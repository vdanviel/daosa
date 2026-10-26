'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Bot,
  FolderOpen,
  Globe,
  Inbox,
  MessageCircle,
  Pencil,
  Phone,
  Plug,
  Send,
  Users,
  Webhook,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type DashboardStats } from '@/lib/api';

const integrations = [
  { icon: FolderOpen, name: 'Google Drive', desc: 'Documentos e arquivos da empresa' },
  { icon: Phone, name: 'WhatsApp', desc: 'Canal de atendimento externo' },
  { icon: Send, name: 'Telegram', desc: 'Canal de atendimento externo' },
  { icon: MessageCircle, name: 'Discord', desc: 'Comunidade e suporte' },
  { icon: Webhook, name: 'MCP', desc: 'Servidores de ferramentas autorizados' },
  { icon: Bot, name: 'API própria', desc: 'Acesso programático com chaves e escopos' },
];

const agentStatus: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Publicado', variant: 'default' },
  draft: { label: 'Rascunho', variant: 'secondary' },
  archived: { label: 'Arquivado', variant: 'outline' },
};

/**
 * Backend de clientes ainda não liberado — valores fixos por enquanto.
 * Trocar por `api.user.all(...)` assim que o endpoint sair.
 */
const clientStats = { total: 0, abertas: 0, clientes: 0 };

/** Card de KPI: valor à esquerda, ícone em destaque à direita. */
function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none tracking-tight tabular-nums">{value}</div>
        <div className="mt-1.5 truncate text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/** Métrica compacta: rótulo com ícone no topo, valor em destaque abaixo. */
function MiniStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Uma chamada só — antes eram 2 + N (uma requisição por conversa). */
  useEffect(() => {
    api.user
      .dashboard()
      .then((res) => {
        setStats(res);
        setError(null);
      })
      .catch((err: any) => setError(err?.message ?? 'Falha ao carregar a visão geral.'));
  }, []);

  const agentStats = stats?.agents ?? { total: 0, active: 0, draft: 0, archived: 0 };
  const conversationStats = stats?.conversations ?? { total: 0, open: 0, closed: 0 };
  const messagesTotal = stats?.messages.total ?? 0;
  const agentsByAgent = stats?.by_agent ?? [];

  const loading = !stats;

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe o desempenho dos seus agentes, conversas e integrações.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* INDICADORES PRINCIPAIS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)
        ) : (
          <>
            <Stat icon={Bot} label="Agentes" value={agentStats.total} />
            <Stat icon={MessageCircle} label="Conversas" value={conversationStats.total} />
            <Stat icon={Inbox} label="Conversas abertas" value={conversationStats.open} />
            <Stat icon={Send} label="Mensagens" value={messagesTotal} />
          </>
        )}
      </div>

      {/* AGENTES + CLIENTES */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Agentes</CardTitle>
            <CardDescription>Status de publicação e atividade de conversas por agente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[64px] rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat icon={Globe} label="Publicados" value={agentStats.active} />
                  <MiniStat icon={Pencil} label="Rascunho" value={agentStats.draft} />
                  <MiniStat icon={Archive} label="Arquivados" value={agentStats.archived} />
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Conversas por agente
                  </div>
                  {agentsByAgent.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center">
                      <Bot className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">Nenhum agente criado ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Só os 3 primeiros — o restante fica na tela de agentes. */}
                      {agentsByAgent.slice(0, 3).map((agent) => {
                        const status = agentStatus[agent.status] ?? {
                          label: agent.status,
                          variant: 'outline' as const,
                        };
                        return (
                          <div
                            key={agent.id}
                            className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                          >
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">{agent.name}</span>
                                <Badge variant={status.variant} className="shrink-0">
                                  {status.label}
                                </Badge>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {agent.conversations} conversas · {agent.open_conversations} abertas · {agent.messages} mensagens
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {agentsByAgent.length > 3 && (
                        <Link
                          href="/dashboard/agents"
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          Ver todos os agentes
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Clientes</CardTitle>
              <Badge variant="secondary">Em breve</Badge>
            </div>
            <CardDescription>Conversas e clientes da sua base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat icon={MessageCircle} label="Conversas" value={clientStats.total} />
              <MiniStat icon={Inbox} label="Abertas" value={clientStats.abertas} />
              <MiniStat icon={Users} label="Clientes" value={clientStats.clientes} />
            </div>
            <p className="rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-xs text-muted-foreground">
              Dados de clientes em breve — backend em preparação.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* INTEGRAÇÕES */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Integrações</CardTitle>
          <CardDescription>Canais e ferramentas disponíveis para conectar à sua operação.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.map((it) => (
              <div
                key={it.name}
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/10"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <it.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{it.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{it.desc}</div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Em breve
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
