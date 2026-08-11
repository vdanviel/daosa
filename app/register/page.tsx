'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AuthShell } from '@/components/auth/auth-shell';
import { getSupabaseBrowser } from '@/lib/supabase';
import { maskCnpj, maskPhone } from '@/lib/utils';


export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/dashboard';
  const supabase = getSupabaseBrowser();

  const [form, setForm] = useState({
    company_name: '',
    cnpj: '',
    email: '',
    phone: '',
    name: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.password || !form.company_name || !form.name) {
      toast.error('Please fill all required fields.');
      return;
    }

    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {

      // 1. Create the auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        phone: form.phone,
        options: { data: { name: form.name, company_name: form.company_name } },
      });

      if (authErr) throw authErr;

      const uid = authData.user?.id;
      if (!uid) throw new Error('Sign-up failed: no user id returned.');

      // 2. Create org + master tenant via a server route using service role.

      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: uid,
          company_name: form.company_name,
          cnpj: form.cnpj || null,
          email: form.email,
          password: form.password,
          phone: form.phone || null,
          name: form.name,
        }),
      });

      const body = await res.json();

      if (!res.ok) throw new Error(body?.error || 'Failed to provision tenant.');

      toast.success('Account created. Welcome to Daosa!');
      router.push(redirect);
    } catch (err: any) {
      toast.error(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your organization"
      subtitle="You'll become the master tenant of a new org."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="company_name">Company name *</Label>
          <Input
            id="company_name"
            value={form.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            placeholder="Acme Inc."
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={form.cnpj}
              onChange={(e) => update('cnpj', maskCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => update('phone', maskPhone(e.target.value))}
              placeholder="+55 11 99999-9999"
            />
          </div>
        </div>
        <div className="h-px bg-border my-2" />
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Jane Doe"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@acme.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            placeholder="At least 6 characters"
            required
          />
        </div>
        <Button type="submit" className="w-full h-11 bg-primary border-0 shadow-md shadow-primary/25" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
