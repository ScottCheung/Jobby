/** @format */

'use client';
import { Button, Kbd, Tooltip } from '@jobby/ui';

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
  BriefcaseBusiness,
  UserRound,
  Gauge,
  Clock,
  Gem,
  Sparkles,
} from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import { cn, cleanName, formatInterviewDuration } from '@/lib/utils';


import type { PracticeMode } from './PracticeModeModal';
import { QuestionCommentActions } from './Comments/QuestionCommentActions';
import { useLayoutStore } from '@/lib/store/layout-store';
import { QuestionReportsContent } from './QuestionReportsDrawer';
import {
  getInterviewCategoryIcon,
  getInterviewCategoryLabel,
} from '@/lib/interview-categories';
import { api } from '@/lib/api';
import type { QuestionCommunitySummary } from '@/lib/types';

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

export const PracticeHeader = React.memo(function PracticeHeader({
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
  const [communitySummary, setCommunitySummary] =
    React.useState<QuestionCommunitySummary | null>(null);

  React.useEffect(() => {
    if (!currentQuestion?.id) {
      setCommunitySummary(null);
      return;
    }
    let cancelled = false;
    void api
      .questionCommunity(currentQuestion.id)
      .then((summary) => {
        if (!cancelled) setCommunitySummary(summary);
      })
      .catch(() => {
        if (!cancelled) setCommunitySummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentQuestion?.id, reportRefreshKey]);

  const topCompanies =
    communitySummary?.top_companies ??
    currentQuestion?.metrics?.top_companies ??
    [];
  const visibleCompanies = topCompanies.slice(0, 5);
  const hiddenCompanyCount = Math.max(
    0,
    (communitySummary?.company_count ?? topCompanies.length) -
      visibleCompanies.length,
  );
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const isQueueActive = isDrawerOpen && drawerId === 'practice-queue';

  const handleOpenReportsDrawer = () => {
    if (!currentQuestion) return;
    openDrawer({
      id: 'question-reports',
      width: 400,
      content: (
        <QuestionReportsContent
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
                'Auto AI Evaluation: ON (up to 5 coins per submitted transcript)'
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
                  autoEvalEnabled &&
                    'animate-heart-pop animate-text-shimmer-primary animate-text-shimmer',
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
        <div className='col -mt-1 lg:-mt-12 gap-1.75!'>
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
          <h2 className='title-card -mt-2 leading-snug'>
            {currentQuestion.title}
          </h2>
          <div className='flex flex-wrap items-center gap-1.5'>
            {/* Contributor / Contributor */}
            <span className='inline-flex h-6 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-[10px] font-semibold text-primary'>
              <UserRound className='h-3 w-3 text-primary' />
              {currentQuestion.contributor_name || 'Community'}
            </span>
            {currentQuestion.category && (
              <span className='inline-flex h-6 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-[10px] font-semibold text-primary'>
                {React.createElement(
                  getInterviewCategoryIcon(currentQuestion.category),
                  { className: 'h-3 w-3' },
                )}
                {getInterviewCategoryLabel(currentQuestion.category)}
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

            {visibleCompanies.map((company) => (
              <Tooltip
                key={company.name}
                content='Click to view interview reports'
                side='bottom'
              >
                <button
                  type='button'
                  onClick={handleOpenReportsDrawer}
                  className='inline-flex h-6 items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 py-1 pl-1.5 pr-2 text-[10px] font-semibold text-blue-600 transition-colors hover:border-blue-500/30 hover:bg-blue-500/20 dark:text-blue-400'
                >
                  <BriefcaseBusiness className='h-3.5 w-3.5' />
                  {company.name} {company.count}
                </button>
              </Tooltip>
            ))}
            {hiddenCompanyCount > 0 && (
              <Tooltip
                content='Click to view all interview reports'
                side='bottom'
              >
                <button
                  type='button'
                  onClick={handleOpenReportsDrawer}
                  className='inline-flex h-6 items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 text-[10px] font-semibold text-blue-600 transition-colors hover:border-blue-500/30 hover:bg-blue-500/20 dark:text-blue-400'
                >
                  More +{hiddenCompanyCount}
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
});
