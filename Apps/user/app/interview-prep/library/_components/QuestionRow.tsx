/** @format */

import React from 'react';
import { Star } from 'lucide-react';
import type { InterviewQuestion, InterviewCategory } from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';
import { AutoTooltip } from '@/components/UI/tooltip/auto-tooltip';

interface QuestionRowProps {
  question: InterviewQuestion;
  originalQuestion: InterviewQuestion | undefined;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelectChange: (id: string, checked: boolean) => void;
  editingCell: {
    id: string;
    field: 'title' | 'category' | 'answer';
  } | null;
  setEditingCell: (
    cell: {
      id: string;
      field: 'title' | 'category' | 'answer';
    } | null,
  ) => void;
  onInlineUpdate: (id: string, updates: Partial<InterviewQuestion>) => void;
  categories: InterviewCategory[];
  onOpenEdit: (q: InterviewQuestion) => void;
  gridColsClass: string;
  isDrawerSelected: boolean;
}

export function QuestionRow({
  question,
  originalQuestion,
  isSelectionMode,
  isSelected,
  onSelectChange,
  editingCell,
  setEditingCell,
  onInlineUpdate,
  categories,
  onOpenEdit,
  gridColsClass,
  isDrawerSelected,
}: QuestionRowProps) {
  const isRowModified =
    originalQuestion &&
    (question.title !== originalQuestion.title ||
      question.category_id !== originalQuestion.category_id ||
      question.frequency !== originalQuestion.frequency ||
      question.importance_score !== originalQuestion.importance_score ||
      question.answer_objective !== originalQuestion.answer_objective);

  const isEditingTitle =
    editingCell?.id === question.id && editingCell?.field === 'title';
  const isEditingCategory =
    editingCell?.id === question.id && editingCell?.field === 'category';
  const isEditingAnswer =
    editingCell?.id === question.id && editingCell?.field === 'answer';

  return (
    <div
      onClick={() => onOpenEdit(question)}
      className={cn(
        'grid items-center px-4 py-3 transition-colors group rounded-xl relative cursor-pointer',
        gridColsClass,
        isDrawerSelected ? 'bg-primary/10 hover:bg-primary/15'
        : isRowModified ?
          'bg-primary/5 dark:bg-primary/10 hover:bg-primary/30 dark:hover:bg-background-secondary/20'
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
        {isEditingTitle ?
          <input
            type='text'
            value={question.title}
            autoFocus
            onChange={(e) => {
              onInlineUpdate(question.id, { title: e.target.value });
            }}
            onBlur={(e) => {
              setEditingCell(null);
              if (e.target.value.trim() && e.target.value !== question.title) {
                onInlineUpdate(question.id, {
                  title: e.target.value.trim(),
                });
              }
            }}
            className='w-full bg-background-primary dark:bg-zinc-955 px-4 py-2 rounded-lg text-sm text-ink-primary font-medium focus:outline-none'
          />
        : <div
            onClick={() => setEditingCell({ id: question.id, field: 'title' })}
            className='cursor-pointer w-full hover:bg-background-secondary/50 px-2 py-1 rounded transition-colors min-h-[28px] flex items-center overflow-hidden'
          >
            <AutoTooltip className='text-sm text-ink-primary font-medium w-full text-left'>
              {question.title}
            </AutoTooltip>
          </div>
        }
        {question.tags && question.tags.length > 0 && (
          <div className='flex flex-wrap gap-1 mt-0.5 px-2'>
            {question.tags.map((t) => (
              <span
                key={t.id}
                className='text-[10px] bg-muted text-ink-secondary px-1.5 py-0.5 rounded-full  '
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
        {isEditingCategory ?
          <select
            value={question.category_id || ''}
            autoFocus
            onChange={(e) => {
              const val = e.target.value || null;
              onInlineUpdate(question.id, { category_id: val });
              setEditingCell(null);
            }}
            onBlur={() => setEditingCell(null)}
            className='w-full bg-background-primary dark:bg-zinc-955 px-2 py-1 rounded  text-sm text-ink-secondary focus:outline-none cursor-pointer'
          >
            <option value='' className='bg-panel text-ink-primary'>
              Unclassified
            </option>
            {categories.map((cat) => (
              <option
                key={cat.id}
                value={cat.id}
                className='bg-panel text-ink-primary'
              >
                {cleanName(cat.name)}
              </option>
            ))}
          </select>
        : <div
            onClick={() =>
              setEditingCell({ id: question.id, field: 'category' })
            }
            className='cursor-pointer w-full hover:bg-background-secondary/50 px-2 py-1 rounded transition-colors min-h-[28px] flex items-center overflow-hidden'
          >
            <AutoTooltip className='text-sm text-ink-secondary w-full text-left'>
              {categories.find((c) => c.id === question.category_id) ?
                cleanName(
                  categories.find((c) => c.id === question.category_id)!.name,
                )
              : 'Unclassified'}
            </AutoTooltip>
          </div>
        }
      </div>

      {/* Frequency Column */}
      <div className='pr-4' onClick={(e) => e.stopPropagation()}>
        <select
          value={question.frequency || 'Medium'}
          onChange={(e) => {
            const val = e.target.value;
            onInlineUpdate(question.id, { frequency: val });
          }}
          className={cn(
            'px-2 py-1 rounded-full text-xs font-semibold cursor-pointer bg-transparent',
            (question.frequency === 'Low' || question.frequency === 'Easy') &&
              'text-green-600 dark:text-green-400',
            (question.frequency === 'Medium' || !question.frequency) &&
              'text-amber-600 dark:text-amber-400',
            (question.frequency === 'High' || question.frequency === 'Hard') &&
              'text-rose-600 dark:text-rose-400',
          )}
        >
          <option value='Low' className='bg-panel text-ink-primary'>
            Low
          </option>
          <option value='Medium' className='bg-panel text-ink-primary'>
            Medium
          </option>
          <option value='High' className='bg-panel text-ink-primary'>
            High
          </option>
        </select>
      </div>

      {/* Importance Column */}
      <div
        className='pr-4 flex gap-0.5 items-center'
        onClick={(e) => e.stopPropagation()}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const score = question.importance_score || 3;
          return (
            <button
              key={i}
              type='button'
              onClick={() => {
                const newScore = i + 1;
                onInlineUpdate(question.id, {
                  importance_score: newScore,
                });
              }}
              className='focus:outline-none'
            >
              <Star
                className={cn(
                  'w-3.5 h-3.5 transition-colors',
                  i < score ?
                    'fill-amber-500 text-amber-500'
                  : 'text-zinc-300 dark:text-zinc-700 hover:text-amber-400',
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Your Answer Column */}
      <div
        className='pr-4 overflow-hidden w-full'
        onClick={(e) => e.stopPropagation()}
      >
        {isEditingAnswer ?
          <textarea
            value={question.answer_objective || ''}
            autoFocus
            onChange={(e) => {
              onInlineUpdate(question.id, { answer_objective: e.target.value });
            }}
            onBlur={(e) => {
              setEditingCell(null);
              if (
                originalQuestion &&
                e.target.value !== (originalQuestion.answer_objective || '')
              ) {
                onInlineUpdate(question.id, {
                  answer_objective: e.target.value,
                });
              }
            }}
            placeholder='Write your answer...'
            rows={3}
            className='w-full bg-background-primary dark:bg-zinc-955 px-2 py-1 rounded  text-xs text-ink-secondary focus:outline-none resize-none leading-relaxed'
          />
        : <div
            onClick={() => setEditingCell({ id: question.id, field: 'answer' })}
            className='cursor-pointer w-full hover:bg-background-secondary/50 px-2 py-1 rounded transition-colors min-h-[28px] flex items-center overflow-hidden'
          >
            <AutoTooltip className='text-xs text-ink-secondary leading-relaxed w-full text-left'>
              {question.answer_objective || (
                <span className='text-zinc-400 italic'>
                  Write your answer...
                </span>
              )}
            </AutoTooltip>
          </div>
        }
      </div>
    </div>
  );
}
