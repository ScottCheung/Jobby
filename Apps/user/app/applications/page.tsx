/** @format */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  DashboardStats,
  EmptyPlaceHolder,
  H2,
  ToggleGroup,
} from '@jobby/ui';
import { Chart, ChartWrapper } from '@jobby/ui/components/UI/Chart';
import { CityVectorMap } from '@jobby/ui/components/UI/Map/CityVectorMap';
import { useConsole } from '@/components/ConsoleContext';
import {
  getDisplayApplicationStatus,
  getStatusBadgeClasses,
} from '@/lib/types';
import {
  ChartNoAxesGantt,
  CalendarSearch,
  ChevronRight,
  Briefcase,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/ConsoleUtils';

export default function ApplicationsDashboardPage() {
  const {
    dashboardData,
    trendRange,
    setTrendRange,
  } = useConsole();

  return (
    <div className='flex flex-col gap-6 pb-12 w-full'>
      {/* Top Banner with Quick Actions */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h2 className='title-page bg-primary-gradient bg-clip-text text-transparent'>
            Applications Dashboard & Analytics
          </h2>
          <p className='mt-1 text-xs text-ink-secondary'>
            Real-time insights on your job search performance, submission trends, and status distribution.
          </p>
        </div>

        <div className='flex items-center gap-3 shrink-0'>
          <Link
            href='/applications/history'
            className='flex items-center gap-1.5 rounded-xl bg-panel px-4 py-2.5 text-xs font-bold text-ink-primary border border-primary/20 hover:border-primary/40 hover:bg-background-secondary transition-all shadow-xs'
          >
            <Briefcase className='size-3.5 text-primary' />
            <span>View All Cards</span>
            <ChevronRight className='size-3 text-ink-secondary' />
          </Link>
          <Link
            href='/applications/recommendations'
            className='flex items-center gap-1.5 rounded-xl bg-primary-gradient px-4 py-2.5 text-xs font-bold text-white shadow-md hover:scale-105 transition-all'
          >
            <Sparkles className='size-3.5' />
            <span>AI Recommendations</span>
            <ArrowUpRight className='size-3' />
          </Link>
        </div>
      </div>

      {/* Global Dashboard Stats */}
      <DashboardStats />

      {/* Row 1: Trend & Distribution Charts */}
      <div className='grid grid-cols-12 gap-6'>
        {/* Trend Chart - Span 7 Columns */}
        <div className='col-span-12 lg:col-span-7 bg-panel rounded-card p-card'>
          <div className='flex items-start justify-between mb-2'>
            <div>
              <H2>Application Trend</H2>
              <p className='text-meta text-ink-secondary'>
                Daily submitted applications over time
              </p>
            </div>

            <ToggleGroup
              id='trend-range-toggle'
              items={[
                {
                  value: '7',
                  label: '7 Days',
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

          <div className='w-full h-72 flex'>
            <Chart
              type='area'
              data={dashboardData.trend}
              showXAxis={false}
              showYAxis={false}
              xKey='date'
              yKeys={['Submitted']}
              showLegend
              yDomain={[0, 'dataMax']}
              gradientFill
              className='h-full flex w-full'
            />
          </div>
        </div>

        {/* Donut Chart - Span 5 Columns */}
        <div className='col-span-12 lg:col-span-5 h-full bg-panel rounded-card p-card'>
          <div>
            <H2>Status Breakdown</H2>
            <p className='text-meta text-ink-secondary mb-4'>
              Proportions of all logged job application states
            </p>
          </div>

          <div className='w-full flex h-72 items-center justify-center relative'>
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
      </div>

      {/* Row 2: Top Companies & Cities */}
      <div className='grid grid-cols-12 gap-6'>
        {/* Top Companies Card */}
        <div className='col-span-12 md:col-span-6 bg-panel rounded-card p-card'>
          <div>
            <H2>Top Applied Companies</H2>
            <p className='text-meta text-ink-secondary mb-4'>
              Companies you have applied to most frequently
            </p>
            <Chart
              type='bar-list'
              data={dashboardData.topCompanies}
              xKey='name'
              yKey='applications'
              maxEquivalent={true}
              barColorClassName='bg-gradient-to-r from-[#57b78b] to-[#9ec2d3]'
              emptyMessage='No submitted companies yet.'
              valueFormatter={(val) => `${val}`}
            />
          </div>
        </div>

        {/* Top Cities Card */}
        <div className='col-span-12 md:col-span-6 bg-panel rounded-card p-card'>
          <div>
            <H2>Geographic Distribution</H2>
            <p className='text-meta text-ink-secondary mb-4'>
              Geographical concentration of submitted applications
            </p>
            <ChartWrapper className='h-64'>
              <CityVectorMap data={dashboardData.topCities} className='h-full' />
            </ChartWrapper>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Activity Table */}
      <div className='bg-panel rounded-card p-card'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <H2>Recent Application Activity</H2>
            <p className='text-meta text-ink-secondary'>
              Your latest submitted applications
            </p>
          </div>
          <Link
            href='/applications/history'
            className='label-sm inline-flex items-center gap-1 text-primary hover:underline cursor-pointer'
          >
            View all history <ChevronRight className='w-3.5 h-3.5' />
          </Link>
        </div>

        <div className='overflow-x-auto'>
          <table className='body-md w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-primary/40 text-[10px] font-bold text-ink-secondary uppercase tracking-wider'>
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
                dashboardData.recentActivities.map((item) => {
                  const displayStatus = getDisplayApplicationStatus(item);
                  return (
                    <tr
                      key={item.id}
                      className='text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors'
                    >
                      <td className='py-3 pr-4'>
                        <Link
                          href={`/applications/history?appId=${item.id}`}
                          className='font-bold text-ink-primary hover:text-primary transition-colors truncate max-w-xs block'
                        >
                          {item.title || 'Untitled Role'}
                        </Link>
                        <span className='text-[10px] text-zinc-400 font-mono'>
                          ID: {item.job_id}
                        </span>
                      </td>
                      <td className='py-3 px-4 font-semibold text-ink-primary truncate max-w-[150px]'>
                        {item.company || 'Unknown'}
                      </td>
                      <td className='text-meta py-3 px-4 text-ink-secondary capitalize'>
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
                      </td>
                      <td className='body-sm py-3 pl-4 text-right text-ink-secondary whitespace-nowrap'>
                        {formatDate(
                          item.date_applied ??
                            item.updated_at ??
                            item.created_at,
                        )}
                      </td>
                    </tr>
                  );
                })
              : <tr>
                  <td colSpan={5} className='py-6'>
                    <EmptyPlaceHolder
                      message='No application activities recorded yet.'
                      className='border-0 bg-transparent py-4'
                    />
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
