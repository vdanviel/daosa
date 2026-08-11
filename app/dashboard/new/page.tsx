'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Cloud,
  Database,
  FolderOpen,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import {
  providerRegistry,
  buildZodSchema,
  type ProviderDefinition,
} from '@/lib/providers/registry';

const iconMap: Record<string, any> = {
  MessageCircle,
  Bot,
  FolderOpen,
  Cloud,
  Database,
};

function ProviderPicker({
  domain,
  value,
  onChange,
}: {
  domain: 'stream' | 'drive';
  value: string;
  onChange: (id: string) => void;
}) {
  const providers = providerRegistry.list(domain);
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {providers.map((p) => {
        const Icon = iconMap[p.icon] ?? Bot;
        const active = value === p.id;
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`text-left rounded-xl border p-4 transition-all hover:shadow-sm ${
              active ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/40'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" />
              </div>
              {active && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
            <div className="mt-3 font-medium">{p.label}</div>
            <div className="mt-1 text-sm text-muted-foreground">{p.description}</div>
            {p.authMode === 'oauth' && (
              <Badge variant="secondary" className="mt-2 text-xs">OAuth</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProviderFields({
  provider,
  values,
  onChange,
}: {
  provider: ProviderDefinition;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {provider.fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key}>
            {f.label}
            {f.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          {f.type === 'textarea' ? (
            <Textarea
              id={f.key}
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          ) : f.type === 'select' && f.options ? (
            <select
              id={f.key}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
            >
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <Input
              id={f.key}
              type={f.type === 'password' ? 'password' : 'text'}
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          )}
          {f.helpText && <p className="text-xs text-muted-foreground">{f.helpText}</p>}
        </div>
      ))}
    </div>
  );
}

export default function NewBotPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const supabase = getSupabaseBrowser();

  const [step, setStep] = useState<1 | 2>(1);
  const [streamProviderId, setStreamProviderId] = useState('');
  const [streamValues, setStreamValues] = useState<Record<string, string>>({});
  const [driveProviderId, setDriveProviderId] = useState('');
  const [driveValues, setDriveValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [skipDrive, setSkipDrive] = useState(false);

  const streamProvider = useMemo(
    () => (streamProviderId ? providerRegistry.get('stream', streamProviderId) : undefined),
    [streamProviderId]
  );
  const driveProvider = useMemo(
    () => (driveProviderId ? providerRegistry.get('drive', driveProviderId) : undefined),
    [driveProviderId]
  );

  const validateStream = () => {
    if (!streamProvider) return false;
    const schema = buildZodSchema(streamProvider);
    const res = schema.safeParse(streamValues);
    if (!res.success) {
      toast.error(res.error.issues[0]?.message || 'Please fill all required fields.');
      return false;
    }
    return true;
  };

  const validateDrive = () => {
    if (skipDrive) return true;
    if (!driveProvider) return false;
    const schema = buildZodSchema(driveProvider);
    const res = schema.safeParse(driveValues);
    if (!res.success) {
      toast.error(res.error.issues[0]?.message || 'Please fill all required fields.');
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!tenant) return;
    if (!validateStream()) return;
    if (!validateDrive()) return;
    setSaving(true);
    try {
      // 1. Create stream_connection
      const { data: stream, error: streamErr } = await supabase
        .from('stream_connection')
        .insert({ tenant_id: tenant.id, stream_type: streamProvider!.id, is_active: true })
        .select('id')
        .single();
      if (streamErr) throw streamErr;

      // 2. Save stream EAV rows
      const streamRows = streamProvider!.fields.map((f) => ({
        key: f.key,
        value: streamValues[f.key] ?? '',
        stream: stream.id,
        drive: null,
      }));
      if (streamRows.length) {
        const { error: eavErr } = await supabase.from('eav_config').insert(streamRows);
        if (eavErr) throw eavErr;
      }

      // 3. Optional drive
      if (!skipDrive && driveProvider) {
        const { data: drive, error: driveErr } = await supabase
          .from('drive_auth')
          .insert({ tenant_id: tenant.id, drive_type: driveProvider.id })
          .select('id')
          .single();
        if (driveErr) throw driveErr;

        const driveRows = driveProvider.fields.map((f) => ({
          key: f.key,
          value: driveValues[f.key] ?? '',
          stream: null,
          drive: drive.id,
        }));
        if (driveRows.length) {
          const { error: dEavErr } = await supabase.from('eav_config').insert(driveRows);
          if (dEavErr) throw dEavErr;
        }
      }

      toast.success('Bot configured!');
      router.push(`/dashboard/connections/${stream.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configure a new bot</h1>
          <p className="text-muted-foreground mt-1">
            Two steps: pick a conversation stream, then link a data source.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3">
        <StepDot n={1} label="Stream" active={step === 1} done={step > 1} />
        <div className="h-px flex-1 bg-border max-w-24" />
        <StepDot n={2} label="Drive" active={step === 2} done={false} />
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1  Conversation channel</CardTitle>
            <CardDescription>
              Choose where Daosa will talk to your users. Fields update dynamically from the
              provider registry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProviderPicker domain="stream" value={streamProviderId} onChange={setStreamProviderId} />
            {streamProvider && (
              <div className="rounded-xl border bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">{streamProvider.label}</Badge>
                  {streamProvider.authMode === 'oauth' && <Badge variant="outline">OAuth</Badge>}
                </div>
                <ProviderFields
                  provider={streamProvider}
                  values={streamValues}
                  onChange={(k, v) => setStreamValues((s) => ({ ...s, [k]: v }))}
                />
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => (validateStream() ? setStep(2) : null)}
                disabled={!streamProvider}
                className="bg-gradient-brand hover:opacity-90 transition-opacity border-0 shadow-md shadow-primary/25"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2  Data source</CardTitle>
            <CardDescription>
              Link a drive so Daosa can read your files. You can skip and add one later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2">
              <Button
                variant={!skipDrive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSkipDrive(false)}
              >
                Link a drive
              </Button>
              <Button
                variant={skipDrive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSkipDrive(true)}
              >
                Skip for now
              </Button>
            </div>

            {!skipDrive && (
              <>
                <ProviderPicker domain="drive" value={driveProviderId} onChange={setDriveProviderId} />
                {driveProvider && (
                  <div className="rounded-xl border bg-muted/30 p-5">
                    {driveProvider.authMode === 'oauth' ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
                          <FolderOpen className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            Google Drive uses OAuth2. After you save, you&apos;ll be redirected to
                            Google to consent. Tokens are stored as EAV keys
                            <code className="mx-1 text-xs bg-muted px-1 py-0.5 rounded">drive.google.access_token</code>
                            and
                            <code className="mx-1 text-xs bg-muted px-1 py-0.5 rounded">drive.google.refresh_token</code>.
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tip: paste existing tokens below if you already have them, or leave blank
                          to authorize after saving.
                        </p>
                      </div>
                    ) : null}
                    <ProviderFields
                      provider={driveProvider}
                      values={driveValues}
                      onChange={(k, v) => setDriveValues((s) => ({ ...s, [k]: v }))}
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={save}
                disabled={saving || (!skipDrive && !driveProvider)}
                className="bg-gradient-brand hover:opacity-90 transition-opacity border-0 shadow-md shadow-primary/25"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-7 w-7 rounded-full grid place-items-center text-xs font-medium ${
          done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={`text-sm ${active ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}
