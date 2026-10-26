'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Loader2,
  Lock,
  LockOpen,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  SendHorizonal,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

/** Tamanho de página das conversas laterais. */
const PAGE_SIZE = 50;
/** Mensagens liberadas de 10 em 10 conforme o usuário arrasta para cima. */
const MESSAGE_PAGE_SIZE = 10;
/** Agentes por página na tela de escolha. */
const AGENT_PAGE_SIZE = 10;

/**
 * Canal "own" (web chat) criado automaticamente pelo backend com ID 1.
 * Todo envio do painel usa esse canal, já que a conversa nasce aqui dentro.
 */
const WEB_CHANNEL_ID = 1;

/** Hora curta no padrão local (ex.: 14:32). */
const formatTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/** Data por extenso curto para o topo da conversa (ex.: 20/10). */
const formatDay = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

/** Rótulo amigável da conversa na lista lateral. */
const conversationTitle = (conversation: any) =>
  conversation?.external_user_name ||
  conversation?.external_user_id ||
  `Conversa #${conversation?.id}`;

const conversationStatus: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  open: { label: 'Aberta', variant: 'secondary' },
  closed: { label: 'Fechada', variant: 'outline' },
};

interface ChatMessage {
  id: number | string;
  role: string;
  content: string;
  created_at?: string | null;
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

export default function ChatPage() {
  const { user } = useAuth();

  /* ------------------------- ETAPA 1: ESCOLHA DO AGENTE ------------------------- */
  const [agents, setAgents] = useState<any[] | null>(null);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState('');
  /** Termo de busca já aplicado na API (evita um request por tecla). */
  const [appliedSearch, setAppliedSearch] = useState('');
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsTotalPages, setAgentsTotalPages] = useState(1);
  const [agentsTotal, setAgentsTotal] = useState(0);

