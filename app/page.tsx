'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, DatabaseIcon, ArrowRight, Cloud, Database, FolderOpen, MessageCircle, Shield, Sparkles, Workflow, Zap, Bot} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

const features = [
  {
    icon: MessageCircle,
    title: 'Multi-channel streams',
    desc: 'Connect with any message channel, or use the native Daosa chat.',
  },
  {
    icon: FolderOpen,
    title: 'Pluggable data sources',
    desc: 'Google Drive (OAuth), S3-compatible buckets, or external databases. Your data can come from anywhere.',
  },
  {
    icon: Shield,
    title: 'Least-privilege by design',
    desc: 'Your company can register as many employess as you wish.',
  },
  {
    icon: Sparkles,
    title: 'Simplicity',
    desc: 'Register your account and get your bot up and running in minutes.',
  },
];

const providers = [
  { icon: MessageCircle, name: 'Discord' },
  { icon: Bot, name: 'Daosa Native' },
  { icon: FolderOpen, name: 'Google Drive' },
  { icon: Cloud, name: 'Cloud' },
  { icon: Database, name: 'Database' },
];

const steps = [
  { n: '01', t: 'Register your org', d: 'Create an org and the first master tenant in one flow.' },
  { n: '02', t: 'Configure a stream', d: 'Pick a channel provider, fill the dynamic form, save.' },
  { n: '03', t: 'Link a drive', d: 'OAuth into Google Drive or paste your database credentials.' },
  { n: '04', t: 'Chat with Daosa', d: 'Chat with a specialist about your business 24/7.' },
];

const previewCards = [
  {
    step: 'Step 1',
    title: 'Pick a stream',
    items: [
      { icon: MessageCircle, label: 'Discord' },
      { icon: Phone, label: 'WhatsApp' },
      { icon: Bot, label: 'Daosa native' },
      { icon: Sparkles, label: "Others..."}
    ],
  },
  {
    step: 'Step 2',
    title: 'Link a drive',
    items: [
      { icon: FolderOpen, label: 'Google Drive' },
      { icon: DatabaseIcon, label: 'Database' },
      { icon: Cloud, label: 'Cloud' },
      { icon: Sparkles, label: "Others..."}
    ],
  },
  {
    step: 'Step 3',
    title: 'Chat with Daosa',
    chat: [
      {
        bot: false,
        content: "What can you do, Daosa ?"
      },
      {
        bot: true,
        content: "I can retrieve information from the company's knowledge base and answer your questions in a simple way."
      },
      {
        bot: false,
        content: "Awesome!"
      }
    ]
  },
];

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !loading && session) router.replace('/dashboard');
  }, [mounted, loading, session, router]);

  return (
    <div className="min-h-screen bg-background">
      
      {/* Nav */}
      <header className="sticky bg-white top-0 z-40 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 h-[100px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/images/daosa-logo.png"
              alt="daosa-image"
              width={150}
              height={80}
              className="object-contain"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="primary border-0">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
    
        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            <div>
              <h1
                className="mt-5 text-5xl sm:text-6xl font-black tracking-tight leading-[1.0] animate-fade-up"
              >
                An <span className='text-gradient'>AI agent</span> to help your employees get all trained and learn your company's business rules. 
              </h1>
            </div>
            
            <div>

                <p
                  className="mt-5 text-lg text-muted-foreground max-w-xl animate-fade-up"
                  style={{ animationDelay: '120ms' }}
                >
                  Daosa is the onboarding IA to your company! With it you can train a bot assistant that can talk to your employees and guide them about all your business rules. Your new employees doesn't need to be insecure about how things works in your company anymore. Daosa can help him!
                </p>

                <div
                  className="mt-8 flex flex-col sm:flex-row gap-3 animate-fade-up"
                  style={{ animationDelay: '180ms' }}
                >
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-8 text-base primary border-0"
                  >
                    <Link href="/register">
                      Get started free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base border-primary/40 hover:primary/5">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>

            </div>

          </div>

          {/* Mini preview strip */}
          <div className="mt-16 grid md:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: '260ms' }}>
            {previewCards.map((col) => (
              <Card key={col.step} className="border-primary/20 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="text-xs uppercase tracking-wider text-primary font-semibold">{col.step}</div>
                  <div className="mt-1.5 font-semibold">{col.title}</div>
                  {col.items && (
                    <div className="mt-3 space-y-2">
                      {col.items.map((it) => (
                        <div key={it.label} className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background/60 p-2 text-sm">
                          <it.icon className="h-4 w-4 text-primary" /> {it.label}
                        </div>
                      ))}
                    </div>
                  )}
                  {col.chat && (
                    <div className="mt-3 space-y-2 text-sm">
                      {
                        col.chat.map((message) => {

                          if (message.bot == false) {
                            return <div className="rounded-xl bg-primary text-white p-2.5 ml-4 text-xs">{message.content}</div>
                          }

                          if (message.bot == true) {
                            return <div className="rounded-xl bg-muted border border-primary/20 p-2.5 mr-4 text-xs">{message.content}</div>
                          }

                        })
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
              Built for extensibility and security
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every provider is registered, every key is namespaced, every row is scoped.
            </p>
          </div>
          <div className="mt-14 flex flex-wrap justify-center gap-5">
            {features.map((f) => (
              <Card
                key={f.title}
                className="hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-200 border-border/60"
              >
                <CardContent className="p-6 w-[400px]">
                  <div className="h-11 w-11 rounded-xl bg-primary text-white grid place-items-center shadow-md shadow-primary/30">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Providers */}
      <section id="providers" className="py-20 border-t border-border/60" style={{ background: 'hsl(252, 40%, 97%)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
              Change apps or data sources anytime
            </h2>
            <p className="mt-4 text-muted-foreground">
              Daosa is built with a modular, plug-and-play architecture. You can effortlessly swap out communication streams or data sources, independently, ensuring zero downtime and total flexibility as your business stack evolves.
            </p>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {providers.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2.5 rounded-full border border-primary/25 bg-card px-5 py-2.5 shadow-sm hover:shadow-md hover:shadow-primary/10 transition-shadow"
              >
                <p.icon className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 border-t border-border/60">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center">
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
              From sign-up to live chat in four steps
            </h2>
          </div>
          <div className="mt-14 grid md:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <div className="text-5xl font-black text-gradient">{s.n}</div>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 border-t border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <Image
            src="/images/icon.png"
            alt="Daosa"
            width={72}
            height={72}
            className="mx-auto object-contain animate-glow"
          />
          <h2 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight">
            Ready to configure your agent?
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Create your org, connect a channel, and chat with Daosa in minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base primary border-0"
            >
              <Link href="/register">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base border-primary/40 hover:primary/5">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <Image src="/images/daosa-logo.png" alt="Daosa" width={100} height={28} className="object-contain" />
            <span className="text-muted-foreground/60"> Dynamic AI Onboarding Specialist Agent</span>
          </div>
          <div>© {new Date().getFullYear()} Daosa. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
