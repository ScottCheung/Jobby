/** @format */

'use client';

import { RefreshCw } from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { cn } from '@/lib/utils';
import { QuestionRecommendationCard } from '../_components/QuestionRecommendationCard';
import { QuestionCardSkeleton } from '../_components/ExploreSkeletons';

export type RankingMode = 'hot' | 'season' | 'month' | 'week';
export type RecommendationFeed = 'forYou' | RankingMode;

type RecommendationPanel = {
  id: RecommendationFeed;
  anchorId: string;
  title: string;
  description: string;
  questions: InterviewQuestion[];
  showReason?: boolean;
};

type RecommendationSectionProps = {
  panels: RecommendationPanel[];
  activeId: string | null;
  practicedTodayIds: Set<string>;
  refreshingFeed: RecommendationFeed | null;
  onRefresh: (feed: RecommendationFeed) => void;
  onSaveQuestion: (question: InterviewQuestion) => void;
  onPracticeQuestion: (question: InterviewQuestion) => void;
  onFavoriteQuestion: (question: InterviewQuestion) => void;
  onReactToQuestion: (
    question: InterviewQuestion,
    value: 'up' | 'down' | null,
  ) => void;
  isLoading: boolean;
};

function RecommendationPanel({
  panel,
  activeId,
  practicedTodayIds,
  isRefreshing,
  onRefresh,
  onSaveQuestion,
  onPracticeQuestion,
  onFavoriteQuestion,
  onReactToQuestion,
  isLoading,
}: {
  panel: RecommendationPanel;
  activeId: string | null;
  practicedTodayIds: Set<string>;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSaveQuestion: (question: InterviewQuestion) => void;
  onPracticeQuestion: (question: InterviewQuestion) => void;
  onFavoriteQuestion: (question: InterviewQuestion) => void;
  onReactToQuestion: (
    question: InterviewQuestion,
    value: 'up' | 'down' | null,
  ) => void;
  isLoading: boolean;
}) {
  return (
    <div id={panel.anchorId} className='grid scroll-mt-5 gap-3 border-t border-border/40 pt-5 first:border-t-0 first:pt-0'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-sm font-bold text-ink-primary'>{panel.title}</h3>
          <p className='mt-1 text-xs text-ink-secondary'>{panel.description}</p>
        </div>
        <button
          type='button'
          onClick={onRefresh}
          disabled={panel.questions.length <= 4}
          aria-label={`Refresh ${panel.title}`}
          title={`Refresh ${panel.title}`}
          className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background-secondary text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35'
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {isLoading ? (
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {Array.from({ length: 4 }, (_, index) => (
            <QuestionCardSkeleton key={index} />
          ))}
        </div>
      ) : panel.questions.length === 0 ? (
        <div className='rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-ink-secondary'>
          No questions available yet.
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-3 sm:grid-cols-2 xl:grid-cols-4',
            isRefreshing && 'opacity-25 transition-opacity duration-200',
          )}
        >
          {panel.questions.map((question) => (
            <QuestionRecommendationCard
              key={question.id}
              question={question}
              isSaving={activeId === question.id}
              practicedToday={practicedTodayIds.has(question.id)}
              showReason={panel.showReason}
              onSave={onSaveQuestion}
              onPractice={onPracticeQuestion}
              onFavorite={onFavoriteQuestion}
              onReact={onReactToQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RecommendationSection({
  panels,
  activeId,
  practicedTodayIds,
  refreshingFeed,
  onRefresh,
  onSaveQuestion,
  onPracticeQuestion,
  onFavoriteQuestion,
  onReactToQuestion,
  isLoading,
}: RecommendationSectionProps) {
  return (
    <section id='recommendations' className='scroll-mt-5'>
      <CardWithNorth title='Question discovery' contentClassName='p-5'>
        <div className='grid gap-6'>
          {panels.map((panel) => (
            <RecommendationPanel
              key={panel.id}
              panel={panel}
              activeId={activeId}
              practicedTodayIds={practicedTodayIds}
              isRefreshing={refreshingFeed === panel.id}
              onRefresh={() => onRefresh(panel.id)}
              onSaveQuestion={onSaveQuestion}
              onPracticeQuestion={onPracticeQuestion}
              onFavoriteQuestion={onFavoriteQuestion}
              onReactToQuestion={onReactToQuestion}
              isLoading={isLoading}
            />
          ))}
        </div>
      </CardWithNorth>
    </section>
  );
}
