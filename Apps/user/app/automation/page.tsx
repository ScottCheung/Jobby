/** @format */

'use client';

import React, { useState } from 'react';
import { useConsole } from '@/components/ConsoleContext';
import { H1 } from '@/components/UI/text/typography';
import { SegmentedControl } from '@/components/UI/segmented-control';
import { EmptyPlaceHolder } from '@/components/UI/EmptyPlaceHolder';
import { type DesktopBotPlatform } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Globe,
  Activity,
  Sparkles,
  Monitor,
  CheckCircle2,
  SearchCheck,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';

const PLATFORM_CARDS: Array<{
  key: DesktopBotPlatform;
  label: string;
  subtitle: string;
  actionLabel: string;
  icon: React.ElementType;
}> = [
  {
    key: 'linkedin',
    label: 'LinkedIn Easy Apply',
    subtitle: 'Automate job search & easy applications',
    actionLabel: 'Start LinkedIn Bot',
    icon: Globe,
  },
  {
    key: 'seek',
    label: 'Seek Quick Apply',
    subtitle: 'Automate Seek job applications',
    actionLabel: 'Start Seek Bot',
    icon: Globe,
  },
  {
    key: 'third_party',
    label: 'Third-Party Assist',
    subtitle: 'Assisted form filling on external portals',
    actionLabel: 'Start Assist',
    icon: Sparkles,
  },
];

