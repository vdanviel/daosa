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
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/dashboard';
  const { login, token, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingForm, setLoadingForm] = useState(false);

  // Rota de não autenticados: se já tem sessão, volta para o dashboard.
  useEffect(() => {
    if (!loading && token) router.replace(redirect);
  }, [loading, token, redirect, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);
    try {
      await login(email, password);
      router.push(redirect);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao entrar.');
    } finally {
      setLoadingForm(false);
    }
  };

  return (
    <AuthShell
      title="Entrar na Daosa"
      subtitle="Acesse seu painel de integração e converse com seu agente."
      footer={
        <>
          Ainda não tem uma conta?{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <Button type="submit" className="w-full h-11 bg-primary border-0" disabled={loadingForm}>
          {loadingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}