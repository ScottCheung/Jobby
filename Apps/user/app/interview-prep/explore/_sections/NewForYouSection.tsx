/** @format */

'use client';

import { RefreshCw } from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { ScrollableContainer } from '@/components/layout/ScrollableContainer';
import { QuestionRecommendationCard } from '../_components/QuestionRecommendationCard';
import { QuestionCardSkeleton } from '../_components/ExploreSkeletons';
import { getQuestionActivityBadge } from '../_components/explore-utils';
import { cn } from '@/lib/utils';

type NewForYouSectionProps = {
  questions: InterviewQuestion[];
  lastLoginAt: string | null;
  activeId: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
  onSaveQuestion: (question: InterviewQuestion) => void;
  onPracticeQuestion: (question: InterviewQuestion) => void;
  onFavoriteQuestion: (question: InterviewQuestion) => void;
  onReactToQuestion: (
    question: InterviewQuestion,
    value: 'up' | 'down' | null,
  ) => void;
};

export function NewForYouSection({
  questions,
  lastLoginAt,
  activeId,
  isLoading,
  isRefreshing,
  canRefresh,
  onRefresh,
  onSaveQuestion,
  onPracticeQuestion,
  onFavoriteQuestion,
  onReactToQuestion,
}: NewForYouSectionProps) {
  return (
    <section id='new' className='scroll-mt-5'>
      <CardWithNorth
        title='New for you'
        contentClassName='p-5'
        className='scroll-mt-5'
      >
        <div className='grid gap-4'>
          <div className='flex items-center justify-between gap-3'>
            <p className='body-sm text-ink-secondary'>
              Recently published or updated since your last visit.
            </p>
            <button
              type='button'
              onClick={onRefresh}
              disabled={!canRefresh}
              aria-label='Show more new questions'
              className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background-secondary text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35'
              title='Show more new questions'
            >
              <RefreshCw
                className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
              />
            </button>
          </div>

          {isLoading ? (
            <div className='grid grid-flow-col auto-cols-[280px] gap-4 overflow-hidden sm:auto-cols-[320px] lg:auto-cols-[300px]'>
              {Array.from({ length: 4 }, (_, index) => (
                <QuestionCardSkeleton key={index} compact />
              ))}
            </div>
          ) : questions.length > 0 ? (
            <ScrollableContainer itemClassName='lg:w-[300px]'>
              {questions.map((question) => (
                <QuestionRecommendationCard
                  key={question.id}
                  question={question}
                  compact
                  activityBadge={getQuestionActivityBadge(question, lastLoginAt)}
                  isSaving={activeId === question.id}
                  onSave={onSaveQuestion}
                  onPractice={onPracticeQuestion}
                  onFavorite={onFavoriteQuestion}
                  onReact={onReactToQuestion}
                />
              ))}
            </ScrollableContainer>
          ) : (
            <div className='rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-ink-secondary'>
              No new questions since your last visit.
            </div>
          )}

        </div>
      </CardWithNorth>
    </section>
  );
}
