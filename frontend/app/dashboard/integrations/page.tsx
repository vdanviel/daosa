'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Loader2, Plus, RefreshCw, Trash2} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table,  TableBody,  TableCell,  TableHead,  TableHeader,  TableRow} from '@/components/ui/table';
import { api, ApiError, type IntegrationRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';


type ProviderInfo = {
  name: string;
  icon: string;
};

const PROVIDERS: Record<string, ProviderInfo> = {
  google: { name: 'Google Drive', icon: '/images/google-drive.png' },
  whatsapp: { name: 'WhatsApp', icon: '/images/whatsapp.png' },
  discord: { name: 'Discord', icon: '/images/discord.png' },
  telegram: { name: 'Telegram', icon: '/images/telegram.png' },
  mcp: { name: 'MCP', icon: '/images/mcp.svg' }
};

function getProvider(provider: string): ProviderInfo {
  return PROVIDERS[provider] ?? { name: provider, icon: '' };
}


function statusInfo(status: string): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (status) {
    case 'active':
      return { label: 'Conectado', variant: 'default' };
    case 'processing':
      return { label: 'Processando…', variant: 'secondary' };
    case 'expired':
      return { label: 'Expirado', variant: 'destructive' };
    case 'revoked':
      return { label: 'Revogado', variant: 'destructive' };
    case 'error':
      return { label: 'Erro', variant: 'destructive' };
    default:
      return { label: 'Desconectado', variant: 'secondary' };
  }
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);

  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [loadingDeletingIntegration, setLoadingDeletingIntegration] = useState(false);


  const ConfirmDeleteDialog = () => {

    const provider = deletingProvider;
    if (!provider) return null;

    const requestDeletion = async () => {
      setLoadingDeletingIntegration(true);
      await api.integration.deleteByProvider(provider);
      setLoadingDeletingIntegration(false);

      refreshIntegrations()

      setDeletingProvider(null);
    };

    return (
      <Dialog open={!!deletingProvider} onOpenChange={(open) => !open && setDeletingProvider(null)}>
        <DialogContent>

          <DialogHeader className="text-center">
            <DialogTitle>Deletar Integração</DialogTitle>
            <DialogDescription>Tem certeza que deseja deletar sua integração ?</DialogDescription>
          </DialogHeader>

          <div className='flex flex-col justify-center'>

            <p>Ao deletar a integração você perdera os dados do serviço e vai precisar autenticar novamente.</p>

            <div className='flex items-center flex-row mt-2 gap-2 justify-end'>
              <Button variant="outline" size="sm" onClick={() => setDeletingProvider(null)}>Cancelar</Button>
              <Button size="sm" onClick={requestDeletion} disabled={loadingDeletingIntegration}>
                {loadingDeletingIntegration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>
    );
    
  };

  const refreshIntegrations = useCallback(async () => {
    if (!user?.id) return;
    setLoadingIntegrations(true);
    setError(null);
    try {
      const ints = await api.integration.all();
      setIntegrations(ints ?? []);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar integrações.');
      setIntegrations([]);
    } finally {
      setLoadingIntegrations(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshIntegrations();
  }, [refreshIntegrations]);

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Canais e ferramentas conectados à sua operação.
          </p>
        </div>

        <div className="flex flex-row gap-4">
          <Button size="sm" onClick={refreshIntegrations} disabled={loadingIntegrations}>
            {loadingIntegrations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/integrations/new">
              <Plus className="mr-2 h-4 w-4" />
              Criar integração
            </Link>
          </Button>
        </div>

      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            {loadingIntegrations ? (
              <div className="border border-border/60 rounded-xl bg-background/60 p-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Carregando integrações…</p>
              </div>
            ) : integrations.length === 0 ? (
              <div className="border border-dashed border-border/60 rounded-xl bg-background/40 p-10 text-center">
                <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">Nenhuma integração encontrada</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                  Conecte seus canais e ferramentas. As integrações aparecem aqui assim que forem criadas.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%]">Provedor</TableHead>
                    <TableHead className="w-[25%]">Status</TableHead>
                    <TableHead className="w-[25%]">Rótulo</TableHead>
                    <TableHead className="w-[25%]">Tipo de auth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => {
                    const provider = getProvider(integration.provider);
                    const info = statusInfo(integration.status);

                    return (
                      <TableRow key={integration.id}>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            {provider.icon && (
                              <img
                                src={provider.icon}
                                alt={provider.name}
                                className="h-5 w-5 rounded"
                              />
                            )}
                            <p className="text-sm text-foreground">{provider.name}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                            <Badge
                              variant={info.variant}
                              className={
                                info.variant === 'default'
                                  ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30'
                                  : ''
                              }
                            >
                              {info.label}
                            </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm text-foreground truncate" title={integration.label ?? ''}>
                            {integration.label ?? 'N/A'}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-muted-foreground truncate" title={integration.auth_type ?? ''}>
                            {integration.auth_type ?? 'N/A'}
                          </span>
                        </TableCell>

                        <TableCell className="shrink-0">
                              
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeletingProvider(integration.provider)}
                          >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Deletar
                          </Button>

                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {integrations.length > 0 && !loadingIntegrations && (
        <p className="text-xs text-muted-foreground">
          A coluna Canal relaciona cada integração ao canal de mesmo type (ex.: provider
          'whatsapp' ↔ canal tipo 'whatsapp'). Canais sem integração não aparecem nas linhas.
        </p>
      )}

      <ConfirmDeleteDialog />

    </div>
  );
}
