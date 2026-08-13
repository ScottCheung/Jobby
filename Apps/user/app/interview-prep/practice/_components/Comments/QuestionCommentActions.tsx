/** @format */

'use client';
import { Button, Kbd, Tooltip } from '@jobby/ui';

import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Eye,
  ThumbsDown,
  ThumbsUp,
  MessageCircle,
  Zap,
  Siren,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { InterviewQuestion, QuestionCommunitySummary } from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { cn } from '@/lib/utils';


import { div } from 'framer-motion/client';

export function QuestionCommentActions({
  questionId,
  reportRefreshKey,
  onReport,
  compact = false,
  initialMetrics,
  onOpenComments,
  onOpenReports,
}: {
  questionId: string;
  reportRefreshKey: number;
  onReport: () => void;
  compact?: boolean;
  initialMetrics?: InterviewQuestion['metrics'];
  onOpenComments?: () => void;
  onOpenReports?: () => void;
}) {
  const [summary, setSummary] = useState<QuestionCommunitySummary | null>(null);
  const viewedQuestionId = useRef<string | null>(null);
  const [commentDelta, setCommentDelta] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const shouldRecordView = viewedQuestionId.current !== questionId;
    viewedQuestionId.current = questionId;

    void (async () => {
      try {
        if (shouldRecordView) {
          await api.getInterviewQuestion(questionId);
        }
        const nextSummary = await api.questionCommunity(questionId);
        if (!cancelled) setSummary(nextSummary);
      } catch {
        // Community signals are supplementary; leave the question usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId, reportRefreshKey]);

  // Reset comment delta when question changes
  useEffect(() => {
    setCommentDelta(0);
  }, [questionId]);

  // Listen for comment creation/deletion to optimistically update comment count
  useEffect(() => {
    const onCommentEvent = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          question_id?: string;
          event_type?: string;
          _local?: boolean;
        }>
      ).detail;
      if (detail?.question_id !== questionId) return;
      // Only react to locally-dispatched events to avoid double-counting with SSE
      if (!detail._local) return;
      if (detail.event_type === 'comment.created') {
        setCommentDelta((d) => d + 1);
      } else if (detail.event_type === 'comment.deleted') {
        setCommentDelta((d) => d - 1);
      }
    };
    window.addEventListener('jobby:comment-event', onCommentEvent);
    return () =>
      window.removeEventListener('jobby:comment-event', onCommentEvent);
  }, [questionId]);

  const react = async (value: 'up' | 'down') => {
    const currentUp =
      summary ? summary.upvote_count : (initialMetrics?.upvote_count ?? 0);
    const currentDown =
      summary ? summary.downvote_count : (initialMetrics?.downvote_count ?? 0);
    const currentReaction = summary?.user_reaction ?? null;
    const next = currentReaction === value ? null : value;
    const baseSummary: QuestionCommunitySummary = summary || {
      rating_count: 0,
      view_count: initialMetrics?.view_count ?? 0,
      unique_viewer_count: 0,
      practice_count: initialMetrics?.practice_count ?? 0,
      unique_practicer_count: 0,
      total_practice_seconds: 0,
      favorite_count: initialMetrics?.favorite_count ?? 0,
      is_favorited: Boolean(initialMetrics?.favorite_count),
      upvote_count: currentUp,
      downvote_count: currentDown,
      seen_in_interview_count: initialMetrics?.seen_in_interview_count ?? 0,
      company_count: 0,
      top_companies: [],
    };

    const previous = summary;
    setSummary({
      ...baseSummary,
      user_reaction: next,
      upvote_count:
        currentUp + Number(next === 'up') - Number(currentReaction === 'up'),
      downvote_count:
        currentDown +
        Number(next === 'down') -
        Number(currentReaction === 'down'),
    });
    try {
      setSummary(await api.updateQuestionCommunityReaction(questionId, next));
    } catch {
      setSummary(previous);
      showGlobalToast('Could not save reaction.');
    }
  };

  const toggleFavorite = async () => {
    const currentFav =
      summary ? summary.favorite_count : (initialMetrics?.favorite_count ?? 0);
    const currentIsFav = summary ? summary.is_favorited : false;
    const isFavorited = !currentIsFav;
    const baseSummary: QuestionCommunitySummary = summary || {
      rating_count: 0,
      view_count: initialMetrics?.view_count ?? 0,
      unique_viewer_count: 0,
      practice_count: initialMetrics?.practice_count ?? 0,
      unique_practicer_count: 0,
      total_practice_seconds: 0,
      favorite_count: currentFav,
      is_favorited: currentIsFav,
      upvote_count: initialMetrics?.upvote_count ?? 0,
      downvote_count: initialMetrics?.downvote_count ?? 0,
      seen_in_interview_count: initialMetrics?.seen_in_interview_count ?? 0,
      company_count: 0,
      top_companies: [],
    };

    const previous = summary;
    setSummary({
      ...baseSummary,
      is_favorited: isFavorited,
      favorite_count: Math.max(0, currentFav + (isFavorited ? 1 : -1)),
    });
    try {
      setSummary(await api.toggleQuestionFavorite(questionId));
    } catch {
      setSummary(previous);
      showGlobalToast('Could not update saved status.');
    }
  };

  // Listen for global keyboard shortcut actions (Upvote, Downvote, Favorite, Report)
  useEffect(() => {
    const handleKeyboardAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string }>).detail;
      if (!detail) return;
      if (detail.action === 'upvote') {
        void react('up');
      } else if (detail.action === 'downvote') {
        void react('down');
      } else if (detail.action === 'favorite') {
        void toggleFavorite();
      } else if (detail.action === 'report') {
        onReport();
      }
    };
    window.addEventListener('jobby:keyboard-action', handleKeyboardAction);
    return () =>
      window.removeEventListener('jobby:keyboard-action', handleKeyboardAction);
  }, [questionId, summary, initialMetrics, onReport]);

  const upvoteCount =
    summary ? summary.upvote_count : (initialMetrics?.upvote_count ?? 0);
  const downvoteCount =
    summary ? summary.downvote_count : (initialMetrics?.downvote_count ?? 0);
  const viewCount =
    summary ? summary.view_count : (initialMetrics?.view_count ?? 0);
  const favoriteCount =
    summary ? summary.favorite_count : (initialMetrics?.favorite_count ?? 0);
  const seenCount =
    summary ?
      summary.seen_in_interview_count
    : (initialMetrics?.seen_in_interview_count ?? 0);
  const practiceCount =
    summary ? summary.practice_count : (initialMetrics?.practice_count ?? 0);
  const commentCount = Math.max(
    0,
    (summary?.comment_count !== undefined ?
      summary.comment_count
    : (initialMetrics?.comment_count ?? 0)) + commentDelta,
  );
  const companies = summary?.top_companies || [];

  if (compact) {
    return (
      <div className=' row gap-1 '>
        <div className='flex flex-wrap items-center gap-1'>
          <Tooltip
            content={
              <span className='inline-flex items-center'>
                {`${upvoteCount} Feel Helpful`} <Kbd>↑</Kbd>
              </span>
            }
          >
            <button
              onClick={() => void react('up')}
              aria-label='Mark question helpful'
              className={cn(
                'inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-medium transition-colors',
                summary?.user_reaction === 'up' ?
                  'text-primary'
                : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
              )}
            >
              <ThumbsUp
                className={cn(
                  'h-3.5 w-3.5',
                  summary?.user_reaction === 'up' && 'fill-current',
                )}
              />{' '}
              {upvoteCount}
            </button>
          </Tooltip>
          <Tooltip
            content={
              <span className='inline-flex items-center'>
                {`${downvoteCount} Feel Not helpful`} <Kbd>↓</Kbd>
              </span>
            }
          >
            <button
              onClick={() => void react('down')}
              aria-label='Mark question not helpful'
              className={cn(
                'inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-medium transition-colors',
                summary?.user_reaction === 'down' ?
                  'text-orange-600'
                : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
              )}
            >
              <ThumbsDown
                className={cn(
                  'h-3.5 w-3.5',
                  summary?.user_reaction === 'down' && 'fill-current',
                )}
              />{' '}
              {downvoteCount}
            </button>
          </Tooltip>

          <Tooltip
            content={
              <span className='inline-flex items-center'>
                {summary?.is_favorited ? 'Remove from saved' : 'Save question'}{' '}
                <Kbd>S</Kbd>
              </span>
            }
          >
            <button
              onClick={() => void toggleFavorite()}
              aria-label={
                summary?.is_favorited ?
                  'Remove from saved questions'
                : 'Save question'
              }
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors',
                summary?.is_favorited ?
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
              )}
            >
              <Bookmark
                className={cn(
                  'h-3.5 w-3.5',
                  summary?.is_favorited && 'fill-current',
                )}
              />
              {favoriteCount}
            </button>
          </Tooltip>

          <Tooltip content={`${commentCount} Comments`}>
            <button
              onClick={onOpenComments}
              className='inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-ink-secondary transition-colors hover:bg-background-secondary hover:text-ink-primary'
            >
              <MessageCircle className='h-3.5 w-3.5' /> {commentCount}
            </button>
          </Tooltip>
          <Tooltip content={`${seenCount} Seen this question in interview`}>
            <Button
              variant={'custom'}
              onClick={onOpenReports}
              className='inline-flex h-6 items-center rounded-md px-1.5 text-[11px] font-medium transition-colors text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
            >
              <span className='flex  gap-1 '>
                <BriefcaseBusiness className='h-3.5 w-3.5' />
                {seenCount}
              </span>
            </Button>
          </Tooltip>
          <Tooltip content={`${viewCount} Views`}>
            <span className='inline-flex h-6 items-center gap-1 px-1.5 text-[11px] font-medium text-ink-secondary'>
              <Eye className='h-3.5 w-3.5' /> {viewCount}
            </span>
          </Tooltip>
          <Tooltip content={`${practiceCount} times Practiced`}>
            <span className='inline-flex h-6 items-center gap-1 px-1.5 text-[11px] font-medium text-ink-secondary'>
              <Dumbbell className='h-3.5 w-3.5 ' /> {practiceCount}
            </span>
          </Tooltip>
        </div>
        <Tooltip
          content={
            <span className='inline-flex items-center'>
              Report this question in interview <Kbd>R</Kbd>
            </span>
          }
        >
          <Button
            layoutId='Seen in Interview'
            variant={'custom'}
            onClick={onReport}
            className='inline-flex h-6 items-center border border-primary rounded-md px-1.5 text-[11px] font-medium transition-colors text-primary hover:bg-background-secondary hover:text-ink-primary'
          >
            <span className='flex  gap-1 '>
              <Siren className='h-3.5 w-3.5' />
              Seen in Interview
            </span>
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className='mt-3 space-y-2.5 border-t border-border/50 pt-3'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <button
          onClick={() => void react('up')}
          className={cn(
            'rounded-full px-2 py-1 text-xs',
            summary?.user_reaction === 'up' ?
              'bg-primary/15 text-primary'
            : 'bg-background-secondary text-ink-secondary',
          )}
        >
          <ChevronUp className='h-3.5 w-3.5' /> {upvoteCount}
        </button>
        <button
          onClick={() => void react('down')}
          className={cn(
            'rounded-full px-2 py-1 text-xs',
            summary?.user_reaction === 'down' ?
              'bg-primary/15 text-primary'
            : 'bg-background-secondary text-ink-secondary',
          )}
        >
          <ChevronDown className='h-3.5 w-3.5' /> {downvoteCount}
        </button>
        <button
          onClick={onOpenReports || onReport}
          className='ml-auto flex items-center gap-1 rounded-md bg-primary/20 px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90'
        >
          <BriefcaseBusiness className='h-3 w-3' /> Seen in Interview{' '}
          {seenCount}
        </button>
      </div>
      <div className='flex items-center gap-3 text-[11px] text-ink-secondary'>
        <span className='inline-flex items-center gap-1'>
          <Eye className='h-3.5 w-3.5' /> {viewCount} views
        </span>
        <span className='inline-flex items-center gap-1'>
          <Bookmark className='h-3.5 w-3.5' /> {favoriteCount} saved
        </span>
        <span className='inline-flex items-center gap-1 text-primary'>
          <Zap className='h-3.5 w-3.5' /> {practiceCount} practiced
        </span>
      </div>
      {(companies.length > 0 || seenCount > 0) && (
        <div className='flex flex-wrap items-center gap-1.5'>
          <span className='text-[10px] font-semibold uppercase tracking-wide text-ink-secondary'></span>
          {companies.map((company) => (
            <Tooltip
              key={company.name}
              content={`${company.count} users have been asked in ${company.name}`}
            >
              <button
                onClick={onOpenReports || onReport}
                className='rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-600'
              >
                {company.name} {company.count > 1 ? company.count : ''}
              </button>
            </Tooltip>
          ))}
          {(summary?.company_count || 0) > companies.length && (
            <Tooltip
              key={'other'}
              content={`other ${(summary?.company_count || 0) - companies.length} users have been asked this question in other companies.`}
            >
              <button
                onClick={onOpenReports || onReport}
                className='rounded-full bg-background-secondary px-2.5 py-1 text-[10px] font-semibold text-ink-secondary'
              >
                Other {(summary?.company_count || 0) - companies.length}
              </button>
            </Tooltip>
          )}
          <button
            onClick={onOpenReports || onReport}
            className='text-[10px] text-ink-secondary underline'
          >
            View {seenCount}
          </button>
        </div>
      )}
    </div>
  );
}
