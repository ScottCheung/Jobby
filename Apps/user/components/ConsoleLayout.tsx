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
  X,
  Terminal,
  Activity,
} from 'lucide-react';
import { Stagger, StaggerItem } from './animation';
import type { DesktopBotPlatform } from '@/lib/types';

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    {...props}
  >
    <path d='M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' />
    <rect x='2' y='9' width='4' height='12' />
    <circle cx='4' cy='4' r='2' />
  </svg>
);

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

const PLATFORM_CARDS: Array<{
  key: DesktopBotPlatform;
  label: string;
}> = [
  { key: 'linkedin', label: 'LinkedIn Easy Apply' },
  { key: 'seek', label: 'Seek Quick Apply' },
  { key: 'third_party', label: 'Third-Party Assist' },
];

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const pathname = usePathname();

  const {
    user,
    mainBotState,
    mainBotName,
    stats,
    error,
    isPending,
    toast,
    isDesktopApp,
    botStates,
    startBot,
    stopBot,
  } = useConsole();
  const desktopBotStatus = String(mainBotState?.status || 'idle').toLowerCase();
  const desktopBotIsStarting = desktopBotStatus === 'starting';
  const desktopBotIsStopping = desktopBotStatus === 'stopping';
  const desktopBotIsActive = ['starting', 'running', 'stopping'].includes(
    desktopBotStatus,
  );
  const desktopWorkerStatusCaption =
    desktopBotIsStarting ? 'Starting on this machine'
    : desktopBotIsStopping ? 'Stopping on this machine'
    : desktopBotIsActive ? 'Python worker live'
    : 'Ready on this machine';
  const desktopWorkerStatusDetail =
    mainBotState?.message && mainBotState.message !== 'Idle' ?
      mainBotState.message
    : desktopBotIsActive ?
      'Python worker is ready to apply'
    : 'Launch the local LinkedIn bot from this desktop app';
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
                    isDesktopApp ?
                      desktopBotIsStarting || desktopBotIsStopping ? undefined
                      : desktopBotIsActive ? stopBot(mainBotName)
                      : startBot(mainBotName)
                    : undefined
                  )
                }
                className={cn(
                  'p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer',
                  ((isDesktopApp &&
                    (desktopBotIsStarting || desktopBotIsStopping)) ||
                    !isDesktopApp) &&
                    'opacity-50 cursor-not-allowed hover:bg-transparent',
                  isDesktopApp ?
                    desktopBotIsStarting ?
                      'text-zinc-400'
                    : desktopBotIsStopping ?
                      'text-zinc-400'
                    : desktopBotIsActive ?
                      'text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
                    : 'text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
                  : 'text-zinc-400',
                )}
                title={
                  isDesktopApp ?
                    desktopBotIsStarting ?
                      'Starting Worker'
                    : desktopBotIsStopping ?
                      'Stopping Worker'
                    : desktopBotIsActive ?
                      'Stop Worker'
                    : 'Start Worker'
                  : 'Desktop controls only'
                }
                disabled={
                  isDesktopApp ?
                    desktopBotIsStarting || desktopBotIsStopping
                  : true
                }
              >
                {(isDesktopApp &&
                  (desktopBotIsStarting || desktopBotIsStopping)) ?
                  <RefreshCw className='w-4 h-4 animate-spin' />
                : (isDesktopApp ? desktopBotIsActive : false) ?
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

      {/* Floating Launch Button / Automation Panel */}
      {!isDesktopApp ? (
        <div className='fixed bottom-6 right-6 z-40 max-w-[280px] rounded-2xl border border-zinc-200/60 bg-white/95 px-5 py-4 text-sm text-zinc-600 shadow-lg dark:border-zinc-800/60 dark:bg-[#0f1219]/95 dark:text-zinc-300'>
          Open this project from the Electron desktop app to use live bot
          controls.
        </div>
      ) : (
        <div className='fixed bottom-6 right-6 z-40 flex flex-col items-end gap-4'>
          <button
            className={cn(
              'relative group flex flex-col items-start gap-0.5 rounded-2xl px-6 py-4 shadow-lg border text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer min-w-[260px]',
              desktopBotIsStarting ?
                'bg-gradient-to-tr from-sky-600 to-cyan-700 border-sky-500/20'
              : desktopBotIsStopping ?
                'bg-gradient-to-tr from-amber-600 to-orange-700 border-amber-500/20'
              : desktopBotIsActive ?
                'bg-gradient-to-tr from-red-600 to-rose-700 border-red-500/20'
              : 'bg-gradient-to-tr from-green-600 to-emerald-700 border-green-500/20 disabled:opacity-50 disabled:pointer-events-none',
            )}
            onClick={() =>
              void (
                desktopBotIsStarting || desktopBotIsStopping ? undefined
                : desktopBotIsActive ? stopBot(mainBotName)
                : startBot(mainBotName)
              )
            }
            disabled={
              (desktopBotIsStarting || desktopBotIsStopping) ||
              (!desktopBotIsActive && !user?.can_use_auto_apply)
            }
          >
            {!desktopBotIsActive && !desktopBotIsStarting && !desktopBotIsStopping && user?.can_use_auto_apply && (
              <span className='absolute inset-0 rounded-2xl bg-green-500/20 animate-pulse pointer-events-none z-0'></span>
            )}
            {desktopBotIsStarting && (
              <span className='absolute inset-0 rounded-2xl bg-sky-500/20 animate-pulse pointer-events-none z-0'></span>
            )}
            {desktopBotIsActive && !desktopBotIsStopping && (
              <span className='absolute inset-0 rounded-2xl bg-red-500/20 animate-pulse pointer-events-none z-0'></span>
            )}
            {desktopBotIsStopping && (
              <span className='absolute inset-0 rounded-2xl bg-amber-500/20 animate-pulse pointer-events-none z-0'></span>
            )}

            <span className='text-[10px] uppercase font-bold tracking-wider opacity-80 z-10'>
              {desktopWorkerStatusCaption}
            </span>
            <strong className='text-sm font-extrabold tracking-tight z-10 flex items-center gap-1.5'>
              {desktopBotIsStarting || desktopBotIsStopping ?
                <RefreshCw className='w-3.5 h-3.5 animate-spin' />
              : desktopBotIsActive ?
                <Square className='w-3.5 h-3.5 fill-white' />
              : <Play className='w-3.5 h-3.5 fill-white' />}
              {desktopBotIsStarting ?
                'Starting Auto Apply'
              : desktopBotIsStopping ?
                'Stopping Auto Apply'
              : desktopBotIsActive ?
                'Stop Auto Apply'
              : 'Start Auto Apply'}
            </strong>
            <span className='text-[11px] leading-tight text-white/80 z-10 max-w-[240px] truncate'>
              {desktopWorkerStatusDetail}
            </span>
          </button>

          {/* Automation Control Panel Overlay */}
          {isPanelOpen && (
            <div className='w-96 max-h-[520px] flex flex-col rounded-3xl border border-zinc-200/50 dark:border-zinc-805/80 bg-white/95 dark:bg-[#0f1219]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300'>
              {/* Header */}
              <div className='p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-700 flex items-center justify-center shadow-md'>
                    <Bot className='w-4 h-4 text-white' />
                  </div>
                  <div>
                    <h3 className='font-bold text-xs text-zinc-900 dark:text-zinc-150'>Platform Automation</h3>
                    <p className='text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold'>Direct process console</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className='p-1.5 rounded-xl text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>

              {/* Scrollable Platform List */}
              <div className='flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none'>
                {PLATFORM_CARDS.map((platformCard) => {
                  const platform = platformCard.key;
                  const state = botStates?.[platform] || {
                    status: 'idle',
                    message: 'Idle',
                    stats: { submitted: 0, skipped: 0, failed: 0 },
                    logs: [],
                  };
                  const isRunning = ['starting', 'running', 'stopping'].includes(state.status);
                  const isStopping = state.status === 'stopping';
                  const isStarting = state.status === 'starting';

                  const label = platformCard.label;
                  const PlatformIcon = platform === 'linkedin' ? LinkedinIcon : platform === 'seek' ? Search : Bot;

                  const statusBadgeColor =
                    state.status === 'success' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' :
                    state.status === 'failed' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
                    state.status === 'cancelled' ? 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' :
                    isRunning ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' : 'text-zinc-400 bg-zinc-500/5 border-zinc-500/10';

                  const dotColor =
                    state.status === 'success' ? 'bg-emerald-500' :
                    state.status === 'failed' ? 'bg-red-500' :
                    state.status === 'cancelled' ? 'bg-zinc-500' :
                    isRunning ? 'bg-blue-500 animate-pulse' : 'bg-zinc-400';

                  return (
                    <div
                      key={platform}
                      className='p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col gap-3 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700'
                    >
                      {/* Row Header */}
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2.5'>
                          <div className='w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-650 dark:text-zinc-350 border border-zinc-200/20'>
                            <PlatformIcon className='w-4 h-4' />
                          </div>
                          <div>
                            <h4 className='font-bold text-xs text-zinc-850 dark:text-zinc-200'>{label}</h4>
                            <span className='text-[9px] text-zinc-400 font-semibold uppercase tracking-wider'>{platform} bot</span>
                          </div>
                        </div>
                        <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border tracking-wider', statusBadgeColor)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
                          {state.status}
                        </span>
                      </div>

                      {/* Stats Grid */}
                      <div className='grid grid-cols-3 gap-1 px-3 py-2 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/30 text-center text-[10px] font-medium'>
                        <div>
                          <div className='text-zinc-400 dark:text-zinc-500 font-semibold mb-0.5'>Submitted</div>
                          <div className='font-bold text-emerald-600 dark:text-emerald-400 text-xs'>{state.stats?.submitted ?? 0}</div>
                        </div>
                        <div>
                          <div className='text-zinc-400 dark:text-zinc-500 font-semibold mb-0.5'>Skipped</div>
                          <div className='font-bold text-amber-500 text-xs'>{state.stats?.skipped ?? 0}</div>
                        </div>
                        <div>
                          <div className='text-zinc-400 dark:text-zinc-500 font-semibold mb-0.5'>Failed</div>
                          <div className='font-bold text-red-500 text-xs'>{state.stats?.failed ?? 0}</div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className='flex items-center gap-2'>
                        {isRunning ? (
                          <button
                            onClick={() => stopBot(platform)}
                            disabled={isStopping}
                            className='flex-1 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5'
                          >
                            {isStopping ? (
                              <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                            ) : (
                              <Square className='w-3 h-3 fill-white' />
                            )}
                            {platform === 'third_party' ? 'Stop Assist' : 'Stop Bot'}
                          </button>
                        ) : (
                          <button
                            onClick={() => startBot(platform)}
                            disabled={isStarting}
                            className='flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5'
                          >
                            {isStarting ? (
                              <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                            ) : (
                              <Play className='w-3 h-3 fill-white' />
                            )}
                            {platform === 'third_party' ? 'Open Assist' : 'Start Bot'}
                          </button>
                        )}
                      </div>

                      {/* Status Message */}
                      {state.message && state.message !== 'Idle' && (
                        <div className='text-[10px] text-zinc-650 dark:text-zinc-400 flex items-center gap-1.5 truncate bg-zinc-100/30 dark:bg-zinc-900/10 px-2 py-1 rounded-lg border border-zinc-200/20'>
                          <Activity className='w-3.5 h-3.5 text-blue-500 shrink-0 animate-pulse' />
                          <span className='font-medium truncate'>{state.message}</span>
                        </div>
                      )}

                      {/* Real-time mini console preview */}
                      {state.logs && state.logs.length > 0 && (
                        <div className='h-20 rounded-xl bg-zinc-950/95 p-2.5 font-mono text-[9px] text-zinc-400 overflow-y-auto border border-zinc-800/80 scrollbar-none'>
                          {state.logs.slice(-3).map((log, i) => (
                            <div key={i} className='truncate opacity-80 leading-normal flex items-start gap-1'>
                              <span className='text-zinc-600 shrink-0'>[{log.at.split('T')[1].split('.')[0]}]</span>
                              <span className='break-all'>{log.line}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Floating Action Button (FAB) */}
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center shadow-lg border text-white transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] cursor-pointer z-40 relative',
              Object.values(botStates || {}).some((s: any) => ['starting', 'running', 'stopping'].includes(s?.status)) ?
                'bg-gradient-to-tr from-emerald-600 to-green-700 border-green-500/20 shadow-green-500/20'
              : 'bg-gradient-to-tr from-zinc-700 to-zinc-800 border-zinc-600/20 shadow-zinc-800/20'
            )}
          >
            {Object.values(botStates || {}).some((s: any) => ['starting', 'running', 'stopping'].includes(s?.status)) && (
              <span className='absolute -top-1 -right-1 flex h-4 w-4'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                <span className='relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white dark:border-zinc-900'></span>
              </span>
            )}
            <Bot className={cn('w-6 h-6 transition-transform duration-300', isPanelOpen && 'rotate-180')} />
          </button>
        </div>
      )}

      {toast && (
        <div className='fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white dark:bg-panel dark:text-zinc-950 px-4 py-3 rounded-xl shadow-md border border-zinc-800 dark:border-zinc-200 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300'>
          {toast}
        </div>
      )}
    </div>
  );
}
