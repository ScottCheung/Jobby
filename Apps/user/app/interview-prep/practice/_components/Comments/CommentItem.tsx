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
import { flattenReplies, kindDot, kindTag, ReportReason } from './utils';
import { Avatar } from '@/components/UI/Avatar/Avatar';
import { ReplyItem } from './ReplyItem';
import { useConsole } from '@/components/ConsoleContext';

export function CommentItem({
  comment,
  sessionPostedIds,
  highlightedCommentId,
  onReplyTo,
  onLike,
  likePopped,
  reportMenuOpen,
  onToggleReportMenu,
  onReport,
  onDelete,
  onEdit,
  onLikeReply,
  likePoppedReplyId,
  onReportReply,
  onDeleteReply,
  onEditReply,
  idPrefix = 'comment-',
}: {
  comment: QuestionComment;
  sessionPostedIds: Set<string>;
  highlightedCommentId: string | null;
  onReplyTo: (target: QuestionComment) => void;
  onLike: () => void;
  likePopped: boolean;
  reportMenuOpen: boolean;
  onToggleReportMenu: () => void;
  onReport: (reason: ReportReason) => void;
  onDelete: () => void;
  onEdit: (comment: QuestionComment) => void;
  onLikeReply: (reply: QuestionComment) => void;
  likePoppedReplyId: string | null;
  onReportReply: (reply: QuestionComment, reason: ReportReason) => void;
  onDeleteReply: (reply: QuestionComment) => void;
  onEditReply: (reply: QuestionComment) => void;
  /** Allows answer threads to share this renderer without colliding with question-comment anchors. */
  idPrefix?: string;
}) {
  const { profile, updateProfileExtra } = useConsole();
  const savedCommentIds = Array.isArray(profile.extra_data?.['saved-comment-ids']) ?
    (profile.extra_data['saved-comment-ids'] as string[])
  : [];
  const relativeTime = useRelativeTime(comment.created_at);
  const [visibleRepliesCount, setVisibleRepliesCount] = useState(3);
  const [isLoadingMoreReplies, setIsLoadingMoreReplies] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const replies = flattenReplies(comment.replies);
  const isHighlighted = highlightedCommentId === comment.id;
  const sortedReplies = replies;
  const displayedReplies = sortedReplies.slice(0, visibleRepliesCount);
  const hasMoreReplies = visibleRepliesCount < sortedReplies.length;

  useEffect(() => {
    if (
      highlightedCommentId &&
      replies.some((reply) => reply.id === highlightedCommentId)
    ) {
      setVisibleRepliesCount(replies.length);
    }
  }, [comment.replies, highlightedCommentId, replies.length]);

  useEffect(() => {
    setIsSaved(savedCommentIds.includes(comment.id));
  }, [comment.id, savedCommentIds]);

  useEffect(() => {
    if (!reportMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggleReportMenu();
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [onToggleReportMenu, reportMenuOpen]);

  const copyComment = async () => {
    await navigator.clipboard?.writeText(comment.body);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1200);
  };

  const toggleSaved = () => {
    setIsSaved((current) => {
      const next = !current;
      const saved = new Set<string>(savedCommentIds);
      if (next) saved.add(comment.id);
      else saved.delete(comment.id);
      void updateProfileExtra({ 'saved-comment-ids': [...saved] });
      return next;
    });
  };

  const handleLoadMoreReplies = () => {
    setIsLoadingMoreReplies(true);
    setTimeout(() => {
      setVisibleRepliesCount((prev) => prev + 10);
      setIsLoadingMoreReplies(false);
    }, 500);
  };

  return (
    <article
      id={`${idPrefix}${comment.id}`}
      className={cn('space-y-4  transition-colors duration-1000 ')}
    >
      <div
        className={cn(
          'group flex p-2 rounded-tl-2xl! rounded-xl',
          isHighlighted && 'bg-primary/15',
        )}
      >
        <div className={cn('flex justify-between gap-2.5 w-full')}>
          <Avatar
            name={comment.author_name}
            src={
              comment.author_avatar_url ? comment.author_avatar_url : undefined
            }
          />
          <div className='min-w-0 flex-1'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-[10px] font-bold text-ink-secondary/60'>
                {comment.author_name}
              </span>
              {comment.author_badge && (
                <span
                  className={cn(
                    'rounded-full px-1.5 border-1 py-0.5 text-[6px] font-extrabold uppercase tracking-wide',
                    comment.author_badge === 'Author' ?
                      ' border-rose-500 text-rose-600'
                    : comment.author_badge === 'Admin' ?
                      ' border-info text-info'
                    : ' border-primary text-primary',
                  )}
                >
                  {comment.author_badge}
                </span>
              )}
              {comment.kind !== 'discussion' && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide',
                    kindTag[comment.kind],
                  )}
                >
                  {comment.kind}
                </span>
              )}
            </div>
            <button
              onClick={() => onReplyTo(comment)}
              className='mt-1 block w-full cursor-pointer text-left text-sm text-ink-primary'
            >
              {comment.body}
            </button>
            <div className='mt-1.5 flex items-center gap-3'>
              <span className='text-[10px] text-ink-secondary/70'>
                {relativeTime}
              </span>
              <button
                onClick={() => onReplyTo(comment)}
                className='cursor-pointer text-[11px] font-bold text-ink-secondary/50 hover:text-primary'
              >
                Reply
              </button>
              {comment.is_author &&
                Date.now() - new Date(comment.created_at).getTime() <
                  120000 && (
                  <button
                    onClick={() => onEdit(comment)}
                    className='cursor-pointer text-[11px] font-bold text-ink-secondary/50 hover:text-primary'
                  >
                    Edit
                  </button>
                )}
            </div>
          </div>
        </div>
        <div className='col justify-between'>
          <div ref={menuRef} className='relative ml-auto'>
            <button
              onClick={onToggleReportMenu}
              aria-label='Comment actions'
              className={cn(
                'rounded-full p-1 text-ink-secondary/70 opacity-0 cursor-pointer transition-opacity hover:bg-primary-foreground hover:text-ink-primary group-hover:opacity-100',
                reportMenuOpen && 'opacity-100',
              )}
            >
              <MoreHorizontal className='h-4 w-4' />
            </button>
            {reportMenuOpen && (
              <div className='absolute right-0 top-7 z-50 w-40 rounded-xl border border-border bg-background-primary backdrop-blur-sm p-1 shadow-lg'>
                <button
                  onClick={() => void copyComment()}
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
                {comment.is_author ?
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
                        disabled={comment.is_reported}
                        className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary/70 hover:bg-background-secondary disabled:opacity-50'
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
              'flex cursor-pointer items-center gap-1 text-[11px] font-bold transition-colors',
              comment.is_liked ? 'text-rose-500' : (
                'text-ink-secondary/70 hover:text-rose-500'
              ),
            )}
          >
            <Heart
              className={cn(
                'h-3.5 w-3.5',
                likePopped && 'animate-heart-pop',
                comment.is_liked && 'fill-current',
              )}
            />
            {comment.like_count || ''}
          </button>
        </div>
      </div>
      {sortedReplies.length > 0 && (
        <div className=' pl-[38px] space-y-3'>
          {displayedReplies.map((replyItem) => (
            <div key={replyItem.id}>
              <ReplyItem
                replyItem={replyItem}
                idPrefix={idPrefix}
                highlightedCommentId={highlightedCommentId}
                onLike={() => onLikeReply(replyItem)}
                likePopped={likePoppedReplyId === replyItem.id}
                onReport={(reason) => onReportReply(replyItem, reason)}
                onDelete={() => onDeleteReply(replyItem)}
                onReply={() => onReplyTo(replyItem)}
                onEdit={() => onEditReply(replyItem)}
              />
            </div>
          ))}
          {hasMoreReplies && (
            <button
              onClick={handleLoadMoreReplies}
              disabled={isLoadingMoreReplies}
              className='text-xs font-semibold text-ink-secondary/70 hover:text-primary transition-colors flex items-center gap-1 mt-1 disabled:opacity-80'
            >
              <div className='w-4 h-[1px] bg-border'></div>
              {isLoadingMoreReplies ?
                <>
                  <div className='h-3 w-3 animate-spin rounded-full border-[1.5px] border-ink-secondary/70 border-t-transparent group-hover:border-primary group-hover:border-t-transparent'></div>
                  Loading...
                </>
              : `View more replies (${sortedReplies.length - visibleRepliesCount})`
              }
            </button>
          )}
        </div>
      )}
    </article>
  );
}
