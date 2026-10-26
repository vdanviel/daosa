'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, LayoutDashboard, MessageCircle, PanelLeftClose, PanelLeftOpen, Plug, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircle },
  { href: '/dashboard/agents', label: 'Agentes', icon: Bot },
  { href: '/dashboard/integrations', label: 'Integrações', icon: Plug }
];

/**
 * Menu de navegação do dashboard:
 * - Desktop: menu lateral recolhível (só ícones quando recolhido).
 * - Mobile: pílulas horizontais compactas no topo do conteúdo.
 */
export function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile */}
      <nav className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:hidden" aria-label="Navegação principal">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                active
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop */}
      <aside className="hidden shrink-0 lg:block">
        <div
          className={cn(
            'sticky top-16 flex h-[calc(100vh-4rem)] flex-col border-r border-border/60 bg-card p-3 transition-[width] duration-300 ease-out',
            collapsed ? 'w-[76px]' : 'w-64'
          )}
        >
          <div
            className={cn(
              'px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70',
              collapsed && 'sr-only'
            )}
          >
            Menu
          </div>

          <nav className="flex flex-col gap-1" aria-label="Navegação principal">
            {navItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              className={cn(
                'flex h-9 w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary',
                collapsed && 'justify-center px-0'
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Recolher menu</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