  /* --------------------------- ETAPA 2: CARD DE CHAT ---------------------------- */
  /** Agente selecionado — null = ainda na escolha. */
  const [agent, setAgent] = useState<any | null>(null);
  const [conversations, setConversations] = useState<any[] | null>(null);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [conversationsTotalPages, setConversationsTotalPages] = useState(1);
  /** `true` enquanto carrega mais uma página de conversas (botão "Carregar mais"). */
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);

  /** Conversa aberta no painel de mensagens (null = conversa nova/não iniciada). */
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  /**
   * Página mais antiga já carregada (o endpoint ordena ASC: página 1 = início
   * da conversa). Enquanto for > 1 ainda existe histórico acima da tela.
   */
  const [oldestLoadedPage, setOldestLoadedPage] = useState(1);
  /** `true` enquanto busca mensagens mais antigas (evita disparos duplicados no scroll). */
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  /** Conversa com toggle (abrir/fechar) em andamento. */
  const [togglingConversationId, setTogglingConversationId] = useState<number | null>(null);
  /** Conversa aguardando confirmação de exclusão (null = diálogo fechado). */
  const [deletingConversationId, setDeletingConversationId] = useState<number | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * No mobile só um painel fica visível por vez (lista OU conversa).
   * No desktop (`lg`) os dois aparecem lado a lado, ignorando o toggle.
   */
  const [showListOnMobile, setShowListOnMobile] = useState(true);

  /** Identifica a conversa dona do carregamento em andamento (evita resposta tardia trocando a tela). */
  const loadingConversationIdRef = useRef<number | string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  /** Container rolável das mensagens — usado para preservar o scroll ao carregar as antigas. */
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  /**
   * Guarda a geometria do container ANTES do prepend, para compensar o
   * crescimento do conteúdo no `useEffect` seguinte e não saltar a leitura.
   */
  const pendingScrollAdjustRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  /**
   * Guard síncrono do lazy load: o estado `loadingOlderMessages` só atualiza no
   * render seguinte, e o `onScroll` dispara várias vezes no mesmo lote.
   */
  const loadingOlderRef = useRef(false);

  /**
   * Envio bloqueado quando o serviço está indisponível:
   * agente arquivado OU conversa ativa já fechada (backend devolve 503).
   * Conversa nova/ausente não bloqueia — ela ainda vai nascer como `open`.
   */
  const agentArchived = agent?.status === 'archived';
  const conversationClosed = !!activeConversation?.id && activeConversation.status === 'closed';
  const sendBlocked = agentArchived || conversationClosed;

  /** Motivo do bloqueio, no mesmo texto do retorno do backend. */
  const blockedReason = agentArchived
    ? 'este agente está arquivado'
    : conversationClosed
      ? 'esta conversa está fechada'
      : null;

  /* ------------------------------- CARGA INICIAL ------------------------------- */

  useEffect(() => {
    if (!user?.id) return;

    api.agent
      .all({ page: agentsPage, size: AGENT_PAGE_SIZE, search: appliedSearch, user_id: user.id })
      .then((res: any) => {
        setAgents(res.data ?? []);
        setAgentsTotalPages(Math.max(1, res.totalPages ?? 1));
        setAgentsTotal(res.total ?? 0);
        setAgentsError(null);
      })
      .catch((err: any) => setAgentsError(err?.message ?? 'Falha ao carregar agentes.'));
  }, [user?.id, agentsPage, appliedSearch]);

  /** Debounce da busca: 350ms sem digitar -> aplica na API e volta pra página 1. */
  useEffect(() => {
    const term = agentSearch.trim();
    const timer = setTimeout(() => {
      setAppliedSearch(term);
      setAgentsPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [agentSearch]);

  /**
   * Depois de cada atualização da lista de mensagens:
   * - normal (troca de conversa / envio): rola para a última mensagem;
   * - com scroll retido (prepend de histórico): mantém a leitura no mesmo ponto.
   */
  useEffect(() => {
    const container = messagesScrollRef.current;

    if (pendingScrollAdjustRef.current && container) {
      const { scrollHeight, scrollTop } = pendingScrollAdjustRef.current;
      pendingScrollAdjustRef.current = null;
      // Conteúdo foi inserido acima: compensa o crescimento para não pular a leitura.
      container.scrollTop = scrollTop + (container.scrollHeight - scrollHeight);
      return;
    }

    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  /* --------------------------------- AÇÕES ----------------------------------- */

  const loadConversations = useCallback(
    (targetAgent: any, page: number, append = false) => {
      if (!append) {
        setConversations(null);
        setConversationsError(null);
      } else {
        setLoadingMoreConversations(true);
      }

      api.agent
        .conversations(targetAgent.id, { page, size: PAGE_SIZE })
        .then((res: any) => {
          const list = res.data ?? [];
          setConversations((prev) => (append && prev ? [...prev, ...list] : list));
          setConversationsPage(page);
          setConversationsTotalPages(Math.max(1, res.totalPages ?? 1));
          setConversationsError(null);
        })
        .catch((err: any) => {
          if (!append) setConversationsError(err?.message ?? 'Falha ao carregar conversas.');
        })
        .finally(() => setLoadingMoreConversations(false));
    },
    []
  );

  /**
   * Carrega as mensagens da conversa começando pela página mais recente
   * (o endpoint ordena ASC, então a última página é a ponta atual do chat).
   * Só as `MESSAGE_PAGE_SIZE` últimas entram — o resto é liberado no scroll.
   */
  const loadMessages = useCallback((conversation: any) => {
    loadingConversationIdRef.current = conversation.id;
    loadingOlderRef.current = false; // troca de conversa: descarta guard em voo
    pendingScrollAdjustRef.current = null;
    setMessages(null);
    setMessagesError(null);
    setSendError(null);
    setLoadingOlderMessages(false);
    setOldestLoadedPage(1); // evita resíduo da conversa anterior em caso de falha

    api.message
      .byConversation(conversation.id, { page: 1, size: 1 })
      .then((first: any) => {
        // O `totalPages` da sondagem é calculado com size=1; aqui precisamos
        // da última página no tamanho real de página (MESSAGE_PAGE_SIZE),
        // senão o offset fica além do total e volta lista vazia.
        const lastPage = Math.max(1, Math.ceil((first?.total ?? 0) / MESSAGE_PAGE_SIZE));
        return api.message
          .byConversation(conversation.id, { page: lastPage, size: MESSAGE_PAGE_SIZE })
          .then(async (res: any) => {
            if (loadingConversationIdRef.current !== conversation.id) return; // conversa já trocada

            const toChatMessages = (rows: any[]): ChatMessage[] =>
              rows.filter((m: any) => ['user', 'assistant'].includes(m?.role));

            let list = toChatMessages(res.data ?? []);
            let oldestPage = lastPage;

            // A última página vem parcial quando o total não é múltiplo de 10;
            // completamos com a anterior para a primeira leva abrir com ≥10.
            if (list.length < MESSAGE_PAGE_SIZE && lastPage > 1) {
              const prev: any = await api.message.byConversation(conversation.id, {
                page: lastPage - 1,
                size: MESSAGE_PAGE_SIZE,
              });
              if (loadingConversationIdRef.current !== conversation.id) return;
              list = [...toChatMessages(prev.data ?? []), ...list];
              oldestPage = lastPage - 1;
            }

            setMessages(list);
            setOldestLoadedPage(oldestPage);
          });
      })
      .catch((err: any) => {
        if (loadingConversationIdRef.current !== conversation.id) return;
        setMessages([]);
        setMessagesError(err?.message ?? 'Falha ao carregar as mensagens.');
      });
  }, []);

  const selectAgent = (nextAgent: any) => {
    setAgent(nextAgent);
    setActiveConversation(null);
    setMessages(null);
    setShowListOnMobile(true);
    loadConversations(nextAgent, 1, false);
  };

  const backToAgents = () => {
    setAgent(null);
    setActiveConversation(null);
    setMessages(null);
    setConversations(null);
    setDraft('');
    setSendError(null);
  };

  const selectConversation = (conversation: any) => {
    setActiveConversation(conversation);
    setShowListOnMobile(false);
    loadMessages(conversation);
  };

  /** Início de conversa limpa: sem conversa ativa, o envio cria um registro novo. */
  const startNewConversation = () => {
    loadingConversationIdRef.current = null;
    setActiveConversation(null);
    setMessages(null);
    setMessagesError(null);
    setSendError(null);
    setShowListOnMobile(false);
  };

  /* ----------------------- AÇÕES DE CONVERSAS (fechar / excluir) ----------------------- */

  /** Abre/fecha a conversa ativa (status `open` ⇄ `closed`). */
  const onToggleConversationStatus = async () => {
    if (!activeConversation?.id) return;

    const id = activeConversation.id;
    const nextStatus = activeConversation.status === 'closed' ? 'open' : 'closed';

    setTogglingConversationId(id);
    try {
      const updated: any = await api.conversation.toggleStatus(id, nextStatus);
      const merged = { ...activeConversation, ...(updated ?? {}), status: nextStatus };
      setActiveConversation(merged);
      setConversations((prev) =>
        (prev ?? []).map((c) => (c.id === id ? { ...c, ...merged } : c))
      );
      toast.success(nextStatus === 'closed' ? 'Conversa fechada.' : 'Conversa reaberta.');
    } catch (err: any) {
      toast.error(
        err instanceof ApiError ? err.message : 'Falha ao alterar o status da conversa.'
      );
    } finally {
      setTogglingConversationId(null);
    }
  };

  /** Confirma a exclusão da conversa (mensagens são removidas junto, no backend). */
  const onDeleteConversationConfirm = async () => {
    if (!deletingConversationId) return;

    setDeleteError(null);
    setDeletingConversation(true);
    try {
      await api.conversation.remove(deletingConversationId);
      const removedId = deletingConversationId;
      setDeletingConversationId(null);

      // Se a conversa apagada era a aberta, volta para o estado inicial.
      if (activeConversation?.id === removedId) {
        loadingConversationIdRef.current = null;
        setActiveConversation(null);
        setMessages(null);
        setMessagesError(null);
        setSendError(null);
        setShowListOnMobile(true);
      }

      if (agent) loadConversations(agent, conversationsPage, false);
      toast.success('Conversa excluída.');
    } catch (err: any) {
      setDeleteError(
        err instanceof ApiError ? err.message : 'Falha ao excluir a conversa.'
      );
    } finally {
      setDeletingConversation(false);
    }
  };

  /** Busca a conversa recém-criada para destacá-la na lista lateral. */
  const refreshConversationsAfterSend = useCallback(
    (conversationId: number) => {
      if (!agent) return;

      api.agent
        .conversations(agent.id, { page: 1, size: PAGE_SIZE })
        .then((res: any) => {
          const list: any[] = res.data ?? [];
          setConversations(list);
          setConversationsPage(1);
          setConversationsTotalPages(Math.max(1, res.totalPages ?? 1));
          setActiveConversation(list.find((c) => c.id === conversationId) ?? { id: conversationId });
        })
        .catch(() => {
          // Lista já estava carregada; seguimos apenas com o ID da conversa.
          setActiveConversation({ id: conversationId });
        });
    },
    [agent]
  );

  const onSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!agent || !text || sending) return;

    // Espelho do guard do backend: não adianta disparar um 503 que já sabemos.
    if (sendBlocked) {
      setSendError('Serviço indisponível.');
      return;
    }

    setSendError(null);
    setSending(true);
    setDraft('');

    // Otimista: entra na tela antes da resposta; se falhar, volta para o rascunho.
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);

    try {
      const body: any = { message: text, channel_id: WEB_CHANNEL_ID };
      if (activeConversation?.id) body.conversation_id = activeConversation.id;

      const res: any = await api.agent.chat(agent.id, body);

      // Resposta oficial do agente (a mensagem do usuário já foi gravada no backend).
      setMessages((prev) => [
        ...(prev ?? []),
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res?.reply ?? '(sem resposta)',
          created_at: new Date().toISOString(),
        },
      ]);

      if (!activeConversation?.id && res?.conversation_id) {
        refreshConversationsAfterSend(res.conversation_id);
      }
    } catch (err: any) {
      setSendError(
        err instanceof ApiError ? err.message : 'Falha ao enviar a mensagem. Tente novamente.'
      );
      // Devolve o texto ao campo para o usuário não perder a mensagem.
      setDraft((prev) => prev || text);
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  /** Ctrl/Cmd + Enter envia; quebra de linha continua sendo Shift + Enter. */
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSend();
    }
  };

  /** Carrega a página imediatamente anterior (10 mensagens mais antigas). */
  const loadOlderMessages = useCallback(() => {
    if (!activeConversation || oldestLoadedPage <= 1 || loadingOlderRef.current) return;
    loadingOlderRef.current = true; // guard síncrono: o estado só atualiza no próximo render

    const conversationId = activeConversation.id;
    const targetPage = oldestLoadedPage - 1;
    const container = messagesScrollRef.current;

    // Captura a geometria antes do prepend para compensar o crescimento.
    if (container) {
      pendingScrollAdjustRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };
    }

    setLoadingOlderMessages(true);
    api.message
      .byConversation(conversationId, { page: targetPage, size: MESSAGE_PAGE_SIZE })
      .then((res: any) => {
        if (loadingConversationIdRef.current !== conversationId) return; // conversa já trocada

        const older: ChatMessage[] = (res.data ?? []).filter((m: any) =>
          ['user', 'assistant'].includes(m?.role)
        );
        setMessages((prev) => [...older, ...(prev ?? [])]);
        setOldestLoadedPage(targetPage);
      })
      .catch((err: any) => {
        pendingScrollAdjustRef.current = null; // nada mudou, não há o que compensar
        if (loadingConversationIdRef.current === conversationId) {
          setMessagesError(err?.message ?? 'Falha ao carregar o histórico.');
        }
      })
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlderMessages(false);
      });
  }, [activeConversation, oldestLoadedPage]);

  /**
   * Lazy load: quando o usuário arrasta até o topo (falta pouco scroll),
   * libera as 10 mensagens mais antigas automaticamente.
   */
  const onMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 80) loadOlderMessages();
  };

  /* --------------------------------- RENDER ---------------------------------- */

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Converse com seus agentes e acompanhe o histórico de cada conversa.
          </p>
        </div>

        {agent && (
          <Button variant="outline" className="rounded-full" onClick={backToAgents}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Trocar agente
          </Button>
        )}
      </div>

      {/* ------------------------- ETAPA 1: ESCOLHA --------------------------- */}
      {!agent && (
        <>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              placeholder="Buscar agente..."
              className="rounded-full pl-9"
              aria-label="Buscar agente"
            />
          </div>

          {agentsError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {agentsError}
            </p>
          )}

          {!agents && !agentsError ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-lg" />
              ))}
            </div>
          ) : agents!.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-12 text-center">
              <Bot className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">
                {appliedSearch ? 'Nenhum agente encontrado para essa busca.' : 'Você ainda não tem agentes.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {appliedSearch ? 'Tente outro termo.' : 'Crie um agente para começar a conversar.'}
              </p>
              {!appliedSearch && (
                <Button className="mt-4 rounded-full" asChild>
                  <Link href="/dashboard/agents/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo agente
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {agents!.map((a) => (
                  <Card
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectAgent(a)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectAgent(a);
                      }
                    }}
                    className="group cursor-pointer border-primary/20 transition-all hover:shadow-md hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start gap-3 p-5">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{a.name}</span>
                          {a.status && (
                            <Badge variant="outline" className="shrink-0 capitalize">
                              {a.status === 'active' ? 'Publicado' : a.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                            </Badge>
                          )}
                        </div>
                        {a.objective && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.objective}</p>
                        )}
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          <MessageCircle className="h-3.5 w-3.5" />
                          Conversar
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Paginação: 10 agentes por página */}
              {agentsTotalPages > 1 && (
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {agentsTotal} agente{agentsTotal === 1 ? '' : 's'} · Página {agentsPage} de {agentsTotalPages}
                  </p>

                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setAgentsPage((p) => Math.max(1, p - 1))}
                          className={agentsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>

                      {paginationRange(agentsPage, agentsTotalPages).map((p, i) =>
                        p === '…' ? (
                          <PaginationItem key={`ellipsis-${i}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === agentsPage}
                              onClick={() => setAgentsPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setAgentsPage((p) => Math.min(agentsTotalPages, p + 1))}
                          className={agentsPage === agentsTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* --------------------------- ETAPA 2: CARD DE CHAT ---------------------- */}
      {agent && (
        <Card className="flex h-[calc(100vh-12rem)] min-h-[520px] flex-col overflow-hidden p-0">
          {/* Cabeçalho do card */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{agent.name}</span>
                {agent.status === 'archived' && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    Arquivado
                  </Badge>
                )}
              </div>
              {agent.objective && (
                <div className="truncate text-xs text-muted-foreground">{agent.objective}</div>
              )}
            </div>

            {/* Ações da conversa ativa */}
            {activeConversation?.id && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={onToggleConversationStatus}
                  disabled={togglingConversationId === activeConversation.id || sending}
                  title={
                    activeConversation.status === 'closed'
                      ? 'Reabrir conversa'
                      : 'Fechar conversa'
                  }
                >
                  {togglingConversationId === activeConversation.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : activeConversation.status === 'closed' ? (
                    <LockOpen className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Lock className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {activeConversation.status === 'closed' ? 'Reabrir' : 'Fechar'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setDeleteError(null);
                    setDeletingConversationId(activeConversation.id);
                  }}
                  disabled={deletingConversation}
                  title="Excluir conversa"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Excluir
                </Button>
              </div>
            )}

            <Button
              variant={activeConversation?.id ? 'outline' : 'default'}
              size="sm"
              className="rounded-full"
              onClick={startNewConversation}
              disabled={sending}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nova conversa
            </Button>
          </div>

          {/* Aviso: serviço indisponível (agente arquivado ou conversa fechada) */}
          {sendBlocked && (
            <div className="flex shrink-0 items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Serviço indisponível — {blockedReason} e não pode receber mensagens.
              {conversationClosed && !agentArchived && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-7 rounded-full text-xs"
                  onClick={onToggleConversationStatus}
                  disabled={togglingConversationId === activeConversation?.id}
                >
                  {togglingConversationId === activeConversation?.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LockOpen className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Reabrir conversa
                </Button>
              )}
            </div>
          )}

          <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* ------------------------- LISTA DE CONVERSAS ------------------- */}
            <aside
              className={cn(
                'min-h-0 flex-col border-border/60 lg:flex lg:border-r',
                showListOnMobile ? 'flex border-b' : 'hidden'
              )}
            >
              <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Conversas
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => loadConversations(agent, 1, false)}
                  title="Atualizar lista"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {conversationsError && (
                <p className="mx-3 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {conversationsError}
                </p>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {!conversations && !conversationsError ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                  </div>
                ) : (conversations ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 px-3 py-8 text-center">
                    <MessageCircle className="mx-auto h-7 w-7 text-muted-foreground/50" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Nenhuma conversa ainda.
                      <br />
                      Envie uma mensagem para começar.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {(conversations ?? []).map((conversation) => {
                      const active = activeConversation?.id === conversation.id;
                      const status =
                        conversationStatus[conversation?.status] ??
                        { label: conversation?.status, variant: 'outline' as const };

                      return (
                        <li key={conversation.id}>
                          <button
                            type="button"
                            onClick={() => selectConversation(conversation)}
                            className={cn(
                              'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                              active
                                ? 'border-primary/40 bg-primary/10'
                                : 'border-transparent hover:border-border/60 hover:bg-primary/5'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {conversationTitle(conversation)}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatDay(conversation?.last_message_at || conversation?.created_at)}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <Badge variant={status.variant} className="shrink-0 text-[10px]">
                                {status.label}
                              </Badge>
                              {conversation?.external_user_id && (
                                <span className="truncate text-[11px] text-muted-foreground">
                                  {conversation.external_user_id}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {conversationsPage < conversationsTotalPages && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-xs"
                    disabled={loadingMoreConversations}
                    onClick={() => loadConversations(agent, conversationsPage + 1, true)}
                  >
                    {loadingMoreConversations && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Carregar mais
                  </Button>
                )}
              </div>
            </aside>

            {/* --------------------------- MENSAGENS -------------------------- */}
            <section
              className={cn(
                'min-h-0 min-w-0 flex-col',
                showListOnMobile ? 'hidden lg:flex' : 'flex'
              )}
            >
              {!activeConversation && !messages ? (
                /* Estado inicial: nenhuma conversa selecionada */
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">Comece uma nova conversa</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Escolha uma conversa ao lado para ver o histórico ou envie a primeira mensagem
                    abaixo.
                  </p>
                </div>
              ) : messages === null ? (
                /* Carregando mensagens */
                <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
                  <div className="flex justify-end">
                    <Skeleton className="h-12 w-2/3 rounded-2xl" />
                  </div>
                  <Skeleton className="h-16 w-1/2 rounded-2xl" />
                  <div className="flex justify-end">
                    <Skeleton className="h-10 w-1/3 rounded-2xl" />
                  </div>
                  <Skeleton className="h-14 w-1/2 rounded-2xl" />
                </div>
              ) : (
                <div
                  ref={messagesScrollRef}
                  onScroll={onMessagesScroll}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
                >
                  {/* Lazy load: ao chegar perto do topo, libera mais 10 antigas */}
                  {loadingOlderMessages && (
                    <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando mensagens anteriores…
                    </div>
                  )}

                  {oldestLoadedPage > 1 && !loadingOlderMessages && (
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full text-xs"
                        onClick={loadOlderMessages}
                      >
                        Carregar mensagens anteriores
                      </Button>
                    </div>
                  )}

                  {messagesError && (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-xs text-destructive">
                      {messagesError}
                    </p>
                  )}

                  {messages.length === 0 && !messagesError && (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <Bot className="h-9 w-9 text-muted-foreground/50" />
                      <p className="mt-3 text-sm font-medium">Sem mensagens ainda</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Envie uma mensagem abaixo e {agent.name} responderá por aqui.
                      </p>
                    </div>
                  )}

                  {messages.map((message) => {
                    const isUser = message.role === 'user';

                    return (
                      <div
                        key={message.id}
                        className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                      >
                        <div className="flex max-w-[85%] items-end gap-2 lg:max-w-[70%]">
                          {!isUser && (
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                              <Bot className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div>
                            <div
                              className={cn(
                                'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                                isUser
                                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                                  : 'rounded-bl-sm bg-muted text-foreground'
                              )}
                            >
                              {message.content}
                            </div>
                            <div
                              className={cn(
                                'mt-1 text-[10px] text-muted-foreground',
                                isUser ? 'text-right' : 'text-left'
                              )}
                            >
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* ------------------------- COMPOSER ------------------------- */}
              <form
                onSubmit={onSend}
                className="shrink-0 border-t border-border/60 bg-background/60 p-3"
              >
                {sendError && (
                  <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {sendError}
                  </p>
                )}

                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder={
                      sendBlocked
                        ? `Serviço indisponível — ${blockedReason}.`
                        : `Conversar com ${agent.name}...`
                    }
                    rows={1}
                    disabled={sendBlocked}
                    className="max-h-32 min-h-[44px] resize-none rounded-xl"
                    aria-label="Mensagem"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    disabled={sending || !draft.trim() || sendBlocked}
                    aria-label="Enviar mensagem"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Enter + Ctrl/⌘ para enviar · Shift + Enter para quebrar linha
                </p>
              </form>
            </section>
          </div>
        </Card>
      )}

      {/* ------------------------- CONFIRMAR EXCLUSÃO -------------------------- */}
      <AlertDialog
        open={deletingConversationId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingConversation) {
            setDeleteError(null);
            setDeletingConversationId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa{' '}
              <span className="font-medium text-foreground">
                {activeConversation?.id === deletingConversationId
                  ? conversationTitle(activeConversation)
                  : `#${deletingConversationId}`}
              </span>{' '}
              e todas as suas mensagens serão excluídas permanentemente. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingConversation}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={onDeleteConversationConfirm}
              disabled={deletingConversation}
            >
              {deletingConversation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
