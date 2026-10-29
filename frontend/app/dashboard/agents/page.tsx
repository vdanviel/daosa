'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, Bot, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { ChannelPicker } from '@/components/agents/channel-picker';
import { DocumentsSection } from '@/components/agents/documents-section';
import {
  type AgentForm,
  agentFormPayload,
  emptyAgentForm,
  validateAgentForm,
} from '@/lib/agent-form';
import { type AgentDocument } from '@/lib/docs-stash';

const PAGE_SIZE = 10;

const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Publicado', variant: 'default' },
  draft: { label: 'Rascunho', variant: 'secondary' },
  archived: { label: 'Arquivado', variant: 'outline' },
};

/** Monta o formulário a partir do agente, tolerando `model_config` como string JSON. */
const formFromAgent = (agent: any): AgentForm => {
  let config: any = agent?.model_config ?? null;

  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = null;
    }
  }

  const options = config?.options ?? {};

  return {
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    objective: agent?.objective ?? '',
    channelId: agent?.channel_id != null ? String(agent.channel_id) : '',
    temp: String(options.temperature ?? ''),
    topP: String(options.top_p ?? ''),
    numPredict: String(options.num_predict ?? ''),
  };
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** Documentos staged (com `File`) aguardando o submit — enviados no update. */
  const [stagedDocs, setStagedDocs] = useState<AgentDocument[]>([]);

  /** Agente aberto no diálogo de edição (null = fechado). */
  const [editing, setEditing] = useState<any | null>(null);
  /** Evita aplicar o fetch de detalhe de um modal que já foi fechado. */
  const editingIdRef = useRef<number | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyAgentForm);
  const [saving, setSaving] = useState(false);
  /** Mensagem de falha exibida logo abaixo do formulário do modal. */
  const [formError, setFormError] = useState<string | null>(null);
  /** Falha da última ação do card (arquivar/deletar), exibida sob os botões. */
  const [cardError, setCardError] = useState<{ id: number; message: string } | null>(null);
  /** Falha da confirmação de exclusão, exibida dentro do diálogo. */
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** ID do agente com toggle de arquivamento em andamento. */
  const [togglingId, setTogglingId] = useState<number | null>(null);
  /** ID do agente aguardando confirmação de exclusão. */
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isMobileEditFormOpen, setIsMobileEditFormOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [uploadLimits, setUploadLimits] = useState<any>(null);
  const [agentSources, setAgentSources] = useState<any[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    api.source.limits()
      .then((data: any) => setUploadLimits(data))
      .catch(() => {
        setUploadLimits({
          maxFiles: 10,
          maxFileSizeMB: 20,
          allowedTypes: ['PDF', 'TXT', 'MD', 'DOC', 'DOCX', 'PPT', 'PPTX', 'CSV', 'JSON'],
        });
      });
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Volta do consentimento Google na edição: o backend devolve
  // `/dashboard/agents?edit=<id>&agent_*=...` — reabre o modal e repõe o form.
  useEffect(() => {
    const idParam = searchParams.get('edit');
    if (!idParam) return;

    const clearUrl = () => router.replace('/dashboard/agents');
    const id = Number(idParam);
    if (!Number.isInteger(id)) {
      clearUrl();
      return;
    }

    let active = true;
    api.agent
      .byId(id)
      .then((full: any) => {
        if (!active) return;
        openEdit(full);

        // O que o usuário digitou antes de ir pro Google é mais recente que o banco.
        if (searchParams.get('agent_name') !== null) {
          const get = (key: string) => searchParams.get(key) ?? '';
          setForm((f) => ({
            ...f,
            name: get('agent_name'),
            objective: get('agent_objective') || f.objective,
            description: get('agent_description') || f.description,
            temp: get('agent_temp') || f.temp,
            topP: get('agent_top_p') || f.topP,
            numPredict: get('agent_token_limit') || f.numPredict,
          }));
        }
      })
      .catch(() => {
        // Agente inexistente/sem acesso: só limpa a URL.
      })
      .finally(() => {
        if (active) clearUrl();
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = useCallback((targetPage: number) => {
    api.agent
      .all({ page: targetPage, size: PAGE_SIZE })
      .then((res: any) => {
        const list = res.data ?? [];
        const pages = Math.max(1, res.totalPages ?? 1);

        // Se a página atual ficou vazia (ex.: deletou o último item), volta uma.
        if (list.length === 0 && targetPage > pages) {
          setPage(pages);
          return;
        }

        setAgents(list);
        setTotalPages(pages);
        setTotal(res.total ?? list.length);
        setError(null);
      })
      .catch((err: any) => setError(err.message ?? 'Falha ao carregar agentes.'));
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const openEdit = (agent: any) => {
    setFormError(null);
    setStagedDocs([]);
    setForm(formFromAgent(agent));
    setEditing(agent);

    // A listagem pode vir sem model_config completo: busca o registro atualizado.
    if (!agent?.model_config) {
      editingIdRef.current = agent.id;
      api.agent
        .byId(agent.id)
        .then((full: any) => {
          if (editingIdRef.current !== agent.id) return; // modal já foi fechado
          setForm(formFromAgent(full));
          setEditing(full);
          setAgents((prev) => (prev ?? []).map((a) => (a.id === full.id ? { ...a, ...full } : a)));
        })
        .catch(() => {
          // Mantém o formulário com o que a listagem trouxe.
        });
    }

    // Em dispositivos móveis, abrir o formulário como sobreposição (sem modal)
    if (isMobile) {
      setIsMobileEditFormOpen(true);
    }

    // Busca fontes de conhecimento do agente
    if (agent?.id) {
      api.source.knowledge(agent.id)
        .then((list: any) => setAgentSources(list?.data ?? list ?? []))
        .catch(() => setAgentSources([]));
    }
  };

  const closeEdit = () => {
    editingIdRef.current = null;
    setFormError(null);
    setEditing(null);
    setIsMobileEditFormOpen(false);
    setStagedDocs([]);
    setAgentSources([]);
  };

  const onEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    setFormError(null);
    setSaving(true);
    try {
      const validation = validateAgentForm(form);
      if (validation) {
        setFormError(validation);
        return;
      }

      const updated = await api.agent.update(editing.id, agentFormPayload(form));
      setAgents((prev) => (prev ?? []).map((a) => (a.id === editing.id ? { ...a, ...(updated as any) } : a)));

      // Envia os documentos staged (upload local) para indexação RAG no agente.
      const files = stagedDocs
        .filter((doc) => doc.file)
        .map((doc) => doc.file as File);
      if (files.length > 0) {
        await api.agent.uploadKnowledge(editing.id, files);
      }

      setStagedDocs([]);
      closeEdit();
    } catch (err: any) {
      let msg = err instanceof ApiError ? err.message : `Falha ao salvar o agente: ${err?.message ?? err}`;
      if (msg.toLowerCase().includes('file too large') || msg.toLowerCase().includes('multer')) {
        const limit = uploadLimits?.maxFileSizeMB ?? 20;
        msg = `O arquivo é muito grande. O limite de tamanho é ${limit}MB. Se necessário, comprima ou divida o arquivo.`;
      } else if (msg.toLowerCase().includes('unsupported') || msg.toLowerCase().includes('file type')) {
        msg = `Tipo de arquivo não aceito. Extensões permitidas: ${uploadLimits?.allowedTypes?.join(', ') ?? 'PDF, TXT, MD, DOC, DOCX, PPT, PPTX, CSV, JSON'}.`;
      }
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  /** Toggle de arquivamento: arquivado ⇄ publicado. */
  const onToggleArchive = async (agent: any) => {
    const nextStatus = agent.status === 'archived' ? 'active' : 'archived';

    setCardError(null);
    setTogglingId(agent.id);
    try {
      const updated = await api.agent.toggleStatus(agent.id, nextStatus);
      setAgents((prev) => (prev ?? []).map((a) => (a.id === agent.id ? { ...a, ...(updated as any) } : a)));
    } catch (err: any) {
      setCardError({
        id: agent.id,
        message: err instanceof ApiError ? err.message : 'Falha ao alterar o status do agente.',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const onDeleteConfirm = async () => {
    if (!deletingId) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      await api.agent.remove(deletingId);
      setDeletingId(null);
      load(page);
    } catch (err: any) {
      setDeleteError(err instanceof ApiError ? err.message : 'Falha ao deletar o agente.');
    } finally {
      setDeleting(false);
    }
  };

  // Componente de sobreposição móvel para o formulário de edição
  const MobileEditOverlay = () => {
    if (!isMobile || !isMobileEditFormOpen || !editing) return null;

    return createPortal(
      <div className="fixed inset-0 z-[60] bg-background md:hidden">
        <div className="h-full w-full overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Editar agente</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeEdit}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name-mobile">Nome *</Label>
              <Input
                id="agent-name-mobile"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Agente de onboarding"
                maxLength={30}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-objective-mobile">Objetivo *</Label>
              <Input
                id="agent-objective-mobile"
                value={form.objective}
                onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                placeholder="Descreva o papel do agente e o que ele deve fazer."
                maxLength={30}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-description-mobile">Descrição</Label>
              <Textarea
                id="agent-description-mobile"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Contexto adicional detalhado."
                maxLength={150}
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.description.length}/150 caracteres
              </p>
            </div>

            <ChannelPicker value={form.channelId} onChange={(id) => setForm((f) => ({ ...f, channelId: id }))} />

            <DocumentsSection form={form} returnPath={`/dashboard/agents?edit=${editing?.id ?? ''}`} onStagedChange={setStagedDocs} uploadLimits={uploadLimits} sources={agentSources} onDeleteSource={(id) => setAgentSources((prev) => prev.filter((s: any) => s.id !== id))} />

            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Configuração do modelo
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-temp-mobile" className="text-xs">Temperatura</Label>
                  <Input
                    id="agent-temp-mobile"
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={form.temp}
                    onChange={(e) => setForm((f) => ({ ...f, temp: e.target.value }))}
                    placeholder="0.7"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-top-p-mobile" className="text-xs">Top P</Label>
                  <Input
                    id="agent-top-p-mobile"
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={form.topP}
                    onChange={(e) => setForm((f) => ({ ...f, topP: e.target.value }))}
                    placeholder="0.9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-num-predict-mobile" className="text-xs">Limite de tokens</Label>
                  <Input
                    id="agent-num-predict-mobile"
                    type="number"
                    step="1"
                    min={1}
                    value={form.numPredict}
                    onChange={(e) => setForm((f) => ({ ...f, numPredict: e.target.value }))}
                    placeholder="300"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Deixe em branco para manter o valor atual.
              </p>
            </div>

            {formError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={closeEdit}
                disabled={saving}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                onClick={onEditSubmit}
                disabled={saving}
                className="flex-1"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie e gerencie os agentes especializados da sua empresa.
          </p>
        </div>
        <Button className="rounded-full" asChild>
          <Link href="/dashboard/agents/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo agente
          </Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!agents && !error ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {(agents ?? []).map((agent) => {
              const status = statusLabel[agent.status] ?? { label: agent.status, variant: 'outline' as const };
              const archived = agent.status === 'archived';

              return (
                <Card
                  key={agent.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(agent)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(agent);
                    }
                  }}
                  className="group cursor-pointer border-primary/20 transition-all hover:shadow-md hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{agent.name}</span>
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                          <div className="text-xs text-muted-foreground">ID {agent.id}</div>
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {agent.objective && (
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{agent.objective}</p>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={archived}
                          disabled={togglingId === agent.id}
                          onCheckedChange={() => onToggleArchive(agent)}
                          aria-label={archived ? 'Desarquivar agente' : 'Arquivar agente'}
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          {togglingId === agent.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : archived ? (
                            <span className="inline-flex items-center gap-1">
                              <ArchiveRestore className="h-3.5 w-3.5" />
                              Arquivado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Archive className="h-3.5 w-3.5" />
                              Arquivar
                            </span>
                          )}
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setDeletingId(agent.id);
                        }}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Deletar
                      </Button>
                    </div>

                    {cardError !== null && cardError.id === agent.id && (
                      <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {cardError.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {(agents ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground md:col-span-2">
                Nenhum agente criado ainda. Clique em “Novo agente” para começar.
              </p>
            )}
          </div>

          {total > 0 && (
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {total} agente{total === 1 ? '' : 's'} · Página {page} de {totalPages}
              </p>

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {paginationRange(page, totalPages).map((p, i) =>
                      p === '…' ? (
                        <PaginationItem key={`ellipsis-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </>
      )}

      {/* ------------------------------ EDIÇÃO MÓVEL ------------------------------ */}
      <MobileEditOverlay />

      {/* ------------------------------ EDIÇÃO -------------------------------- */}
      <Dialog open={!!editing && !isMobile} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar agente</DialogTitle>
            <DialogDescription>
              Ajuste as informações do agente <span className="font-medium text-foreground">ID {editing?.id}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Nome *</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Agente de onboarding"
                maxLength={30}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-objective">Objetivo *</Label>
              <Input
                id="agent-objective"
                value={form.objective}
                onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                placeholder="Descreva o papel do agente e o que ele deve fazer."
                maxLength={30}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-description">Descrição</Label>
              <Textarea
                id="agent-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Contexto adicional detalhado."
                maxLength={150}
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.description.length}/150 caracteres
              </p>
            </div>

            <ChannelPicker value={form.channelId} onChange={(id) => setForm((f) => ({ ...f, channelId: id }))} />

            <DocumentsSection form={form} returnPath={`/dashboard/agents?edit=${editing?.id ?? ''}`} onStagedChange={setStagedDocs} uploadLimits={uploadLimits} sources={agentSources} onDeleteSource={(id) => setAgentSources((prev) => prev.filter((s: any) => s.id !== id))} />

            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Configuração do modelo
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-temp" className="text-xs">Temperatura</Label>
                  <Input
                    id="agent-temp"
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={form.temp}
                    onChange={(e) => setForm((f) => ({ ...f, temp: e.target.value }))}
                    placeholder="0.7"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-top-p" className="text-xs">Top P</Label>
                  <Input
                    id="agent-top-p"
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={form.topP}
                    onChange={(e) => setForm((f) => ({ ...f, topP: e.target.value }))}
                    placeholder="0.9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-num-predict" className="text-xs">Limite de tokens</Label>
                  <Input
                    id="agent-num-predict"
                    type="number"
                    step="1"
                    min={1}
                    value={form.numPredict}
                    onChange={(e) => setForm((f) => ({ ...f, numPredict: e.target.value }))}
                    placeholder="300"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Deixe em branco para manter o valor atual.
              </p>
            </div>

            {formError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEdit} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------------------- CONFIRMAR DELETE ------------------------- */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteError(null);
            setDeletingId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar agente?</AlertDialogTitle>
            <AlertDialogDescription>
              O agente <span className="font-medium text-foreground">ID {deletingId}</span> será deletado
              permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={onDeleteConfirm} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deletar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Janela de páginas numeradas: mantém atual ± 1, com reticências nas pontas. */
function paginationRange(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const range: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) range.push('…');
    range.push(p);
  });
  return range;
}
