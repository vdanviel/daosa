'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase';

export interface TenantProfile {
  id: number;
  name: string | null;
  email: string | null;
  is_master: boolean;
  org_id: number | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  tenant: TenantProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  tenant: null,
  loading: true,
  signOut: async () => {},
  refreshTenant: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowser();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('tenant')
      .select('id, name, email, is_master, org_id')
      .eq('auth_user_id', uid)
      .maybeSingle();
    setTenant((data as TenantProfile | null) ?? null);
  }, [supabase]);

  const refreshTenant = useCallback(async () => {
    if (user?.id) await loadTenant(user.id);
  }, [user, loadTenant]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user?.id) {
        loadTenant(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user?.id) {
          await loadTenant(sess.user.id);
        } else {
          setTenant(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadTenant]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setTenant(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ session, user, tenant, loading, signOut, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
