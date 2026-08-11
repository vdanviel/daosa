'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bot,
  Cloud,
  Database,
  FolderOpen,
  Loader2,
  MessageCircle,
  Power,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { providerRegistry } from '@/lib/providers/registry';
import { ChatWidget } from '@/components/dashboard/chat-widget';
import { format } from 'date-fns';

const iconMap: Record<string, any> = {
  MessageCircle,
  Bot,
  FolderOpen,
  Cloud,
  Database,
};

interface EavRow { key: string | null; value: string | null; }
interface DriveRow { id: number; drive_type: string | null; created_at: string; eav: EavRow[]; }

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant } = useAuth();
  const supabase = getSupabaseBrowser();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<any>(null);
  const [streamEav, setStreamEav] = useState<EavRow[]>([]);
  const [drives, setDrives] = useState<DriveRow[]>([]);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data: s, error: sErr } = await supabase
      .from('stream_connection')
      .select('id, tenant_id, stream_type, is_active, created_at')
      .eq('id', id)
      .maybeSingle();
    if (sErr) toast.error(sErr.message);
    if (!s) {
      toast.error('Connection not found.');
      router.replace('/dashboard');
      return;
    }
    setStream(s);

    const { data: sEav } = await supabase
      .from('eav_config')
      .select('key, value')
      .eq('stream', s.id);
    setStreamEav((sEav as EavRow[]) || []);

    const { data: dRows } = await supabase
      .from('drive_auth')
      .select('id, drive_type, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    const drives: DriveRow[] = [];
    for (const d of (dRows as any[]) || []) {
      const { data: dEav } = await supabase
        .from('eav_config')
        .select('key, value')
        .eq('drive', d.id);
      drives.push({ id: d.id, drive_type: d.drive_type, created_at: d.created_at, eav: (dEav as EavRow[]) || [] });
    }
    setDrives(drives);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, id]);

  const toggleActive = async () => {
    if (!stream) return;
    const { error } = await supabase
      .from('stream_connection')
      .update({ is_active: !stream.is_active })
      .eq('id', stream.id);
    if (error) toast.error(error.message);
    else {
      toast.success(stream.is_active ? 'Deactivated.' : 'Activated.');
      load();
    }
  };

  const onDelete = async () => {
    if (!confirm('Delete this connection and all its config?')) return;
    const { error } = await supabase.from('stream_connection').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted.');
      router.push('/dashboard');
    }
  };

  if (loading || !stream) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const provider = stream.stream_type ? providerRegistry.get('stream', stream.stream_type) : undefined;
  const StreamIcon = provider ? iconMap[provider.icon] ?? MessageCircle : MessageCircle;

  const maskedValue = (key: string, v: string | null) => {
    if (v == null) return '';
    if (key.includes('token') || key.includes('secret') || key.includes('password') || key.includes('connection_string')) {
      return v.slice(0, 4) + '••••••' + (v.length > 12 ? v.slice(-2) : '');
    }
    return v;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            {provider?.label || stream.stream_type || 'Connection'}
            <Badge variant={stream.is_active ? 'default' : 'secondary'}>
              {stream.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Created {format(new Date(stream.created_at), 'MMM d, yyyy HH:mm')}
          </p>
        </div>
        {tenant?.is_master && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleActive}>
              <Power className="h-4 w-4 mr-1.5" />
              {stream.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <StreamIcon className="h-4 w-4" />
                </div>
                Stream configuration
              </CardTitle>
              <CardDescription>{provider?.description || 'Conversation channel'}</CardDescription>
            </CardHeader>
            <CardContent>
              {streamEav.length === 0 ? (
                <p className="text-sm text-muted-foreground">No configuration saved.</p>
              ) : (
                <dl className="space-y-2.5">
                  {streamEav.map((r) => (
                    <div key={r.key} className="flex items-start justify-between gap-4 text-sm">
                      <dt className="font-mono text-xs text-muted-foreground pt-1">{r.key}</dt>
                      <dd className="font-medium text-right break-all">{maskedValue(r.key!, r.value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <FolderOpen className="h-4 w-4" />
                </div>
                Data sources
              </CardTitle>
              <CardDescription>Drives linked to this tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {drives.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drives configured.</p>
              ) : (
                drives.map((d) => {
                  const dp = d.drive_type ? providerRegistry.get('drive', d.drive_type) : undefined;
                  const DIcon = dp ? iconMap[dp.icon] ?? FolderOpen : FolderOpen;
                  return (
                    <div key={d.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <DIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{dp?.label || d.drive_type}</span>
                      </div>
                      <Separator className="my-2" />
                      <dl className="space-y-1.5">
                        {d.eav.map((r) => (
                          <div key={r.key} className="flex items-start justify-between gap-4 text-xs">
                            <dt className="font-mono text-muted-foreground pt-0.5">{r.key}</dt>
                            <dd className="font-medium text-right break-all">{maskedValue(r.key!, r.value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Chat with Daosa</CardTitle>
              <CardDescription>
                Messages route to your n8n workflow with tenant context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChatWidget
                tenantId={tenant!.id}
                orgId={tenant!.org_id}
                streamConnectionId={stream.id}
                streamType={stream.stream_type}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
