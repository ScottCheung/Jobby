/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useConsole } from '@/components/ConsoleContext';
import { Sidebar } from '@/components/layout/sidebar';
import { GlobalDrawer } from '@/components/layout/global-drawer';
import { cn } from '@/lib/utils';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { H1 } from '@/components/UI/text/typography';
import {
  RefreshCw,
} from 'lucide-react';
import { Stagger, StaggerItem } from './animation';
import { Number } from './UI/Number/Number';
import AutomationPanel from '@/app/_component/AutomationPanel';



export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    stats,
    error,
    isPending,
    toast,
    isDesktopApp,
  } = useConsole();
  return (
    <div className='min-h-screen z-10 flex transition-colors duration-300'>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className='relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden'>
        {isDesktopApp && (
          <div className='app-drag fixed inset-x-0 top-0 z-50 h-[48px] ' />
        )}

        <div className='custom-scrollbar-primary flex-1 overflow-y-auto'>
          <div className='p-page'>
            <div className='mx-auto grid gap-8'>
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
                    profile changes, saved answers, and application history now
                    live in PostgreSQL instead of scattered files.
                  </p>
                </header>
              )}

              {/* Stats Bar */}
              {pathname === '/' && (
                <Stagger
                  staggerDelay={0.15}
                  className='grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))]  gap-6  pt-4'
                >
                  {stats.map((item) => {
                    const Icon = item.icon;
                    return (
                      <StaggerItem key={item.label} yOffset={20}>
                        <CardWithNorth title={item.label}>
                          <div className='flex items-start justify-between relative'>
                            <div
                              className={cn(
                                'absolute -top-16 -right-2 z-50 p-6 rounded-full backdrop-blur-[10px]',
                                item.bgColor,
                                item.borderColor,
                              )}
                            >
                              <Icon
                                className={cn('w-10 h-10', item.iconColor)}
                              />
                            </div>
                            <div className='flex flex-col'>
                              <H1
                                className={cn(
                                  item.textColor,
                                  '-mt-4 -ml-[0.13em] md:-ml-[0.23em]',
                                )}
                              >
                                <Number
                                  value={item.value}
                                  duration={1}
                                  className='font-[600]'
                                  digitWidth='0.66em'
                                />
                              </H1>
                              {item.comparison && (
                                <div className={cn('flex items-center gap-1 text-xs font-semibold mt-2', item.comparisonColor)}>
                                  {item.comparisonIcon && <item.comparisonIcon className='w-3.5 h-3.5' />}
                                  <span>{item.comparison}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardWithNorth>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              )}

              {error && (
                <div className='fixed bottom-1/2 flex items-center gap-2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50  text-error bg-red-500/30 backdrop-blur-sm  py-3 px-card rounded-card text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300'>
                  <div>{error}</div>
                </div>
              )}
              {isPending && (
                <div className='fixed bottom-1/2 flex items-center left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50  text-white bg-black/30 backdrop-blur-sm  py-3 pl-3 gap-3 pr-card rounded-card text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300'>
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

      {toast && (
        <div className='fixed bottom-1/2 flex items-center gap-2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50  text-white bg-black/30 backdrop-blur-sm  py-3 px-card rounded-card text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300'>
          <div>{toast}</div>
        </div>
      )}

      {/* Global Drawer */}
      <GlobalDrawer />
    </div>
  );
}
