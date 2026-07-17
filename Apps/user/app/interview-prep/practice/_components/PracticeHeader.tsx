/** @format */

'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  List,
  Eye,
  EyeOff,
  LandPlot,
  Tag,
  Star,
} from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';
import { Tooltip } from '@/components/UI/tooltip';
import { Button } from '@/components/UI/Button';
import type { PracticeMode } from './PracticeModeModal';

interface PracticeHeaderProps {
  currentQuestion: InterviewQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  practiceMode: PracticeMode;
  isShuffled: boolean;
  isDrawerOpen: boolean;
  drawerId: string | undefined;
  globalShowAnswers: boolean;
  customSelectedIds: string[];
  onShowModeModal: () => void;
  onToggleAnswers: () => void;
  onToggleShuffle: () => void;
  onOpenQueue: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const modeIcons: Record<PracticeMode, React.ElementType> = {
  free: Shuffle,
  custom: List,
  plan: CalendarCheckIcon,
};

function CalendarCheckIcon(props: any) {
  // Simple custom lucide-like CalendarCheck icon fallback if lucide version is different
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <rect width='18' height='18' x='3' y='4' rx='2' ry='2' />
      <line x1='16' x2='16' y1='2' y2='6' />
      <line x1='8' x2='8' y1='2' y2='6' />
      <line x1='3' x2='21' y1='10' y2='10' />
      <path d='m9 16 2 2 4-4' />
    </svg>
  );
}

const modeLabels: Record<PracticeMode, string> = {
  free: 'Free Roam',
  custom: 'Custom Set',
  plan: 'Plan Mode',
};

export function PracticeHeader({
  currentQuestion,
  currentIndex,
  totalQuestions,
  practiceMode,
  isShuffled,
  isDrawerOpen,
  drawerId,
  globalShowAnswers,
  customSelectedIds,
  onShowModeModal,
  onToggleAnswers,
  onToggleShuffle,
  onOpenQueue,
  onPrevious,
  onNext,
}: PracticeHeaderProps) {
  const ModeIcon = modeIcons[practiceMode] ?? Shuffle;
  const modeLabel = modeLabels[practiceMode] ?? 'Free Roam';

  const isQueueActive = isDrawerOpen && drawerId === 'practice-queue';

  return (
    <div className='flex flex-col gap-2.5 shrink-0'>
      {/* Top row: toolbar aligned to the right, mode modal button inside the toolbar */}
      <div className='flex items-baseline justify-between gap-2'>
        {/* Progress counter */}
        <span className='text-[10px] text-ink-primary font-bold'>
          Question {currentIndex + 1} of {totalQuestions}
          <span className='ml-1 font-normal opacity-60'>· {modeLabel}</span>
          {practiceMode !== 'plan' && (
            <span className='ml-1 font-normal opacity-60'>
              · {isShuffled ? 'shuffle' : 'sequential'}
            </span>
          )}
        </span>

        {/* Unified toolbar */}
        <div className='flex items-center gap-1.5 shrink-0'>
          {/* Mode Settings Button */}
          <Tooltip content='Practice Mode Settings' side='bottom'>
            <Button onClick={onShowModeModal} variant='toolbar' size='toolbar'>
              <LandPlot className='w-4 h-4' />
            </Button>
          </Tooltip>

          {/* Show / Hide Answer Toggle */}
          <Tooltip
            content={
              globalShowAnswers ?
                'Hide Standard Answers'
              : 'Show Standard Answers'
            }
            side='bottom'
          >
            <Button
              onClick={onToggleAnswers}
              variant={globalShowAnswers ? 'toolbarActive' : 'toolbar'}
              size='toolbar'
            >
              {globalShowAnswers ?
                <Eye className='w-4 h-4' />
              : <EyeOff className='w-4 h-4' />}
            </Button>
          </Tooltip>

          {/* Shuffle Toggle */}
          {practiceMode !== 'plan' && (
            <Tooltip
              content={
                isShuffled ?
                  'Shuffle ON (Sequential off)'
                : 'Sequential (Shuffle off)'
              }
              side='bottom'
            >
              <Button
                onClick={onToggleShuffle}
                variant={isShuffled ? 'toolbarActive' : 'toolbar'}
                size='toolbar'
              >
                <Shuffle className='w-4 h-4' />
              </Button>
            </Tooltip>
          )}

          {/* View Queue List Button */}
          <Tooltip content='View Playlist Queue' side='bottom'>
            <Button
              onClick={onOpenQueue}
              variant={isQueueActive ? 'toolbarActive' : 'toolbar'}
              size='toolbar'
            >
              <List className='w-4 h-4' />
            </Button>
          </Tooltip>

          {/* Navigation Controls */}
          <Tooltip content='Previous Question' side='bottom'>
            <Button
              onClick={onPrevious}
              disabled={currentIndex <= 0}
              variant='toolbar'
              size='toolbar'
            >
              <ChevronLeft className='w-4 h-4' />
            </Button>
          </Tooltip>

          <Tooltip content='Next Question' side='bottom'>
            <Button
              onClick={onNext}
              disabled={
                practiceMode !== 'free' && currentIndex === totalQuestions - 1
              }
              variant='toolbar'
              size='toolbar'
            >
              <ChevronRight className='w-4 h-4' />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Title, tags, rating */}
      {currentQuestion && (
        <div className='flex flex-col -mt-4 gap-2'>
          <h2 className='text-lg font-bold text-ink-primary leading-snug'>
            {currentQuestion.title}
          </h2>
          {((currentQuestion.tags && currentQuestion.tags.length > 0) ||
            currentQuestion.frequency) && (
            <div className='flex flex-wrap gap-1'>
              {currentQuestion.frequency && (
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ',
                    (currentQuestion.frequency === 'Low' ||
                      currentQuestion.frequency === 'Easy') &&
                      'bg-green-500/10 text-green-600 dark:text-green-400',
                    currentQuestion.frequency === 'Medium' &&
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    (currentQuestion.frequency === 'High' ||
                      currentQuestion.frequency === 'Hard') &&
                      'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                  )}
                >
                  {currentQuestion.frequency === 'Hard' ?
                    'High'
                  : currentQuestion.frequency === 'Easy' ?
                    'Low'
                  : currentQuestion.frequency}
                </span>
              )}
              {currentQuestion.tags?.map((t) => (
                <span
                  key={t.id}
                  className='text-[10px] bg-zinc-100 dark:bg-zinc-800/80 text-ink-primary px-2.5 py-1 rounded-full border border-zinc-200/50 dark:border-zinc-700/50 flex items-center gap-1 font-semibold '
                >
                  <Tag className='w-2.5 h-2.5 opacity-60' />
                  {cleanName(t.name)}
                </span>
              ))}
            </div>
          )}
          <div className='flex gap-0.5 mt-0.5'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-3.5 h-3.5 transition-all duration-300',
                  i < (currentQuestion.importance_score || 0) ?
                    'fill-amber-500 text-amber-500 scale-110 drop-'
                  : 'text-zinc-300 dark:text-zinc-750',
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
