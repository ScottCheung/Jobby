/** @format */

'use client';

import {
  Bookmark,
  CheckCircle2,
  Dumbbell,
  Heart,
  Loader2,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { cn, formatInterviewDuration } from '@/lib/utils';
import {
  getCategoryPresentation,
  type ContentActivityBadge,
} from './explore-utils';
import { div } from 'framer-motion/client';
import { Tooltip } from '@/components/UI/tooltip';

type QuestionRecommendationCardProps = {
  question: InterviewQuestion;
  onSave: (question: InterviewQuestion) => void;
  onPractice: (question: InterviewQuestion) => void;
  isSaving: boolean;
  compact?: boolean;
  activityBadge?: ContentActivityBadge;
  practicedToday?: boolean;
  showReason?: boolean;
  onFavorite?: (question: InterviewQuestion) => void;
  onReact?: (question: InterviewQuestion, value: 'up' | 'down' | null) => void;
};

export function QuestionRecommendationCard({
  question,
  onSave,
  onPractice,
  isSaving,
  compact = false,
  activityBadge,
  practicedToday = false,
  showReason = false,
  onFavorite,
  onReact,
}: QuestionRecommendationCardProps) {
  const { label: categoryLabel, Icon: CategoryIcon } =
    getCategoryPresentation(question);
  const durationLabel =
    question.estimated_duration_seconds ?
      formatInterviewDuration(question.estimated_duration_seconds)
    : 'Ready';

  return (
    <article
      className={cn(
        'relative flex h-full flex-col justify-between rounded-xl rounded-tr-2xl! rounded-br-3xl! border p-4 transition-colors hover:border-primary/40',
        compact ?
          'min-h-[154px] border-primary/20 bg-primary/5'
        : 'min-h-[190px] border-border/50 bg-background-secondary/35',
      )}
    >
      <button
        type='button'
        onClick={() => onSave(question)}
        disabled={isSaving}
        className={cn(
          'absolute right-3 top-3 inline-flex items-center justify-center rounded-full border transition-colors',
          compact ? 'h-7 w-7' : 'h-8 w-8',
          question.is_saved ?
            'border-primary/30 bg-primary/10 text-primary'
          : 'border-border bg-background-secondary text-ink-secondary hover:border-primary/50 hover:text-primary',
        )}
        title={question.is_saved ? 'Saved' : 'Save to Library'}
      >
        {isSaving ?
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
        : question.is_saved ?
          <CheckCircle2 className='h-3.5 w-3.5' />
        : <Plus className='h-3.5 w-3.5' />}
      </button>

      <div className='pr-9'>
        <div className='flex items-end gap-3 text-[8px] font-bold uppercase tracking-wide text-primary/70'>
          <div className='col'>
            <CategoryIcon className='h-6 w-6' />
            {categoryLabel}
          </div>
          {activityBadge && (
            <span className='inline-flex items-center gap-1 border-success rounded border px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-success'>
              {activityBadge}
            </span>
          )}
        </div>
        {/* {showReason && question.recommendation_reason && (
          <div className='mt-2 flex items-center gap-1 line-clamp-1 text-xs text-ink-secondary'>
            {question.recommendation_reason}
          </div>
        )} */}
        <Tooltip content={question.title}>
          <h3
            className={cn(
              'font-bold leading-snug text-ink-primary line-clamp-2',
              compact ? 'mt-3 text-sm' : 'mt-1 text-sm',
            )}
          >
            {question.title}{' '}
          </h3>
        </Tooltip>
        <div className='row mt-2'>
          {onReact && (
            <>
              <button
                type='button'
                onClick={() =>
                  onReact(
                    question,
                    question.user_reaction === 'up' ? null : 'up',
                  )
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:text-primary',
                  question.user_reaction === 'up' && ' text-rose-500',
                )}
                title='Helpful'
              >
                <ThumbsUp className='h-3.5 w-3.5' />
                {question.metrics?.upvote_count || 0}
              </button>
              <button
                type='button'
                onClick={() =>
                  onReact(
                    question,
                    question.user_reaction === 'down' ? null : 'down',
                  )
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:text-rose-500',
                  question.user_reaction === 'down' && ' text-primary',
                )}
                title='Not helpful'
              >
                <ThumbsDown className='h-3.5 w-3.5' />
                {question.metrics?.downvote_count || 0}
              </button>
            </>
          )}
          {onFavorite && (
            <button
              type='button'
              onClick={() => onFavorite(question)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-ink-secondary transition-colors hover:text-rose-500',
                question.is_favorited && ' text-amber-500',
              )}
              title='Favorite'
            >
              <Bookmark className='h-3.5 w-3.5' />
              {question.metrics?.favorite_count || 0}
            </button>
          )}
        </div>
      </div>

      <div className='mt-4 flex items-end justify-between gap-2'>
        {compact ?
          <div />
        : practicedToday ?
          <span className='inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400'>
            <CheckCircle2 className='h-3.5 w-3.5' />
            Practiced today
          </span>
        : <span className='text-xs text-ink-secondary'>{durationLabel}</span>}
        <div className='flex items-center '>
          <Button onClick={() => onPractice(question)} Icon={Dumbbell}>
            Practice
          </Button>
        </div>
      </div>
    </article>
  );
}
