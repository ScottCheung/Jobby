/** @format */

import React from 'react';
import { Archive, Star, Play, Trash2, Edit3, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  InterviewQuestion,
  InterviewCategory,
  InterviewCollection,
} from '@/lib/types';
import { cn, cleanName, formatInterviewDuration } from '@/lib/utils';
import { AutoTooltip } from '@/components/UI/tooltip/auto-tooltip';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';

interface QuestionRowProps {
  question: InterviewQuestion;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelectChange: (id: string, checked: boolean) => void;
  categories: InterviewCategory[];
  onOpenEdit: (q: InterviewQuestion) => void;
  onDeleteQuestion?: (id: string) => void;
  onArchiveQuestion?: (id: string) => void;
  onInlineUpdate: (id: string, updates: Partial<InterviewQuestion>) => void;
  gridColsClass: string;
  isDrawerSelected: boolean;
  collections: InterviewCollection[];
  currentUserId?: string;
}

export function QuestionRow({
  question,
  isSelectionMode,
  isSelected,
  onSelectChange,
  categories,
  onOpenEdit,
  onDeleteQuestion,
  onArchiveQuestion,
  onInlineUpdate,
  gridColsClass,
  isDrawerSelected,
  collections,
  currentUserId,
}: QuestionRowProps) {
  const router = useRouter();

  const parentCollection = collections.find(
    (c) => question.collection_ids?.includes(c.id),
  );

  const collectionName = parentCollection ? parentCollection.title : 'Community Catalog';

  const authorName =
    question.contributor_name ? question.contributor_name
    : (
      parentCollection?.creator_user_id &&
      parentCollection.creator_user_id === currentUserId
    ) ?
      'Me'
    : parentCollection?.collection_type === 'official' ? 'Official'
    : parentCollection?.creator_name || 'Community';

  const canEdit =
    question.can_edit ??
    (question.submitted_by_user_id === currentUserId || authorName === 'Me');

  const handleRowClick = () => {
    router.push(
      `/interview-prep/practice/${question.display_number || question.id}`,
    );
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleQuestionFavorite(question.id);
      onInlineUpdate(question.id, { is_favorited: !question.is_favorited });
      showGlobalToast(
        question.is_favorited ?
          'Removed from favorites'
        : 'Added to favorites',
      );
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (err) {
      showGlobalToast('Failed to update favorite status');
    }
  };

  const difficultyLabel = question.difficulty || 'Medium';
  const durationLabel = formatInterviewDuration(
    question.estimated_duration_seconds,
  );

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        'grid items-center px-4 py-3 transition-colors group rounded-xl relative cursor-pointer',
        gridColsClass,
        isDrawerSelected ? 'bg-primary/10 hover:bg-primary/15'
        : 'hover:bg-primary/10 dark:hover:bg-background-secondary/20',
      )}
    >
      {/* Selector Column */}
      {isSelectionMode && (
        <div
          className='flex justify-center items-center'
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type='checkbox'
            checked={isSelected}
            onChange={(e) => onSelectChange(question.id, e.target.checked)}
            className='w-4 h-4 rounded bg-background-primary/50 text-primary focus:ring-primary accent-primary cursor-pointer'
          />
        </div>
      )}

      {/* Title & Tags Column */}
      <div
        className='pr-4 flex flex-col gap-1 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onClick={handleRowClick}
          className='cursor-pointer w-full hover:bg-background-secondary/50 px-2 py-1 rounded transition-colors min-h-[28px] flex items-center overflow-hidden'
        >
          <AutoTooltip className='label w-full text-left font-semibold group-hover:text-primary transition-colors'>
            {question.title}
          </AutoTooltip>
        </div>
        {question.tags && question.tags.length > 0 && (
          <div className='flex flex-wrap gap-1 mt-0.5 px-2'>
            {question.tags.map((t) => (
              <span
                key={t.id}
                className='text-[10px] bg-muted text-ink-secondary px-1.5 py-0.5 rounded-full'
              >
                {cleanName(t.name)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Category Column */}
      <div
        className='pr-4 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        <AutoTooltip className='body-md text-ink-secondary w-full text-left'>
          {categories.find((c) => c.id === question.category_id) ?
            cleanName(
              categories.find((c) => c.id === question.category_id)!.name,
            )
          : 'Unclassified'}
        </AutoTooltip>
      </div>

      {/* Collection Column */}
      <div
        className='pr-4 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        <AutoTooltip className='body-md text-ink-secondary w-full text-left'>
          <span className='font-medium text-ink-primary'>
            {collectionName}
          </span>
        </AutoTooltip>
      </div>

      {/* Uploader / Author Column */}
      <div
        className='pr-4 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        <AutoTooltip className='body-md text-ink-secondary w-full text-left'>
          {authorName === 'Me' ?
            <span className='font-semibold text-primary/80'>Me</span>
          : <span>{authorName}</span>}
        </AutoTooltip>
      </div>

      {/* Difficulty & Est Time Column */}
      <div
        className='pr-4 flex flex-col gap-0.5 items-start justify-center'
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={cn(
            'label-sm px-2 py-0.5 rounded-full border text-[11px] font-semibold',
            difficultyLabel === 'Easy' &&
              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            (difficultyLabel === 'Medium' || !difficultyLabel) &&
              'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
            difficultyLabel === 'Hard' &&
              'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
          )}
        >
          {difficultyLabel}
        </span>
        <span className='text-[10px] text-ink-secondary flex items-center gap-1 pl-0.5 mt-0.5'>
          <Clock className='size-3 text-ink-secondary/70' />
          {durationLabel}
        </span>
      </div>

      {/* Importance Column */}
      <div
        className='pr-4 flex gap-0.5 items-center'
        onClick={(e) => e.stopPropagation()}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const score = question.importance_score || 0;
          return (
            <Star
              key={i}
              className={cn(
                'w-3.5 h-3.5 transition-colors',
                i < score ?
                  'fill-amber-500 text-amber-500'
                : 'text-border/60 dark:text-border/40',
              )}
            />
          );
        })}
      </div>

      {/* Action Column (Far Right) */}
      <div
        className='flex items-center justify-end gap-1.5'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleRowClick}
          title='Practice question'
          className='p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors'
        >
          <Play className='size-4 fill-primary/20' />
        </button>
        <button
          onClick={handleToggleFavorite}
          title={question.is_favorited ? 'Unstar question' : 'Star question'}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            question.is_favorited ?
              'text-amber-400 hover:bg-amber-400/10'
            : 'text-ink-secondary hover:text-amber-400 hover:bg-background-secondary',
          )}
        >
          <Star
            className={cn(
              'size-4',
              question.is_favorited && 'fill-amber-400',
            )}
          />
        </button>
        {canEdit && (
          <>
            <button
              onClick={() => onOpenEdit(question)}
              title='Edit details (Author)'
              className='p-1.5 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-background-secondary transition-colors'
            >
              <Edit3 className='size-4' />
            </button>
            {onArchiveQuestion && (
              <button
                onClick={() => onArchiveQuestion(question.id)}
                title='Archive from public question bank'
                className='p-1.5 rounded-lg text-ink-secondary hover:text-orange-500 hover:bg-orange-500/10 transition-colors'
              >
                <Archive className='size-4' />
              </button>
            )}
          </>
        )}
        {question.is_saved && onDeleteQuestion && (
          <button
            onClick={() => onDeleteQuestion(question.id)}
            title='Remove saved question'
            className='p-1.5 rounded-lg text-ink-secondary hover:text-rose-500 hover:bg-rose-500/10 transition-colors'
          >
            <Trash2 className='size-4' />
          </button>
        )}
      </div>
    </div>
  );
}
