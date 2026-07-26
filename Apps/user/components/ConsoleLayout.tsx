/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutGroup } from 'framer-motion';
import { useConsole } from '@/components/ConsoleContext';
import { Sidebar } from '@/components/layout/sidebar';
import { GlobalDrawer } from '@/components/layout/global-drawer';
import { GlobalConfirm } from '@/components/layout/global-confirm';
import { GlobalModal } from '@/components/layout/global-modal';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import AutomationPanel from '@/app/_component/AutomationPanel';
import { Toaster } from '@/components/UI/toast/toaster';
import { CelebrationLayer } from '@/components/UI/celebration/confetti';
import { DashboardStats } from '@/components/layout/dashboard-stats';

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { error, isPending, isDesktopApp } = useConsole();
  return (
    <LayoutGroup id='console-layout'>
      <div className='h-screen w-screen z-10 flex overflow-hidden transition-colors duration-300'>
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className='relative flex h-full flex-1 min-w-0 flex-col overflow-hidden'>
          {isDesktopApp && (
            <div className='app-drag fixed inset-x-0 top-0 z-50 h-[48px] ' />
          )}

          <div className='custom-scrollbar-primary flex-1 overflow-y-auto'>
            <div
              className={cn(
                !pathname?.startsWith('/interview-prep') &&
                  !pathname?.startsWith('/job-application') &&
                  !pathname?.startsWith('/design-system') &&
                  !pathname?.startsWith('/settings') &&
                  'p-page',
                (pathname?.startsWith('/interview-prep') ||
                  pathname?.startsWith('/job-application') ||
                  pathname?.startsWith('/settings') ||
                  pathname?.startsWith('/design-system')) &&
                  'h-full flex flex-col overflow-hidden',
              )}
            >
              <div
                className={cn(
                  !pathname?.startsWith('/interview-prep') &&
                    !pathname?.startsWith('/job-application') &&
                    !pathname?.startsWith('/design-system') &&
                    !pathname?.startsWith('/settings') &&
                    'mx-auto grid gap-8',
                  (pathname?.startsWith('/interview-prep') ||
                    pathname?.startsWith('/job-application') ||
                    pathname?.startsWith('/settings') ||
                    pathname?.startsWith('/design-system')) &&
                    'h-full flex flex-col overflow-hidden',
                )}
              >
                {/* Hero Header */}
                {pathname === '/' && (
                  <header className='hero bg-gradient-to-br from-green-800 via-emerald-900 to-zinc-950'>
                    <span className='inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2 px-2 py-0.5 rounded-md bg-emerald-500/20'>
                      PostgreSQL backed workspace
                    </span>
                    <h1>
                      Manage once. Let the local worker apply with clean data.
                    </h1>
                    <p>
                      This console reads and writes through the API layer, so
                      profile changes, saved answers, and application history
                      now live in PostgreSQL instead of scattered files.
                    </p>
                  </header>
                )}

                {/* Stats Bar */}
                {pathname === '/' && (
                  <DashboardStats />
                )}

                {error && (
                  <div className='label-sm fixed bottom-1/2 flex items-center gap-2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-error bg-red-500/30 backdrop-blur-sm py-3 px-card rounded-card animate-in fade-in slide-in-from-bottom-2 duration-300'>
                    <div>{error}</div>
                  </div>
                )}
                {isPending && (
                  <div className='label-sm text-white! fixed bottom-1/2 flex items-center left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-black/30 backdrop-blur-sm py-3 pl-3 gap-3 pr-card rounded-card animate-in fade-in slide-in-from-bottom-2 duration-300'>
                    <RefreshCw className='w-4 h-4 animate-spin' />
                    Refreshing data...
                  </div>
                )}

                {/* Child Page Content */}
                {children}
              </div>
            </div>
          </div>
        </main>

        {/* Floating Launch Button / Automation Panel */}
        <AutomationPanel />

        {/* Global Drawer */}
        <GlobalDrawer />

        {/* Global Confirm */}
        <GlobalConfirm />

        {/* Global Modal */}
        <GlobalModal />

        {/* Global Toaster */}
        <Toaster />

        {/* Global Celebration */}
        <CelebrationLayer />
      </div>
    </LayoutGroup>
  );
}
