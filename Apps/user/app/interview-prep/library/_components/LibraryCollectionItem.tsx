'use client';

import { Archive, Check, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { InterviewCollection } from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';

type Props = {
  collection: InterviewCollection;
  count: number;
  isSelected: boolean;
  isOwned: boolean;
  isBusy: boolean;
  avatar: React.ReactNode;
  onSelect: () => void;
  onAddOrRestore: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

export function LibraryCollectionItem({
  collection,
  count,
  isSelected,
  isOwned,
  isBusy,
  avatar,
  onSelect,
  onAddOrRestore,
  onRemove,
  onEdit,
  onArchive,
}: Props) {
  const isPartial = collection.library_status === 'partial';
  const needsRestore = isPartial ||
    (collection.library_status === 'not_added' && collection.is_in_library);
  const isEmpty = collection.library_status === 'empty';
  const isComplete = collection.library_status === 'complete';
  const restoreLabel = collection.missing_question_count === 1 ?
      'Restore 1'
    : `Restore ${collection.missing_question_count}`;

  return (
    <div className='group/item rounded-xl border border-transparent transition-colors hover:border-border/60 hover:bg-background-secondary/25 focus-within:border-border/60 focus-within:bg-background-secondary/25'>
      <button
        type='button'
        onClick={onSelect}
        className={cn(
          'label flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition-all',
          isSelected ?
            'bg-gradient-to-r from-primary/20 to-transparent text-primary font-semibold'
          : 'text-ink-secondary hover:text-ink-primary',
        )}
      >
        <span className='flex min-w-0 items-center gap-2'>
          {avatar}
          <span className='truncate text-[11px]'>{cleanName(collection.title)}</span>
        </span>
        <span className={cn(
          'body-sm shrink-0 rounded-full px-2 py-0.5',
          isSelected ? 'bg-primary text-primary-foreground' : 'bg-zinc-200 text-ink-secondary dark:bg-zinc-700/80',
        )}>
          {count}
        </span>
      </button>

      <div className='grid max-h-0 grid-rows-[0fr] overflow-hidden px-2 opacity-0 transition-all duration-200 group-hover/item:max-h-44 group-hover/item:grid-rows-[1fr] group-hover/item:pb-2 group-hover/item:opacity-100 group-focus-within/item:max-h-44 group-focus-within/item:grid-rows-[1fr] group-focus-within/item:pb-2 group-focus-within/item:opacity-100'>
        <div className='min-h-0 overflow-hidden'>
          <div className='border-t border-border/40 pt-2'>
            <div className='flex items-center justify-between gap-2 text-[10px]'>
              <span className='text-ink-secondary'>
                {isEmpty ? 'No questions yet' : `${collection.user_active_question_count}/${collection.question_count} in Library`}
              </span>
              <span className={cn(
                'font-semibold',
                isPartial ? 'text-amber-700 dark:text-amber-400' : isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-secondary',
              )}>
                {isPartial ? 'Partially added' : isComplete ? 'Complete' : collection.is_purchased ? 'Purchased' : 'Not added'}
              </span>
            </div>

            <div className='mt-2 flex flex-wrap gap-1.5'>
              {!isEmpty && (needsRestore || !collection.is_in_library) && (
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddOrRestore();
                  }}
                  disabled={isBusy}
                  className='inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
                >
                  {isBusy ? <Loader2 className='h-3 w-3 animate-spin' /> : needsRestore ? <RotateCcw className='h-3 w-3' /> : <Plus className='h-3 w-3' />}
                  {needsRestore ? restoreLabel : 'Add to Library'}
                </button>
              )}
              {collection.is_in_library && !isEmpty && (
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove();
                  }}
                  disabled={isBusy}
                  className='inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/40 dark:hover:bg-rose-950/20'
                >
                  <Trash2 className='h-3 w-3' />
                  Remove
                </button>
              )}
              {isOwned && (
                <>
                  <button
                    type='button'
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit();
                    }}
                    disabled={isBusy}
                    className='inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-ink-primary transition-colors hover:bg-background-secondary disabled:opacity-60'
                  >
                    <Pencil className='h-3 w-3' />
                    Edit
                  </button>
                  {collection.status === 'published' && (
                    <button
                      type='button'
                      onClick={(event) => {
                        event.stopPropagation();
                        onArchive();
                      }}
                      disabled={isBusy}
                      className='inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-ink-secondary transition-colors hover:bg-background-secondary hover:text-ink-primary disabled:opacity-60'
                    >
                      <Archive className='h-3 w-3' />
                      Stop maintaining
                    </button>
                  )}
                </>
              )}
              {isComplete && !isEmpty && (
                <span className='inline-flex items-center gap-1 px-1 py-1 text-[10px] text-emerald-600 dark:text-emerald-400'>
                  <Check className='h-3 w-3' /> Ready
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
