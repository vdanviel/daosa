'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, CalendarDays, Clock, Loader2, Save, Shield, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { isValidDocument, maskDocument } from '@/lib/utils';

function getInitials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const statusMeta: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'border-primary/40 bg-primary/10 text-primary' },
  invited: { label: 'Convidada', className: 'border-amber-500/40 bg-amber-500/10 text-amber-600' },
  suspended: { label: 'Suspensa', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
  disabled: { label: 'Desativada', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  /** Guarda os valores originais para habilitar o botão só quando houver alteração. */
  const [initial, setInitial] = useState({ name: '', document: '' });
  const [saving, setSaving] = useState(false);

  /**
   * Preenche o formulário uma única vez quando o usuário carrega.
   * Depois disso não sobrescreve — senão um `refreshUser()` apagaria o que
   * a pessoa acabou de digitar.
   */
  useEffect(() => {
    if (!user) return;
    const nextName = user.name ?? '';
    const nextDocument = maskDocument(user.document ?? '');
    setInitial({ name: nextName, document: nextDocument });
    setName(nextName);
    setDocument(nextDocument);
  }, [user?.id]);

  const dirty = name !== initial.name || document !== initial.document;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Preencha o nome.');
      return;
    }
    if (document.trim() && !isValidDocument(document)) {
      toast.error('Informe um CPF ou CNPJ válido, ou deixe o campo vazio.');
      return;
    }

    setSaving(true);
    try {
      await api.user.update({ name: name.trim(), document: document.trim() });
      await refreshUser();
      setInitial({ name: name.trim(), document: document.trim() });
      toast.success('Perfil atualizado com sucesso.');
    } catch (err: any) {
      toast.error(err instanceof ApiError ? err.message : `Falha ao salvar: ${err?.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const status = statusMeta[user.status] ?? { label: user.status ?? '—', className: 'border-border/60' };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja seus dados de conta e mantenha suas informações atualizadas.
        </p>
      </div>

      {/* ------------------------- RESUMO DA CONTA ------------------------- */}
      <Card className="border-primary/20">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <Avatar className="h-16 w-16 border border-primary/40">
            <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg font-semibold">{user.name || 'Sem nome'}</span>
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* --------------------------- DADOS --------------------------- */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" />
            Dados pessoais
          </CardTitle>
          <CardDescription>
            O e-mail não é editável por aqui — ele é confirmado por código enviado ao próprio endereço.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={255}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="document">CPF ou CNPJ</Label>
                <Input
                  id="document"
                  value={document}
                  onChange={(e) => setDocument(maskDocument(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">Pode ficar vazio.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={user.email ?? ''} readOnly disabled className="cursor-not-allowed" />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !dirty}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* --------------------------- CONTA --------------------------- */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Sobre a conta
          </CardTitle>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3.5">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Membro desde</dt>
                <dd className="truncate text-sm font-medium">{formatDate(user.created_at)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Último acesso</dt>
                <dd className="truncate text-sm font-medium">{formatDateTime(user.last_login_at)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3.5">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Identificador</dt>
                <dd className="truncate font-mono text-sm font-medium">{user.id}</dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
