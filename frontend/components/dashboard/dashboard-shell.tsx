'use client';

import { ReactNode } from 'react';
import { DashboardHeader } from './dashboard-header';
import { DashboardSidebar } from './dashboard-sidebar';

/**
 * Layout padrão do dashboard:
 * header fixo no topo e, abaixo, menu lateral recolhível (desktop)
 * ou navegação horizontal compacta (mobile) com o conteúdo ao lado.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex w-full flex-col lg:flex-row">
        <DashboardSidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
