/** @format */

import { AutoTooltip, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@jobby/ui';
import React, { useState, useRef, useEffect } from 'react';
import {
  Archive,
  Star,
  Play,
  Trash2,
  Edit3,
  Clock,
  MoreHorizontal,
  AlertCircle,
  Gauge,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  InterviewQuestion,
  InterviewCategory,
  InterviewCollection,
} from '@/lib/types';
import { cn, cleanName, formatInterviewDuration } from '@/lib/utils';


import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import { QuestionFeedbackFormContent } from './QuestionFeedbackModal';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';


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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  const parentCollection = collections.find((c) =>
    question.collection_ids?.includes(c.id),
  );

  const collectionName =
    parentCollection ? parentCollection.title : 'Community Catalog';

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
        question.is_favorited ? 'Removed from favorites' : 'Added to favorites',
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
  const importanceScore =
    question.importance_score || question.author_importance_score || 0;
  const frequencyText = question.frequency || question.author_frequency;

  const categoryObj = categories.find((c) => c.id === question.category_id);
  const categoryName =
    categoryObj ? cleanName(categoryObj.name) : 'Unclassified';

  const hasMoreActions = true;

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        'grid items-center px-4 py-2.5 transition-colors group rounded-xl relative cursor-pointer h-[72px] box-border',
        gridColsClass,
        isMenuOpen ? 'z-50 overflow-visible' : 'overflow-visible',
        isDrawerSelected ?
          'bg-primary/10 hover:bg-primary/15'
        : 'hover:bg-primary/10 dark:hover:bg-background-secondary/20',
      )}
    >
      {/* 0. Selector Column */}
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

      {/* 1. Question Column */}
      <div
        className='pr-3 overflow-hidden w-full flex items-center'
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onClick={handleRowClick}
          className='cursor-pointer w-full hover:text-primary transition-colors py-1 rounded min-h-[28px] flex items-center overflow-hidden'
        >
          <AutoTooltip className='label w-full text-left font-semibold group-hover:text-primary transition-colors text-sm line-clamp-2 leading-snug'>
            {question.title}
          </AutoTooltip>
        </div>
      </div>

      {/* 2. Category Column */}
      <div
        className='pr-3 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        <AutoTooltip className='text-xs text-ink-secondary/90 w-full text-left truncate font-normal'>
          {categoryName}
        </AutoTooltip>
      </div>

      {/* 3. Key Info Column (Merged Tags, Difficulty/Time, Importance, Frequency) */}
      <div
        className='pr-3 overflow-hidden w-full flex items-center'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex flex-wrap items-center gap-1.5 max-h-[52px] overflow-hidden py-0.5'>
          {/* Difficulty Tag */}
          <Tooltip content={`Difficulty: ${difficultyLabel}`} side='top'>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 capitalize',
                difficultyLabel.toLowerCase() === 'easy' &&
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                (difficultyLabel.toLowerCase() === 'medium' ||
                  !difficultyLabel) &&
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                difficultyLabel.toLowerCase() === 'hard' &&
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
              )}
            >
              <Gauge className='size-3 opacity-80' />
              <span>{difficultyLabel}</span>
            </span>
          </Tooltip>

          {/* Duration Tag */}
          <Tooltip content={`Est. Duration: ${durationLabel}`} side='top'>
            <span className='inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0'>
              <Clock className='size-3 opacity-80 text-primary/70' />
              <span>{durationLabel}</span>
            </span>
          </Tooltip>

          {/* Importance Tag */}
          {importanceScore > 0 && (
            <Tooltip
              content={`Importance Score: ${importanceScore}/5`}
              side='top'
            >
              <span className='inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0'>
                <Star className='size-3 fill-amber-500 text-amber-500' />
                <span>{importanceScore}</span>
              </span>
            </Tooltip>
          )}

          {/* Frequency Tag */}
          {frequencyText && (
            <Tooltip
              content={`Interview Frequency: ${frequencyText}`}
              side='top'
            >
              <span className='inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shrink-0'>
                <span>🔥 {frequencyText}</span>
              </span>
            </Tooltip>
          )}

          {/* Topic Tags */}
          {question.tags &&
            question.tags.map((t) => (
              <Tooltip
                key={t.id}
                content={`Tag: ${cleanName(t.name)}`}
                side='top'
              >
                <span className='text-[10px] bg-background-secondary/80 text-ink-secondary px-1.5 py-0.5 rounded-full shrink-0 border border-border/50 font-normal'>
                  {cleanName(t.name)}
                </span>
              </Tooltip>
            ))}
        </div>
      </div>

      {/* 4. Collection Column */}
      <div
        className='pr-3 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        <AutoTooltip className='text-xs text-ink-secondary/90 w-full text-left truncate font-normal'>
          {collectionName}
        </AutoTooltip>
      </div>

      {/* 5. Contributor / Contributor Column */}
      <div
        className='pr-3 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        <AutoTooltip className='text-xs text-ink-secondary/90 w-full text-left truncate font-normal'>
          {authorName === 'Me' ?
            <span className='font-semibold text-primary/90'>Me</span>
          : <span>{authorName}</span>}
        </AutoTooltip>
      </div>

      {/* 6. Action Column */}
      <div
        className={cn(
          'flex items-center justify-end gap-1 transition-opacity duration-150',
          isMenuOpen ? 'opacity-100' : (
            'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          ),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip content='Practice question' side='left'>
          <button
            onClick={handleRowClick}
            className='p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors'
          >
            <Play className='size-4 fill-primary/20' />
          </button>
        </Tooltip>

        <Tooltip
          content={question.is_favorited ? 'Unstar question' : 'Star question'}
          side='left'
        >
          <button
            onClick={handleToggleFavorite}
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
        </Tooltip>

        {hasMoreActions && (
          <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                title='More actions'
                className={cn(
                  'p-1.5 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-background-secondary transition-colors cursor-pointer',
                  isMenuOpen && 'bg-background-secondary text-ink-primary',
                )}
              >
                <MoreHorizontal className='size-4' />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align='end'
              side='bottom'
              sideOffset={4}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className='w-44 p-1 rounded-xl border border-border bg-panel dark:bg-background-secondary shadow-2xl z-50'
            >
              {canEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onOpenEdit(question);
                  }}
                  className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-primary hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer'
                >
                  <Edit3 className='size-3.5' />
                  <span>Edit Question</span>
                </button>
              )}
              {canEdit && onArchiveQuestion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onArchiveQuestion(question.id);
                  }}
                  className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer'
                >
                  <Archive className='size-3.5' />
                  <span>Archive Question</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  openModal({
                    layoutId: 'question-feedback-modal',
                    content: (
                      <QuestionFeedbackFormContent
                        question={question}
                        onClose={closeModal}
                      />
                    ),
                    className: 'w-[92vw] max-w-lg rounded-2xl overflow-hidden',
                    onClose: closeModal,
                  });
                }}
                className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer'
              >
                <AlertCircle className='size-3.5' />
                <span>Report / Feedback</span>
              </button>
              {question.is_saved && onDeleteQuestion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onDeleteQuestion(question.id);
                  }}
                  className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer'
                >
                  <Trash2 className='size-3.5' />
                  <span>Remove Saved</span>
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
