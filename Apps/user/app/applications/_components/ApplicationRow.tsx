/** @format */

'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ConsoleUtils';

export interface ApplicationRowViewModel {
  id: string;
  title: string;
  company: string;
  jobId: string;
  platform?: string | null;
  workStyle?: string | null;
  workLocation: string;
  displayStatus: string;
  statusBadgeClassName: string;
  isLiveProcessing: boolean;
  stageTimestamp?: string | null;
  displayStageTime: string;
  skipReason?: string | null;
  shouldShowSkipReason: boolean;
  jobLink?: string | null;
}

interface ApplicationRowProps {
  entry: ApplicationRowViewModel;
  style?: React.CSSProperties;
  isLast: boolean;
  isSyncing: boolean;
  isSelected: boolean;
  onOpenDetails: (applicationId: string) => void;
  onAsync: (applicationId: string) => void;
  onDelete: (applicationId: string) => void;
}

export const ApplicationRow = React.memo(
  function ApplicationRow({
    entry,
    style,
    isLast,
    isSyncing,
    isSelected,
    onOpenDetails,
    onAsync,
    onDelete,
  }: ApplicationRowProps) {
    const platformIcons: Record<string, React.ReactNode> = {
      linkedin: (
        <svg width='16' height='16' viewBox='0 0 34 34' fill='currentColor'>
          <path
            fill=''
            className='fill-[#0a66c2] dark:fill-ink-secondary/70'
            d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
          />
        </svg>
      ),
      seek: (
        /* 这里放 Seek 的图标 SVG */
        <svg width='16' height='16' viewBox='0 0 68 68' fill='currentColor'>
          <path
            className='fill-[#0d3880] dark:fill-ink-secondary/70'
            d='M34.015,1.51c-17.952,0-32.506,14.552-32.506,32.507c0,17.952,14.554,32.505,32.506,32.505
	c17.958,0,32.508-14.553,32.508-32.505C66.523,16.062,51.972,1.51,34.015,1.51z M8.262,41.733c-0.281,0-0.511-0.226-0.511-0.504
	c0-0.281,0.229-0.511,0.511-0.511c0.278,0,0.504,0.229,0.504,0.511C8.766,41.508,8.541,41.733,8.262,41.733z M8.262,34.907
	c-0.281,0-0.511-0.229-0.511-0.51s0.229-0.509,0.511-0.509c0.278,0,0.504,0.228,0.504,0.509S8.541,34.907,8.262,34.907z
	M8.262,28.077c-0.281,0-0.511-0.229-0.511-0.509c0-0.281,0.229-0.507,0.511-0.507c0.278,0,0.504,0.226,0.504,0.507
	C8.766,27.849,8.541,28.077,8.262,28.077z M11.764,41.991c-0.422,0-0.762-0.342-0.762-0.762c0-0.422,0.34-0.765,0.762-0.765
	c0.421,0,0.762,0.343,0.762,0.765C12.526,41.649,12.186,41.991,11.764,41.991z M11.764,35.158c-0.422,0-0.762-0.339-0.762-0.761
	c0-0.42,0.34-0.761,0.762-0.761c0.421,0,0.762,0.341,0.762,0.761C12.526,34.819,12.186,35.158,11.764,35.158z M11.764,28.33
	c-0.422,0-0.762-0.341-0.762-0.762c0-0.422,0.34-0.763,0.762-0.763c0.421,0,0.762,0.341,0.762,0.763
	C12.526,27.989,12.186,28.33,11.764,28.33z M15.867,42.246c-0.562,0-1.019-0.455-1.019-1.017c0-0.561,0.457-1.018,1.019-1.018
	c0.558,0,1.016,0.457,1.016,1.018C16.882,41.791,16.424,42.246,15.867,42.246z M15.867,35.412c-0.562,0-1.019-0.453-1.019-1.015
	c0-0.562,0.457-1.016,1.019-1.016c0.558,0,1.016,0.453,1.016,1.016C16.882,34.959,16.424,35.412,15.867,35.412z M15.867,28.583
	c-0.562,0-1.019-0.451-1.019-1.015c0-0.562,0.457-1.016,1.019-1.016c0.558,0,1.016,0.453,1.016,1.016
	C16.882,28.132,16.424,28.583,15.867,28.583z M20.18,42.497c-0.702,0-1.27-0.567-1.27-1.268c0-0.705,0.568-1.27,1.27-1.27
	c0.704,0,1.27,0.564,1.27,1.27C21.45,41.93,20.884,42.497,20.18,42.497z M20.18,35.669c-0.702,0-1.27-0.568-1.27-1.271
	s0.568-1.269,1.27-1.269c0.704,0,1.27,0.565,1.27,1.269S20.884,35.669,20.18,35.669z M20.18,28.84c-0.702,0-1.27-0.568-1.27-1.271
	s0.568-1.271,1.27-1.271c0.704,0,1.27,0.567,1.27,1.271S20.884,28.84,20.18,28.84z M25.234,42.752c-0.842,0-1.523-0.681-1.523-1.522
	c0-0.845,0.682-1.523,1.523-1.523c0.84,0,1.522,0.679,1.522,1.523C26.756,42.071,26.074,42.752,25.234,42.752z M25.234,35.922
	c-0.842,0-1.523-0.684-1.523-1.524c0-0.842,0.682-1.523,1.523-1.523c0.84,0,1.522,0.682,1.522,1.523
	C26.756,35.238,26.074,35.922,25.234,35.922z M25.234,29.093c-0.842,0-1.523-0.683-1.523-1.524s0.682-1.525,1.523-1.525
	c0.84,0,1.522,0.684,1.522,1.525S26.074,29.093,25.234,29.093z M30.523,43.005c-0.983,0-1.778-0.792-1.778-1.775
	c0-0.982,0.795-1.78,1.778-1.78c0.985,0,1.779,0.798,1.779,1.78C32.302,42.213,31.508,43.005,30.523,43.005z M30.523,36.176
	c-0.983,0-1.778-0.796-1.778-1.778s0.795-1.776,1.778-1.776c0.985,0,1.779,0.794,1.779,1.776S31.508,36.176,30.523,36.176z
	M30.523,29.346c-0.983,0-1.778-0.796-1.778-1.777s0.795-1.776,1.778-1.776c0.985,0,1.779,0.795,1.779,1.776
	S31.508,29.346,30.523,29.346z M36.812,56.922c-1.121,0-2.027-0.911-2.027-2.034c0-1.119,0.906-2.027,2.027-2.027
	c1.125,0,2.035,0.908,2.035,2.027C38.847,56.011,37.938,56.922,36.812,56.922z M36.812,50.091c-1.121,0-2.027-0.91-2.027-2.03
	c0-1.122,0.906-2.036,2.027-2.036c1.125,0,2.035,0.914,2.035,2.036C38.847,49.181,37.938,50.091,36.812,50.091z M36.812,43.26
	c-1.121,0-2.027-0.909-2.027-2.03c0-1.123,0.906-2.033,2.027-2.033c1.125,0,2.035,0.91,2.035,2.033
	C38.847,42.351,37.938,43.26,36.812,43.26z M36.812,36.43c-1.121,0-2.027-0.91-2.027-2.032c0-1.124,0.906-2.03,2.027-2.03
	c1.125,0,2.035,0.906,2.035,2.03C38.847,35.52,37.938,36.43,36.812,36.43z M36.812,29.6c-1.121,0-2.027-0.908-2.027-2.031
	c0-1.122,0.906-2.031,2.027-2.031c1.125,0,2.035,0.909,2.035,2.031C38.847,28.691,37.938,29.6,36.812,29.6z M36.812,22.77
	c-1.121,0-2.027-0.912-2.027-2.032c0-1.123,0.906-2.03,2.027-2.03c1.125,0,2.035,0.907,2.035,2.03
	C38.847,21.857,37.938,22.77,36.812,22.77z M36.812,15.938c-1.121,0-2.027-0.91-2.027-2.029c0-1.123,0.906-2.033,2.027-2.033
	c1.125,0,2.035,0.91,2.035,2.033C38.847,15.027,37.938,15.938,36.812,15.938z M43.342,50.3c-1.233,0-2.238-1.002-2.238-2.239
	c0-1.239,1.004-2.242,2.238-2.242c1.24,0,2.243,1.003,2.243,2.242C45.585,49.298,44.582,50.3,43.342,50.3z M43.342,43.469
	c-1.233,0-2.238-1.003-2.238-2.239c0-1.239,1.004-2.242,2.238-2.242c1.24,0,2.243,1.003,2.243,2.242
	C45.585,42.466,44.582,43.469,43.342,43.469z M43.342,36.64c-1.233,0-2.238-1.004-2.238-2.242c0-1.237,1.004-2.238,2.238-2.238
	c1.24,0,2.243,1.001,2.243,2.238C45.585,35.636,44.582,36.64,43.342,36.64z M43.342,29.807c-1.233,0-2.238-1.002-2.238-2.238
	c0-1.238,1.004-2.24,2.238-2.24c1.24,0,2.243,1.002,2.243,2.24C45.585,28.805,44.582,29.807,43.342,29.807z M43.342,22.977
	c-1.233,0-2.238-1.003-2.238-2.239c0-1.239,1.004-2.242,2.238-2.242c1.24,0,2.243,1.003,2.243,2.242
	C45.585,21.974,44.582,22.977,43.342,22.977z M50.351,43.765c-1.393,0-2.517-1.126-2.517-2.517c0-1.389,1.124-2.516,2.517-2.516
	c1.391,0,2.513,1.127,2.513,2.516C52.863,42.639,51.742,43.765,50.351,43.765z M50.351,36.933c-1.393,0-2.517-1.123-2.517-2.515
	c0-1.386,1.124-2.517,2.517-2.517c1.391,0,2.513,1.131,2.513,2.517C52.863,35.81,51.742,36.933,50.351,36.933z M50.351,30.104
	c-1.393,0-2.517-1.125-2.517-2.515c0-1.393,1.124-2.517,2.517-2.517c1.391,0,2.513,1.124,2.513,2.517
	C52.863,28.979,51.742,30.104,50.351,30.104z M57.49,37.219c-1.519,0-2.756-1.234-2.756-2.754c0-1.523,1.238-2.757,2.756-2.757
	c1.521,0,2.754,1.233,2.754,2.757C60.244,35.984,59.012,37.219,57.49,37.219z'
          ></path>
        </svg>
      ),
    };

    // 2. 优化后的组件逻辑
    const platformBadge = entry.platform && platformIcons[entry.platform] && (
      <span className={cn('flex')} title={entry.platform}>
        {platformIcons[entry.platform]}
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
          onOpenDetails(entry.id);
        }}
        className={cn(
          'grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] pl-4 items-center text-sm border-ink-secondary/10 text-ink-secondary ease-in-out cursor-pointer border-b border-l-2 border-l-transparent',
          entry.isLiveProcessing ?
            'bg-amber-500/5 border-l-amber-500 border-l-4 hover:bg-amber-500/10'
          : isSelected ?
            'bg-primary/10 border-l-primary border-l-4 hover:bg-primary/15'
          : 'hover:bg-primary/20 border-l-0',
        )}
      >
        <div className='pr-4 min-w-0 flex flex-col gap-1 py-2'>
          <strong
            className='  text-ink-primary block truncate text-small font-bold'
            title={entry.title || 'Untitled role'}
          >
            {entry.title}
          </strong>
          <div className='flex items-center gap-2 flex-wrap min-w-0'>
            {entry.jobId ?
              <div className='flex items-center gap-2 flex-wrap'>
                {platformBadge}
                <span className='text-[10px] px-1 py-0.5 rounded bg-ink-primary/10 text-ink-primary/70 font-mono shrink-0'>
                  ID: {entry.jobId}
                </span>
              </div>
            : platformBadge}

            {entry.workLocation && (
              <span
                className='text-[10px] text-ink-primary/70 truncate'
                title={entry.workLocation}
              >
                {entry.workLocation.split(',')[0]}
              </span>
            )}
          </div>
        </div>

        <div
          className='px-4 font-semibold text-ink-primary truncate'
          title={entry.company}
        >
          {entry.company}
        </div>

        <div className='px-4 flex flex-col items-center  gap-1 py-2'>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-[12px] font-black uppercase tracking-wider border-2 ',
              entry.statusBadgeClassName,
            )}
          >
            <span className='inline-flex items-center gap-1.5'>
              {entry.isLiveProcessing && (
                <RefreshCw className='w-3 h-3 animate-spin' />
              )}
              {entry.displayStatus}
            </span>
          </span>

          {entry.shouldShowSkipReason && entry.skipReason && (
            <p
              className='text-[10px] text-ink-secondary italic max-w-[180px] truncate'
              title={entry.skipReason}
            >
              {entry.skipReason}
            </p>
          )}
        </div>
        {entry.stageTimestamp && (
          <div className='flex flex-col items-center justify-center gap-0.5 text-xs text-ink-secondary font-medium'>
            <span title={entry.stageTimestamp}>{entry.displayStageTime}</span>
          </div>
        )}

        <div className='inline-flex gap-1.5 justify-end w-full'>
          {entry.jobLink && (
            <IconButton
              label='Open link'
              icon='open'
              onClick={() =>
                window.open(
                  entry.jobLink ?? '',
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            />
          )}

          {entry.isLiveProcessing ? null : (
            <>
              <IconButton
                label='Async from link'
                icon='async'
                onClick={() => onAsync(entry.id)}
                disabled={!entry.jobLink || isSyncing}
              />
              <IconButton
                label='Delete application'
                icon='delete'
                onClick={() => onDelete(entry.id)}
                // danger
              />
            </>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 1. Check if isLast changed
    if (prevProps.isLast !== nextProps.isLast) return false;

    // 2. Check if syncing status changed for this entry
    if (prevProps.isSyncing !== nextProps.isSyncing) return false;

    // 3. Check if selected state changed
    if (prevProps.isSelected !== nextProps.isSelected) return false;

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
        prevEntry.jobId !== nextEntry.jobId ||
        prevEntry.displayStatus !== nextEntry.displayStatus ||
        prevEntry.skipReason !== nextEntry.skipReason ||
        prevEntry.jobLink !== nextEntry.jobLink ||
        prevEntry.workLocation !== nextEntry.workLocation ||
        prevEntry.platform !== nextEntry.platform ||
        prevEntry.workStyle !== nextEntry.workStyle ||
        prevEntry.stageTimestamp !== nextEntry.stageTimestamp ||
        prevEntry.displayStageTime !== nextEntry.displayStageTime ||
        prevEntry.statusBadgeClassName !== nextEntry.statusBadgeClassName ||
        prevEntry.shouldShowSkipReason !== nextEntry.shouldShowSkipReason ||
        prevEntry.isLiveProcessing !== nextEntry.isLiveProcessing
      ) {
        return false;
      }
    }

    return true;
  },
);
