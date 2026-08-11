'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Plus, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { tenant, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const nav = [
    { href: '/dashboard', label: 'Connections', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/new', label: 'New bot', icon: Plus },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-border/60 bg-card hidden md:flex flex-col shadow-sm">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 h-16 border-b border-border/60">
          <Image src="/images/daosa-icon.png" alt="Daosa" width={30} height={30} className="object-contain" />
          <span
            className="font-black tracking-widest uppercase text-base"
            style={{ color: 'hsl(255, 78%, 20%)' }}
          >
            Daosa
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'nav-active'
                    : 'text-muted-foreground hover:bg-primary/8 hover:text-primary'
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-primary/5">
            <div className="h-9 w-9 rounded-full bg-gradient-brand text-white grid place-items-center shrink-0 shadow-sm">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{tenant?.name || 'Loading…'}</div>
              <div className="text-xs text-muted-foreground truncate">
                {loading ? '' : tenant?.is_master ? 'Master tenant' : 'Tenant'}
              </div>
            </div>
            {tenant?.is_master && (
              <Badge className="text-xs bg-primary/15 text-primary border-primary/25 hover:bg-primary/15">
                master
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="md:pl-64">
        {/* Mobile header */}
        <div className="md:hidden h-14 border-b border-border/60 bg-card flex items-center px-4 sticky top-0 z-30 gap-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/images/daosa-icon.png" alt="Daosa" width={26} height={26} className="object-contain" />
            <span className="font-black tracking-widest uppercase text-sm" style={{ color: 'hsl(255, 78%, 20%)' }}>
              Daosa
            </span>
          </Link>
        </div>
        <div className="p-6 md:p-10 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
