/** @format */

'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton, formatRelativeDate } from '@/components/ConsoleUtils';
import {
  getCurrentApplicationStageTimestamp,
  getDisplayApplicationStatus,
  getStatusBadgeClasses,
  isProcessingApplication,
  isStaleProcessingApplication,
  shouldShowApplicationSkipReason,
  type JobApplication,
} from '@/lib/types';
import { useConsole } from '@/components/ConsoleContext';
import { useLayoutStore } from '@/lib/store/layout-store';
import { ApplicationDetails } from '@/components/ApplicationDetails';

interface ApplicationRowProps {
  entry: JobApplication;
  style?: React.CSSProperties;
  isLast: boolean;
  syncingApplicationId: string;
  asyncApplication: (id: string) => void | Promise<void>;
  deleteApplication: (id: string) => void | Promise<void>;
}

export const ApplicationRow = React.memo(
  function ApplicationRow({
    entry,
    style,
    isLast,
    syncingApplicationId,
    asyncApplication,
    deleteApplication,
  }: ApplicationRowProps) {
    const { saveApplicationPatch } = useConsole();
    const { actions } = useLayoutStore();

    const displayStatus = getDisplayApplicationStatus(entry);
    const isLiveProcessing =
      isProcessingApplication(entry) && !isStaleProcessingApplication(entry);

    const openDrawerDetails = () => {
      actions.openDrawer({
        width: 640,
        content: (
          <ApplicationDetails application={entry} onSave={saveApplicationPatch} />
        ),
      });
    };

    const stageTimestamp = getCurrentApplicationStageTimestamp(entry);
    const displayStageTime = formatRelativeDate(stageTimestamp);
    const platformBadge = entry.platform && (
      <span
        className={cn(
          'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 border',
          entry.platform === 'linkedin' ?
            'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
          : entry.platform === 'seek' ?
            'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20'
          : 'bg-glass text-ink-secondary border-border',
        )}
      >
        {entry.platform}
      </span>
    );

    const workStyleBadge = entry.work_style && (
      <span className='text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider shrink-0 border border-emerald-500/20'>
        {entry.work_style}
      </span>
    );

    return (
      <div
        style={style}
        onClick={(e) => {
          // Exclude interactive items from triggering the drawer click
          if (
            (e.target as HTMLElement).closest(
              'button, a, input, select, textarea',
            )
          ) {
            return;
          }
          openDrawerDetails();
        }}
        className={cn(
          'grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] items-center px-4 text-sm text-ink-secondary transition-colors cursor-pointer hover:bg-glass border-b border-zinc-100/5',
          isLiveProcessing && 'bg-amber-500/5 border-l-2 border-l-amber-500',
        )}
      >
        <div className='pr-4 min-w-0 flex flex-col gap-1 py-2'>
          <strong
            className='text-ink-primary block truncate text-sm font-semibold'
            title={entry.title || 'Untitled role'}
          >
            {entry.title || 'Untitled role'}
          </strong>
          <div className='flex items-center gap-2 flex-wrap min-w-0'>
            <span className='text-[9px] px-1 py-0.5 rounded bg-glass border border-border text-ink-secondary font-mono shrink-0'>
              ID: {entry.job_id}
            </span>
            {platformBadge}
            {workStyleBadge}
            <span
              className='text-xs text-ink-secondary truncate'
              title={entry.work_location ?? ''}
            >
              {entry.work_location || 'Location not recorded'}
            </span>
          </div>
        </div>
        <div
          className='px-4 font-semibold text-ink-primary truncate'
          title={entry.company ?? ''}
        >
          {entry.company || 'Unknown'}
        </div>
        <div className='px-4 flex flex-col items-start gap-1 py-2'>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
              getStatusBadgeClasses(displayStatus),
            )}
          >
            <span className='inline-flex items-center gap-1.5'>
              {isLiveProcessing && <RefreshCw className='w-3 h-3 animate-spin' />}
              {displayStatus}
            </span>
          </span>

          {stageTimestamp && (
            <div className='flex flex-col items-start gap-0.5 text-[10px] text-ink-secondary font-medium'>
              <span title={stageTimestamp}>{displayStageTime}</span>
            </div>
          )}

          {shouldShowApplicationSkipReason(entry) && entry.skip_reason && (
            <p
              className='text-[10px] text-ink-secondary italic max-w-[180px] truncate'
              title={entry.skip_reason}
            >
              {entry.skip_reason}
            </p>
          )}
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
                  label='Edit application details'
                  icon='edit'
                  onClick={openDrawerDetails}
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
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 1. Check if isLast changed
    if (prevProps.isLast !== nextProps.isLast) return false;

    // 2. Check if syncing status changed for this entry
    const prevIsSyncing = prevProps.syncingApplicationId === prevProps.entry.id;
    const nextIsSyncing = nextProps.syncingApplicationId === nextProps.entry.id;
    if (prevIsSyncing !== nextIsSyncing) return false;

    // 3. Compare position styles (to support react-window virtualization correctly)
    if (
      prevProps.style?.top !== nextProps.style?.top ||
      prevProps.style?.height !== nextProps.style?.height ||
      prevProps.style?.width !== nextProps.style?.width
    ) {
      return false;
    }

    // 4. Compare entry fields
    const prevEntry = prevProps.entry;
    const nextEntry = nextProps.entry;
    if (prevEntry !== nextEntry) {
      if (
        prevEntry.id !== nextEntry.id ||
        prevEntry.title !== nextEntry.title ||
        prevEntry.company !== nextEntry.company ||
        prevEntry.status !== nextEntry.status ||
        prevEntry.skip_reason !== nextEntry.skip_reason ||
        prevEntry.job_link !== nextEntry.job_link ||
        prevEntry.work_location !== nextEntry.work_location ||
        prevEntry.platform !== nextEntry.platform ||
        prevEntry.work_style !== nextEntry.work_style ||
        prevEntry.status_updated_at !== nextEntry.status_updated_at ||
        prevEntry.date_applied !== nextEntry.date_applied ||
        prevEntry.notes !== nextEntry.notes ||
        prevEntry.raw_data !== nextEntry.raw_data
      ) {
        return false;
      }
    }

    return true;
  }
);
