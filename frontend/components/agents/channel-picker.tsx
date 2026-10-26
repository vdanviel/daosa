'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError, type Channel } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * CARD "CANAIS:" — seleção única de canal do agente.
 *
 * Carrega os canais de `GET /channel/all` e os exibe como tags (ícone +
 * nome). A tag selecionada é o `channel_id` enviado no register/update.
 */
export function ChannelPicker({
  value,
  onChange,
}: {
  /** `channel_id` selecionado (`''` = nenhum). */
  value: string;
  onChange: (channelId: string) => void;
}) {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Canais cujo `icon_url` falhou ao carregar — caem no ícone padrão. */
  const [brokenIcons, setBrokenIcons] = useState<number[]>([]);

  useEffect(() => {
    let active = true;

    api.channel
      .all()
      .then((list) => {
        if (!active) return;
        setChannels(Array.isArray(list) ? list : []);
        setError(null);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar os canais.');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Canais:
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : !channels ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-36 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
      ) : channels.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum canal disponível.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {channels.map((channel) => {
            const selected = String(channel.id) === value;
            // Registro anterior à coluna `icon_url` guarda o ícone dentro de `config`.
            const icon = brokenIcons.includes(channel.id)
              ? null
              : channel.icon_url || channel.config?.icon_url || null;

            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onChange(String(channel.id))}
                aria-pressed={selected}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-secondary font-medium text-secondary-foreground'
                    : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {icon ? (
                  <img
                    src={channelIconSrc(icon)}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 object-contain"
                    onError={() => setBrokenIcons((prev) => [...prev, channel.id])}
                  />
                ) : (
                  <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                )}
                <span className="max-w-40 truncate">{channel.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * `icon_url` relativo (ex.: `/public/images/...`) é estático do backend e não
 * existe no SPA — passa pelo proxy `/api` para não responder 404.
 */
function channelIconSrc(iconUrl: string) {
  return iconUrl.startsWith('/') ? `/api${iconUrl}` : iconUrl;
}
