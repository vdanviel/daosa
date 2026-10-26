'use client';

import { FolderOpen, MessageCircle, Phone, Send, Webhook, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const integrations = [
  { icon: FolderOpen, name: 'Google Drive', desc: 'Documentos e arquivos da empresa' },
  { icon: Phone, name: 'WhatsApp', desc: 'Canal de atendimento externo' },
  { icon: Send, name: 'Telegram', desc: 'Canal de atendimento externo' },
  { icon: MessageCircle, name: 'Discord', desc: 'Comunidade e suporte' },
  { icon: Webhook, name: 'MCP', desc: 'Servidores de ferramentas autorizados' },
  { icon: Bot, name: 'API própria', desc: 'Acesso programático com chaves e escopos' },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte canais de comunicação, fontes de conhecimento e ferramentas ao seus agentes.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="space-y-3 p-5">
          {integrations.map((it) => (
            <div
              key={it.name}
              className="flex items-center gap-4 rounded-full border border-primary/30 bg-background/60 px-5 py-3 transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <it.icon className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{it.name}</div>
                <div className="truncate text-xs text-muted-foreground">{it.desc}</div>
              </div>
              <Badge variant="secondary">Em breve</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
