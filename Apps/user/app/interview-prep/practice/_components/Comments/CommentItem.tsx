/** @format */

import { useState } from 'react';
import { Flag, Heart, MoreHorizontal, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/lib/use-relative-time';
import type { QuestionComment } from '@/lib/types';
import { flattenReplies, kindDot, kindTag, ReportReason } from './utils';
import { Avatar } from './Avatar';
import { ReplyItem } from './ReplyItem';

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
}) {
  const relativeTime = useRelativeTime(comment.created_at);
  const [visibleRepliesCount, setVisibleRepliesCount] = useState(3);
  const [isLoadingMoreReplies, setIsLoadingMoreReplies] = useState(false);
  const replies = flattenReplies(comment.replies);
  const isHighlighted = highlightedCommentId === comment.id;
  const sortedReplies = [...replies].sort((a, b) => {
    const aNew = sessionPostedIds.has(a.id) ? 1 : 0;
    const bNew = sessionPostedIds.has(b.id) ? 1 : 0;
    if (aNew !== bNew) return bNew - aNew;

    const aBase = a.like_count - (a.is_liked ? 1 : 0);
    const bBase = b.like_count - (b.is_liked ? 1 : 0);
    if (aBase !== bBase) return bBase - aBase;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const displayedReplies = sortedReplies.slice(0, visibleRepliesCount);
  const hasMoreReplies = visibleRepliesCount < sortedReplies.length;

  const handleLoadMoreReplies = () => {
    setIsLoadingMoreReplies(true);
    setTimeout(() => {
      setVisibleRepliesCount((prev) => prev + 10);
      setIsLoadingMoreReplies(false);
    }, 500);
  };

  return (
    <article
      id={`comment-${comment.id}`}
      className={cn(
        'space-y-4 px-2 py-2 transition-colors duration-1000 rounded-2xl',
        isHighlighted && 'from-primary/20 bg-linear-to-b to-transparent',
      )}
    >
      <div className='group flex gap-2.5 transition-colors'>
        <Avatar name={comment.author_name} url={comment.author_avatar_url} />
        <div className='min-w-0 flex-1'>
          <div className='flex items-baseline gap-1.5'>
            <span className='text-[10px] font-bold text-ink-secondary/60'>
              {comment.author_name}
            </span>
            {comment.author_badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 border-1 py-0.5 text-[6px] font-extrabold uppercase tracking-wide',
                  comment.author_badge === 'Admin' ?
                    ' border-rose-500 text-rose-600'
                  : comment.author_badge === 'Author' ?
                    ' border-primary text-primary'
                  : ' border-amber-500 text-amber-600',
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
            {comment.is_author && Date.now() - new Date(comment.created_at).getTime() < 120000 && (
              <button
                onClick={() => onEdit(comment)}
                className='cursor-pointer text-[11px] font-bold text-ink-secondary/50 hover:text-primary'
              >
                Edit
              </button>
            )}
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
            <div className='relative ml-auto'>
              {comment.is_author ?
                <button
                  onClick={onDelete}
                  aria-label='Delete comment'
                  className='rounded-full p-1 text-ink-secondary/70 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </button>
              : <button
                  onClick={onToggleReportMenu}
                  aria-label='Report comment'
                  className={cn(
                    'rounded-full p-1 text-ink-secondary/70 opacity-0 transition-opacity hover:bg-background-secondary hover:text-ink-primary group-hover:opacity-100',
                    reportMenuOpen && 'opacity-100',
                  )}
                >
                  <MoreHorizontal className='h-4 w-4' />
                </button>
              }
              {reportMenuOpen && (
                <div className='absolute right-0 top-7 z-10 w-32 rounded-xl border border-border bg-panel p-1 shadow-lg'>
                  <p className='px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-ink-secondary/70'>
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {sortedReplies.length > 0 && (
        <div className=' pl-[38px] space-y-3'>
          <AnimatePresence initial={false}>
            {displayedReplies.map((replyItem) => (
              <motion.div
                key={replyItem.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <ReplyItem
                  replyItem={replyItem}
                  highlightedCommentId={highlightedCommentId}
                  onLike={() => onLikeReply(replyItem)}
                  likePopped={likePoppedReplyId === replyItem.id}
                  onReport={(reason) => onReportReply(replyItem, reason)}
                  onDelete={() => onDeleteReply(replyItem)}
                  onReply={() => onReplyTo(replyItem)}
                  onEdit={() => onEditReply(replyItem)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
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
