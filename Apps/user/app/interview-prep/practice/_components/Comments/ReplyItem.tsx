/** @format */

import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/lib/use-relative-time';
import type { QuestionComment } from '@/lib/types';
import { Avatar } from './Avatar';
import { ReportReason } from './utils';

export function ReplyItem({
  replyItem,
  onLike,
  likePopped,
  onReport,
  onDelete,
  onReply,
  onEdit,
  highlightedCommentId,
}: {
  replyItem: QuestionComment;
  onLike: () => void;
  likePopped: boolean;
  onReport: (reason: ReportReason) => void;
  onDelete: () => void;
  onReply: () => void;
  onEdit: () => void;
  highlightedCommentId?: string | null;
}) {
  const relativeTime = useRelativeTime(replyItem.created_at);
  const isHighlighted = highlightedCommentId === replyItem.id;
  return (
    <div
      id={`comment-${replyItem.id}`}
      className={cn(
        'group/reply flex gap-2.5 rounded-lg transition-colors duration-1000',
        isHighlighted && 'bg-primary/20 p-2 -mx-2',
      )}
    >
      <Avatar
        name={replyItem.author_name}
        url={replyItem.author_avatar_url}
        small
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
          className='mt-0.5 block w-full cursor-pointer whitespace-pre-wrap text-left text-xs text-ink-primary'
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
            
            {replyItem.is_author && Date.now() - new Date(replyItem.created_at).getTime() < 120000 && (
              <button
                onClick={onEdit}
                className='cursor-pointer text-[10px] font-semibold text-ink-secondary/70 opacity-0 transition-opacity group-hover/reply:opacity-100 hover:text-primary'
              >
                Edit
              </button>
            )}

            {replyItem.is_author ?
              <button
                onClick={onDelete}
                className='text-[10px] font-semibold text-ink-secondary/70 opacity-0 transition-opacity group-hover/reply:opacity-100 hover:text-rose-500'
              >
                Delete
              </button>
            : <button
                onClick={() => onReport('off_topic')}
                disabled={replyItem.is_reported}
                className='text-[10px] font-semibold text-ink-secondary/70 opacity-0 transition-opacity group-hover/reply:opacity-100 hover:text-ink-primary disabled:opacity-50'
              >
                Report
              </button>
            }
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
    </div>
  );
}
