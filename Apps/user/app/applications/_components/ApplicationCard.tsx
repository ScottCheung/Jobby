/** @format */

'use client';
import { Avatar, Tooltip } from '@jobby/ui';

import React from 'react';
import {
  Building2,
  MapPin,
  ExternalLink,
  Clock,
  Briefcase,
  ChevronRight,
  RefreshCw,
  FileText,
  Calendar,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, cleanDescription } from '@/lib/utils';
import { StructuredJobDescription } from '@/components/StructuredJobDescription';

import { IconButton } from '@/components/ConsoleUtils';

export interface ApplicationCardViewModel {
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
  jobLink?: string | null;
  hasTailoredResume?: boolean;
  firstPostedAt?: string | null;
  lastPostedAt?: string | null;
  displayFirstPostedAt?: string | null;
  displayLastPostedAt?: string | null;
  isReposted?: boolean;
  jobDescription?: string | null;
}

interface ApplicationCardProps {
  entry: ApplicationCardViewModel;
  isSelected: boolean;
  onOpenDetails: (
    applicationId: string,
    initialTab?: 'overview' | 'qa' | 'description',
  ) => void;
  onDelete: (applicationId: string, title?: string, company?: string) => void;
  onOpenResume?: (
    applicationId: string,
    title: string,
    company: string,
  ) => void;
}

const platformIcons: Record<string, React.ReactNode> = {
  linkedin: (
    <svg width='16' height='16' viewBox='0 0 34 34' fill='currentColor'>
      <path
        className='fill-[#0a66c2] dark:fill-ink-secondary/70'
        d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
      />
    </svg>
  ),
  seek: (
    <svg width='16' height='16' viewBox='0 0 68 68' fill='currentColor'>
      <path
        className='fill-[#0d3880] dark:fill-ink-secondary/70'
        d='M34.015,1.51c-17.952,0-32.506,14.552-32.506,32.507c0,17.952,14.554,32.505,32.506,32.505
c17.958,0,32.508-14.553,32.508-32.505C66.523,16.062,51.972,1.51,34.015,1.51z'
      />
    </svg>
  ),
};

