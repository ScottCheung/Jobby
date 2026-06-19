/** @format */

'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton, formatDate } from '@/components/ConsoleUtils';
import {
  getApplicationDisplayDate,
  getDisplayApplicationStatus,
  isProcessingApplication,
  isStaleProcessingApplication,
  type JobApplication,
} from '@/lib/types';
import { motion } from 'framer-motion';

interface ApplicationRowProps {
  entry: JobApplication;
  style?: React.CSSProperties;
  isLast: boolean;
  expandedApplicationId: string;
  setExpandedApplicationId: (id: string) => void;
  syncingApplicationId: string;
  asyncApplication: (id: string) => void | Promise<void>;
  deleteApplication: (id: string) => void | Promise<void>;
}

export function ApplicationRow({
  entry,
  style,
  isLast,
  expandedApplicationId,
  setExpandedApplicationId,
  syncingApplicationId,
  asyncApplication,
  deleteApplication,
}: ApplicationRowProps) {
  const displayStatus = getDisplayApplicationStatus(entry);
  const isLiveProcessing =
    isProcessingApplication(entry) && !isStaleProcessingApplication(entry);

  return (
    <motion.div
      transition={{ duration: 1 }}
      style={style}
      className={cn(
        'grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,2fr)] items-center px-4 text-sm text-ink-secondary transition-colors',
        isLiveProcessing && 'bg-yellow-100 fixed top-0',
      )}
    >
      <div className='pr-4 min-w-0'>
        <strong
          className='text-zinc-900 block dark:text-zinc-100 truncate'
          title={entry.title || 'Untitled role'}
        >
          {entry.title || 'Untitled role'}
        </strong>
        <div className='flex items-center gap-2 mt-1 min-w-0'>
          <span className='text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 font-mono shrink-0'>
            ID: {entry.job_id}
          </span>
          <span
            className='text-xs text-zinc-400 dark:text-zinc-500 truncate'
            title={entry.work_location ?? ''}
          >
            {entry.work_location || 'Location not recorded'}
          </span>
        </div>
      </div>
      <div
        className='px-4 font-semibold text-zinc-800 dark:text-zinc-200 truncate'
        title={entry.company ?? ''}
      >
        {entry.company || 'Unknown'}
      </div>
      <div className='px-4 whitespace-nowrap'>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            displayStatus === 'submitted' ?
              'bg-green-500/5 text-green-600 dark:bg-green-900/20 dark:text-green-400'
            : displayStatus === 'processing' ?
              'bg-sky-500/10 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300'
            : displayStatus === 'skipped' ?
              'bg-amber-500/5 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
            : displayStatus === 'cancelled' ?
              'bg-rose-500/5 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300'
            : 'bg-zinc-500/5 text-zinc-650 dark:bg-zinc-800/20 dark:text-zinc-400',
          )}
        >
          <span className='inline-flex items-center gap-1.5'>
            {isLiveProcessing && <RefreshCw className='w-3 h-3 animate-spin' />}
            {displayStatus}
          </span>
        </span>
        {entry.skip_reason && (
          <p
            className='text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 italic max-w-[180px] truncate'
            title={entry.skip_reason}
          >
            {entry.skip_reason}
          </p>
        )}
      </div>
      <div className='px-4 text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap'>
        {formatDate(getApplicationDisplayDate(entry))}
      </div>
      <div className='pl-4'>
        <div className='inline-flex gap-1.5 justify-end w-full'>
          {entry.job_link && (
            <IconButton
              label='Open link'
              icon='open'
              onClick={() =>
                window.open(
                  entry.job_link ?? '',
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            />
          )}

          {isLiveProcessing ? null : (
            <>
              <IconButton
                label='Async from link'
                icon='async'
                onClick={() => void asyncApplication(entry.id)}
                disabled={!entry.job_link || syncingApplicationId === entry.id}
              />
              <IconButton
                label='Edit application'
                icon='edit'
                onClick={() =>
                  setExpandedApplicationId(
                    expandedApplicationId === entry.id ? '' : entry.id,
                  )
                }
              />
              <IconButton
                label='Delete application'
                icon='delete'
                onClick={() => void deleteApplication(entry.id)}
                danger
              />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
