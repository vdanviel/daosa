'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError, type Channel } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { launchWhatsappSignup } from '@/lib/meta-signup';
import { cn } from '@/lib/utils';

/**
 * CARD "CANAIS:" — seleção única de canal do agente.
 *
 * Carrega os canais de `GET /channel/all` e os exibe como tags (ícone +
 * nome). A tag selecionada é o `channel_id` enviado no register/update.
 *
 * Os canais `whatsapp` e `discord` são especiais: só são selecionáveis com a
 * integração correspondente conectada (`GET /integration/user/:id?provider=...`).
 * Sem integração, o clique abre um modal explicativo. Para WhatsApp usa-se o
 * Embedded Signup (popup); para Discord usa-se o fluxo OAuth2 padrão (redirect).
 */
export function ChannelPicker({
  value,
  onChange,
  returnPath,
  resumeData,
  initialChannel,
}: {
  /** `channel_id` selecionado (`''` = nenhum). */
  value: string;
  onChange: (channelId: string) => void;
  /** Caminho de retorno usado no fluxo OAuth do Discord (padrão: URL atual). */
  returnPath?: string;
  /** Dados de texto do agente digitados antes de conectar o Discord (repostos no callback). */
  resumeData?: Record<string, string>;
  /** Canal a pré-selecionar ao voltar do Discord (ex.: 'discord'). */
  initialChannel?: string;
}) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Canais cujo `icon_url` falhou ao carregar — caem no ícone padrão. */
  const [brokenIcons, setBrokenIcons] = useState<number[]>([]);
  /** Integração Meta do usuário; `loading` ainda não sabe se está conectada. */
  const [whatsapp, setWhatsapp] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  /** Integração Discord do usuário. */
  const [discord, setDiscord] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  /** Modal explicativo exibido quando ainda não há integração (WhatsApp ou Discord). */
  const [connectOpen, setConnectOpen] = useState(false);
  /** Qual provider o modal está a tratar: 'whatsapp' | 'discord'. */
  const [connectProvider, setConnectProvider] = useState<'whatsapp' | 'discord' | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  /** `connect_code` de uso único — só existe para WhatsApp depois que o modal prepara. */
  const [connectCode, setConnectCode] = useState<string | null>(null);
  /** Incrementa para o modal preparar um `connect_code` novo (WhatsApp). */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    api.channel
      .all()
      .then((list) => {
        if (!active) return;
        // Remove possíveis linhas duplicadas do banco (mesmo `id` repetido),
        // que faziam cada tag de canal aparecer várias vezes na tela.
        const unique = Array.from(
          new Map((Array.isArray(list) ? list : []).map((channel) => [String(channel.id), channel])).values()
        );
        setChannels(unique);
        setError(null);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar os canais.');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    api.integration
      .byProvider('whatsapp')
      .then((row) => {
        if (active) setWhatsapp(row?.status === 'active' ? 'connected' : 'disconnected');
      })
      .catch(() => {
        if (active) setWhatsapp('disconnected');
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    api.integration
      .byProvider('discord')
      .then((row) => {
        if (active) setDiscord(row?.status === 'active' ? 'connected' : 'disconnected');
      })
      .catch(() => {
        if (active) setDiscord('disconnected');
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  // Volta do consentimento do Discord: já deixa o canal Discord selecionado,
  // só quando o usuário não escolheu outro canal ainda.
  useEffect(() => {
    if (!initialChannel || initialChannel !== 'discord') return;
    if (value) return; // já tem canal selecionado, não sobrescreve
    if (!channels) return;
    const discordChannel = channels.find((channel) => channel.type === 'discord');
    if (discordChannel) onChange(String(discordChannel.id));
  }, [initialChannel, channels, value]);

  // Prepara a conexão WhatsApp assim que o modal abre para esse provider:
  // o `FB.login` precisa disparar no clique do "Conectar", sem `await` antes.
  useEffect(() => {
    if (connectProvider !== 'whatsapp' || !connectOpen) return;
    let active = true;

    setConnectCode(null);
    setBusy(true);

    api.whatsapp
      .connect()
      .then(({ connect_code }) => {
        if (active) setConnectCode(connect_code);
      })
      .catch((err: any) => {
        if (active) {
          setConnectError(
            err instanceof ApiError ? err.message : 'Não foi possível preparar a conexão. Feche e tente novamente.'
          );
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [connectOpen, connectProvider, attempt]);

  const onChannelClick = (channel: Channel) => {
    // Canais que não exigem integração especial: seleciona direto.
    if (channel.type !== 'whatsapp' && channel.type !== 'discord') {
      onChange(String(channel.id));
      return;
    }

    const isConnected = channel.type === 'whatsapp' ? whatsapp === 'connected' : discord === 'connected';
    const isLoading = channel.type === 'whatsapp' ? whatsapp === 'loading' : discord === 'loading';

    if (isConnected) {
      onChange(String(channel.id));
      return;
    }

    // Ainda carregando a integração: não dá para decidir, espera responder.
    if (isLoading) return;

    // Não conectado: abre o modal explicativo para o provider correspondente.
    setConnectError(null);
    setConnectProvider(channel.type);
    setConnectOpen(true);
  };

  const onConfirmConnect = async () => {
    if (!connectProvider || busy) return;

    // WhatsApp: usa o connect_code + popup Embedded Signup.
    if (connectProvider === 'whatsapp') {
      if (!connectCode) return;

      setBusy(true);
      setConnectError(null);

      try {
        const assets = await launchWhatsappSignup();

        // Cliente fechou o popup: fecha sem selecionar nada.
        if (!assets) {
          setConnectOpen(false);
          return;
        }

        await api.whatsapp.callback({ connect_code: connectCode, ...assets });

        setWhatsapp('connected');
        setConnectOpen(false);
        setConnectProvider(null);

        const whatsappChannel = channels?.find((channel) => channel.type === 'whatsapp');
        if (whatsappChannel) onChange(String(whatsappChannel.id));
      } catch (err) {
        // O code da Meta é de uso único: descarta e prepara outro para a próxima.
        setConnectCode(null);
        setConnectError(
          err instanceof ApiError ? err.message : (err as Error)?.message || 'Falha ao conectar com o Facebook.'
        );
        setAttempt((current) => current + 1);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Discord: chama o backend para obter o link de consentimento e redireciona.
    if (connectProvider === 'discord') {
      setBusy(true);
      setConnectError(null);

      try {
        // O return_path preserva a página atual para o backend redirecionar de volta.
        // Os dados de texto do agente vão junto para o backend devolvê-los no callback.
        const finalReturnPath = returnPath ?? (window.location.pathname + window.location.search);
        const { d_consent_link } = await api.discord.connect({ ...resumeData, return_path: finalReturnPath });
        if (d_consent_link) {
          window.location.href = d_consent_link;
        } else {
          throw new Error('Link de consentimento não retornado pelo backend.');
        }
      } catch (err) {
        setConnectError(
          err instanceof ApiError ? err.message : (err as Error)?.message || 'Falha ao iniciar conexão com Discord.'
        );
      } finally {
        setBusy(false);
      }
      return;
    }
  };

  const ConnectDialog = () => {
    const isWhatsApp = connectProvider === 'whatsapp';
    const title = isWhatsApp ? 'Conectar ao WhatsApp Business' : 'Conectar ao Discord';
    const body = isWhatsApp
      ? 'Sua conta ainda não está conectada ao Facebook Business.'
      : 'Sua conta ainda não está conectada ao Discord.';
    const hint = isWhatsApp
      ? 'Ao continuar, um popup do Facebook abre para entrar na conta, escolher ou criar a conta do WhatsApp Business e aceitar as permissões.'
      : 'Ao continuar, você será redirecionado para o Discord para autorizar o bot.';
    const label = isWhatsApp ? 'Conectar ao Facebook' : 'Conectar ao Discord';

    return (
      <Dialog
        open={connectOpen}
        onOpenChange={(open) => { if (!open) setConnectProvider(null); setConnectOpen(open); }}
      >
        {/* z-[60] para o aviso ficar por cima do modal de edição do agente. */}
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{body}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{hint}</p>
          {connectError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive text-center">
              {connectError}
            </p>
          )}
          <DialogFooter className="flex items-center flex-row justify-center pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setConnectOpen(false); setConnectProvider(null); }}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={onConfirmConnect}
              disabled={busy || (isWhatsApp && !connectCode)}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-background/60 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Canais:
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : !channels ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-36 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        ) : channels.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum canal disponível.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => {
              const selected = String(channel.id) === value;
              // Registro anterior à coluna `icon_url` guarda o ícone dentro de `config`.
              const icon = brokenIcons.includes(channel.id)
                ? null
                : channel.icon_url || channel.config?.icon_url || null;
              // Apaga a logo enquanto a conta não está conectada.
              const faded =
                (channel.type === 'whatsapp' && whatsapp === 'disconnected') ||
                (channel.type === 'discord' && discord === 'disconnected');

              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onChannelClick(channel)}
                  aria-pressed={selected}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary bg-secondary font-medium text-secondary-foreground'
                      : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  {icon ? (
                    <img
                      src={channelIconSrc(icon)}
                      alt=""
                      aria-hidden="true"
                      className={cn('h-4 w-4 shrink-0 object-contain', faded && 'opacity-40')}
                      onError={() => setBrokenIcons((prev) => [...prev, channel.id])}
                    />
                  ) : (
                    <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="max-w-40 truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {connectOpen && <ConnectDialog />}
    </>
  );
}

/**
 * `icon_url` relativo (ex.: `/public/images/...`) é estático do backend e não
 * existe no SPA — passa pelo proxy `/api` para não responder 404.
 */
function channelIconSrc(iconUrl: string) {
  return iconUrl.startsWith('/') ? `/api${iconUrl}` : iconUrl;
}
