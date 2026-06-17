/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useConsole } from '@/components/ConsoleContext';
import { H2 } from '@/components/UI/text/typography';
import { Chart, ChartWrapper } from '@/components/UI/Chart';
import type { DesktopBotPlatform } from '@/lib/types';
import {
  ChartNoAxesGantt,
  CalendarSearch,
  MonitorCog,
  Globe,
  Activity,
} from 'lucide-react';
import { ToggleGroup } from '@/components/UI/toggle-group';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
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
      {isDesktopApp && (
        <div className='col-span-12 bg-panel rounded-card p-card border border-zinc-200/50 dark:border-zinc-800/50'>
          <div className='flex items-start justify-between gap-4 mb-6'>
            <div>
              <H2>Platform Automation Console</H2>
              <p className='text-xs text-zinc-400 dark:text-zinc-500'>
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
              const label =
                platformCard.label;
              const statusColor =
                state.status === 'success' ?
                  'text-emerald-500 bg-emerald-500/10'
                : state.status === 'failed' ? 'text-red-500 bg-red-500/10'
                : state.status === 'cancelled' ? 'text-zinc-500 bg-zinc-500/10'
                : isRunning ? 'text-blue-500 bg-blue-500/10 animate-pulse'
                : 'text-zinc-400 bg-zinc-500/5';

              return (
                <div
                  key={platform}
                  className='rounded-3xl border border-zinc-200/50 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20 p-5 flex flex-col justify-between transition-colors'
                >
                  <div>
                    {/* Header */}
                    <div className='flex items-center justify-between gap-3 mb-4'>
                      <div className='flex items-center gap-3'>
                        <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-200/50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'>
                          <Globe className='h-5 w-5' />
                        </div>
                        <div>
                          <div className='font-semibold text-zinc-900 dark:text-zinc-100'>
                            {label}
                          </div>
                          <div className='text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500'>
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
                    <div className='grid grid-cols-3 gap-2 py-3 px-4 mb-4 rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/40 text-center'>
                      <div>
                        <div className='text-xs text-zinc-400 dark:text-zinc-500'>
                          Submitted
                        </div>
                        <div className='text-lg font-bold text-emerald-600 dark:text-emerald-400'>
                          {state.stats.submitted}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs text-zinc-400 dark:text-zinc-500'>
                          Skipped
                        </div>
                        <div className='text-lg font-bold text-amber-500'>
                          {state.stats.skipped}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs text-zinc-400 dark:text-zinc-500'>
                          Failed
                        </div>
                        <div className='text-lg font-bold text-red-500'>
                          {state.stats.failed}
                        </div>
                      </div>
                    </div>

                    {/* Current Log / Message */}
                    <div className='text-xs mb-3 text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5'>
                      <Activity className='h-3.5 w-3.5 text-zinc-400 animate-pulse' />
                      <span className='font-medium truncate'>
                        {state.message}
                      </span>
                    </div>

                    {/* Real-time terminal log stream */}
                    <div className='mb-5 h-70 rounded-xl bg-zinc-950 p-3 font-mono text-[10px] text-zinc-400 overflow-y-auto border border-zinc-800/80 scrollbar-none'>
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
                        className='flex-1 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5'
                      >
                        <Activity className='h-3.5 w-3.5 animate-spin' /> Stop
                        {platform === 'third_party' ? ' Assist' : ' Bot'}
                      </button>
                    : <button
                        onClick={() => startBot(platform)}
                        className='flex-1 py-2 rounded-full bg-emerald-600 hover:bg-emerald-505 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5'
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
              <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                Persisted desktop endpoints for your current environment
              </p>
            </div>
            <span className='inline-flex items-center rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white dark:bg-zinc-100 dark:text-zinc-900'>
              {desktopRuntime?.environmentName || connectionForm.environmentName}
            </span>
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <label className='grid gap-2 text-sm'>
              <span className='text-zinc-500 dark:text-zinc-400'>Environment</span>
              <input
                value={connectionForm.environmentName}
                onChange={(event) =>
                  setConnectionForm((current) => ({
                    ...current,
                    environmentName: event.target.value,
                  }))
                }
                className='rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
                placeholder='Production'
              />
            </label>

            <label className='grid gap-2 text-sm md:col-span-2'>
              <span className='text-zinc-500 dark:text-zinc-400'>API URL</span>
              <input
                value={connectionForm.apiUrl}
                onChange={(event) =>
                  setConnectionForm((current) => ({
                    ...current,
                    apiUrl: event.target.value,
                  }))
                }
                className='rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
                placeholder='https://api.example.com'
              />
            </label>

            <label className='grid gap-2 text-sm md:col-span-3'>
              <span className='text-zinc-500 dark:text-zinc-400'>Dashboard URL</span>
              <input
                value={connectionForm.dashboardUrl}
                onChange={(event) =>
                  setConnectionForm((current) => ({
                    ...current,
                    dashboardUrl: event.target.value,
                  }))
                }
                className='rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
                placeholder='https://app.example.com'
              />
            </label>
          </div>

          <div className='mt-4 flex flex-wrap items-center gap-3'>
            <button
              onClick={handleConnectionSave}
              className='rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500'
            >
              Save And Reconnect
            </button>
            <button
              onClick={handleConnectionReset}
              className='rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900'
            >
              Reset Defaults
            </button>
            <p className='text-xs text-zinc-400 dark:text-zinc-500'>
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
            <p className='text-xs text-zinc-400 dark:text-zinc-500'>
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
            yKeys={['Submitted', 'Skipped']}
            // showLegend
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
          <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-4'>
            Proportions of all logged job application states
          </p>
        </div>

        <div className='w-full flex h-80 items-center justify-center relative'>
          <Chart
            type='pie'
            data={dashboardData.statusDistribution}
            nameKey='name'
            valueKey='value'
            // showLegend
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
      <div className='col-span-12 md:col-span-4 bg-panel rounded-card p-card'>
        <div>
          <H2>Top Skip Reasons</H2>
          <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-4'>
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
      <div className='col-span-12 md:col-span-4 bg-panel rounded-card p-card'>
        <div>
          <H2>Top Applied Companies</H2>
          <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-4'>
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
      <div className='col-span-12 md:col-span-4 bg-panel rounded-card p-card'>
        <div>
          <H2>Top Cities Map</H2>
          <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-4'>
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
            <p className='text-xs text-zinc-400 dark:text-zinc-500'>
              The latest application attempts by the Jobbie
            </p>
          </div>
          <Link
            href='/applications'
            className='inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer'
          >
            View all history <ChevronRight className='w-3.5 h-3.5' />
          </Link>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse text-sm'>
            <thead>
              <tr className='border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider'>
                <th className='pb-3 pr-4'>Position</th>
                <th className='pb-3 px-4'>Company</th>
                <th className='pb-3 px-4'>Workplace Style</th>
                <th className='pb-3 px-4'>Status</th>
                <th className='pb-3 pl-4 text-right'>Applied Date</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800/50'>
              {(
                dashboardData.recentActivities &&
                dashboardData.recentActivities.length > 0
              ) ?
                dashboardData.recentActivities.map((item) => (
                  <tr
                    key={item.id}
                    className='text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors'
                  >
                    <td className='py-3 pr-4'>
                      <div className='font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-xs'>
                        {item.title || 'Untitled Role'}
                      </div>
                      <span className='text-[10px] text-zinc-400 font-mono'>
                        ID: {item.job_id}
                      </span>
                    </td>
                    <td className='py-3 px-4 font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]'>
                      {item.company || 'Unknown'}
                    </td>
                    <td className='py-3 px-4 text-xs text-zinc-500 dark:text-zinc-400 capitalize'>
                      {item.work_location || 'Not specified'}
                    </td>
                    <td className='py-3 px-4'>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                          item.status === 'submitted' ?
                            'bg-green-500/5 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                          : item.status === 'skipped' ?
                            'bg-amber-500/5 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'bg-zinc-500/5 text-zinc-600 dark:bg-zinc-800/20 dark:text-zinc-400',
                        )}
                      >
                        {item.status}
                      </span>
                      {item.skip_reason && (
                        <p
                          className='text-[9px] text-zinc-400 dark:text-zinc-500 italic max-w-[150px] truncate'
                          title={item.skip_reason}
                        >
                          {item.skip_reason}
                        </p>
                      )}
                    </td>
                    <td className='py-3 pl-4 text-right text-xs text-zinc-500 dark:text-zinc-500 whitespace-nowrap'>
                      {formatDate(item.date_applied)}
                    </td>
                  </tr>
                ))
              : <tr>
                  <td
                    colSpan={5}
                    className='py-8 text-center text-zinc-500 dark:text-zinc-500 italic'
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
