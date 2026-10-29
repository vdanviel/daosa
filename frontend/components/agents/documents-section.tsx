'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
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
  onStagedChange,
  uploadLimits,
  sources,
  onDeleteSource,
}: {
  /** Formulário atual — usado para repor os dados na volta do consentimento. */
  form: AgentForm;
  /** Para onde o backend deve devolver o usuário após o OAuth. */
  returnPath: string;
  onStagedChange?: Dispatch<SetStateAction<AgentDocument[]>>;
  uploadLimits?: { maxFiles?: number; maxFileSizeMB?: number; allowedTypes?: string[]; allowedExtensions?: string[] };
  sources?: any[];
  onDeleteSource?: (id: number) => void;
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  useEffect(() => {
    onStagedChange?.(docs);
  }, [docs, onStagedChange]);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Modal explicativo exibido quando ainda não há integração com o Google. */
  const [connectOpen, setConnectOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);
  const [sourceDetail, setSourceDetail] = useState<any>(null);
  const [deletingSource, setDeletingSource] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
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
      await openDrivePicker(accessToken, async (picked) => {
        const downloaded = await Promise.all(
          picked.map(async (file) => {
            try {
              const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                { headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'follow' }
              );
              if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                console.error('Drive fetch error', res.status, errBody.slice(0, 200));
                throw new Error(`Drive fetch failed: ${res.status}`);
              }
              const blob = await res.blob();
              const fileObj = new File([blob], file.name, {
                type: file.mimeType || blob.type || 'application/octet-stream',
              });
              return { id: `drive:${file.id}`, name: file.name, origin: 'drive' as const, file: fileObj };
            } catch {
              return { id: `drive:${file.id}`, name: file.name, origin: 'drive' as const };
            }
          })
        );
        setDocs((prev) => mergeDocs(prev, downloaded));
      });
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
      const { g_consent_link: consent_g_link } = await api.google.consentScreen({
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
      <div className="rounded-2xl border border-border/60 bg-background shadow-sm p-5 space-y-5">
        {/* Cabeçalho da seção com hierarquia forte */}
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Multimídia</h3>
          {uploadLimits && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Máximo <strong className="text-foreground">{uploadLimits.maxFileSizeMB ?? 20} MB</strong> por arquivo · limite de <strong className="text-foreground">{uploadLimits.maxFiles ?? 10}</strong> arquivos
            </p>
          )}
        </div>

        {/* Zona de upload — sutil, com borda tracejada e fundo primário muito leve */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative w-full rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.04] px-6 py-7 text-center transition-all hover:border-primary/40 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'group'
          )}
          aria-label="Enviar arquivo"
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
            <Upload aria-hidden="true" className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Arraste arquivos ou clique para enviar</p>
          <p className="mt-1 text-xs text-muted-foreground">{uploadLimits?.allowedTypes?.join(', ') ?? 'PDF, TXT, MD, DOC, PPT, CSV, JSON'}</p>

          {/* Botões de ação integrados à zona */}
          <div className="mt-4 flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onGoogleClick}
              disabled={busy || googleReady === null}
              title={googleReady ? 'Selecionar do Google Drive' : 'Conectar Google Drive'}
              aria-label={googleReady ? 'Selecionar do Google Drive' : 'Conectar Google Drive'}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                googleReady
                  ? 'border-border/60 bg-background shadow-sm hover:border-primary/50 hover:shadow'
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background shadow-sm transition-colors hover:border-primary/50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>

          {googleReady === null && (
            <span className="mt-2 block text-[11px] text-muted-foreground">Verificando integração Google…</span>
          )}
        </button>

        {error && !connectOpen && <p className="text-xs text-destructive">{error}</p>}

        <div className="mt-3">
          {/* Arquivos a enviar — sem título */}
          {docs.length === 0 ? (
            !error && (
              <p className="text-xs text-muted-foreground">Nenhum arquivo carregado até o momento.</p>
            )
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background shadow-sm px-3 py-2.5 transition hover:shadow"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText aria-hidden="true" className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="text-[11px] text-muted-foreground">{doc.origin === 'drive' ? 'Drive' : 'Upload'}{typeof doc.size === 'number' ? ` · ${formatBytes(doc.size)}` : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                    title="Remover"
                    aria-label={`Remover ${doc.name}`}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {sources && sources.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Enviados</h4>
              <ul className="space-y-2">
                {sources.map((s: any) => {
                  const rawStatus = String(s.status ?? '').toLowerCase();
                  const statusMap: Record<string, string> = {
                    pending: 'Pendente', processing: 'Processando', completed: 'Processado', processed: 'Processado', failed: 'Falha',
                  };
                  const statusLabel = statusMap[rawStatus] || s.status || 'Desconhecido';
                  const isCompleted = rawStatus === 'completed' || rawStatus === 'processed';
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background shadow-sm px-3 py-2.5 transition hover:shadow">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const detail = await api.source.byId(s.id);
                            setSourceDetail(detail);
                            setSourceDetailOpen(true);
                          } catch {
                            setSourceDetail({ id: s.id, ...s });
                            setSourceDetailOpen(true);
                          }
                        }}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-left hover:underline"
                      >
                        {s.file_name || s.name || `Source ${s.id}`}
                      </button>
                      <span className={cn(
                        'shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                        isCompleted ? 'bg-emerald-100 text-emerald-700' :
                        s.status === 'failed' || rawStatus === 'failed' ? 'bg-red-100 text-red-700' :
                        s.status === 'processing' || rawStatus === 'processing' ? 'bg-amber-100 text-amber-700' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {statusLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>


      {/* Aviso prévio quando a conta Google ainda não está conectada.
          z-[60] garante que o modal do Google fique acima do modal de edição. */}
      {isMobile && connectOpen ? (
        createPortal(
          <div className="fixed inset-0 z-[60] bg-background md:hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Conectar ao Google</h2>
              <button
                type="button"
                onClick={() => setConnectOpen(false)}
                className="h-8 w-8 rounded-md border p-0 hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Sua conta Google ainda não está conectada.
              </p>
              <p className="text-sm text-muted-foreground">
                Ao continuar, o Google abre a tela de consentimento pedindo acesso ao seu Drive. Depois de autorizar, você volta para este formulário com tudo o que já preencheu.
              </p>
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setConnectOpen(false)} disabled={busy} className="flex-1">
                  Cancelar
                </Button>
                <Button type="button" onClick={onConfirmConnect} disabled={busy} className="flex-1">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Conectar
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
      ) : (
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
      )}

      {/* Modal de detalhes da source */}
      <Dialog open={sourceDetailOpen} onOpenChange={setSourceDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do arquivo</DialogTitle>
            <DialogDescription>
              {sourceDetail?.file_name || sourceDetail?.name || 'Source'}
            </DialogDescription>
          </DialogHeader>
          {sourceDetail && (
            <div className="space-y-2 text-sm">
              <div><strong>ID:</strong> {sourceDetail.id}</div>
              <div><strong>Agente:</strong> {sourceDetail.agent_id}</div>
              <div><strong>Arquivo:</strong> {sourceDetail.file_name || sourceDetail.name}</div>
              <div><strong>Tamanho do Arquivo (MB):</strong> {(Number(sourceDetail.file_size) / 1024 ** 2).toFixed(2)}</div>
              <div><strong>Status:</strong> {sourceDetail.status || 'N/A'}</div>
              <div><strong>Chunks:</strong> {sourceDetail.chunks?.length ?? 'N/A'}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceDetailOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!sourceDetail?.id || !onDeleteSource) return;
                setDeletingSource(true);
                try {
                  await api.source.delete(sourceDetail.id);
                  onDeleteSource(sourceDetail.id);
                  setSourceDetailOpen(false);
                } catch {
                  // erro silencioso
                } finally {
                  setDeletingSource(false);
                }
              }}
              disabled={deletingSource}
            >
              {deletingSource ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
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