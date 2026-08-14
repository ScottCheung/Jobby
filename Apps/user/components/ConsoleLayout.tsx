/** @format */

'use client';
import {
  CelebrationLayer,
  Toaster,
  Sidebar,
  GlobalDrawer,
  GlobalConfirm,
  GlobalModal,
  DashboardStats,
} from '@jobby/ui';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutGroup } from 'framer-motion';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import AutomationPanel from '@/app/_component/AutomationPanel';

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { error, isPending, isDesktopApp } = useConsole();

  const isFullHeightRoute =
    pathname?.startsWith('/interview-prep') ||
    pathname?.startsWith('/job-application') ||
    pathname?.startsWith('/applications') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/design-system');

  if (pathname?.startsWith('/Resume/Template/')) {
    return <>{children}</>;
  }

  return (
    <LayoutGroup id='console-layout'>
      <div className='h-screen w-screen z-10 flex overflow-hidden transition-colors duration-300'>
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className='relative flex h-full flex-1 min-w-0 flex-col overflow-hidden'>
          <div
            className={cn(
              'app-no-drag custom-scrollbar-primary flex-1',
              isFullHeightRoute ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
            )}
          >
            <div
              className={cn(
                !isFullHeightRoute && 'p-page',
                isFullHeightRoute && 'h-full flex flex-col overflow-hidden',
              )}
            >
              <div
                className={cn(
                  !isFullHeightRoute && 'mx-auto grid gap-8',
                  isFullHeightRoute && 'h-full flex flex-col overflow-hidden',
                )}
              >
                {/* Hero Header */}
                {pathname === '/' && (
                  <header className='hero bg-gradient-to-br from-green-800 via-emerald-900 to-zinc-950'>
                    <span className='inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2 px-2 py-0.5 rounded-md bg-emerald-500/20'>
                      AI-Powered Job Automation
                    </span>
                    <h1>
                      Job Automation Console
                    </h1>
                    <p>
                      Monitor real-time automation status across platforms, access key feature panels instantly, and track applications & interviews.
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
