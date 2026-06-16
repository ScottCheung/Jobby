/** @format */

import React from 'react';
import { cn } from '@/lib/utils';
import { motion, Variants } from 'framer-motion';

export interface ProgressBarListProps<T = any> {
  data: T[];
  nameKey?: keyof T;
  valueKey?: keyof T;
  // CSS class for the filled progress bar background (e.g. gradients)
  barColorClassName?: string;
  // If true, the item with the highest value is scaled to 100%, and other items are scaled relative to it.
  // If false, it uses the item's own percentage (if it exists) or value / sum of all values.
  maxEquivalent?: boolean;
  emptyMessage?: string;
  // Custom renderer/formatter for the right-hand label
  valueFormatter?: (value: number, item: T) => React.ReactNode;
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

export function ProgressBarList<T = any>({
  data,
  nameKey = 'name' as keyof T,
  valueKey = 'value' as keyof T,
  barColorClassName = 'bg-gradient-to-l from-green-400 to-amber-300 dark:from-amber-300 dark:to-amber-700',
  maxEquivalent = true,
  emptyMessage = 'No data recorded yet.',
  valueFormatter,
  className,
}: ProgressBarListProps<T>) {
  if (!data || data.length === 0) {
    return (
      <div className='py-8 text-center text-zinc-500 dark:text-zinc-500 italic text-sm w-full'>
        {emptyMessage}
      </div>
    );
  }

  // Calculate maximum value and sum of all values
  let maxVal = 0;
  let sumVal = 0;

  data.forEach((item) => {
    const val = Number(item[valueKey]) || 0;
    if (val > maxVal) maxVal = val;
    sumVal += val;
  });

  if (maxVal === 0) maxVal = 1;
  if (sumVal === 0) sumVal = 1;

  return (
    <motion.div
      variants={containerVariants}
      initial='hidden'
      animate='show'
      className={cn('space-y-4 mt-2 w-full', className)}
    >
      {data.map((item, index) => {
        const name = String(item[nameKey] ?? '');
        const value = Number(item[valueKey]) || 0;

        // Determine the percentage width of the bar
        let barPercentage = 0;
        if (maxEquivalent) {
          barPercentage = (value / maxVal) * 100;
        } else {
          // If the item itself has a pre-calculated percentage, use it, otherwise fall back to proportion of sum
          if (
            item &&
            typeof item === 'object' &&
            'percentage' in item &&
            typeof (item as any).percentage === 'number'
          ) {
            barPercentage = (item as any).percentage;
          } else {
            barPercentage = (value / sumVal) * 100;
          }
        }

        // Clip percentage range to [0, 100]
        barPercentage = Math.min(100, Math.max(0, barPercentage));

        return (
          <motion.div
            key={index}
            variants={itemVariants}
            className='space-y-1 w-full'
          >
            <div className='flex items-baseline justify-between text-xs w-full gap-5'>
              <span
                className='font-semibold text-ink-primary truncate max-w-[280px]'
                title={name}
              >
                {name}
              </span>
              <span className='text-ink-secondary font-mono shrink-0'>
                {valueFormatter ? valueFormatter(value, item) : value}
              </span>
            </div>
            <div className='w-full bg-panel-foreground/5 h-3 rounded-full overflow-hidden'>
              <motion.div
                className={cn('h-full rounded-full', barColorClassName)}
                initial={{ width: 0 }}
                animate={{ width: `${barPercentage}%` }}
                transition={{
                  duration: 1.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

ProgressBarList.displayName = 'ProgressBarList';