export function ApplicationCard({
  entry,
  isSelected,
  onOpenDetails,
  onDelete,
  onOpenResume,
}: ApplicationCardProps) {
  const platformBadge =
    entry.platform && platformIcons[entry.platform] ?
      <span className='inline-flex items-center gap-1' title={entry.platform}>
        {platformIcons[entry.platform]}
        <span className='text-[10px] font-bold capitalize text-ink-secondary/80'>
          {entry.platform}
        </span>
      </span>
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.5,
        // delay: 0.07 * Math.random(),
      }}
      onClick={() => onOpenDetails(entry.id)}
      className={cn(
        'group relative flex flex-col justify-between rounded-tl-3xl! rounded-2xl border border-primary/60 bg-panel/70 p-5  hover:border-primary/40 hover:shadow-md cursor-pointer',
        entry.isLiveProcessing &&
          'bg-amber-500/5 border-amber-500/40 border-l-4 border-l-amber-500',
        isSelected && 'bg-primary/10 border-primary/50 ring-1 ring-primary/30',
      )}
    >
      <div>
        {/* Top Header: Avatar, Role Title, Status Badge */}
        <div className='flex items-start -mt-1 justify-between gap-3'>
          <div className='flex flex-col gap-3 flex-1 min-w-0'>
            <div className='flex items-center gap-2 min-w-0 w-full'>
              <Avatar size='md' name={entry.company || entry.title} />{' '}
              <div className='flex flex-col w-full'>
                <span className='text-xs text-ink-secondary font-medium truncate'>
                  {entry.company}
                </span>
                <h3 className='line-clamp-1  text-base font-bold text-ink-primary group-hover:text-primary transition-colors'>
                  {entry.title}
                </h3>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className='flex flex-col items-end shrink-0'>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border',
                entry.statusBadgeClassName,
              )}
            >
              {entry.isLiveProcessing && (
                <RefreshCw className='w-3 h-3 animate-spin mr-1' />
              )}
              {entry.displayStatus}
            </span>
          </div>
        </div>

        {/* Job Posting Info & Requisition Details */}
        <div className='mt-4 flex flex-col gap-2 rounded-xl border border-primary/40 bg-background-secondary/30 p-3 text-xs text-ink-secondary'>
          <div className='flex items-center justify-between gap-2 flex-wrap'>
            <div className='grid gap-1 text-primary font-medium'>
              {entry.isReposted && (
                <div className='flex items-center gap-1.5'>
                  <Clock className='size-3.5 shrink-0 text-primary' />
                  <span>
                    First posted:{' '}
                    <strong className='font-bold text-ink-primary'>
                      {entry.displayFirstPostedAt || entry.firstPostedAt || 'Unknown'}
                    </strong>
                  </span>
                </div>
              )}
              <div className='flex items-center gap-1.5'>
                <Clock className='size-3.5 shrink-0 text-primary' />
                <span>
                  {entry.isReposted ? 'Reposted' : 'Posted'}:{' '}
                  <strong className='font-bold text-ink-primary'>
                    {entry.displayLastPostedAt || entry.lastPostedAt || entry.displayFirstPostedAt || entry.firstPostedAt || 'Unknown'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Applied Stage Time */}
            {entry.stageTimestamp && (
              <div className='flex items-center gap-1.5 text-ink-secondary/90'>
                <Calendar className='size-3.5 shrink-0 text-slate-400' />
                <span>Applied: {entry.displayStageTime}</span>
              </div>
            )}
          </div>

          <div className='flex items-center justify-between gap-2 border-t border-primary/30 pt-2 flex-wrap text-[11px]'>
            {/* Location & Work Style */}
            <div className='flex items-center gap-2 flex-wrap'>
              {entry.workLocation && (
                <div className='flex items-center gap-1 text-ink-secondary'>
                  <MapPin className='size-3 text-slate-400' />
                  <span className='truncate max-w-[140px]'>
                    {entry.workLocation.split(',')[0]}
                  </span>
                </div>
              )}
              {entry.workStyle && (
                <div className='flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium'>
                  <Briefcase className='size-3 shrink-0' />
                  <span className='capitalize'>{entry.workStyle}</span>
                </div>
              )}
            </div>

            {/* Platform & Job ID */}
            <div className='flex items-center gap-1.5 shrink-0'>
              {platformBadge}
              {entry.jobId && (
                <span className='font-mono text-[10px] bg-ink-primary/10 text-ink-primary/80 px-1.5 py-0.5 rounded'>
                  #{entry.jobId.slice(0, 10)}
                </span>
              )}
            </div>
          </div>
        </div>

        {entry.jobDescription ?
          <Tooltip
            side='top'
            size='lg'
            delay={150}
            content={
              <div className='max-h-[350px] max-w-[460px] overflow-y-auto custom-scrollbar-primary p-2 space-y-1 text-xs'>
                <div className='font-bold text-primary text-[11px] uppercase tracking-wider border-b border-primary/40 pb-1 mb-2'>
                  Full Job Description ({entry.company})
                </div>
                <StructuredJobDescription content={entry.jobDescription} />
              </div>
            }
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(entry.id, 'description');
              }}
              className='mt-3.5 rounded-xl border border-primary/40 bg-background-secondary/40 p-3 text-xs text-ink-secondary hover:border-primary/30 transition-colors cursor-pointer group/jdp'
            >
              <div className='flex items-center justify-between mb-1'>
                <span className='text-[10px] font-bold text-ink-secondary/70 uppercase tracking-wider group-hover/jdp:text-primary transition-colors'>
                  Job Description Preview
                </span>
                <span className='text-[10px] text-primary font-medium'>
                  Hover for full JD ↗
                </span>
              </div>
              <p className='leading-relaxed text-ink-primary/80 line-clamp-3 whitespace-pre-wrap'>
                {cleanDescription(entry.jobDescription)}
              </p>
            </div>
          </Tooltip>
        : null}
      </div>

      {/* Card Footer Actions */}
      <div className='mt-4 flex items-center justify-between border-t border-primary/40 pt-3 text-xs gap-2'>
        <div
          className='flex items-center gap-1.5'
          onClick={(e) => e.stopPropagation()}
        >
          {onOpenResume && entry.hasTailoredResume && (
            <IconButton
              label='Preview tailored resume'
              icon='resume'
              onClick={() => onOpenResume(entry.id, entry.title, entry.company)}
            />
          )}

          {entry.jobLink && (
            <IconButton
              label='Open job link'
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

          {!entry.isLiveProcessing && (
            <IconButton
              label='Delete application'
              icon='delete'
              onClick={() => onDelete(entry.id, entry.title, entry.company)}
              danger
            />
          )}
        </div>

        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(entry.id);
          }}
          className='flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer group/det'
        >
          <span>View Details</span>
          <ChevronRight className='size-3.5 group-hover/det:translate-x-0.5 transition-transform' />
        </button>
      </div>
    </motion.div>
  );
}
