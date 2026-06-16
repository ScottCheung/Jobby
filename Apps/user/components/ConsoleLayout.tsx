/** @format */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { H1 } from '@/components/UI/text/typography';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Laptop,
  RefreshCw,
  Play,
  Square,
  LayoutDashboard,
  User as UserIcon,
  Search,
  MessageSquareCode,
  Briefcase,
} from 'lucide-react';
import { Stagger, StaggerItem } from './animation';

const tabs = [
  { id: 'overview', label: 'Overview', hint: 'pulse', path: '/' },
  { id: 'profile', label: 'Profile', hint: 'identity', path: '/profile' },
  { id: 'search', label: 'Search', hint: 'targets', path: '/search' },
  {
    id: 'questions',
    label: 'Question Cache',
    hint: 'answers',
    path: '/questions',
  },
  {
    id: 'applications',
    label: 'Applications History',
    path: '/applications',
  },
] as const;

const tabIcons = {
  overview: LayoutDashboard,
  profile: UserIcon,
  search: Search,
  questions: MessageSquareCode,
  applications: Briefcase,
};

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const {
    user,
    latestRun,
    latestStatusUpdatedAt,
    workerIsStarting,
    workerIsActive,
    workerIsStopping,
    startWorker,
    stopWorker,
    stats,
    error,
    isPending,
    toast,
  } = useConsole();

  const workerSignalAgeMs =
    latestStatusUpdatedAt ? Date.now() - new Date(latestStatusUpdatedAt).getTime() : null;
  const workerSignalIsLive =
    typeof workerSignalAgeMs === 'number' && Number.isFinite(workerSignalAgeMs) && workerSignalAgeMs < 4000;
  const workerStatusCaption =
    workerIsStarting ? 'Starting on this machine'
    : latestRun?.status === 'pending' ? 'Waiting for host agent'
    : workerIsStopping ? 'Stopping on this machine'
    : workerIsActive && workerSignalIsLive ? 'Python worker live'
    : workerIsActive ? 'Python worker running'
    : 'Ready on this machine';
  const workerStatusDetail =
    workerIsActive ?
      latestRun?.current_message || 'Python worker is running'
    : latestRun?.current_message || null;

  return (
    <div className='min-h-screen bg-[#F4F4F6] dark:bg-[#0E1116] text-zinc-900 dark:text-zinc-100 flex transition-colors duration-300'>
      {/* Sidebar */}
      <aside
        className={cn(
          'h-screen sticky top-0 flex flex-col justify-between bg-panel border-r border-zinc-200/50 dark:border-zinc-800/50 p-4 transition-all duration-300 ease-in-out z-20 shrink-0',
          isCollapsed ? 'w-[80px]' : 'w-[260px]',
        )}
      >
        {/* Top Header */}
        <div className='relative'>
          <div className='flex items-center gap-3 px-2 py-1.5 overflow-hidden'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-700 flex items-center justify-center text-white font-extrabold text-lg shadow-md shrink-0'>
              <Bot className='w-5 h-5 text-white' />
            </div>
            {!isCollapsed && (
              <div className='flex flex-col min-w-0'>
                <span className='font-bold tracking-tight text-zinc-800 dark:text-zinc-100 text-sm truncate'>
                  AutoApplyAI
                </span>
                <span className='text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                  Control Panel
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className='absolute -right-12 top-1/2 w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 bg-panel flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shadow-sm z-30 transition-transform hover:scale-105 cursor-pointer'
          >
            {isCollapsed ?
              <ChevronRight className='w-3.5 h-3.5' />
            : <ChevronLeft className='w-3.5 h-3.5' />}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className='flex flex-col gap-1 mt-6 flex-1'>
          {!isCollapsed && (
            <span className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wider mb-2 px-3'>
              MAIN MENU
            </span>
          )}
          {tabs.map((tab) => {
            const Icon = tabIcons[tab.id];
            const isActive =
              tab.path === '/' ?
                pathname === '/'
              : pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl transition-all duration-200 py-2.5 cursor-pointer',
                  isCollapsed ? 'justify-center px-2' : 'px-3',
                  isActive ?
                    'bg-zinc-900 text-white dark:bg-panel dark:text-zinc-950 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/40',
                )}
                title={isCollapsed ? tab.label : undefined}
              >
                <Icon className='w-5 h-5 shrink-0' />
                {!isCollapsed && (
                  <span className='text-sm tracking-tight flex-1 text-left'>
                    {tab.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / User Details & Theme Toggle */}
        <div className='flex flex-col gap-4 border-t border-zinc-200/50 dark:border-zinc-800/50 pt-4'>
          {/* Theme Switcher */}
          <div
            className={cn(
              'flex items-center justify-between',
              isCollapsed ? 'justify-center' : 'px-2',
            )}
          >
            {!isCollapsed && (
              <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                Theme
              </span>
            )}
            <div
              className={cn(
                'flex bg-zinc-100 dark:bg-zinc-800/60 p-0.5 rounded-lg',
                isCollapsed && 'flex-col',
              )}
            >
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'p-1 rounded-md text-zinc-500 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer',
                  theme === 'light' &&
                    'bg-panel dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
                )}
                title='Light Theme'
              >
                <Sun className='w-3.5 h-3.5' />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'p-1 rounded-md text-zinc-500 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer',
                  theme === 'dark' &&
                    'bg-panel dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
                )}
                title='Dark Theme'
              >
                <Moon className='w-3.5 h-3.5' />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={cn(
                  'p-1 rounded-md text-zinc-500 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer',
                  theme === 'system' &&
                    'bg-panel dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
                )}
                title='System Theme'
              >
                <Laptop className='w-3.5 h-3.5' />
              </button>
            </div>
          </div>

          {/* Profile Section */}
          <div
            className={cn(
              'flex items-center gap-3',
              isCollapsed ? 'justify-center' : 'px-2',
            )}
          >
            <div className='relative shrink-0'>
              <div className='w-10 h-10 rounded-full bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/20 shadow-xs'>
                {user?.display_name ?
                  user.display_name.slice(0, 2).toUpperCase()
                : 'LU'}
              </div>
              <span className='absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#181C26] rounded-full'></span>
            </div>

            {!isCollapsed && (
              <div className='flex flex-col min-w-0 flex-1'>
                <span className='text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate leading-tight'>
                  {user?.display_name ?? 'Local Admin'}
                </span>
                <span className='text-[11px] text-zinc-400 dark:text-zinc-500 capitalize truncate'>
                  {user?.role ?? 'admin'}
                </span>
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={() =>
                  void (
                    workerIsStarting || workerIsStopping ? undefined
                    : workerIsActive ? stopWorker()
                    : startWorker()
                  )
                }
                className={cn(
                  'p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer',
                  (workerIsStarting || workerIsStopping) &&
                    'opacity-50 cursor-not-allowed hover:bg-transparent',
                  workerIsStarting ?
                    'text-zinc-400'
                  : workerIsStopping ?
                    'text-zinc-400'
                  : workerIsActive ?
                    'text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
                  : 'text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40',
                )}
                title={
                  workerIsStarting ?
                    'Starting Worker'
                  : workerIsStopping ?
                    'Stopping Worker'
                  : workerIsActive ?
                    'Stop Worker'
                  : 'Start Worker'
                }
                disabled={workerIsStarting || workerIsStopping}
              >
                {workerIsStarting || workerIsStopping ?
                  <RefreshCw className='w-4 h-4 animate-spin' />
                : workerIsActive ?
                  <Square className='w-4 h-4 fill-current' />
                : <Play className='w-4 h-4 fill-current' />}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className='flex-1 min-w-0 p-page overflow-y-auto'>
        <div className='max-w-[1200px] mx-auto grid gap-8'>
          {/* Hero Header */}
          {pathname === '/' && (
            <header className='hero bg-gradient-to-br from-green-800 via-emerald-900 to-zinc-950'>
              <span className='inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2 px-2 py-0.5 rounded-md bg-emerald-500/20'>
                PostgreSQL backed workspace
              </span>
              <h1>Manage once. Let the local worker apply with clean data.</h1>
              <p>
                This console reads and writes through the API layer, so profile
                changes, saved answers, and application history now live in
                PostgreSQL instead of scattered files.
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
                  <StaggerItem yOffset={20}>
                    <CardWithNorth key={item.label} title={item.label}>
                      <div className='flex items-start justify-between relative'>
                        <div
                          className={cn(
                            'absolute -top-16 -right-2 z-50 p-6 rounded-full backdrop-blur-[3px]',
                            item.bgColor,
                            item.borderColor,
                          )}
                        >
                          <Icon className={cn('w-10 h-10', item.iconColor)} />
                        </div>
                        <H1 className={cn(item.textColor)}>{item.value}</H1>
                      </div>
                    </CardWithNorth>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}

          {error && (
            <div className='p-4 text-sm rounded-2xl border border-red-200/60 bg-red-500/5 text-red-600 dark:border-red-900/30 dark:text-red-400 flex items-center justify-center'>
              {error}
            </div>
          )}
          {isPending && (
            <div className='p-4 text-sm rounded-2xl border border-zinc-200/60 bg-zinc-50 text-zinc-500 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:text-zinc-400 flex items-center justify-center gap-2'>
              <RefreshCw className='w-4 h-4 animate-spin' />
              Refreshing data...
            </div>
          )}

          {/* Child Page Content */}
          {children}
        </div>
      </main>

      {/* Floating Launch Button */}
      <div className='fixed bottom-6 right-6 z-40'>
        <button
          className={cn(
            'relative group flex flex-col items-start gap-0.5 rounded-2xl px-6 py-4 shadow-lg border text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer',
            workerIsStarting ?
              'bg-gradient-to-tr from-sky-600 to-cyan-700 border-sky-500/20'
            : workerIsStopping ?
              'bg-gradient-to-tr from-amber-600 to-orange-700 border-amber-500/20'
            : workerIsActive ?
              'bg-gradient-to-tr from-red-600 to-rose-700 border-red-500/20'
            : 'bg-gradient-to-tr from-green-600 to-emerald-700 border-green-500/20 disabled:opacity-50 disabled:pointer-events-none',
          )}
          onClick={() =>
            void (
              workerIsStarting || workerIsStopping ? undefined
              : workerIsActive ? stopWorker()
              : startWorker()
            )
          }
          disabled={(workerIsStarting || workerIsStopping) || (!workerIsActive && !user?.can_use_auto_apply)}
        >
          {/* Pulsing glow ring when active */}
          {!workerIsActive && !workerIsStarting && !workerIsStopping && user?.can_use_auto_apply && (
            <span className='absolute inset-0 rounded-2xl bg-green-500/20 animate-pulse pointer-events-none z-0'></span>
          )}
          {workerIsStarting && (
            <span className='absolute inset-0 rounded-2xl bg-sky-500/20 animate-pulse pointer-events-none z-0'></span>
          )}
          {workerIsActive && (
            <span className='absolute inset-0 rounded-2xl bg-red-500/20 animate-pulse pointer-events-none z-0'></span>
          )}
          {workerIsStopping && (
            <span className='absolute inset-0 rounded-2xl bg-amber-500/20 animate-pulse pointer-events-none z-0'></span>
          )}

          <span className='text-[10px] uppercase font-bold tracking-wider opacity-80 z-10'>
            {workerStatusCaption}
          </span>
          <strong className='text-sm font-extrabold tracking-tight z-10 flex items-center gap-1.5'>
            {workerIsStarting || workerIsStopping ?
              <RefreshCw className='w-3.5 h-3.5 animate-spin' />
            : workerIsActive ?
              <Square className='w-3.5 h-3.5 fill-white' />
            : <Play className='w-3.5 h-3.5 fill-white' />}
            {workerIsStarting ?
              'Starting Auto Apply'
            : workerIsStopping ?
              'Stopping Auto Apply'
            : workerIsActive ?
              'Stop Auto Apply'
            : 'Start Auto Apply'}
          </strong>
          {workerStatusDetail && (
            <span className='text-[11px] leading-tight text-white/80 z-10 max-w-[240px] truncate'>
              {workerStatusDetail}
            </span>
          )}
        </button>
      </div>

      {toast && (
        <div className='fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white dark:bg-panel dark:text-zinc-950 px-4 py-3 rounded-xl shadow-md border border-zinc-800 dark:border-zinc-200 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300'>
          {toast}
        </div>
      )}
    </div>
  );
}
