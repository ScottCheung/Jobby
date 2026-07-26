/** @format */

import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Flag,
  Heart,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/lib/use-relative-time';
import type { QuestionComment } from '@/lib/types';
import { Avatar } from '@/components/UI/Avatar/Avatar';
import { ReportReason } from './utils';
import { useConsole } from '@/components/ConsoleContext';

export function ReplyItem({
  replyItem,
  onLike,
  likePopped,
  onReport,
  onDelete,
  onReply,
  onEdit,
  highlightedCommentId,
  idPrefix = 'comment-',
}: {
  replyItem: QuestionComment;
  onLike: () => void;
  likePopped: boolean;
  onReport: (reason: ReportReason) => void;
  onDelete: () => void;
  onReply: () => void;
  onEdit: () => void;
  highlightedCommentId?: string | null;
  idPrefix?: string;
}) {
  const { profile, updateProfileExtra } = useConsole();
  const savedCommentIds =
    Array.isArray(profile.extra_data?.['saved-comment-ids']) ?
      (profile.extra_data['saved-comment-ids'] as string[])
    : [];
  const relativeTime = useRelativeTime(replyItem.created_at);
  const isHighlighted = highlightedCommentId === replyItem.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsSaved(savedCommentIds.includes(replyItem.id));
  }, [replyItem.id, savedCommentIds]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const copyReply = async () => {
    await navigator.clipboard?.writeText(replyItem.body);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1200);
  };
  const toggleSaved = () => {
    setIsSaved((current) => {
      const next = !current;
      const saved = new Set<string>(savedCommentIds);
      if (next) saved.add(replyItem.id);
      else saved.delete(replyItem.id);
      void updateProfileExtra({ 'saved-comment-ids': [...saved] });
      return next;
    });
  };
  return (
    <div
      id={`${idPrefix}${replyItem.id}`}
      className={cn(
        'group reply flex gap-2 p-1.5 rounded-t-xl! rounded-lg justify-between ',
        isHighlighted && 'bg-linear-to-b bg-primary/15 to-transparent',
        'hover:bg-primary/5',
      )}
    >
      <div className='flex gap-2  w-full items-start h-full'>
        <Avatar
          name={replyItem.author_name}
          src={
            replyItem.author_avatar_url ?
              replyItem.author_avatar_url
            : undefined
          }
          size='sm'
        />

        <div className='min-w-0 flex-1'>
          <div className='row items-baseline '>
            <span className='text-[10px] font-bold text-ink-secondary/50'>
              {replyItem.author_name}
            </span>
            {replyItem.author_badge && (
              <span className='rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-primary'>
                {replyItem.author_badge}
              </span>
            )}
          </div>
          <button
            onClick={onReply}
            className='mt-0.5 block w-full cursor-pointer whitespace-pre-wrap text-left text-sm text-ink-primary'
          >
            {(() => {
              let replyTarget = null;
              let displayBody = replyItem.body;
              const colonMatch = replyItem.body.match(
                /^Reply\s+([^:]+):\s*([\s\S]*)$/,
              );
              if (colonMatch) {
                replyTarget = colonMatch[1];
                displayBody = colonMatch[2];
              } else {
                const spaceMatch = replyItem.body.match(
                  /^@([^\s:]+)\s+([\s\S]*)$/,
                );
                if (spaceMatch) {
                  replyTarget = spaceMatch[1];
                  displayBody = spaceMatch[2];
                }
              }

              if (replyTarget) {
                return (
                  <span>
                    <span className='mr-1  text-[10px] font-semibold text-ink-primary'>
                      Reply
                      <span className='ml-1 text-ink-secondary/50'>
                        {replyTarget}:
                      </span>
                    </span>
                    {displayBody}
                  </span>
                );
              }
              return replyItem.body;
            })()}
          </button>
          <div className='header'>
            <div className='row'>
              <span className='text-[10px] text-ink-secondary/50'>
                {relativeTime}
              </span>

              <button
                onClick={onReply}
                className='cursor-pointer text-[10px] font-semibold text-ink-secondary/70 opacity-0 transition-opacity group-hover/reply:opacity-100 hover:text-primary'
              >
                Reply
              </button>

              {replyItem.is_author &&
                Date.now() - new Date(replyItem.created_at).getTime() <
                  120000 && (
                  <button
                    onClick={onEdit}
                    className='cursor-pointer text-[10px] font-semibold text-ink-secondary/70 opacity-0 transition-opacity group-hover/reply:opacity-100 hover:text-primary'
                  >
                    Edit
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
      <div className='col justify-between items-end gap-1'>
        <div ref={menuRef} className='relative'>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label='Reply actions'
            className={cn(
              'rounded-full p-1 text-ink-secondary/70 opacity-0 cursor-pointer transition-opacity hover:bg-primary-foreground group-hover:opacity-100',
              menuOpen && 'opacity-100',
            )}
          >
            <MoreHorizontal className='h-4 w-4' />
          </button>
          {menuOpen && (
            <div className='absolute right-0 top-7 z-10 w-40 rounded-xl border border-border bg-background-primary p-1 shadow-lg'>
              <button
                onClick={() => void copyReply()}
                className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary hover:bg-background-secondary'
              >
                {isCopied ?
                  <Check className='h-3 w-3 text-emerald-500' />
                : <Copy className='h-3 w-3' />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={toggleSaved}
                className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary hover:bg-background-secondary'
              >
                <Bookmark
                  className={cn(
                    'h-3 w-3',
                    isSaved && 'fill-current text-primary',
                  )}
                />
                {isSaved ? 'Saved' : 'Save comment'}
              </button>
              {replyItem.is_author ?
                <button
                  onClick={onDelete}
                  className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-500/10'
                >
                  <Trash2 className='h-3 w-3' />
                  Delete
                </button>
              : <>
                  <p className='mt-1 border-t border-border/60 px-2 pt-2 text-[9px] font-bold uppercase tracking-wide text-ink-secondary/70'>
                    Report as
                  </p>
                  {(
                    [
                      ['spam', 'Spam'],
                      ['off_topic', 'Off topic'],
                      ['unsafe', 'Unsafe'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => onReport(value)}
                      disabled={replyItem.is_reported}
                      className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary hover:bg-background-secondary disabled:opacity-50'
                    >
                      <Flag className='h-3 w-3' />
                      {label}
                    </button>
                  ))}
                </>
              }
            </div>
          )}
        </div>
        <button
          onClick={onLike}
          className={cn(
            'flex items-center gap-1 cursor-pointer text-[12px] font-bold transition-colors',
            replyItem.is_liked ? 'text-rose-500' : (
              'text-ink-secondary/70 hover:text-rose-500'
            ),
          )}
        >
          <Heart
            className={cn(
              'h-4 w-4',
              likePopped && 'animate-heart-pop',
              replyItem.is_liked && 'fill-current',
            )}
          />
          {replyItem.like_count || ''}
        </button>
      </div>
    </div>
  );
}
