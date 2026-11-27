'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { api, ApiError, type IntegrationRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { launchWhatsappSignup } from '@/lib/meta-signup';
import { toast } from 'sonner';

interface ProviderMeta {
  id: string;
  name: string;
  image: string;
  explanation: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'google',
    name: 'Google Drive',
    image: '/images/google-drive.png',
    explanation:
      'Conecte sua conta do Google Drive para acessar arquivos e pastas direto da plataforma. Permite anexar documentos aos agentes.',
  },
  {
    id: 'discord',
    name: 'Discord',
    image: '/images/discord.png',
    explanation:
      'Conecte seu servidor do Discord para usar o bot pela aplicação. Mantém a comunicação da do agente como um bot no Discord.',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    image: '/images/whatsapp.png',
    explanation:
      'Conecte o WhatsApp Business para atendimento por mensagens.',
  },
];

/** Provedores que já possuem fluxo de conexão implementado no backend. */
const CONNECTABLE = new Set(['google', 'whatsapp', 'discord']);

export default function NewIntegrationPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  /** Provider cujo fluxo de conexão está em aberto (ex.: popup do WhatsApp). */
  const [busy, setBusy] = useState<string | null>(null);
  /** IDs dos cards colapsíveis abertos. */
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const connectedByProvider = useMemo(() => {
    const map = new Map<string, IntegrationRecord>();
    (integrations ?? []).forEach((it) => map.set(it.provider, it));
    return map;
  }, [integrations]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const ints = await api.integration.all();
      setIntegrations(ints ?? []);
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Inicia o fluxo de conexão do provedor escolhido. */
  const onSelect = async (provider: string) => {
    if (busy !== null && busy !== provider) return;
    if (!CONNECTABLE.has(provider)) {
      toast(`Conexão com ${provider} não está disponível por aqui.`);
      return;
    }

    const already = connectedByProvider.get(provider);
    if (already?.status === 'active') {
      toast(`${provider} já está conectado.`);
      return;
    }

    setBusy(provider);
    try {
      const returnPath = '/dashboard/integrations';
      switch (provider) {
        case 'google': {
          const { g_consent_link } = await api.google.consentScreen({ return_path: returnPath });
          window.location.href = g_consent_link;
          break;
        }
        case 'discord': {
          const { d_consent_link } = await api.discord.connect({ return_path: returnPath });
          window.location.href = d_consent_link;
          break;
        }
        case 'whatsapp': {
          // 1. Prepara a conexão no backend e obtém o código de uso único.
          const { connect_code } = await api.whatsapp.connect();

          // 2. Abre o popup do Embedded Signup dentro do gesto do usuário.
          const assets = await launchWhatsappSignup();
          if (!assets) {
            toast('Conexão com o WhatsApp foi cancelada.');
            return;
          }

          // 3. Troca o code + assets pelo backend para ativar a integração.
          await api.whatsapp.callback({ connect_code, ...assets });

          toast('WhatsApp conectado.');
          window.location.href = returnPath;
          break;
        }
      }
    } catch (err: any) {
      toast(err instanceof ApiError ? err.message : `Falha ao conectar com ${provider}.`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/integrations"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para integrações
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Criar integração</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha qual provedor você quer conectar à sua operação.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
            const connected = connectedByProvider.get(provider.id);
            const isActive = connected?.status === 'active';
            const isOpen = openIds.has(provider.id);
            const disabled = busy !== null && busy !== provider.id;

          return (
            <Card
              key={provider.id}
              className={cn(
                'border-border/60 hover:border-primary/30 transition-colors',
                isActive ? 'border-primary/20' : ''
              )}
            >
              <Collapsible
                open={isOpen}
                onOpenChange={(open) =>
                  setOpenIds((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(provider.id);
                    else next.delete(provider.id);
                    return next;
                  })
                }
              >
                <CollapsibleTrigger
                  className={'flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-foreground bg-transparent border-none outline-none'}
                >
                  <Image
                    src={provider.image}
                    alt={provider.name}
                    width={30}
                    height={30}
                    priority
                  />
                  <span>{provider.name}</span>
                  <ChevronDown
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 pt-4">
                   {isActive ? (
                     <p className="text-sm text-muted-foreground">
                       Esta integração já está ativa.
                     </p>
                   ) : (
                     <>
                       <p className="text-sm text-muted-foreground leading-relaxed">
                         {provider.explanation}
                       </p>
                       <div className="mt-5">
                         <Button
                           size="sm"
                           disabled={disabled}
                           onClick={() => onSelect(provider.id)}
                         >
                           Conectar
                         </Button>
                       </div>
                     </>
                   )}
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
