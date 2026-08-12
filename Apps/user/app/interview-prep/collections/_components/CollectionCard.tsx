/** @format */

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
  ScrollText,
  Archive,
  EyeOff,
  Check,
  AlertCircle,
  Sparkles,
  BookOpen,
  Plus,
  RotateCcw,
  Trash2,
  Pencil,
} from 'lucide-react';
import type { InterviewCollection } from '@/lib/types';
import { Button } from '@jobby/ui';
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
  const isFree = collection.price_coins <= 0;
  const isPartial = collection.library_status === 'partial';
  const needsRestore =
    collection.library_status === 'partial' ||
    (collection.library_status === 'not_added' && collection.is_in_library);
  const restoreLabel =
    collection.missing_question_count === 1 ?
      'Restore 1 Question'
    : `Restore ${collection.missing_question_count} Questions`;

  const isAuthor = Boolean(
    currentUserId && collection.creator_user_id === currentUserId,
  );

  return (
    <div className='group/card relative flex h-full flex-col justify-between rounded-2xl border border-border/40 bg-panel/60 p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 dark:bg-panel/40 overflow-hidden'>
      <div className='flex flex-col gap-3'>
        {/* Cover Banner (Matches interview-prep/ page aesthetic) */}
        <div className='relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-primary/15 via-primary/5 to-emerald-500/10'>
          {collection.cover_url ?
            <img
              src={`${collection.cover_url}?t=${collection.last_updated_at ? new Date(collection.last_updated_at).getTime() : ''}`}
              alt={collection.title}
              className='h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105'
            />
          : <div className='flex h-full w-full items-center justify-center text-primary/60 transition-transform duration-500 group-hover/card:scale-105'>
              <ScrollText className='h-10 w-10 text-primary/50' />
            </div>
          }

          {/* Badges Overlay on Cover Image */}
          <div className='absolute inset-x-2 top-2 flex items-center justify-between gap-1.5 z-10'>
            {/* Category / Status Badge */}
            {collection.collection_type === 'official' ?
              <span className='inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-md border border-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary shadow-xs'>
                <BadgeCheck className='h-3 w-3' />
                Official
              </span>
            : collection.status === 'draft' ?
              <span className='inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-md border border-border/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary shadow-xs'>
                <Lock className='h-3 w-3' />
                My Personal
              </span>
            : <span className='inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-md border border-border/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-secondary shadow-xs'>
                <Users className='h-3 w-3' />
                Community
              </span>
            }

            {/* Status / Price Badge */}
            {collection.status === 'draft' ?
              <span className='inline-flex items-center gap-1 rounded-full bg-zinc-950/70 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs'>
                <EyeOff className='h-3 w-3' />
                Private
              </span>
            : collection.status === 'archived' ?
              <span className='inline-flex items-center gap-1 rounded-full bg-rose-950/70 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-rose-200 shadow-xs'>
                <Archive className='h-3 w-3' />
                Archived
              </span>
            : collection.is_in_library ?
              <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-xs'>
                <Check className='h-3 w-3' />
                In Library
              </span>
            : isFree ?
              <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-xs'>
                <Unlock className='h-3 w-3' />
                FREE
              </span>
            : <span className='inline-flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-xs'>
                <Coins className='h-3 w-3' />
                {collection.price_coins} Coins
              </span>
            }
          </div>
        </div>

        {/* Title and Meta Information */}
        <div>
          <h3
            className='text-base font-bold text-ink-primary transition-colors duration-200 group-hover/card:text-primary line-clamp-1'
            title={collection.title}
          >
            {collection.title}
          </h3>

          <div className='mt-1 flex items-center gap-2 text-xs text-ink-secondary/70 flex-wrap font-medium'>
            <span>By {collection.creator_name || 'Official'}</span>
            <span className='text-ink-secondary/30'>•</span>
            <span className='flex items-center gap-1'>
              <ScrollText className='h-3 w-3 text-ink-secondary/50' />
              <span>{collection.question_count} Questions</span>
            </span>
            {collection.library_adds > 0 && (
              <>
                <span className='text-ink-secondary/30'>•</span>
                <span className='flex items-center gap-1'>
                  <LibraryBig className='h-3 w-3 text-ink-secondary/50' />
                  <span>{collection.library_adds} Adds</span>
                </span>
              </>
            )}
          </div>

          <p
            className='body-sm text-ink-secondary mt-2 line-clamp-2 leading-relaxed min-h-[2.5rem]'
            title={
              collection.description ||
              'Practice high quality standard interview questions.'
            }
          >
            {collection.description ||
              'Practice high quality standard interview questions.'}
          </p>
        </div>

        {/* Partial Warning Banner */}
        {isPartial && (
          <div className='flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs'>
            <AlertCircle className='h-3.5 w-3.5 text-amber-500 shrink-0' />
            <span className='text-ink-secondary truncate'>
              {collection.user_active_question_count}/
              {collection.question_count} in Library (
              {collection.missing_question_count} missing)
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className='mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2'>
        {/* Author Actions */}
        {isAuthor && (
          <div className='flex items-center gap-1.5'>
            {collection.status === 'archived' ?
              <>
                {onRestore && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onRestore(collection)}
                    disabled={isLoading}
                    className='rounded-lg text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10'
                  >
                    Restore
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={() => onDelete(collection)}
                    disabled={isLoading}
                    className='rounded-lg text-xs text-rose-500 hover:bg-rose-500/10'
                  >
                    Delete
                  </Button>
                )}
              </>
            : <>
                {onEdit && (
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={() => onEdit(collection)}
                    disabled={isLoading}
                    className='rounded-lg text-xs'
                  >
                    <Pencil className='h-3 w-3 mr-1' />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={() => onDelete(collection)}
                    disabled={isLoading}
                    className='rounded-lg text-xs text-rose-500 hover:bg-rose-500/10'
                  >
                    <Trash2 className='h-3 w-3' />
                  </Button>
                )}
              </>
            }
          </div>
        )}

        {/* Subscriber Action Buttons */}
        <div
          className={cn(
            'flex items-center gap-2',
            !isAuthor && 'w-full justify-end',
          )}
        >
          {collection.is_in_library ?
            <>
              {needsRestore && collection.question_count > 0 && (
                <Button
                  size='sm'
                  onClick={() => onAdd(collection)}
                  disabled={isLoading}
                  className='rounded-xl shadow-xs text-xs'
                >
                  {isLoading ?
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  : restoreLabel}
                </Button>
              )}
              <Button
                variant='secondary'
                size='sm'
                onClick={() => onRemove(collection)}
                disabled={isLoading}
                className='rounded-xl border border-rose-500/20 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-all'
              >
                {isLoading ?
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                : 'Unfollow'}
              </Button>
            </>
          : <Button
              size='sm'
              onClick={() => onAdd(collection)}
              disabled={isLoading}
              className={cn(
                'rounded-xl text-xs font-semibold shadow-xs transition-all',
                !isAuthor && 'w-full',
              )}
            >
              {isLoading ?
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              : collection.is_purchased || isFree ?
                <>
                  <Plus className='h-3.5 w-3.5 mr-1' />
                  Follow
                </>
              : <>
                  <Coins className='h-3.5 w-3.5 mr-1 text-amber-300' />
                  Unlock & Follow ({collection.price_coins})
                </>
              }
            </Button>
          }
        </div>
      </div>
    </div>
  );
}
