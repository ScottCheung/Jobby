/** @format */

'use client';

import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Compass } from 'lucide-react';
import { AuthForm } from '@/components/auth/AuthForm';

function LoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || undefined;
  const reason = searchParams?.get('reason') || undefined;
  const extensionRedirect =
    searchParams?.get('extension_redirect') || undefined;

  return (
    <div className='min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-background'>
      {/* Ambient background glows */}
      <div className='absolute inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute -top-32 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-[140px] animate-pulse' />
        <div className='absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[140px] animate-pulse' />
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none' />
      </div>

      {/* Top Bar with Return Link */}
      <div className='absolute top-6 left-6 z-20'>
        <Link
          href='/'
          className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-panel/80 hover:bg-surface-secondary backdrop-blur-md border border-primary/60 text-xs font-medium text-ink-secondary hover:text-ink-primary shadow-xs transition-all'
        >
          <ArrowLeft className='w-3.5 h-3.5' />
          <span>Back to Console</span>
        </Link>
      </div>

      {/* Main Glass Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className='w-full max-w-md bg-panel/90 backdrop-blur-2xl border border-transparent rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 my-8'
      >
        <AuthForm
          next={next}
          extensionRedirect={extensionRedirect}
          reason={
            extensionRedirect ?
              'Sign in to connect the Jobby browser extension'
            : reason
          }
        />

        {/* Guest browse footer link */}
        <div className='mt-5'>
          <Link
            href='/interview-prep/explore'
            className='group flex w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-secondary hover:text-primary'
          >
            <Compass className='h-3.5 w-3.5 shrink-0 text-primary' />
            <span>Prefer to explore first? Browse questions as guest</span>
            <ChevronRight className='ml-auto h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5' />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen flex items-center justify-center bg-background'>
          <div className='w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
