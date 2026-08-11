'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Send, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatWidget({
  tenantId,
  orgId,
  streamConnectionId,
  streamType,
}: {
  tenantId: number;
  orgId: number | null;
  streamConnectionId: number;
  streamType: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `s_${Date.now()}`
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        await new Promise((r) => setTimeout(r, 700));
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              "Hi! I'm Daosa. The n8n webhook URL isn't configured yet, so I'm in demo mode. Once you set NEXT_PUBLIC_N8N_WEBHOOK_URL, I'll reply with real context from your data source.",
          },
        ]);
        return;
      }
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: String(tenantId),
          org_id: orgId ? String(orgId) : null,
          stream_connection_id: String(streamConnectionId),
          stream_type: streamType,
          message: text,
          session_id: sessionId,
        }),
      });
      if (!res.ok) throw new Error(`Webhook failed (${res.status})`);
      const data = await res.json().catch(() => ({}));
      const reply =
        typeof data === 'string'
          ? data
          : data?.reply || data?.message || data?.output || JSON.stringify(data);
      setMessages((m) => [...m, { role: 'assistant', content: String(reply) }]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message.');
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `Error: ${err.message || 'failed to reach Daosa'}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[540px] rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border/60 bg-gradient-to-r from-primary/5 to-primary/10">
        <Image src="/images/daosa-icon.png" alt="Daosa" width={24} height={24} className="object-contain" />
        <span className="font-bold text-sm tracking-wider uppercase" style={{ color: 'hsl(255, 78%, 20%)' }}>
          Daosa Chat
        </span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          session {sessionId.slice(0, 8)}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <Image
              src="/images/daosa-icon.png"
              alt="Daosa"
              width={48}
              height={48}
              className="mx-auto object-contain opacity-40"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Send a message to start chatting with Daosa.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="h-8 w-8 rounded-lg overflow-hidden bg-primary/10 shrink-0 grid place-items-center">
                <Image src="/images/daosa-icon.png" alt="Daosa" width={22} height={22} className="object-contain" />
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm ${
                m.role === 'user'
                  ? 'bg-gradient-brand text-white'
                  : 'bg-primary/8 text-foreground border border-primary/15'
              }`}
            >
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0 border border-border/60">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 shrink-0 grid place-items-center">
              <Image src="/images/daosa-icon.png" alt="" width={22} height={22} className="object-contain" />
            </div>
            <div className="bg-primary/8 border border-primary/15 rounded-2xl px-3.5 py-2.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/60 bg-muted/20">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Daosa something… (Enter to send)"
            className="min-h-10 max-h-32 resize-none bg-card border-primary/20 focus-visible:ring-primary/40"
            rows={1}
          />
          <Button
            onClick={send}
            disabled={sending || !input.trim()}
            size="icon"
            className="h-10 w-10 shrink-0 bg-gradient-brand hover:opacity-90 transition-opacity border-0 shadow-md shadow-primary/25"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
