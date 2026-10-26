'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { useAuth, RegisterData } from '@/lib/auth-context';
import { maskDocument, isValidDocument } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/dashboard';
  const { register, token, loading } = useAuth();

  const [form, setForm] = useState<RegisterData>({
    name: '',
    email: '',
    document: '',
    password: '',
  });
  const [loadingForm, setLoadingForm] = useState(false);

  // Rota de não autenticados: se já tem sessão, volta para o dashboard.
  useEffect(() => {
    if (!loading && token) router.replace(redirect);
  }, [loading, token, redirect, router]);

  const update = (k: keyof RegisterData, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.document || !form.password) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!isValidDocument(form.document)) {
      toast.error('Informe um CPF ou CNPJ válido.');
      return;
    }

    if (form.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoadingForm(true);

    try {
      await register(form);
      toast.success('Conta criada. Bem-vindo à Daosa!');
      router.push(redirect);
    } catch (err: any) {
      toast.error(err.message || 'Falha no cadastro.');
    } finally {
      setLoadingForm(false);
    }
  };

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Cadastre-se com seu CPF ou CNPJ para começar a usar a Daosa."
      footer={
        <>
          Já tem uma conta?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Seu nome *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Maria Silva"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="document">CPF ou CNPJ *</Label>
          <Input
            id="document"
            value={form.document}
            onChange={(e) => update('document', maskDocument(e.target.value))}
            placeholder="000.000.000-00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha *</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            placeholder="Mínimo de 6 caracteres"
            required
          />
        </div>
        <Button type="submit" className="w-full h-11 bg-primary border-0 shadow-md shadow-primary/25" disabled={loadingForm}>
          {loadingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
