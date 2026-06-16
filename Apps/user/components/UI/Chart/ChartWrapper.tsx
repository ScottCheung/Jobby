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
          {isEmpty ? (
            <div className='flex h-full min-h-[150px] w-full flex-col items-center justify-center text-center p-6 bg-zinc-50/50 dark:bg-zinc-900/10 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800/80'>
              <BarChart3 className='w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-3 animate-pulse' />
              <p className='text-sm font-medium text-zinc-400 dark:text-zinc-500'>
                {emptyMessage}
              </p>
            </div>
          ) : (
            children
          )}
        </InView>
      </div>
    </div>
  );
};

export default ChartWrapper;

