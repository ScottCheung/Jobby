'use client';

import React from 'react';
import {
  BadgeCheck,
  LibraryBig,
  Loader2,
  Users,
  Coins,
  Lock,
  Unlock,
  Clock,
  Archive,
  EyeOff,
  Check,
  AlertCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { InterviewCollection } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { cn } from '@/lib/utils';

type Props = {
  collection: InterviewCollection;
  onAdd: (collection: InterviewCollection) => void;
  onRemove: (collection: InterviewCollection) => void;
  isLoading: boolean;
  currentUserId?: string | null;
  onEdit?: (collection: InterviewCollection) => void;
  onDelete?: (collection: InterviewCollection) => void;
  onRestore?: (collection: InterviewCollection) => void;
};

export function CollectionCard({
  collection,
  onAdd,
  onRemove,
  isLoading,
  currentUserId,
  onEdit,
  onDelete,
  onRestore,
}: Props) {
  const updatedAt =
    collection.last_updated_at ?
      new Date(collection.last_updated_at).toLocaleDateString()
    : 'Recently';
  const isFree = collection.price_coins <= 0;
  const isPartial = collection.library_status === 'partial';
  const needsRestore =
    collection.library_status === 'partial' ||
    (collection.library_status === 'not_added' && collection.is_in_library);
  const restoreLabel = collection.missing_question_count === 1 ?
      'Restore 1 Question'
    : `Restore ${collection.missing_question_count} Questions`;

  const categoryBadge = collection.collection_type === 'official' ? (
    <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary'>
      <BadgeCheck className="h-3 w-3" />
      Official
    </span>
  ) : (
    <span className='inline-flex items-center gap-1 rounded-full bg-background-secondary border border-border/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-secondary'>
      <Users className="h-3 w-3" />
      Community
    </span>
  );

  const statusBadge = (() => {
    if (collection.status === 'draft') {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-background-secondary border border-border/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted'>
          <EyeOff className="h-3 w-3" />
          Private
        </span>
      );
    }
    if (collection.status === 'archived') {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400'>
          <Archive className="h-3 w-3" />
          Archived
        </span>
      );
    }
    if (isPartial) {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400'>
          <AlertCircle className="h-3 w-3" />
          Partially Added
        </span>
      );
    }
    if (collection.library_status === 'complete') {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400'>
          <Check className="h-3 w-3" />
          In Library
        </span>
      );
    }
    if (collection.is_purchased) {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400'>
          <Sparkles className="h-3 w-3" />
          Purchased
        </span>
      );
    }
    if (isFree) {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400'>
          <Unlock className="h-3 w-3" />
          Free
        </span>
      );
    }
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-background-secondary border border-border/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-secondary'>
        <Lock className="h-3 w-3" />
        Locked
      </span>
    );
  })();

  return (
    <div className="group/card relative flex h-full flex-col gap-4 rounded-2xl border border-border/40 bg-panel/60 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 dark:bg-panel/40">
      
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Cover Image or Fallback Illustration */}
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center relative overflow-hidden">
            {collection.cover_url ? (
              <img
                src={`${collection.cover_url}?t=${collection.last_updated_at ? new Date(collection.last_updated_at).getTime() : ''}`}
                alt={collection.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary/70 transition-transform duration-300 group-hover/card:scale-105">
                <BookOpen className="h-7 w-7 text-primary/60 dark:text-primary/40" />
              </div>
            )}
          </div>

          {/* Title and Badges Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {categoryBadge}
              {statusBadge}
            </div>

            <h3 className="title-card mt-1.5 truncate text-ink-primary font-bold transition-colors duration-200 group-hover/card:text-primary" title={collection.title}>
              {collection.title}
            </h3>

            <div className="flex items-center gap-2 mt-1 text-xs text-ink-secondary/70 flex-wrap font-medium">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 text-ink-secondary/50" />
                <span>{collection.creator_name || 'Official'}</span>
              </span>
              <span className="text-ink-secondary/30">•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-ink-secondary/50" />
                <span>Updated {updatedAt}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Prominent Price Element */}
        <div className="shrink-0 flex flex-col items-center justify-center text-center self-center py-2 px-3.5 rounded-xl bg-background-secondary/30 border border-border/20 min-w-[80px]">
          <span className="text-[10px] font-bold text-ink-secondary/60 uppercase tracking-wider leading-none mb-1">Price</span>
          {collection.price_coins > 0 ? (
            <div className="flex items-center gap-1 text-amber-500 font-extrabold text-sm leading-none">
              <Coins className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>{collection.price_coins}</span>
            </div>
          ) : (
            <span className="text-emerald-500 font-extrabold text-xs leading-none">
              {collection.free_label || 'FREE'}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="body-sm text-ink-secondary line-clamp-2 leading-relaxed min-h-[2.5rem] mt-0.5" title={collection.description || 'No description yet.'}>
        {collection.description || 'No description yet.'}
      </p>

      {/* High-density 2-Column Statistics Panel */}
      <div className="grid grid-cols-2 gap-3 px-3 py-2.5 rounded-xl bg-background-secondary/30 border border-border/20 text-ink-secondary text-xs">
        <div className="flex items-center gap-2.5 py-0.5 justify-center">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider leading-none">Questions</div>
            <div className="text-sm font-extrabold text-ink-primary mt-0.5 leading-none">{collection.question_count}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 py-0.5 justify-center border-l border-border/20">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <LibraryBig className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider leading-none">Library Adds</div>
            <div className="text-sm font-extrabold text-ink-primary mt-0.5 leading-none">{collection.library_adds}</div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {collection.sample_questions?.length ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/30 bg-background-secondary/20 p-3">
          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <Sparkles className="h-3 w-3 text-primary" />
            Sample Questions
          </div>
          <div className="space-y-1.5">
            {collection.sample_questions.slice(0, 3).map((title, idx) => (
              <div key={title} className="flex items-start gap-2 text-xs">
                <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                  {idx + 1}
                </span>
                <span className="truncate text-ink-primary font-medium leading-relaxed" title={title}>{title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Partial Warning Banner */}
      {isPartial && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-normal">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink-primary leading-tight">Part of this collection is missing</div>
            <p className="mt-0.5 text-ink-secondary text-[11px] leading-tight">
              {collection.user_active_question_count} of {collection.question_count} questions are in your Library.
            </p>
          </div>
          <span className="shrink-0 font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
            {collection.missing_question_count} missing
          </span>
        </div>
      )}

      {/* Archived Notice Banner */}
      {collection.status === 'archived' && collection.creator_user_id !== currentUserId && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-normal">
          <Archive className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink-primary leading-tight">Archived Collection</div>
            <p className="mt-0.5 text-ink-secondary text-[11px] leading-tight">
              The author no longer maintains this collection. You can continue using it, but new updates are unlikely.
            </p>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between gap-3">
        {/* Author Actions */}
        {currentUserId && collection.creator_user_id === currentUserId && (
          <div className="flex items-center gap-2">
            {collection.status === 'archived' ? (
              <>
                {onRestore && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => onRestore(collection)}
                    disabled={isLoading}
                    className="rounded-full border-emerald-500 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:hover:bg-emerald-950/20"
                  >
                    Restore
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => onDelete(collection)}
                    disabled={isLoading}
                    className="rounded-full text-rose-500 hover:bg-rose-500/10 border border-transparent"
                  >
                    Delete
                  </Button>
                )}
              </>
            ) : (
              <>
                {onEdit && (
                  <Button
                    layoutId='collection-form-modal'
                    variant="secondary"
                    size="md"
                    onClick={() => onEdit(collection)}
                    disabled={isLoading}
                    className="rounded-full"
                  >
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => onDelete(collection)}
                    disabled={isLoading}
                    className="rounded-full text-rose-500 hover:bg-rose-500/10 border border-transparent"
                  >
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* User Subscriber Actions */}
        <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
          <div className="flex items-center gap-2 justify-end w-full">
            {collection.is_in_library ? (
              <>
                {needsRestore && collection.question_count > 0 && (
                  <Button
                    size="md"
                    onClick={() => onAdd(collection)}
                    disabled={isLoading}
                    className="rounded-full shadow-sm"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : restoreLabel}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onRemove(collection)}
                  disabled={isLoading}
                  className="rounded-full border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 hover:border-transparent transition-all"
                >
                  Remove
                </Button>
              </>
            ) : (
              <Button
                size="md"
                onClick={() => onAdd(collection)}
                disabled={isLoading}
                className="rounded-full w-full max-w-[200px] shadow-sm bg-primary-gradient hover:bg-primary text-primary-foreground font-semibold transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : collection.is_purchased || isFree ? (
                  'Add to Library'
                ) : (
                  `Unlock (${collection.price_coins})`
                )}
              </Button>
            )}
          </div>
          {!collection.is_in_library && !collection.is_purchased && !isFree && collection.status !== 'archived' && (
            <span className="text-[10px] text-ink-muted leading-none mt-1 mr-1">
              First add deducts coins
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
