/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { motion, useDragControls, useMotionValue } from 'framer-motion';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';
import {
  Bot,
  Search,
  RefreshCw,
  Play,
  Square,
  X,
  Activity,
} from 'lucide-react';
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

const PLATFORM_CARDS: Array<{
  key: DesktopBotPlatform;
  label: string;
}> = [
  { key: 'linkedin', label: 'LinkedIn Easy Apply' },
  { key: 'seek', label: 'Seek Quick Apply' },
  { key: 'third_party', label: 'Third-Party Assist' },
];

export default function AutomationPanel() {
  const {
    user,
    mainBotState,
    mainBotName,
    isDesktopApp,
    botStates,
    startBot,
    stopBot,
  } = useConsole();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [corner, setCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [mounted, setMounted] = useState(false);

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragControls = useDragControls();

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('automation-panel-corner');
    if (saved === 'top-left' || saved === 'top-right' || saved === 'bottom-left' || saved === 'bottom-right') {
      setCorner(saved);
    }
  }, []);

  if (!isDesktopApp) return null;

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
    : desktopBotIsActive ? 'Python worker is ready to apply'
    : 'Launch the local LinkedIn bot from this desktop app';

  const handleDragEnd = (event: any, info: any) => {
    const x = info.point.x;
    const y = info.point.y;
    const W = window.innerWidth;
    const H = window.innerHeight;

    let newCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right';

    if (x < W / 2) {
      if (y < H / 2) {
        newCorner = 'top-left';
      } else {
        newCorner = 'bottom-left';
      }
    } else {
      if (y < H / 2) {
        newCorner = 'top-right';
      } else {
        newCorner = 'bottom-right';
      }
    }

    setCorner(newCorner);
    localStorage.setItem('automation-panel-corner', newCorner);

    // Reset offsets back to zero so layout animation takes over positioning
    dragX.set(0);
    dragY.set(0);
  };

  const isTop = corner.startsWith('top');
  const isLeft = corner.endsWith('left');

  // Prevent rendering position logic on server to avoid hydration mismatch
  if (!mounted) return null;

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.08}
      style={{ x: dragX, y: dragY }}
      onDragEnd={handleDragEnd}
      layout
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      className={cn(
        'fixed z-40 flex gap-4 pointer-events-auto touch-none',
        corner === 'top-left' && 'top-6 left-6 flex-col items-start',
        corner === 'top-right' && 'top-6 right-6 flex-col items-end',
        corner === 'bottom-left' && 'bottom-6 left-6 flex-col-reverse items-start',
        corner === 'bottom-right' && 'bottom-6 right-6 flex-col-reverse items-end',
      )}
    >
      {/* Floating Action Button (FAB) / Drag Handle */}
      <button
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-lg border text-white transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] cursor-grab active:cursor-grabbing z-40 relative select-none',
          Object.values(botStates || {}).some((s: any) =>
            ['starting', 'running', 'stopping'].includes(s?.status),
          ) ?
            'bg-gradient-to-tr from-emerald-600 to-green-700 border-green-500/20 shadow-green-500/20'
          : 'bg-gradient-to-tr from-zinc-700 to-zinc-800 border-zinc-600/20 shadow-zinc-800/20',
        )}
      >
        {Object.values(botStates || {}).some((s: any) =>
          ['starting', 'running', 'stopping'].includes(s?.status),
        ) && (
          <span className='absolute -top-1 -right-1 flex h-4 w-4 pointer-events-none'>
            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
            <span className='relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white dark:border-zinc-900'></span>
          </span>
        )}
        <Bot
          className={cn(
            'w-6 h-6 transition-transform duration-300 pointer-events-none',
            isPanelOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Floating Launch Button */}
      <button
        className={cn(
          'relative group flex flex-col items-start gap-0.5 rounded-2xl px-6 py-4 shadow-lg border text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer min-w-[260px] select-none',
          desktopBotIsStarting ?
            'bg-gradient-to-tr from-sky-600 to-cyan-700 border-sky-500/20'
          : desktopBotIsStopping ?
            'bg-gradient-to-tr from-amber-600 to-orange-700 border-amber-500/20'
          : desktopBotIsActive ?
            'bg-gradient-to-tr from-red-600 to-rose-700 border-red-500/20'
          : 'bg-gradient-to-tr from-green-600 to-emerald-700 border-green-500/20 disabled:opacity-50 disabled:pointer-events-none',
        )}
        onClick={() =>
          void (desktopBotIsStarting || desktopBotIsStopping ? undefined
          : desktopBotIsActive ? stopBot(mainBotName)
          : startBot(mainBotName))
        }
        disabled={
          desktopBotIsStarting ||
          desktopBotIsStopping ||
          (!desktopBotIsActive && !user?.can_use_auto_apply)
        }
      >
        {!desktopBotIsActive &&
          !desktopBotIsStarting &&
          !desktopBotIsStopping &&
          user?.can_use_auto_apply && (
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

        <span className='text-[10px] uppercase font-bold tracking-wider opacity-80 z-10 pointer-events-none'>
          {desktopWorkerStatusCaption}
        </span>
        <strong className='text-sm font-extrabold tracking-tight z-10 flex items-center gap-1.5 pointer-events-none'>
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
        <span className='text-[11px] leading-tight text-white/80 z-10 max-w-[240px] truncate pointer-events-none'>
          {desktopWorkerStatusDetail}
        </span>
      </button>

      {/* Automation Control Panel Overlay */}
      {isPanelOpen && (
        <div className='w-96 max-h-[520px] flex flex-col rounded-3xl border border-zinc-200/50 dark:border-zinc-800/80 bg-white/95 dark:bg-[#0f1219]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300'>
          {/* Header */}
          <div className='p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40 select-none'>
            <div className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-700 flex items-center justify-center shadow-md'>
                <Bot className='w-4 h-4 text-white' />
              </div>
              <div>
                <h3 className='font-bold text-xs text-zinc-900 dark:text-zinc-150'>
                  Platform Automation
                </h3>
                <p className='text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold'>
                  Direct process console
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPanelOpen(false)}
              className='p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer'
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
              const isRunning = [
                'starting',
                'running',
                'stopping',
              ].includes(state.status);
              const isStopping = state.status === 'stopping';
              const isStarting = state.status === 'starting';

              const label = platformCard.label;
              const PlatformIcon =
                platform === 'linkedin' ? LinkedinIcon
                : platform === 'seek' ? Search
                : Bot;

              const statusBadgeColor =
                state.status === 'success' ?
                  'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                : state.status === 'failed' ?
                  'text-red-500 bg-red-500/10 border-red-500/20'
                : state.status === 'cancelled' ?
                  'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
                : isRunning ?
                  'text-blue-500 bg-blue-500/10 border-blue-500/20'
                : 'text-zinc-400 bg-zinc-500/5 border-zinc-500/10';

              const dotColor =
                state.status === 'success' ? 'bg-emerald-500'
                : state.status === 'failed' ? 'bg-red-500'
                : state.status === 'cancelled' ? 'bg-zinc-500'
                : isRunning ? 'bg-blue-500 animate-pulse'
                : 'bg-zinc-400';

              return (
                <div
                  key={platform}
                  className='p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col gap-3 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700'
                >
                  {/* Row Header */}
                  <div className='flex items-center justify-between select-none'>
                    <div className='flex items-center gap-2.5'>
                      <div className='w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 border border-zinc-200/20'>
                        <PlatformIcon className='w-4 h-4' />
                      </div>
                      <div>
                        <h4 className='font-bold text-xs text-zinc-800 dark:text-zinc-200'>
                          {label}
                        </h4>
                        <span className='text-[9px] text-zinc-400 font-semibold uppercase tracking-wider'>
                          {platform} bot
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border tracking-wider',
                        statusBadgeColor,
                      )}
                    >
                      <span
                        className={cn('w-1.5 h-1.5 rounded-full', dotColor)}
                      />
                      {state.status}
                    </span>
                  </div>

                  {/* Stats Grid */}
                  <div className='grid grid-cols-3 gap-1 px-3 py-2 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/30 text-center text-[10px] font-medium select-none'>
                    <div>
                      <div className='text-zinc-400 dark:text-zinc-500 font-semibold mb-0.5'>
                        Submitted
                      </div>
                      <div className='font-bold text-emerald-600 dark:text-emerald-400 text-xs'>
                        {state.stats?.submitted ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className='text-zinc-400 dark:text-zinc-500 font-semibold mb-0.5'>
                        Skipped
                      </div>
                      <div className='font-bold text-amber-500 text-xs'>
                        {state.stats?.skipped ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className='text-zinc-400 dark:text-zinc-500 font-semibold mb-0.5'>
                        Failed
                      </div>
                      <div className='font-bold text-red-500 text-xs'>
                        {state.stats?.failed ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className='flex items-center gap-2'>
                    {isRunning ?
                      <button
                        onClick={() => stopBot(platform)}
                        disabled={isStopping}
                        className='flex-1 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5'
                      >
                        {isStopping ?
                          <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                        : <Square className='w-3 h-3 fill-white' />}
                        {platform === 'third_party' ?
                          'Stop Assist'
                        : 'Stop Bot'}
                      </button>
                    : <button
                        onClick={() => startBot(platform)}
                        disabled={isStarting}
                        className='flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5'
                      >
                        {isStarting ?
                          <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                        : <Play className='w-3 h-3 fill-white' />}
                        {platform === 'third_party' ?
                          'Open Assist'
                        : 'Start Bot'}
                      </button>
                    }
                  </div>

                  {/* Status Message */}
                  {state.message && state.message !== 'Idle' && (
                    <div className='text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 truncate bg-zinc-100/30 dark:bg-zinc-900/10 px-2 py-1 rounded-lg border border-zinc-200/20 select-none'>
                      <Activity className='w-3.5 h-3.5 text-blue-500 shrink-0 animate-pulse' />
                      <span className='font-medium truncate'>
                        {state.message}
                      </span>
                    </div>
                  )}

                  {/* Real-time mini console preview */}
                  {state.logs && state.logs.length > 0 && (
                    <div className='h-20 rounded-xl bg-zinc-950/95 p-2.5 font-mono text-[9px] text-zinc-400 overflow-y-auto border border-zinc-800/80 scrollbar-none'>
                      {state.logs.slice(-3).map((log, i) => (
                        <div
                          key={i}
                          className='truncate opacity-80 leading-normal flex items-start gap-1'
                        >
                          <span className='text-zinc-600 shrink-0'>
                            [{log.at.split('T')[1].split('.')[0]}]
                          </span>
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
    </motion.div>
  );
}
