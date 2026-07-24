/** @format */

'use client';

import React, { useEffect, useRef } from 'react';
import { X, Shuffle, ListChecks, CalendarCheck, Check } from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';
import type { PracticeMode } from './PracticeModeModal';

interface PracticeQueueDrawerContentProps {
  queue: InterviewQuestion[];
  currentId: string;
  practiceMode: PracticeMode;
  isShuffled: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const modeIcons: Record<PracticeMode, React.ElementType> = {
  free: Shuffle,
  custom: ListChecks,
  plan: CalendarCheck,
};

const modeLabels: Record<PracticeMode, string> = {
  free: 'Free Roam',
  custom: 'Custom Set',
  plan: 'Plan Mode',
};

export function PracticeQueueDrawerContent({
  queue,
  currentId,
  practiceMode,
  isShuffled,
  onSelect,
  onClose,
}: PracticeQueueDrawerContentProps) {
  const currentRef = useRef<HTMLButtonElement | null>(null);
  const ModeIcon = modeIcons[practiceMode] ?? Shuffle;

  // Scroll active item into view when mounted/updated
  useEffect(() => {
    if (currentRef.current) {
      setTimeout(() => {
        currentRef.current?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      }, 150);
    }
  }, [currentId]);

  const currentIndex = queue.findIndex((q) => q.id === currentId);

  return (
    <div className='h-full flex flex-col bg-background'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-4 border-b border-border shrink-0'>
        <div className='flex flex-col gap-0.5'>
          <div className='flex items-center gap-2'>
            <ModeIcon className='w-3.5 h-3.5 text-primary' />
            <span className='label'>
              {modeLabels[practiceMode]}
            </span>
            {practiceMode !== 'plan' && (
              <span
                className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                  isShuffled ?
                    'bg-primary/10 text-primary border-primary/20'
                  : 'bg-background-secondary text-ink-secondary border-border',
                )}
              >
                {isShuffled ? 'shuffle' : 'sequential'}
              </span>
            )}
          </div>
          <span className='label-sm'>
            {currentIndex + 1} / {queue.length} questions
          </span>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='p-2 rounded-lg hover:bg-background-secondary hover:bg-background-secondary transition-colors'
        >
          <X className='w-4 h-4 text-ink-secondary' />
        </button>
      </div>

      {/* Queue list */}
      <div className='flex-1 overflow-y-auto custom-scrollbar-primary py-2'>
        {queue.map((q, index) => {
          const isCurrent = q.id === currentId;
          return (
            <button
              key={`${q.id}-${index}`}
              ref={isCurrent ? currentRef : null}
              type='button'
              onClick={() => {
                onSelect(q.id);
                onClose();
              }}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 text-left transition-all group',
                isCurrent ?
                  'bg-primary/10 border-l-4 border-primary'
                : 'hover:bg-background-secondary/60 border-r-2 border-transparent',
              )}
            >
              {/* Index / Playing indicator */}
              <div className='shrink-0 w-6 flex items-center justify-center mt-0.5'>
                {isCurrent ?
                  <svg
                    className='w-5 h-5 text-primary overflow-visible'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <path
                      d='M3 16c2-2 4-2 6 0s4 2 6 0'
                      className='animate-draw-line'
                      strokeWidth='1.5'
                    />
                    <g transform='translate(1.4, 1.2) scale(0.8)'>
                      <path
                        d='M12 3a2.83 2.83 0 2 1 4 4L5.5 17.5L2 18.5L3 15Z'
                        className='animate-write-pen'
                        fill='currentColor'
                        strokeWidth='1'
                      />
                    </g>
                  </svg>
                : <span className='text-[10px] font-bold text-ink-secondary group-hover:hidden'>
                    {index + 1}
                  </span>
                }
                {!isCurrent && (
                  <Check className='w-3 h-3 text-primary hidden group-hover:block' />
                )}
              </div>

              {/* Question info */}
              <div className='flex-1 min-w-0'>
                <p
                  className={cn(
                    'label-sm line-clamp-2',
                    isCurrent ? 'text-primary' : 'text-ink-primary',
                  )}
                >
                  {q.title}
                </p>
                <div className='flex items-center gap-2 mt-1'>
                  {q.category?.name && (
                    <span className='text-[9px] text-ink-secondary truncate'>
                      {cleanName(q.category.name)}
                    </span>
                  )}
                  {q.frequency && (
                    <span
                      className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                        q.frequency === 'High' || q.frequency === 'Hard' ?
                          'bg-rose-500/10 text-rose-600'
                        : q.frequency === 'Medium' ?
                          'bg-amber-500/10 text-amber-600'
                        : 'bg-green-500/10 text-green-600',
                      )}
                    >
                      {q.frequency === 'Hard' ?
                        'High'
                      : q.frequency === 'Easy' ?
                        'Low'
                      : q.frequency}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
