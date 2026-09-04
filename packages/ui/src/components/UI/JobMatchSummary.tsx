/** @format */

import type { ReactNode } from 'react';
import { CircularProgress } from './Progress/CircularProgress';
import { Number as AnimatedNumber } from './Number/Number';
import { cn } from '../../lib/utils';

export interface JobMatchBreakdownItem {
  label: string;
  value: number | null;
  colorClassName: string;
}

export interface JobMatchSummaryProps {
  score: number | null;
  label: string;
  breakdown: JobMatchBreakdownItem[];
  isLoading?: boolean;
  isUnavailable?: boolean;
  action?: ReactNode;
  explanation?: string;
  compact?: boolean;
  className?: string;
}

export function JobMatchSummary({
  score,
  label,
  breakdown,
  isLoading = false,
  isUnavailable = false,
  action,
  explanation,
  compact = false,
  className,
}: JobMatchSummaryProps) {
  const safeScore =
    typeof score === 'number' ? Math.min(100, Math.max(0, score)) : null;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div
        className={cn(
          'relative flex shrink-0 items-start justify-center rounded-full bg-primary/10 shadow-xs',
          compact ? 'size-14' : 'size-18',
        )}
      >
        <CircularProgress
          value={safeScore || 0}
          size='sm'
          variant='gradient'
          color={
            safeScore === null ? 'primary'
            : safeScore >= 70 ? 'primary'
            : safeScore >= 45 ? 'warning'
            : 'danger'
          }
          showValue={false}
          isIndeterminate={isLoading}
          thickness={compact ? 7 : 8}
        />
        <AnimatedNumber
          className={cn(
            'absolute inset-0 flex items-center justify-center font-extrabold text-foreground',
            compact ? 'text-base' : 'text-xl',
          )}
          value={isLoading ? '..' : safeScore ?? '--'}
        />
      </div>

      <div className='min-w-0 flex-1'>
        <div className='mb-1.5 flex items-center justify-between gap-2'>
          <p
            className={cn(
              'truncate text-xs font-bold text-foreground',
              isLoading && 'animate-text-shimmer animate-text-shimmer-primary',
            )}
          >
            {label}
          </p>
          {action}
        </div>

        <div
          className='grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] select-none'
          title={explanation || 'Score breakdown'}
        >
          {breakdown.map((item) => {
            const value =
              typeof item.value === 'number' ?
                Math.min(100, Math.max(0, item.value))
              : null;
            return (
              <div key={item.label} className='flex min-w-0 items-center gap-1.5'>
                <span className='w-7 shrink-0 truncate font-medium text-muted-foreground'>
                  {item.label}
                </span>
                <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-background-secondary'>
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isLoading ? 'animate-skeleton-shimmer'
                      : isUnavailable || value === null ? 'bg-transparent'
                      : item.colorClassName,
                    )}
                    style={{ width: `${isLoading ? 100 : value || 0}%` }}
                  />
                </div>
                <span className='w-5 shrink-0 text-right font-mono text-foreground/80'>
                  {isLoading ? '' : value ?? '--'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
