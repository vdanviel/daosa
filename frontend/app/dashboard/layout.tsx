'use client';

import { RequireAuth } from '@/components/auth/require-auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <DashboardShell>{children}</DashboardShell>
    </RequireAuth>
  );
}
