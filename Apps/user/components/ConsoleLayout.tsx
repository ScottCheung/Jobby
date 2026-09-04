/** @format */

'use client';
import {
  CelebrationLayer,
  Toaster,
  Sidebar,
  GlobalDrawer,
  GlobalConfirm,
  GlobalModal,
  LayoutGroup,
} from '@jobby/ui';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';
import { GlobalAuthModal } from '@/components/auth/GlobalAuthModal';

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { error } = useConsole();

  const isFullHeightRoute =
    pathname?.startsWith('/ai-studio') ||
    pathname?.startsWith('/prospects') ||
    pathname?.startsWith('/interview-prep') ||
    pathname?.startsWith('/job-application') ||
    pathname?.startsWith('/applications') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/design-system');

  if (
    pathname?.startsWith('/Resume/Template/') ||
    pathname?.startsWith('/login')
  ) {
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
              isFullHeightRoute ?
                'flex flex-col overflow-hidden'
              : 'overflow-y-auto',
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
                {error && (
                  <div className='label-sm fixed bottom-1/2 flex items-center gap-2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-error bg-red-500/30 backdrop-blur-sm py-3 px-card rounded-card animate-in fade-in slide-in-from-bottom-2 duration-300'>
                    <div>{error}</div>
                  </div>
                )}
                {/* Child Page Content */}
                {children}
              </div>
            </div>
          </div>
        </main>

        {/* Global Drawer */}
        <GlobalDrawer />

        {/* Global Confirm */}
        <GlobalConfirm />

        {/* Global Modal */}
        <GlobalModal />

        {/* Global Auth Modal */}
        <GlobalAuthModal />

        {/* Global Toaster */}
        <Toaster />

        {/* Global Celebration */}
        <CelebrationLayer />
      </div>
    </LayoutGroup>
  );
}
