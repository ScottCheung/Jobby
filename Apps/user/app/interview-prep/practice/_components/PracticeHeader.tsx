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
  Building2,
  Badge,
  UserRound,
  Gauge,
  Clock,
  Gem,
  Sparkles,
} from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import { cn, cleanName, formatInterviewDuration } from '@/lib/utils';
import { Tooltip, Kbd } from '@/components/UI/tooltip';
import { Button } from '@/components/UI/Button';
import type { PracticeMode } from './PracticeModeModal';
import { QuestionCommentActions } from './Comments/QuestionCommentActions';
import { useLayoutStore } from '@/lib/store/layout-store';
import { QuestionReportsDrawer } from './QuestionReportsDrawer';

interface PracticeHeaderProps {
  currentQuestion: InterviewQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  practiceMode: PracticeMode;
  isShuffled: boolean;
  isDrawerOpen: boolean;
  drawerId: string | undefined;
  globalShowAnswers: boolean;
  autoEvalEnabled: boolean;
  customSelectedIds: string[];
  onShowModeModal: () => void;
  onToggleAnswers: () => void;
  onToggleShuffle: () => void;
  onToggleAutoEval: () => void;
  onOpenQueue: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onReportInterview: () => void;
  onOpenComments: () => void;
  reportRefreshKey: number;
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
  autoEvalEnabled,
  customSelectedIds,
  onShowModeModal,
  onToggleAnswers,
  onToggleShuffle,
  onToggleAutoEval,
  onOpenQueue,
  onPrevious,
  onNext,
  onReportInterview,
  onOpenComments,
  reportRefreshKey,
}: PracticeHeaderProps) {
  const ModeIcon = modeIcons[practiceMode] ?? Shuffle;
  const modeLabel = modeLabels[practiceMode] ?? 'Free Roam';
  const aiDifficulty = currentQuestion?.ai_metadata?.difficulty;
  const displayDifficulty =
    aiDifficulty ?
      cleanName(aiDifficulty)
    : currentQuestion?.difficulty || 'Medium';
  const normalizedDifficulty = displayDifficulty.toLowerCase();
  const estimatedDurationLabel = formatInterviewDuration(
    currentQuestion?.estimated_duration_seconds,
  );

  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const isQueueActive = isDrawerOpen && drawerId === 'practice-queue';

  const handleOpenReportsDrawer = () => {
    if (!currentQuestion) return;
    openDrawer({
      id: 'question-reports',
      width: 400,
      content: (
        <QuestionReportsDrawer
          questionId={currentQuestion.id}
          onReport={onReportInterview}
        />
      ),
    });
  };

  return (
    <div className='flex flex-col gap-2.5 shrink-0 '>
      {/* Top row: toolbar aligned to the right, mode modal button inside the toolbar */}
      <div className='flex items-baseline  justify-end gap-2 opacity-60 -mr-4'>
        {/* Unified toolbar */}
        <div className='row shrink-0'>
          {/* Mode Settings Button */}
          <Tooltip content='Practice Mode Settings' side='bottom'>
            <Button
              layoutId='Practice Mode Setting'
              onClick={onShowModeModal}
              variant='toolbar'
              size='toolbar'
            >
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

          {/* Auto AI Evaluation Toggle */}
          <Tooltip
            content={
              autoEvalEnabled ?
                'Auto AI Evaluation: ON (Consumes coins)'
              : 'Auto AI Evaluation: OFF'
            }
            side='bottom'
          >
            <Button
              onClick={onToggleAutoEval}
              variant={autoEvalEnabled ? 'toolbarActive' : 'toolbar'}
              size='toolbar'
            >
              <Sparkles
                className={cn(
                  'w-4 h-4',
                  autoEvalEnabled && 'animate-heart-pop animate-pulse',
                )}
              />
            </Button>
          </Tooltip>

          {/* View Queue List / Search Button */}
          <Tooltip
            content={
              <span className='inline-flex items-center'>
                View Practice Queue <Kbd>F</Kbd>
              </span>
            }
            side='bottom'
          >
            <Button
              onClick={onOpenQueue}
              variant={isQueueActive ? 'toolbarActive' : 'toolbar'}
              size='toolbar'
            >
              <List className='w-4 h-4' />
            </Button>
          </Tooltip>

          {/* Navigation Controls (Infinite wrap-around) */}
          <Tooltip
            content={
              <span className='inline-flex items-center'>
                Previous Question <Kbd>←</Kbd>
              </span>
            }
            side='bottom'
          >
            <Button
              onClick={onPrevious}
              disabled={totalQuestions <= 1}
              variant='toolbar'
              size='toolbar'
            >
              <ChevronLeft className='w-4 h-4' />
            </Button>
          </Tooltip>

          <Tooltip
            content={
              <span className='inline-flex items-center'>
                Next Question <Kbd>→</Kbd>
              </span>
            }
            side='bottom'
          >
            <Button
              onClick={onNext}
              disabled={totalQuestions <= 1}
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
        <div className='col -mt-1 lg:-mt-8 gap-x-1.5'>
          {/* Progress counter */}
          <span className='flex items-baseline gap-1 text-[11px] text-primary'>
            <span className='font-sans text-[30px] font-black text-primary/40'>
              {currentIndex + 1}
            </span>{' '}
            /
            <span className='font-sans text-[16px] font-black text-primary/20'>
              {totalQuestions}
            </span>
            <span className='ml-1 font-normal '>· {modeLabel}</span>
            {practiceMode !== 'plan' && (
              <span className='ml-1 font-normal '>
                · {isShuffled ? 'shuffle' : 'sequential'}
              </span>
            )}
          </span>
          <h2 className='title-card -mt-1 leading-snug'>
            {currentQuestion.title}
          </h2>
          <div className='flex flex-wrap items-center gap-1.5'>
            {/* Uploader / Author */}
            <span className='inline-flex h-6 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-[10px] font-semibold text-primary'>
              <UserRound className='h-3 w-3 text-primary' />
              {currentQuestion.contributor_name || 'Community'}
            </span>
            {currentQuestion.category && (
              <span className='inline-flex h-6 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-[10px] font-semibold text-primary'>
                <Badge className='h-3 w-3' />
                {cleanName(currentQuestion.category.name)}
              </span>
            )}
            {/* Estimated Duration */}
            <span className='inline-flex h-6 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-[10px] font-semibold text-primary'>
              <Clock className='h-3 w-3 text-ink-secondary/70' />
              {estimatedDurationLabel}
            </span>
            {/* Difficulty Badge */}
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold capitalize',
                normalizedDifficulty === 'easy' &&
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                normalizedDifficulty === 'medium' &&
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                normalizedDifficulty === 'hard' &&
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400',
              )}
            >
              <Gauge className='h-3 w-3' />
              {displayDifficulty}
            </span>

            {/* Practice Priority / Importance */}
            <span
              title='Practice Priority'
              className='inline-flex h-6 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400'
            >
              <Gem className='h-3 w-3 ' />
              Priority {currentQuestion.importance_score || 0}
            </span>

            {currentQuestion.tags?.map((t) => (
              <span
                key={t.id}
                className='inline-flex h-6 items-center gap-1 rounded-md bg-background-secondary/60 px-1.5 text-[10px] font-medium text-ink-primary'
              >
                <Tag className='w-2.5 h-2.5 opacity-50' />
                {cleanName(t.name)}
              </span>
            ))}

            {/* Aggregated Company Statistics Button */}
            {currentQuestion.companies &&
              currentQuestion.companies.length > 0 && (
                <Tooltip
                  content='Click to view interview details by company'
                  side='bottom'
                >
                  <button
                    type='button'
                    onClick={handleOpenReportsDrawer}
                    className='inline-flex h-6 items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 py-1 pl-1.5 pr-2 text-[10px] font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-500/20 hover:border-blue-500/30 cursor-pointer active:scale-95'
                  >
                    <div className='flex items-center -space-x-1 overflow-hidden'>
                      {currentQuestion.companies.slice(0, 3).map((c) =>
                        c.logo_url ?
                          <img
                            key={c.id}
                            src={c.logo_url}
                            alt={c.name}
                            className='w-3.5 h-3.5 rounded-full object-cover bg-white ring-1 ring-background shrink-0'
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        : <Building2
                            key={c.id}
                            className='w-3 h-3 opacity-60 ml-0.5'
                          />,
                      )}
                    </div>
                    <span>
                      {currentQuestion.companies
                        .slice(0, 2)
                        .map((c) => c.name)
                        .join(', ')}
                      {currentQuestion.companies.length > 2 && (
                        <span className='ml-0.5 font-semibold text-blue-700 dark:text-blue-300'>
                          +{currentQuestion.companies.length - 2}
                        </span>
                      )}
                    </span>
                  </button>
                </Tooltip>
              )}
          </div>
          <QuestionCommentActions
            questionId={currentQuestion.id}
            reportRefreshKey={reportRefreshKey}
            onReport={onReportInterview}
            compact
            initialMetrics={currentQuestion.metrics}
            onOpenComments={onOpenComments}
            onOpenReports={handleOpenReportsDrawer}
          />
        </div>
      )}
    </div>
  );
}
