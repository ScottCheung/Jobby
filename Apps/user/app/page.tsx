/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useConsole } from '@/components/ConsoleContext';
import { H2 } from '@/components/UI/text/typography';
import { Chart, ChartWrapper } from '@/components/UI/Chart';
import {
  getDisplayApplicationStatus,
  getStatusBadgeClasses,
  shouldShowApplicationSkipReason,
  type DesktopBotPlatform,
} from '@/lib/types';
import {
  ChartNoAxesGantt,
  CalendarSearch,
  MonitorCog,
  Globe,
  Activity,
  Check,
  ChevronRight,
  ContactRound,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { ToggleGroup } from '@/components/UI/toggle-group';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/ConsoleUtils';
import { CityVectorMap } from '@/components/UI/Map/CityVectorMap';

const PLATFORM_CARDS: Array<{
  key: DesktopBotPlatform;
  label: string;
  subtitle: string;
  actionLabel: string;
}> = [
  {
    key: 'linkedin',
    label: 'LinkedIn Automation',
    subtitle: 'Easy Apply Bot',
    actionLabel: 'Start LinkedIn',
  },
  {
    key: 'seek',
    label: 'Seek Automation',
    subtitle: 'Quick Apply Bot',
    actionLabel: 'Start Seek',
  },
  {
    key: 'third_party',
    label: 'Third-Party Assist',
    subtitle: 'Guided Form Fill',
    actionLabel: 'Assist Current Page',
  },
];

type QuickStartStep = {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  complete: boolean;
};

function ApplicationQuickStart() {
  const { hasLoadedInitialData, profile, jobHuntingProfile } = useConsole();

  if (!hasLoadedInitialData) return null;

  const hasPersonalDetails = Boolean(
    profile.first_name?.trim() &&
      profile.last_name?.trim() &&
      profile.phone_number?.trim(),
  );
  const hasSearchTarget = Boolean(jobHuntingProfile.search_terms?.length);
  const hasResume = Boolean(
    jobHuntingProfile.resume_path?.trim() ||
      String(jobHuntingProfile.extra_data?.default_resume_path ?? '').trim(),
  );

  const steps: QuickStartStep[] = [
    {
      title: 'Add your contact details',
      description:
        'Your first name, last name, and phone number are required for application forms.',
      href: '/settings/profile',
      action: 'Complete profile',
      icon: ContactRound,
      complete: hasPersonalDetails,
    },
    {
      title: 'Set your target roles',
      description:
        'Add at least one job title or keyword so the automation knows what to search for.',
      href: '/settings/job-profiles?edit=1&section=overview',
      action: 'Set search target',
      icon: Search,
      complete: hasSearchTarget,
    },
    {
      title: 'Attach your resume',
      description:
        'Use the active job profile to provide the resume used for uploads and form answers.',
      href: '/settings/resume',
      action: 'Upload resume',
      icon: FileText,
      complete: hasResume,
    },
  ];

  if (steps.every((step) => step.complete)) return null;

  return (
    <section className='col-span-12 panel-xl relative overflow-hidden'>
      <div className='absolute inset-y-0 left-0 w-1.5 bg-primary/50' />
      <div className='grid gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2.2fr)]'>
        <div className='border-b border-border/50 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6'>
          <Sparkles className='mb-2 h-7 w-7 text-primary' />
          <h2 className='title-sub text-ink-primary'>2 Min Quick Start</h2>
          <p className='body-sm mt-1 text-ink-secondary'>
            Complete these essentials once so your application automation has
            the information it needs to run.
          </p>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className='flex min-w-0 gap-3'>
                <div
                  className={cn(
                    'label flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                    step.complete ?
                      'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                    : 'border-primary bg-primary/10 text-primary',
                  )}
                  aria-label={step.complete ? `${step.title} complete` : `Step ${index + 1}`}
                >
                  {step.complete ? <Check className='h-4 w-4' /> : index + 1}
                </div>
                <div className='min-w-0'>
                  <div className='flex items-center gap-1.5'>
                    <Icon className='h-4 w-4 shrink-0 text-ink-secondary' />
                    <h3
                      className={cn(
                        'label text-sm',
                        step.complete ?
                          'text-ink-secondary line-through'
                        : 'text-ink-primary',
                      )}
                    >
                      {step.title}
                    </h3>
                  </div>
                  <p className='body-sm mt-1 text-ink-secondary'>
                    {step.description}
                  </p>
                  <Link
                    href={step.href}
                    className='label-sm mt-2 inline-flex items-center gap-1 text-primary hover:underline'
                  >
                    {step.complete ? 'Review details' : step.action}
                    <ChevronRight className='h-3.5 w-3.5' />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function OverviewPage() {
  const {
    dashboardData,
    trendRange,
    setTrendRange,
    desktopRuntime,
    desktopServiceStatus,
    isDesktopApp,
    desktopConnectionConfig,
    saveDesktopConnectionConfig,
    resetDesktopConnectionConfig,
    botStates,
    startBot,
    stopBot,
  } = useConsole();
  const [connectionForm, setConnectionForm] = useState({
    environmentName: '',
    apiUrl: '',
    dashboardUrl: '',
  });

  useEffect(() => {
    if (!desktopConnectionConfig) {
      return;
    }

    setConnectionForm({
      environmentName: desktopConnectionConfig.environmentName,
      apiUrl: desktopConnectionConfig.apiUrl,
      dashboardUrl: desktopConnectionConfig.dashboardUrl,
    });
  }, [desktopConnectionConfig]);

  const desktopServices =
    desktopServiceStatus ?
      [
        {
          key: 'api',
          label: 'API Service',
          icon: Globe,
          status: desktopServiceStatus.api,
          mode: desktopRuntime?.api?.mode,
        },
        {
          key: 'dashboard',
          label: 'Dashboard',
          icon: MonitorCog,
          status: desktopServiceStatus.dashboard,
          mode: desktopRuntime?.dashboard?.mode,
        },
        {
          key: 'worker',
          label: 'Worker Agent',
          icon: Activity,
          status: desktopServiceStatus.worker,
          mode: desktopRuntime?.worker?.mode,
        },
      ]
    : [];

  const handleConnectionSave = async () => {
    if (!desktopConnectionConfig) {
      return;
    }

    await saveDesktopConnectionConfig({
      ...desktopConnectionConfig,
      environmentName: connectionForm.environmentName,
      apiUrl: connectionForm.apiUrl,
      dashboardUrl: connectionForm.dashboardUrl,
    });
  };

  const handleConnectionReset = async () => {
    const result = await resetDesktopConnectionConfig();
    if (result.ok) {
      setConnectionForm({
        environmentName: result.config.environmentName,
        apiUrl: result.config.apiUrl,
        dashboardUrl: result.config.dashboardUrl,
      });
    }
  };

  return (
    <div className='grid grid-cols-12 gap-6'>
      <ApplicationQuickStart />

      {isDesktopApp && (
        <div className='col-span-12 bg-panel rounded-card p-card border border-border/50'>
          <div className='flex items-start justify-between gap-4 mb-6'>
            <div>
              <H2>Platform Automation Console</H2>
              <p className='text-meta dark:text-ink-primary0'>
                Launch and monitor automated job applications across active
                platforms in real time
              </p>
            </div>
            <span className='inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400'>
              Direct Process Control
            </span>
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            {PLATFORM_CARDS.map((platformCard) => {
              const platform = platformCard.key;
              const state = botStates[platform] || {
                status: 'idle',
                message: 'Idle',
                stats: { submitted: 0, skipped: 0, failed: 0 },
                logs: [],
              };
              const isRunning = ['starting', 'running', 'stopping'].includes(
                state.status,
              );
              const label = platformCard.label;
              const statusColor =
                state.status === 'success' ?
                  'text-emerald-500 bg-emerald-500/10'
                : state.status === 'failed' ? 'text-red-500 bg-red-500/10'
                : state.status === 'cancelled' ?
                  'text-ink-primary0 bg-zinc-500/10'
                : isRunning ?
                  'text-blue-500 bg-blue-500/10 animate-text-shimmer-primary animate-text-shimmer'
                : 'text-zinc-400 bg-zinc-500/5';

              return (
                <div
                  key={platform}
                  className='rounded-3xl border border-border/60 bg-background-secondary/30 dark:bg-panel/20 p-5 flex flex-col justify-between transition-colors'
                >
                  <div>
                    {/* Header */}
                    <div className='flex items-center justify-between gap-3 mb-4'>
                      <div className='flex items-center gap-3'>
                        <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-200/50 dark:bg-panel text-zinc-700 dark:text-zinc-300'>
                          <Globe className='h-5 w-5' />
                        </div>
                        <div>
                          <div className='font-semibold text-ink-primary'>
                            {label}
                          </div>
                          <div className='text-[10px] uppercase tracking-wider text-zinc-400 dark:text-ink-primary0'>
                            {platformCard.subtitle}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${statusColor}`}
                      >
                        {state.status}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className='grid grid-cols-3 gap-2 py-3 px-4 mb-4 rounded-2xl bg-background-secondary/50 dark:bg-panel/40 text-center'>
                      <div>
                        <div className='text-meta dark:text-ink-primary0'>
                          Submitted
                        </div>
                        <div className='title-card text-emerald-600 dark:text-emerald-400'>
                          {state.stats.submitted}
                        </div>
                      </div>
                      <div>
                        <div className='text-meta dark:text-ink-primary0'>
                          Skipped
                        </div>
                        <div className='title-card text-amber-500'>
                          {state.stats.skipped}
                        </div>
                      </div>
                      <div>
                        <div className='text-meta dark:text-ink-primary0'>
                          Failed
                        </div>
                        <div className='title-card text-red-500'>
                          {state.stats.failed}
                        </div>
                      </div>
                    </div>

                    {/* Current Log / Message */}
                    <div className='body-sm mb-3 flex items-center gap-1.5'>
                      <Activity className='h-3.5 w-3.5 text-zinc-400 animate-text-shimmer-primary animate-text-shimmer' />
                      <span className='font-medium truncate'>
                        {state.message}
                      </span>
                    </div>

                    {/* Real-time terminal log stream */}
                    <div className='mb-5 h-70 rounded-xl bg-secondary p-3 font-mono text-[10px] text-zinc-400 overflow-y-auto border border-zinc-800/80 scrollbar-none'>
                      {state.logs.length === 0 ?
                        <div className='text-zinc-600 italic'>
                          Waiting for logs...
                        </div>
                      : state.logs.map((log, i) => (
                          <div key={i} className='truncate leading-relaxed'>
                            <span className='text-zinc-600 mr-1.5'>
                              [{log.at.split('T')[1].split('.')[0]}]
                            </span>
                            {log.line}
                          </div>
                        ))
                      }
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='flex items-center gap-3'>
                    {isRunning ?
                      <button
                        onClick={() => stopBot(platform)}
                        className='label-sm flex-1 py-2 rounded-full bg-red-600 hover:bg-red-500 transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5'
                      >
                        <Activity className='h-3.5 w-3.5 animate-spin' /> Stop
                        {platform === 'third_party' ? ' Assist' : ' Bot'}
                      </button>
                    : <button
                        onClick={() => startBot(platform)}
                        className='label-sm flex-1 py-2 rounded-full bg-emerald-600 hover:bg-emerald-505 transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5'
                      >
                        {platformCard.actionLabel}
                      </button>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* {isDesktopApp && desktopConnectionConfig && (
        <div className='col-span-12 bg-panel rounded-card p-card'>
          <div className='flex items-start justify-between gap-4 mb-5'>
            <div>
              <H2>Cloud Connection</H2>
              <p className='text-meta dark:text-ink-primary0'>
                Persisted desktop endpoints for your current environment
              </p>
            </div>
            <span className='inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white dark:bg-background-secondary dark:text-ink-primary'>
              {desktopRuntime?.environmentName || connectionForm.environmentName}
            </span>
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <label className='body-md grid gap-2'>
              <span className='text-ink-primary0 dark:text-zinc-400'>Environment</span>
              <input
                value={connectionForm.environmentName}
                onChange={(event) =>
                  setConnectionForm((current) => ({
                    ...current,
                    environmentName: event.target.value,
                  }))
                }
                className='body-md rounded-2xl border border-border bg-panel px-4 py-3 text-ink-primary outline-none transition focus:border-emerald-500 dark:border-border dark:bg-background dark:text-ink-primary'
                placeholder='Production'
              />
            </label>

            <label className='body-md grid gap-2 md:col-span-2'>
              <span className='text-ink-primary0 dark:text-zinc-400'>API URL</span>
              <input
                value={connectionForm.apiUrl}
                onChange={(event) =>
                  setConnectionForm((current) => ({
                    ...current,
                    apiUrl: event.target.value,
                  }))
                }
                className='body-md rounded-2xl border border-border bg-panel px-4 py-3 text-ink-primary outline-none transition focus:border-emerald-500 dark:border-border dark:bg-background dark:text-ink-primary'
                placeholder='https://api.example.com'
              />
            </label>

            <label className='body-md grid gap-2 md:col-span-3'>
              <span className='text-ink-primary0 dark:text-zinc-400'>Dashboard URL</span>
              <input
                value={connectionForm.dashboardUrl}
                onChange={(event) =>
                  setConnectionForm((current) => ({
                    ...current,
                    dashboardUrl: event.target.value,
                  }))
                }
                className='body-md rounded-2xl border border-border bg-panel px-4 py-3 text-ink-primary outline-none transition focus:border-emerald-500 dark:border-border dark:bg-background dark:text-ink-primary'
                placeholder='https://app.example.com'
              />
            </label>
          </div>

          <div className='mt-4 flex flex-wrap items-center gap-3'>
            <button
              onClick={handleConnectionSave}
              className='label rounded-full bg-emerald-600 px-4 py-2 transition hover:bg-emerald-500'
            >
              Save And Reconnect
            </button>
            <button
              onClick={handleConnectionReset}
              className='label rounded-full border border-zinc-200 px-4 py-2 transition hover:bg-zinc-100 dark:border-border dark:hover:bg-zinc-900'
            >
              Reset Defaults
            </button>
            <p className='text-meta dark:text-ink-primary0'>
              API mode: {desktopConnectionConfig.apiMode} | Dashboard mode:{' '}
              {desktopConnectionConfig.dashboardMode} | Worker mode:{' '}
              {desktopConnectionConfig.workerMode}
            </p>
          </div>
        </div>
      )} */}

      {/* Row 1: Trend & Distribution Charts */}
      {/* Trend Chart - Span 2 Columns */}
      <div className='col-span-12 md:col-span-7 bg-panel rounded-card p-card'>
        <div className='flex items-start justify-between mb-2'>
          <div>
            <H2>Application Trend</H2>
            <p className='text-meta dark:text-ink-primary0'>
              Daily tracking of submitted vs skipped applications
            </p>
          </div>

          <ToggleGroup
            id='trend-range-toggle'
            items={[
              {
                value: '7',
                label: '7 Days',
                // 使用 Lucide 图标替换原来的 span
                icon: ({ className }) => (
                  <ChartNoAxesGantt className={className} />
                ),
              },
              {
                value: '30',
                label: '30 Days',
                icon: ({ className }) => (
                  <CalendarSearch className={className} />
                ),
              },
            ]}
            value={String(trendRange)}
            onValueChange={(val) => setTrendRange(Number(val) as 7 | 30)}
          />
        </div>

        <div className='w-full h-75 flex '>
          <Chart
            type='area'
            data={dashboardData.trend}
            showXAxis={false}
            showYAxis={false}
            xKey='date'
            yKeys={['Skipped', 'Submitted']}
            showLegend
            yDomain={[0, 'dataMax']}
            // stacked
            gradientFill
            className='h-full flex w-full'
          />
        </div>
      </div>

      {/* Donut Chart - Span 1 Column */}
      <div className='col-span-12  md:col-span-5 h-full bg-panel rounded-card p-card'>
        <div>
          <H2>Application Status Breakdown</H2>
          <p className='text-meta dark:text-ink-primary0 mb-4'>
            Proportions of all logged job application states
          </p>
        </div>

        <div className='w-full flex h-80 items-center justify-center relative'>
          <Chart
            type='pie'
            data={dashboardData.statusDistribution}
            nameKey='name'
            valueKey='value'
            showLegend={false}
            className='h-full flex'
            pieCornerRadius={999}
            piePaddingAngle={5}
            pieInnerRadius='65%'
            pieOuterRadius='80%'
            gradientFill
          />
        </div>
      </div>

      {/* Row 2: Insights & Work Style Breakdown */}
      {/* Skip Reasons Card */}
      <div className='col-span-12 md:col-span-12 lg:col-span-4 bg-panel rounded-card p-card'>
        <div>
          <H2>Top Skip Reasons</H2>
          <p className='text-meta dark:text-ink-primary0 mb-4'>
            Main constraints preventing automatic job application
          </p>

          <Chart
            type='bar-list'
            data={dashboardData.skipReasons}
            nameKey='name'
            valueKey='value'
            maxEquivalent={true}
            barColorClassName='bg-gradient-to-r from-[#eaab41] to-[#efc95d]'
            emptyMessage='No skipped applications recorded yet.'
            valueFormatter={(val, item) => `${val} (${item.percentage}%)`}
          />
        </div>
      </div>

      {/* Top Companies Card */}
      <div className='col-span-12 md:col-span-6 lg:col-span-4 bg-panel rounded-card p-card'>
        <div>
          <H2>Top Applied Companies</H2>
          <p className='text-meta dark:text-ink-primary0 mb-4'>
            Most frequent companies targeted by automation bot
          </p>
          <Chart
            type='bar-list'
            data={dashboardData.topCompanies}
            xKey='name'
            yKey='applications'
            maxEquivalent={true}
            barColorClassName='bg-gradient-to-r from-[#57b78b] to-[#9ec2d3] '
            emptyMessage='No submitted companies yet.'
            valueFormatter={(val) => `${val}`}
          />
        </div>
      </div>

      {/* Top Cities Card */}
      <div className='col-span-12 md:col-span-6 lg:col-span-4 bg-panel rounded-card p-card'>
        <div>
          <H2>Cities</H2>
          <p className='text-meta dark:text-ink-primary0 mb-4'>
            Geographical distribution of job automation activity
          </p>
          <ChartWrapper className='h-64'>
            <CityVectorMap data={dashboardData.topCities} className='h-full' />
          </ChartWrapper>
        </div>
      </div>

      {/* Row 3: Recent Activity Feed */}
      <div className='col-span-12 md:col-span-12 bg-panel rounded-card p-card'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <H2>Recent Application History</H2>
            <p className='text-meta dark:text-ink-primary0'>
              The latest application attempts by the Jobbie
            </p>
          </div>
          <Link
            href='/applications'
            className='label-sm inline-flex items-center gap-1 text-primary/50 hover:text-primary cursor-pointer'
          >
            View all history <ChevronRight className='w-3.5 h-3.5' />
          </Link>
        </div>

        <div className='overflow-x-auto'>
          <table className='body-md w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-border/40 text-[10px] font-bold text-ink-primary0 dark:text-ink-primary0 uppercase tracking-wider'>
                <th className='pb-3 pr-4'>Position</th>
                <th className='pb-3 px-4'>Company</th>
                <th className='pb-3 px-4'>Workplace Style</th>
                <th className='pb-3 px-4'>Status</th>
                <th className='pb-3 pl-4 text-right'>Applied Date</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border/40'>
              {(
                dashboardData.recentActivities &&
                dashboardData.recentActivities.length > 0
              ) ?
                dashboardData.recentActivities.map((item) =>
                  (() => {
                    const displayStatus = getDisplayApplicationStatus(item);
                    return (
                      <tr
                        key={item.id}
                        className='text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors'
                      >
                        <td className='py-3 pr-4'>
                          <div className='font-bold text-ink-primary truncate max-w-xs'>
                            {item.title || 'Untitled Role'}
                          </div>
                          <span className='text-[10px] text-zinc-400 font-mono'>
                            ID: {item.job_id}
                          </span>
                        </td>
                        <td className='py-3 px-4 font-semibold text-ink-primary truncate max-w-[150px]'>
                          {item.company || 'Unknown'}
                        </td>
                        <td className='text-meta py-3 px-4 text-ink-primary0 capitalize'>
                          {item.work_location || 'Not specified'}
                        </td>
                        <td className='py-3 px-4'>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border',
                              getStatusBadgeClasses(displayStatus),
                            )}
                          >
                            {displayStatus}
                          </span>
                          {shouldShowApplicationSkipReason(item) &&
                            item.skip_reason && (
                              <p
                                className='text-[9px] text-zinc-400 dark:text-ink-primary0 italic max-w-[150px] truncate'
                                title={item.skip_reason}
                              >
                                {item.skip_reason}
                              </p>
                            )}
                        </td>
                        <td className='body-sm py-3 pl-4 text-right text-ink-primary0 dark:text-ink-primary0 whitespace-nowrap'>
                          {formatDate(
                            item.date_applied ??
                              item.updated_at ??
                              item.created_at,
                          )}
                        </td>
                      </tr>
                    );
                  })(),
                )
              : <tr>
                  <td
                    colSpan={5}
                    className='py-8 text-center text-ink-primary0 dark:text-ink-primary0 italic'
                  >
                    No application activities recorded yet.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
