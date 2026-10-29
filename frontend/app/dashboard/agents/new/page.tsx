'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { ChannelPicker } from '@/components/agents/channel-picker';
import { DocumentsSection } from '@/components/agents/documents-section';
import { type AgentDocument } from '@/lib/docs-stash';
import {
  AGENT_LIMITS,
  type AgentForm,
  agentFormPayload,
  emptyAgentForm,
  validateAgentForm,
} from '@/lib/agent-form';

export default function NewAgentPage() {
  const router = useRouter();
  const [form, setForm] = useState<AgentForm>(emptyAgentForm);
  const [saving, setSaving] = useState(false);
  /** Documentos staged (com `File`) aguardando o submit — enviados ao criar o agente. */
  const [stagedDocs, setStagedDocs] = useState<AgentDocument[]>([]);
  /** Falha do cadastro, exibida logo abaixo do formulário. */
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof AgentForm, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const searchParams = useSearchParams();

  // Volta do consentimento Google: o backend devolve os dados digitados na query.
  useEffect(() => {
    if (searchParams.get('agent_name') === null) return;

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
    router.replace('/dashboard/agents/new');
  }, [searchParams, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    const validation = validateAgentForm(form, { requireChannel: true });
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    try {
      const created: any = await api.agent.register(agentFormPayload(form));
      // Envia os documentos staged para indexação RAG no agente recém-criado.
      const newAgentId = created?.id;
      const files = stagedDocs
        .filter((doc) => doc.origin === 'upload' && doc.file)
        .map((doc) => doc.file as File);
      if (newAgentId && files.length > 0) {
        await api.agent.uploadKnowledge(newAgentId, files);
      }
      // Sem aviso de sucesso: volta para a lista, onde o novo agente já aparece.
      router.push('/dashboard/agents');
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : `Falha ao criar o agente: ${err?.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para agentes
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Novo agente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina o papel do agente, o objetivo e como o modelo deve responder.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Nome *</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Ex.: Agente de onboarding"
                maxLength={AGENT_LIMITS.name}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-objective">Objetivo *</Label>
              <Input
                id="agent-objective"
                value={form.objective}
                onChange={(e) => update('objective', e.target.value)}
                placeholder="Ex.: Onboarding de novos clientes"
                maxLength={AGENT_LIMITS.objective}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-description">Descrição</Label>
              <Textarea
                id="agent-description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Contexto adicional, tom de voz e limites do agente."
                maxLength={AGENT_LIMITS.description}
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                {form.description.length}/{AGENT_LIMITS.description} caracteres
              </p>
            </div>

            <ChannelPicker value={form.channelId} onChange={(id) => update('channelId', id)} />

            <DocumentsSection form={form} returnPath="/dashboard/agents/new" onStagedChange={setStagedDocs} />

            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Configuração do modelo
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-temp" className="text-xs">
                    Temperatura
                  </Label>
                  <Input
                    id="agent-temp"
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={form.temp}
                    onChange={(e) => update('temp', e.target.value)}
                    placeholder="0.7"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-top-p" className="text-xs">
                    Top P
                  </Label>
                  <Input
                    id="agent-top-p"
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={form.topP}
                    onChange={(e) => update('topP', e.target.value)}
                    placeholder="0.9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-num-predict" className="text-xs">
                    Limite de tokens
                  </Label>
                  <Input
                    id="agent-num-predict"
                    type="number"
                    step="1"
                    min={1}
                    value={form.numPredict}
                    onChange={(e) => update('numPredict', e.target.value)}
                    placeholder="300"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Deixe em branco para usar os padrões.
              </p>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/agents')} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar agente
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
