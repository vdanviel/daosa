'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { LogOut, Settings, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/lib/auth-context';

function getInitials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const menuItem =
  'flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors';

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  /** Popover controlado: fecha ao navegar para o perfil. */
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center" aria-label="Daosa — ir para o dashboard">
          <Image
            src="/images/daosa-logo.png"
            alt="Daosa"
            width={100}
            priority
          />
        </Link>

        {/* Ícone de perfil -> popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              aria-label="Menu do perfil"
              className="h-10 w-10 rounded-full p-0 hover:bg-primary/10"
            >
              <Avatar className="h-9 w-9 border border-primary/40">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 space-y-2 p-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/dashboard/profile');
              }}
              className={`${menuItem} border-primary/30 bg-background hover:bg-primary hover:text-primary-foreground`}
            >
              <User className="h-4 w-4" />
              Perfil
            </button>
            <button
              type="button"
              onClick={() => toast('Recurso em breve', { description: 'As configurações chegam em uma próxima etapa.' })}
              className={`${menuItem} border-primary/30 bg-background hover:bg-primary hover:text-primary-foreground`}
            >
              <Settings className="h-4 w-4" />
              Configurações
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={`${menuItem} border-destructive/40 bg-background text-destructive hover:bg-destructive hover:text-destructive-foreground`}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
