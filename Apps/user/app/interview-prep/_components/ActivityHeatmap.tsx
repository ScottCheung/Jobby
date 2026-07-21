/** @format */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { HeatmapData } from '@/lib/types';

interface ActivityHeatmapProps {
  data: HeatmapData | null;
  className?: string;
}

export function ActivityHeatmap({ data, className }: ActivityHeatmapProps) {
  // Generate last 20 weeks (140 days) of dates
  const weeks = 20;
  const daysInWeek = 7;
  const totalDays = weeks * daysInWeek;

  const { matrix, maxCount, totalCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countsByDate = new Map<string, number>();
    let max = 0;
    let total = 0;

    if (data?.entries) {
      data.entries.forEach((entry) => {
        countsByDate.set(entry.date, entry.count);
        if (entry.count > max) max = entry.count;
        total += entry.count;
      });
    }

    // Initialize matrix: [weekIndex][dayOfWeek]
    const grid: { date: Date; count: number; level: number }[][] = Array.from(
      { length: weeks },
      () => Array(daysInWeek).fill(null),
    );

    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday

    let currentDate = new Date(today);
    const daysToSubtract = (weeks - 1) * 7 + currentDayOfWeek;
    currentDate.setDate(currentDate.getDate() - daysToSubtract);

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < daysInWeek; d++) {
        // Skip future days in the last week
        if (w === weeks - 1 && d > currentDayOfWeek) {
          continue;
        }

        const dateStr = currentDate.toISOString().split('T')[0];
        const count = countsByDate.get(dateStr) || 0;

        let level = 0;
        if (count > 0) {
          if (max <= 3) {
            level = count;
          } else {
            level = Math.ceil((count / max) * 4);
          }
          if (level > 4) level = 4;
        }

        grid[w][d] = {
          date: new Date(currentDate),
          count,
          level,
        };

        // Advance one day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return { matrix: grid, maxCount: max, totalCount: total };
  }, [data]);

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-emerald-200 dark:bg-emerald-900/40';
      case 2:
        return 'bg-emerald-300 dark:bg-emerald-700/60';
      case 3:
        return 'bg-emerald-400 dark:bg-emerald-500/80';
      case 4:
        return 'bg-emerald-500 dark:bg-emerald-400';
      default:
        return 'bg-background-secondary/50';
    }
  };

  return (
    <div
      className={cn(
        'panel-xl col-span-6 md:col-span-3 lg:col-span-2 flex flex-col gap-4',
        className,
      )}
    >
      <div className='stack'>
        <h3 className='text-[10px] uppercase font-bold text-primary tracking-wider'>
          Practice Consistency
        </h3>
        <span className='label-sm row'>
          <div className='title-card'>{totalCount}</div>contributions /{' '}
          <div className='title-card'>{weeks}</div>weeks
        </span>
      </div>

      <div className='flex gap-2 items-end overflow-x-auto pb-2 scrollbar-thin'>
        {matrix.map((week, wIdx) => (
          <div key={`w-${wIdx}`} className='flex flex-col gap-1'>
            {week.map((day, dIdx) => {
              if (!day)
                return (
                  <div
                    key={`empty-${wIdx}-${dIdx}`}
                    className='w-3 h-3 rounded-sm'
                  />
                );

              return (
                <div
                  key={day.date.toISOString()}
                  title={`${day.count} practices on ${day.date.toDateString()}`}
                  className={cn(
                    'w-3 h-3 rounded-sm transition-colors hover:ring-1 ring-primary/50 cursor-crosshair',
                    getLevelColor(day.level),
                  )}
                />
              );
            })}

            <div className='h-4 mt-1 relative'>
              {wIdx % 4 === 0 && week[0] && (
                <span className='absolute text-[10px] text-ink-secondary whitespace-nowrap'>
                  {week[0].date.toLocaleDateString(undefined, {
                    month: 'short',
                  })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className='body-sm flex items-center gap-2 text-ink-secondary self-end mt-[-10px]'>
        <span>Less</span>
        <div className='w-3 h-3 rounded-sm bg-background-secondary/50' />
        <div className='w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/40' />
        <div className='w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-700/60' />
        <div className='w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-500/80' />
        <div className='w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-400' />
        <span>More</span>
      </div>
    </div>
  );
}
