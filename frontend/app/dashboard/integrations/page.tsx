'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Webhook,
  Bot,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiError, type IntegrationRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * STATUS DA INTEGRAÇÃO GOOGLE
 * -----------------------------------------------------------------------------
 * `GET /integration/user/:id/all` devolve as integrações sem segredos. O status
 * da linha Google manda no botão:
 *
 *   active     → "Conectado"      (nenhuma ação: o access token é renovado sob demanda)
 *   processing → "Conectando…"    (consentimento aberto e ainda não completado)
 *   expired    → "Reconectar"     (refresh token venceu/revogado → refaz o consent screen)
 *   error/revoked → "Conectar"    (começa tudo de novo)
 *   (nenhuma)  → "Conectar"
 *
 * O POST /google/consent-screen é o mesmo nos dois casos: o backend decide se
 * atualiza a linha existente ou cria uma nova.
 */
type GoogleStatus = 'loading' | 'none' | 'active' | 'processing' | 'expired' | 'error';

const GOOGLE_PROVIDER = 'google';

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [google, setGoogle] = useState<GoogleStatus>('loading');
  const [googleLabel, setGoogleLabel] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGoogle = useCallback(async () => {
    if (!user?.id) return;

    try {
      const rows: IntegrationRecord[] = await api.integration.all(String(user.id));
      const row = rows.find((r) => r.provider === GOOGLE_PROVIDER);

      setGoogleLabel(row?.label ?? null);
      setGoogle((row?.status as GoogleStatus) || 'none');
    } catch {
      setGoogle('none');
    }
  }, [user?.id]);

  useEffect(() => {
    loadGoogle();
  }, [loadGoogle]);

  /** Sai do SPA para o consentimento — conecta ou reconecta, o backend resolve. */
  const onGoogleAction = async () => {
    if (connecting) return;
    setError(null);
    setConnecting(true);

    try {
      const { g_consent_link } = await api.google.consentScreen({
        return_path: '/dashboard/integrations',
      });
      window.location.href = g_consent_link;
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : `Falha ao conectar com o Google: ${err?.message ?? err}`);
      setConnecting(false);
    }
  };

  /** Revalida o status (ex.: voltou do consentimento em outra aba). */
  const onRecheck = () => {
    setError(null);
    setGoogle('loading');
    loadGoogle();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte canais de comunicação, fontes de conhecimento e ferramentas aos seus agentes.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="border-primary/20">
        <CardContent className="space-y-3 p-5">
          <GoogleDriveRow
            status={google}
            label={googleLabel}
            connecting={connecting}
            onAction={onGoogleAction}
            onRecheck={onRecheck}
          />

          {soonIntegrations.map((it) => (
            <div
              key={it.name}
              className="flex items-center gap-4 rounded-full border border-primary/30 bg-background/60 px-5 py-3 transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <it.icon className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{it.name}</div>
                <div className="truncate text-xs text-muted-foreground">{it.desc}</div>
              </div>
              <Badge variant="secondary">Em breve</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Linha do Google Drive — a única com status real hoje. */
function GoogleDriveRow({
  status,
  label,
  connecting,
  onAction,
  onRecheck,
}: {
  status: GoogleStatus;
  label: string | null;
  connecting: boolean;
  onAction: () => void;
  onRecheck: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-full border border-primary/30 bg-background/60 px-5 py-3 transition-colors hover:border-primary/60 hover:bg-primary/5">
      <FolderOpen className="h-5 w-5 shrink-0 text-primary" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">Google Drive</div>
        <div className="truncate text-xs text-muted-foreground">
          {status === 'active'
            ? (label ?? 'Documentos e arquivos da empresa')
            : status === 'processing'
              ? 'Aguardando autorização no Google…'
              : status === 'expired'
                ? 'A conexão expirou — autorize novamente para continuar'
                : 'Documentos e arquivos da empresa'}
        </div>
      </div>

      {status === 'loading' ? (
        <Badge variant="secondary">Verificando…</Badge>
      ) : status === 'active' ? (
        <Badge className="bg-green-500/15 text-green-600 dark:text-green-400">Conectado</Badge>
      ) : status === 'processing' ? (
        <Badge variant="secondary">Conectando…</Badge>
      ) : status === 'expired' ? (
        <>
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <Button size="sm" onClick={onAction} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reconectar
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={onAction} disabled={connecting}>
          {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Conectar
        </Button>
      )}

      {/* Volta do consentimento em outra aba: confere de novo sem recarregar a página. */}
      {status === 'processing' && (
        <button
          type="button"
          onClick={onRecheck}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Já autorizei
        </button>
      )}
    </div>
  );
}

const soonIntegrations = [
  { icon: Phone, name: 'WhatsApp', desc: 'Canal de atendimento externo' },
  { icon: Send, name: 'Telegram', desc: 'Canal de atendimento externo' },
  { icon: MessageCircle, name: 'Discord', desc: 'Comunidade e suporte' },
  { icon: Webhook, name: 'MCP', desc: 'Servidores de ferramentas autorizados' },
  { icon: Bot, name: 'API própria', desc: 'Acesso programático com chaves e escopos' },
];
