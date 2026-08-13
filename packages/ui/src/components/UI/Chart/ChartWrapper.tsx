'use client';
/** @format */

import { cn } from '@/lib/utils';
import React from 'react';
import { InView } from '@/components/animation';
import { BarChart3 } from 'lucide-react';

interface ChartWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  isEmpty?: boolean;
  emptyMessage?: string;
}

const ChartWrapper = ({
  title,
  size = 'md',
  className,
  isEmpty = false,
  emptyMessage = 'No data available',
  children,
  ...props
}: ChartWrapperProps) => {
  return (
    <div className={cn('w-full flex flex-col', className)} {...props}>
      {title && (
        <h4 className='font-medium text-gray-900 mb-8 text-center text-nowrap shrink-0'>
          {title}
        </h4>
      )}

      <div
        className={cn('w-full flex-1 min-h-0 overflow-hidden')}
        style={{ position: 'relative' }}
      >
        <InView>
          {isEmpty ?
            <div className='flex h-full min-h-80 w-full flex-col items-center justify-center text-center p-6 bg-background-secondary/20 dark:bg-panel/10 rounded-xl border border-dashed  /80'>
              <BarChart3 className='w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-3 animate-text-shimmer-primary animate-text-shimmer' />
              <p className='label dark:text-ink-primary0'>{emptyMessage}</p>
            </div>
          : children}
        </InView>
      </div>
    </div>
  );
};

export default ChartWrapper;
