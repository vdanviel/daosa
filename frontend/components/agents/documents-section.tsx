'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { AgentForm } from '@/lib/agent-form';
import { stashDocs, takeStashedDocs, type AgentDocument } from '@/lib/docs-stash';
import { openDrivePicker } from '@/lib/google-picker';
import { cn } from '@/lib/utils';

/**
 * SEÇÃO "MULTIMÍDIA" DO FORMULÁRIO DE AGENTE
 * -----------------------------------------------------------------------------
 * Dois acessos: ícone do Google (Drive) e upload de arquivo comum.
 *
 * - Sem integração Google: o ícone fica apagado e o clique abre um modal
 *   explicando o que vai acontecer; o botão "Conectar ao Google" manda os dados
 *   já digitados no form para `POST /google/consent-screen` (o backend codifica
 *   esses campos no `state`, ver `googleRouter.js`) e navega para o
 *   consentimento. Os documentos locais são guardados em `stashDocs` para
 *   voltarem intactos quando o OAuth redirecionar de volta.
 * - Com integração: o ícone fica sólido e o clique abre o Google Picker com o
 *   access token de `GET /integration/user/credentials/{id}`.
 *
 * Por enquanto nada é enviado ao backend: os documentos só acumulam aqui.
 */
export function DocumentsSection({
  form,
  returnPath,
}: {
  /** Formulário atual — usado para repor os dados na volta do consentimento. */
  form: AgentForm;
  /** Para onde o backend deve devolver o usuário após o OAuth. */
  returnPath: string;
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Modal explicativo exibido quando ainda não há integração com o Google. */
  const [connectOpen, setConnectOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    // Volta do consentimento: devolve o que foi stashado antes de sair.
    takeStashedDocs().then((stashed) => {
      if (active && stashed.length > 0) setDocs((prev) => mergeDocs(stashed, prev));
    });

    if (user?.id) {
      api.integration
        .credentials(String(user.id), 'google')
        .then((res) => {
          if (!active) return;
          setAccessToken(res?.access || null);
          setGoogleReady(Boolean(res?.access));
        })
        .catch(() => {
          if (active) setGoogleReady(false);
        });
    }

    return () => {
      active = false;
    };
  }, [user?.id]);

  const onGoogleClick = async () => {
    if (busy || googleReady === null) return;
    setError(null);

    // Sem integração: explica a situação antes de sair do SPA.
    if (!googleReady || !accessToken) {
      setConnectOpen(true);
      return;
    }

    // Com integração: abre o seletor nativo do Drive. `busy` cobre só o
    // carregamento do Picker — ele é liberado quando o diálogo aparece, sem
    // depender de como o usuário vai fechar.
    setBusy(true);
    try {
      await openDrivePicker(accessToken, (picked) =>
        setDocs((prev) =>
          mergeDocs(
            prev,
            picked.map((file) => ({
              id: `drive:${file.id}`,
              name: file.name,
              origin: 'drive' as const,
            }))
          )
        )
      );
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : `Falha ao abrir o Google Drive: ${err?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  /** Sai do SPA indo para o consentimento do Google. */
  const onConfirmConnect = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      await stashDocs(docs).catch(() => undefined);
      const { consent_g_link } = await api.google.consentScreen({
        ...resumeData(form),
        return_path: returnPath,
      });
      window.location.href = consent_g_link;
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : `Falha ao conectar com o Google: ${err?.message ?? err}`);
      setBusy(false);
    }
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite escolher o mesmo arquivo de novo

    setDocs((prev) =>
      mergeDocs(
        prev,
        files.map((file) => ({
          id: `upload:${file.name}:${file.size}:${file.lastModified}`,
          name: file.name,
          origin: 'upload' as const,
          size: file.size,
          file,
        }))
      )
    );
  };

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-background/60 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Multimídia:
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoogleClick}
            disabled={busy || googleReady === null}
            title={googleReady ? 'Selecionar do Google Drive' : 'Conectar Google Drive'}
            aria-label={googleReady ? 'Selecionar do Google Drive' : 'Conectar Google Drive'}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              googleReady
                ? 'border-border/60 bg-background hover:border-primary/50'
                // Apagado enquanto não há integração.
                : 'border-border/40 opacity-40 hover:opacity-70'
            )}
          >
            <GoogleIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Enviar arquivo"
            aria-label="Enviar arquivo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFilesSelected}
            aria-label="Selecionar arquivos"
          />

          {googleReady === null && (
            <span className="text-[11px] text-muted-foreground">Verificando integração Google…</span>
          )}
        </div>

        {error && !connectOpen && <p className="mt-2 text-xs text-destructive">{error}</p>}

        {docs.length === 0 ? (
          !error && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Nenhum arquivo ainda — ele fica só nesta sessão do formulário.
            </p>
          )
        ) : (
          <ul className="mt-2 space-y-1">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2 py-1.5"
              >
                <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{doc.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {doc.origin === 'drive' ? 'Drive' : 'Upload'}
                  {typeof doc.size === 'number' && ` · ${formatBytes(doc.size)}`}
                </span>
                <button
                  type="button"
                  onClick={() => setDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                  title="Remover"
                  aria-label={`Remover ${doc.name}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Aviso prévio quando a conta Google ainda não está conectada.
          z-[60] garante que o modal do Google fique acima do modal de edição. */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="z-[60] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GoogleIcon className="h-5 w-5" />
              Conectar ao Google
            </DialogTitle>
            <DialogDescription>Sua conta Google ainda não está conectada.</DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Ao continuar, o Google abre a tela de consentimento pedindo acesso ao seu Drive. Depois de
            autorizar, você volta para este formulário com tudo o que já preencheu.
          </p>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConnectOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirmConnect} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conectar ao Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Corpo enviado ao consentimento: só o que já foi digitado, mais o caminho de volta. */
function resumeData(form: AgentForm) {
  const body: Record<string, string> = {};
  const put = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) body[key] = trimmed;
  };

  put('agent_name', form.name);
  put('agent_objective', form.objective);
  put('agent_description', form.description);
  put('agent_temp', form.temp);
  put('agent_top_p', form.topP);
  put('agent_token_limit', form.numPredict);

  return body;
}

/** Acumula documentos sem repetir id (mesmo arquivo do Drive ou mesmo upload). */
function mergeDocs(current: AgentDocument[], incoming: AgentDocument[]): AgentDocument[] {
  const known = new Set(current.map((doc) => doc.id));
  return [...current, ...incoming.filter((doc) => !known.has(doc.id))];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "G" multicolorido do Google (lucide-react não traz a marca). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
