'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowRight,
  Bot,
  Cloud,
  Database,
  FolderOpen,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { providerRegistry } from '@/lib/providers/registry';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionRow {
  id: number;
  stream_type: string | null;
  is_active: boolean;
  created_at: string;
}

const streamIcons: Record<string, any> = {
  discord: MessageCircle,
  daosa: Bot,
};

export default function DashboardPage() {
  const { tenant } = useAuth();
  const supabase = getSupabaseBrowser();
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null);
  const [drives, setDrives] = useState<number>(0);

  const load = async () => {
    if (!tenant) return;
    const { data, error } = await supabase
      .from('stream_connection')
      .select('id, stream_type, is_active, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      setConnections([]);
      return;
    }
    setConnections((data as ConnectionRow[]) || []);

    const { count } = await supabase
      .from('drive_auth')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id);
    setDrives(count || 0);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const onDelete = async (id: number) => {
    if (!confirm('Delete this connection and all its config?')) return;
    const { error } = await supabase.from('stream_connection').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Connection deleted.');
      load();
    }
  };

  if (connections === null) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const empty = connections.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
          <p className="text-muted-foreground mt-1">
            Manage your conversation streams and data sources.
          </p>
        </div>
        {tenant?.is_master && !empty && (
          <Button asChild className="bg-gradient-brand hover:opacity-90 transition-opacity border-0 shadow-md shadow-primary/25">
            <Link href="/dashboard/new">
              <Plus className="h-4 w-4 mr-2" />
              Add new connection
            </Link>
          </Button>
        )}
      </div>

      {empty ? (
        <Card className="border-dashed bg-gradient-to-b from-background to-primary/5">
          <CardContent className="p-10 sm:p-14 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              <Bot className="h-7 w-7" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">Configure your first bot</h2>
            <p className="mt-2 text-muted-foreground max-w-md mx-auto">
              You don&apos;t have any active stream connections yet. Set up a new bot to start
              chatting with Daosa.
            </p>
            {tenant?.is_master ? (
              <Button asChild size="lg" className="mt-6 h-12 px-8 bg-gradient-brand hover:opacity-90 transition-opacity border-0 shadow-lg shadow-primary/30">
                <Link href="/dashboard/new">
                  Configure new bot
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                Ask a master tenant to configure a bot for your organization.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((c) => {
            const provider = c.stream_type ? providerRegistry.get('stream', c.stream_type) : undefined;
            const Icon = provider?.icon ? streamIcons[provider.id] ?? MessageCircle : MessageCircle;
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      {provider?.label || c.stream_type || 'Stream'}
                      <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-xs">
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {provider?.description || 'Conversation channel'} · created{' '}
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/connections/${c.id}`}>
                        Open
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {tenant?.is_master && (
                      <Button size="icon" variant="ghost" onClick={() => onDelete(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{connections.length}</div>
              <div className="text-sm text-muted-foreground">Stream connections</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{drives}</div>
              <div className="text-sm text-muted-foreground">Data sources</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{tenant?.is_master ? 'Master' : 'Member'}</div>
              <div className="text-sm text-muted-foreground">Your role</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
