'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (

    <div className="min-h-screen grid lg:grid-cols-2 bg-background">

      {/* Left: form */}
      <div className="flex flex-col px-6 sm:px-10 py-8">
        <Link href="/" className="flex items-center gap-2.5 self-start">
          <Image src="/images/daosa-logo.png" alt="Daosa" width={150} height={80} className="object-contain" />
        </Link>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">{footer}</div>
      </div>

      {/* Right: brand panel */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-grid">

        <Image className='rounded-xl' src={'/images/auth-s-style1.png'} width={650} height={600} alt='Art to the auth page.'/>

      </div>

    </div>

  );
}