export default function AutomationConsolePage() {
  const { isDesktopApp, botStates, startBot, stopBot } = useConsole();
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  const controlOptions = [
    { value: 'all', label: 'All Platforms', icon: Layers },
    { value: 'linkedin', label: 'LinkedIn', icon: Globe },
    { value: 'seek', label: 'Seek', icon: Globe },
    { value: 'third_party', label: 'Third-Party Assist', icon: Sparkles },
  ];

  const visibleCards =
    selectedPlatform === 'all'
      ? PLATFORM_CARDS
      : PLATFORM_CARDS.filter((card) => card.key === selectedPlatform);

  if (!isDesktopApp) {
    return (
      <div className='max-w-5xl mx-auto py-12 px-6'>
        <div className='mb-8'>
          <H1 className='text-ink-primary'>Platform Automation Console</H1>
          <p className='body-sm text-ink-secondary mt-1'>
            Launch and monitor automated job applications across active platforms
          </p>
        </div>

        <div className='bg-panel border border-border/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center'>
          <div className='w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4'>
            <Monitor className='w-8 h-8' />
          </div>
          <h3 className='title-card text-ink-primary mb-2'>
            Desktop App Connection Required
          </h3>
          <p className='body-md text-ink-secondary max-w-md mb-6'>
            Direct bot process automation runs locally inside the Jobby Desktop Client.
            Please launch Jobby Desktop App to access real-time bot control.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto py-8 px-4 sm:px-6 flex flex-col gap-8'>
      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6'>
        <div>
          <div className='inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 mb-2'>
            Direct Process Control
          </div>
          <H1 className='text-ink-primary'>Platform Automation Console</H1>
          <p className='body-sm text-ink-secondary mt-1'>
            Launch and monitor automated job applications across active platforms in real time
          </p>
        </div>

        {/* Platform Toggle SegmentedControl */}
        <div className='shrink-0'>
          <SegmentedControl
            options={controlOptions}
            value={selectedPlatform}
            onChange={(val) => setSelectedPlatform(val)}
            size='lg'
          />
        </div>
      </div>

      {/* Bot Cards Grid */}
      <div
        className={cn(
          'grid gap-6',
          selectedPlatform === 'all' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1',
        )}
      >
        {visibleCards.map((platformCard) => {
          const platform = platformCard.key;
          const state = botStates[platform] || {
            status: 'idle',
            message: 'Idle',
            stats: { submitted: 0, skipped: 0, failed: 0 },
            logs: [],
          };
          const isRunning = ['starting', 'running', 'waiting', 'stopping'].includes(state.status);
          const label = platformCard.label;
          const Icon = platformCard.icon;
          const statusColor =
            state.status === 'success'
              ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
              : state.status === 'failed'
              ? 'text-red-500 bg-red-500/10 border-red-500/20'
              : state.status === 'cancelled'
              ? 'text-ink-primary0 bg-zinc-500/10 border-zinc-500/20'
              : state.status === 'waiting'
              ? 'text-amber-500 bg-amber-500/10 border-amber-500/20 animate-text-shimmer'
              : isRunning
              ? 'text-blue-500 bg-blue-500/10 border-blue-500/20 animate-text-shimmer'
              : 'text-zinc-400 bg-zinc-500/5 border-border/40';

          return (
            <div
              key={platform}
              className='rounded-3xl border border-border/60 bg-panel p-6 flex flex-col justify-between shadow-xs hover:border-primary/30 transition-all'
            >
              <div>
                {/* Card Header */}
                <div className='flex items-center justify-between gap-3 mb-4'>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
                      <Icon className='h-6 w-6' />
                    </div>
                    <div>
                      <h3 className='title-card text-ink-primary'>{label}</h3>
                      <p className='body-sm text-ink-secondary'>{platformCard.subtitle}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}
                  >
                    <span className='w-1.5 h-1.5 rounded-full bg-current' />
                    {state.status === 'waiting' ? 'Waiting' : state.status}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className='grid grid-cols-3 gap-3 py-3 px-4 mb-4 rounded-2xl bg-background-secondary/60 dark:bg-panel/40 text-center border border-border/40'>
                  <div>
                    <div className='label-overline text-ink-secondary mb-1'>Submitted</div>
                    <div className='title-card text-emerald-600 dark:text-emerald-400 font-bold'>
                      {state.stats.submitted}
                    </div>
                  </div>
                  <div>
                    <div className='label-overline text-ink-secondary mb-1'>Skipped</div>
                    <div className='title-card text-amber-500 font-bold'>
                      {state.stats.skipped}
                    </div>
                  </div>
                  <div>
                    <div className='label-overline text-ink-secondary mb-1'>Failed</div>
                    <div className='title-card text-red-500 font-bold'>
                      {state.stats.failed}
                    </div>
                  </div>
                </div>

                {/* Current Log Status */}
                <div className='body-sm mb-3 flex items-center gap-2 text-ink-secondary bg-background-secondary/30 p-3 rounded-xl border border-border/40'>
                  <Activity className='h-4 w-4 text-primary shrink-0 animate-pulse' />
                  <span className='font-medium truncate text-ink-primary'>{state.message}</span>
                </div>

                {/* Real-time terminal log stream */}
                <div
                  className={cn(
                    'mb-6 rounded-2xl bg-zinc-950 p-4 font-mono text-xs text-zinc-300 overflow-y-auto border border-zinc-800/80 shadow-inner custom-scrollbar-primary',
                    selectedPlatform === 'all' ? 'h-64' : 'h-96',
                  )}
                >
                  {state.logs.length === 0 ? (
                    <div className='text-zinc-500 italic flex items-center gap-2 h-full justify-center'>
                      <Clock className='w-4 h-4' />
                      Waiting for automation logs...
                    </div>
                  ) : (
                    state.logs.map((log, i) => (
                      <div key={i} className='truncate leading-relaxed hover:bg-zinc-900 px-1 rounded'>
                        <span className='text-zinc-500 mr-2 font-semibold'>
                          [{log.at.split('T')[1].split('.')[0]}]
                        </span>
                        {log.line}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Start / Stop Actions */}
              <div className='flex items-center gap-3 pt-2 border-t border-border/40'>
                {isRunning ? (
                  <button
                    onClick={() => stopBot(platform)}
                    className='label flex-1 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2'
                  >
                    <Activity className='h-4 w-4 animate-spin' />
                    Stop {platform === 'third_party' ? 'Assist' : 'Bot'}
                  </button>
                ) : (
                  <>
                    {platform === 'linkedin' && (
                      <button
                        onClick={() => startBot(platform, { diagnostic: true })}
                        className='label size-11 shrink-0 rounded-full border border-border bg-background text-ink-secondary transition hover:border-primary/50 hover:text-primary active:scale-95 cursor-pointer flex items-center justify-center'
                        title='Run safe LinkedIn diagnostic'
                        aria-label='Run safe LinkedIn diagnostic'
                      >
                        <SearchCheck className='h-4 w-4' />
                      </button>
                    )}
                    <button
                      onClick={() => startBot(platform)}
                      className='label flex-1 py-3 rounded-full bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2'
                    >
                      <CheckCircle2 className='h-4 w-4' />
                      {platformCard.actionLabel}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
