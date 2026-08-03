/** @format */

'use client';

import { KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/UI/Avatar/Avatar';
import {
  ChevronDown,
  ChevronUp,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Mic,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { QuestionComment } from '@/lib/types';
import { Tooltip } from '@/components/UI/tooltip/index';
import { showGlobalToast } from '@/lib/toast';
import { Button } from '@/components/UI/Button';
import { Textarea } from '@/components/UI/textarea';
import { EmptyState } from '@/components/UI/EmptyState';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/lib/use-relative-time';
import { useConsole } from '@/components/ConsoleContext';

const kinds = [
  ['discussion', 'Discussion'],
  ['feedback', 'Feedback'],
] as const;
type CommentKind = QuestionComment['kind'];
type ReportReason = 'spam' | 'off_topic' | 'unsafe';

const kindDot: Record<CommentKind, string> = {
  discussion: 'bg-primary',
  feedback: 'bg-amber-500',
  example: 'bg-success',
};
const kindTag: Record<CommentKind, string> = {
  discussion: 'bg-primary/10 text-primary',
  feedback: 'bg-amber-500/10 text-amber-600',
  example: 'bg-success/10 text-success',
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
const updateComment = (
  items: QuestionComment[],
  id: string,
  update: (comment: QuestionComment) => QuestionComment,
): QuestionComment[] =>
  items.map((comment) =>
    comment.id === id ?
      update(comment)
    : { ...comment, replies: updateComment(comment.replies, id, update) },
  );

const findComment = (
  items: QuestionComment[],
  id: string,
): QuestionComment | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    const nested = findComment(item.replies, id);
    if (nested) return nested;
  }
};

const appendReply = (
  items: QuestionComment[],
  parentId: string,
  reply: QuestionComment,
): QuestionComment[] =>
  items.map((item) =>
    item.id === parentId ?
      { ...item, replies: [...item.replies, reply] }
    : { ...item, replies: appendReply(item.replies, parentId, reply) },
  );

export function QuestionCommunity({ questionId }: { questionId: string }) {
  const { user } = useConsole();
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [expandedReplyIds, setExpandedReplyIds] = useState<Set<string>>(
    new Set(),
  );
  const [kind, setKind] = useState<'all' | CommentKind>('all');
  const [draft, setDraft] = useState('');
  const [draftKind, setDraftKind] = useState<CommentKind>('discussion');
  const [isComposing, setIsComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [reportMenuFor, setReportMenuFor] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [poppedLikeId, setPoppedLikeId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const load = async (reset = true, showSkeleton = true) => {
    const startedAt = Date.now();
    if (showSkeleton) setIsLoading(true);
    const page = await api.questionComments(questionId, {
      kind: kind === 'all' ? undefined : kind,
      before: reset ? undefined : nextCursor || undefined,
    });
    const remaining = Math.max(0, 500 - (Date.now() - startedAt));
    if (showSkeleton && remaining)
      await new Promise((resolve) => window.setTimeout(resolve, remaining));
    setComments((items) => (reset ? page.items : [...items, ...page.items]));
    setNextCursor(page.next_cursor || null);
    if (showSkeleton) setIsLoading(false);
  };
  useEffect(() => {
    setComments([]);
    setNextCursor(null);
    void load(true).catch(() => {
      setIsLoading(false);
      showGlobalToast('Could not load comments.');
    });
  }, [questionId, kind]);
  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          question_id?: string;
          comment_id?: string;
          like_count?: number;
          event_type?: string;
        }>
      ).detail;
      if (detail?.question_id !== questionId) return;
      if (
        detail.event_type === 'comment.reaction_updated' &&
        detail.comment_id &&
        typeof detail.like_count === 'number'
      ) {
        setComments((items) =>
          updateComment(items, detail.comment_id!, (comment) => ({
            ...comment,
            like_count: detail.like_count!,
          })),
        );
        return;
      }
      void load(true, false).catch(() => undefined);
    };
    window.addEventListener('jobby:comment-event', onRealtime);
    return () => window.removeEventListener('jobby:comment-event', onRealtime);
  }, [questionId, kind]);
  useEffect(() => {
    if (replyTo) requestAnimationFrame(() => replyInputRef.current?.focus());
  }, [replyTo]);

  const post = async (parentId?: string) => {
    const rawBody = (parentId ? reply : draft).trim();
    if (!rawBody) return;
    const parent = parentId ? findComment(comments, parentId) : undefined;
    const body =
      parent?.parent_id ? `Reply ${parent.author_name}: ${rawBody}` : rawBody;
    const optimistic: QuestionComment = {
      id: `pending-${Date.now()}`,
      question_id: questionId,
      parent_id: parentId || null,
      kind: parentId ? 'discussion' : draftKind,
      body,
      author_name: user?.display_name || 'You',
      author_avatar_url: user?.avatar_url || null,
      author_badge:
        user?.community_badge || (user?.role === 'admin' ? 'Admin' : null),
      is_author: true,
      like_count: 0,
      is_liked: false,
      is_reported: false,
      reply_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      replies: [],
    };
    setComments((items) =>
      parentId ?
        appendReply(items, parentId, optimistic)
      : [...items, optimistic],
    );
    if (parentId) {
      setReply('');
      setReplyTo(null);
    } else {
      setDraft('');
      setIsComposing(false);
    }
    try {
      const saved = await api.createQuestionComment(questionId, {
        kind: optimistic.kind,
        body: rawBody,
        parent_id: parentId,
      });
      setComments((items) => updateComment(items, optimistic.id, () => saved));
    } catch {
      await load();
      showGlobalToast('Could not post comment.');
    }
  };
  const submitOnEnter = (
    event: KeyboardEvent<HTMLTextAreaElement>,
    parentId?: string,
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void post(parentId);
    }
  };
  const like = async (comment: QuestionComment) => {
    const previous = comment;
    if (!comment.is_liked) {
      setPoppedLikeId(comment.id);
      window.setTimeout(
        () => setPoppedLikeId((id) => (id === comment.id ? null : id)),
        400,
      );
    }
    setComments((items) =>
      updateComment(items, comment.id, (item) => ({
        ...item,
        is_liked: !item.is_liked,
        like_count: item.like_count + (item.is_liked ? -1 : 1),
      })),
    );
    try {
      const result = await api.toggleQuestionCommentLike(
        questionId,
        comment.id,
      );
      setComments((items) =>
        updateComment(items, comment.id, (item) => ({
          ...item,
          is_liked: result.liked,
          like_count: result.like_count,
        })),
      );
    } catch {
      setComments((items) => updateComment(items, comment.id, () => previous));
      showGlobalToast('Could not update like.');
    }
  };
  const report = async (comment: QuestionComment, reason: ReportReason) => {
    setReportMenuFor(null);
    const previous = comment;
    setComments((items) =>
      updateComment(items, comment.id, (item) => ({
        ...item,
        is_reported: true,
      })),
    );
    try {
      await api.reportQuestionComment(questionId, comment.id, reason);
      showGlobalToast('Report submitted.');
    } catch {
      setComments((items) => updateComment(items, comment.id, () => previous));
      showGlobalToast('Could not submit report.');
    }
  };
  const remove = async (commentId: string) => {
    const previous = comments;
    setComments((items) =>
      items
        .filter((item) => item.id !== commentId)
        .map((item) => ({
          ...item,
          replies: removeComment(item.replies, commentId),
        })),
    );
    try {
      await api.deleteQuestionComment(questionId, commentId);
    } catch {
      setComments(previous);
      showGlobalToast('Could not delete comment.');
    }
  };
  const expandReplies = async (comment: QuestionComment) => {
    const startedAt = Date.now();
    setLoadingReplies(comment.id);
    try {
      const page = await api.questionCommentReplies(questionId, comment.id);
      const remaining = Math.max(0, 500 - (Date.now() - startedAt));
      if (remaining)
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setComments((items) =>
        updateComment(items, comment.id, (item) => ({
          ...item,
          replies: page.items,
        })),
      );
      setExpandedReplyIds((items) => new Set(items).add(comment.id));
    } catch {
      showGlobalToast('Could not load replies.');
    } finally {
      setLoadingReplies(null);
    }
  };
  const collapseReplies = (comment: QuestionComment) => {
    setComments((items) =>
      updateComment(items, comment.id, (item) => ({
        ...item,
        replies: item.replies.slice(-3),
      })),
    );
    setExpandedReplyIds((items) => {
      const next = new Set(items);
      next.delete(comment.id);
      return next;
    });
  };
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showGlobalToast('Voice input is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let text = '';
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      )
        text += event.results[index][0].transcript;
      setDraft(
        (value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}${text}`,
      );
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
      showGlobalToast('Voice input stopped.');
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className='flex h-full min-h-0  flex-col'>
      <div className='header'>
        <div className='flex gap-0.5 rounded-full bg-background-secondary/70 p-0.5'>
          {(['all', ...kinds.map(([value]) => value)] as const).map((value) => (
            <button
              key={value}
              onClick={() => setKind(value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-bold capitalize transition-colors',
                kind === value ?
                  'bg-panel text-primary shadow-sm'
                : 'text-ink-secondary/70 hover:text-ink-primary',
              )}
            >
              {value}
            </button>
          ))}
        </div>
        {!isLoading && (
          <span className='shrink-0 text-[11px] font-semibold text-ink-secondary/70'>
            {comments.length}
            {nextCursor ? '+' : ''} comments
          </span>
        )}
      </div>
      <div className='body'>
        {isLoading ?
          <CommentSkeleton />
        : comments.length === 0 ?
          <EmptyState
            icon={MessageCircle}
            title='No comments yet'
            description='Be the first to start the conversation.'
          />
        : comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              replyTo={replyTo}
              reply={reply}
              setReply={setReply}
              replyInputRef={replyInputRef}
              onOpenReply={() => setReplyTo(comment.id)}
              onCloseReply={() => setReplyTo(null)}
              onReply={() => void post(comment.id)}
              onReplyTo={(target) => setReplyTo(target.id)}
              onSubmitReplyTo={(target) => void post(target.id)}
              onEnter={(event) => submitOnEnter(event, comment.id)}
              onLike={() => void like(comment)}
              likePopped={poppedLikeId === comment.id}
              reportMenuOpen={reportMenuFor === comment.id}
              onToggleReportMenu={() =>
                setReportMenuFor(
                  reportMenuFor === comment.id ? null : comment.id,
                )
              }
              onReport={(reason) => void report(comment, reason)}
              onDelete={() => void remove(comment.id)}
              onLikeReply={(replyItem) => void like(replyItem)}
              likePoppedReplyId={poppedLikeId}
              onReportReply={(replyItem, reason) =>
                void report(replyItem, reason)
              }
              onDeleteReply={(replyItem) => void remove(replyItem.id)}
              loadingReplies={loadingReplies === comment.id}
              onExpandReplies={() => void expandReplies(comment)}
              isRepliesExpanded={expandedReplyIds.has(comment.id)}
              onCollapseReplies={() => collapseReplies(comment)}
              currentUserName={user?.display_name || 'You'}
              currentUserAvatar={user?.avatar_url}
            />
          ))
        }
        {!isLoading && nextCursor && (
          <div className='py-3 text-center'>
            <button
              onClick={() => void load(false, false)}
              className='rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-ink-secondary/70 transition-colors hover:border-primary/40 hover:text-primary'
            >
              Load more comments
            </button>
          </div>
        )}
      </div>
      <div className='footer col relative z-10 w-full' ref={footerRef}>
        {isComposing && (
          <div className='mb-2 absolute -top-8 flex gap-1.5  -translate-x-1/2 right-1/2 '>
            {kinds.map(([value, label]) => (
              <Tooltip content={`Use Ctrl + ${value} for ${label}`}>
                <button
                  key={value}
                  onClick={() => setDraftKind(value)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all',
                    draftKind === value ?
                      'bg-primary text-primary-foreground'
                    : 'bg-background-secondary text-ink-secondary/70 hover:text-ink-primary',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      draftKind === value ?
                        'bg-primary-foreground'
                      : kindDot[value],
                    )}
                  />
                  {label}
                </button>
              </Tooltip>
            ))}
          </div>
        )}
        <div
          onClick={() => mainInputRef.current?.focus()}
          className={cn(
            ' border border-border bg-background-secondary/40  w-full duration-1000  transition-all',
            isComposing ?
              'p-2 items-start col rounded-2xl'
            : 'rounded-3xl p-1  row items-center cursor-text',
          )}
        >
          <Avatar
            name={user?.display_name || 'You'}
            src={user?.avatar_url || undefined}
            size='sm'
          />
          <Textarea
            ref={mainInputRef}
            value={draft}
            onFocus={() => setIsComposing(true)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={submitOnEnter}
            placeholder='Add a comment...'
            rows={isComposing ? 3 : 1}
            minHeight={isComposing ? 72 : 36}
            showClearButton={false}
            className='min-h-6 flex-1 border-0 bg-transparent text-sm text-ink-primary outline-none placeholder:text-ink-secondary/70/70 p-0 shadow-none'
          />

          <div className='row justify-end w-full'>
            <button
              onClick={toggleVoice}
              aria-label={
                isListening ? 'Stop voice input' : 'Start voice input'
              }
              className={cn(
                'mb-0.5 rounded-full p-1.5 transition-all',
                isListening ?
                  'bg-rose-500/10 text-rose-500'
                : 'text-ink-secondary/70 hover:bg-background-secondary hover:text-primary',
              )}
            >
              {isListening ?
                <Square className='h-3.5 w-3.5 fill-current' />
              : <Mic className='h-4 w-4' />}
            </button>
            <button
              onClick={() => void post()}
              disabled={!draft.trim()}
              aria-label='Send comment'
              className={cn(
                'mb-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-all',
                draft.trim() ?
                  'bg-primary text-primary-foreground shadow-sm'
                : 'bg-transparent text-ink-secondary/50',
              )}
            >
              <Send className='h-3.5 w-3.5' />
            </button>
          </div>
        </div>
        {isComposing && (
          <p className='mt-1.5 px-1 text-[10px] text-ink-secondary/70'>
            Enter to send · Shift+Enter for a new line
          </p>
        )}
      </div>
    </div>
  );
}

const removeComment = (
  items: QuestionComment[],
  id: string,
): QuestionComment[] =>
  items
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, replies: removeComment(item.replies, id) }));
const flattenReplies = (items: QuestionComment[]): QuestionComment[] =>
  items.flatMap((item) => [item, ...flattenReplies(item.replies)]);

function Comment({
  comment,
  replyTo,
  reply,
  setReply,
  replyInputRef,
  onOpenReply,
  onCloseReply,
  onReply,
  onEnter,
  onLike,
  likePopped,
  reportMenuOpen,
  onToggleReportMenu,
  onReport,
  onDelete,
  onLikeReply,
  likePoppedReplyId,
  onReportReply,
  onDeleteReply,
  loadingReplies,
  onExpandReplies,
  isRepliesExpanded,
  onCollapseReplies,
  onReplyTo,
  onSubmitReplyTo,
  currentUserName,
  currentUserAvatar,
}: {
  comment: QuestionComment;
  replyTo: string | null;
  reply: string;
  setReply: (value: string) => void;
  replyInputRef: RefObject<HTMLTextAreaElement | null>;
  onOpenReply: () => void;
  onCloseReply: () => void;
  onReply: () => void;
  onEnter: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onLike: () => void;
  likePopped: boolean;
  reportMenuOpen: boolean;
  onToggleReportMenu: () => void;
  onReport: (reason: ReportReason) => void;
  onDelete: () => void;
  onLikeReply: (reply: QuestionComment) => void;
  likePoppedReplyId: string | null;
  onReportReply: (reply: QuestionComment, reason: ReportReason) => void;
  onDeleteReply: (reply: QuestionComment) => void;
  loadingReplies: boolean;
  onExpandReplies: () => void;
  isRepliesExpanded: boolean;
  onCollapseReplies: () => void;
  onReplyTo: (target: QuestionComment) => void;
  onSubmitReplyTo: (target: QuestionComment) => void;
  currentUserName: string;
  currentUserAvatar?: string | null;
}) {
  const isReplying = replyTo === comment.id;
  const relativeTime = useRelativeTime(comment.created_at);
  const replyContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isReplying &&
        replyContainerRef.current &&
        !replyContainerRef.current.contains(e.target as Node)
      ) {
        onCloseReply();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isReplying, onCloseReply]);

  return (
    <article className='group relative px-1  transition-colors hover:bg-background-secondary/25'>
      <div className='flex gap-2.5'>
        <Avatar
          name={comment.author_name}
          src={comment.author_avatar_url || undefined}
          ring={Boolean(comment.author_badge || comment.is_author)}
          ringColor={
            comment.author_badge === 'Admin' ? 'ring-rose-500'
            : comment.is_author ?
              'ring-primary'
            : undefined
          }
        />
        <div className='min-w-0 flex-1'>
          <div className='row items-baseline '>
            <span className='text-[9px] font-bold text-ink-secondary/50'>
              {comment.author_name}
            </span>
            {comment.author_badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide',
                  comment.author_badge === 'Admin' ?
                    'bg-rose-500/10 text-rose-600'
                  : comment.author_badge === 'Contributor' ?
                    'bg-primary/10 text-primary'
                  : 'bg-amber-500/10 text-amber-600',
                )}
              >
                {comment.author_badge}
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide',
                kindTag[comment.kind],
              )}
            >
              <span
                className={cn('h-1 w-1 rounded-full', kindDot[comment.kind])}
              />
              {comment.kind}
            </span>
          </div>
          <button
            onClick={onOpenReply}
            className='mt-1 block w-full cursor-pointer text-left text-[14px]  text-ink-primary!'
          >
            {comment.body}
          </button>
          <div className='mt-1.5 flex items-center gap-4'>
            <span className='text-[10px] text-ink-secondary/70'>
              {relativeTime}
            </span>

            <button
              onClick={onOpenReply}
              className='cursor-pointer text-[11px] font-bold text-ink-secondary/50 hover:text-primary'
            >
              Reply
            </button>
            <div className='relative ml-auto'>
              {comment.is_author ?
                <button
                  onClick={onDelete}
                  aria-label='Delete comment'
                  className='flex items-center px-4 py-3 cursor-pointer hover:bg-background-secondary rounded-full gap-1 text-[11px] font-bold transition-colors'
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
            <button
              onClick={onLike}
              className={cn(
                'flex items-center px-4 py-3 cursor-pointer hover:bg-background-secondary rounded-full gap-1 text-[11px] font-bold transition-colors',
                comment.is_liked ? 'text-rose-500' : (
                  'text-ink-secondary/70 hover:text-rose-500'
                ),
              )}
            >
              <Heart
                className={cn(
                  'h-4 w-4 transition-transform',
                  likePopped && 'animate-heart-pop',
                  comment.is_liked && 'fill-current',
                )}
              />
              {comment.like_count || ''}
            </button>
          </div>
          {isReplying && (
            <div
              ref={replyContainerRef}
              className='mt-3 flex gap-2 rounded-2xl bg-background-secondary/60 p-2'
            >
              <Avatar
                name={currentUserName}
                src={currentUserAvatar || undefined}
                size='sm'
              />
              <Textarea
                ref={replyInputRef}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={onEnter}
                rows={2}
                minHeight={48}
                placeholder={`Reply to ${comment.author_name}...`}
                className='min-w-0 flex-1 border-0 bg-transparent py-1 text-xs text-ink-primary outline-none placeholder:text-ink-secondary/70/70 p-0 shadow-none'
              />
              <div className='flex flex-col justify-between'>
                <button
                  onClick={onCloseReply}
                  className='text-[10px] font-semibold text-ink-secondary/70 hover:text-ink-primary'
                >
                  Close
                </button>
                <Button onClick={onReply} disabled={!reply.trim()} size='sm'>
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {comment.replies.length > 0 && (
        <div className='mt-4 space-y-4'>
          {flattenReplies(comment.replies).map((replyItem) => (
            <ReplyItem
              key={replyItem.id}
              replyItem={replyItem}
              onLike={() => onLikeReply(replyItem)}
              likePopped={likePoppedReplyId === replyItem.id}
              onReport={(reason) => onReportReply(replyItem, reason)}
              onDelete={() => onDeleteReply(replyItem)}
              replyTo={replyTo}
              reply={reply}
              setReply={setReply}
              onReplyTo={onReplyTo}
              onSubmitReplyTo={onSubmitReplyTo}
              onEnter={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  onSubmitReplyTo(replyItem);
                }
              }}
              currentUserName={currentUserName}
              currentUserAvatar={currentUserAvatar}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function ReplyItem({
  replyItem,
  onLike,
  likePopped,
  onReport,
  onDelete,
  replyTo,
  reply,
  setReply,
  onReplyTo,
  onSubmitReplyTo,
  onEnter,
  currentUserName,
  currentUserAvatar,
}: {
  replyItem: QuestionComment;
  onLike: () => void;
  likePopped: boolean;
  onReport: (reason: ReportReason) => void;
  onDelete: () => void;
  replyTo: string | null;
  reply: string;
  setReply: (value: string) => void;
  onReplyTo: (target: QuestionComment) => void;
  onSubmitReplyTo: (target: QuestionComment) => void;
  onEnter: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  currentUserName: string;
  currentUserAvatar?: string | null;
}) {
  const relativeTime = useRelativeTime(replyItem.created_at);
  return (
    <div className='group/reply flex gap-2.5'>
      <Avatar
        name={replyItem.author_name}
        src={replyItem.author_avatar_url || undefined}
        size='sm'
      />
      <div className='min-w-0 flex-1'>
        <div className='row items-baseline '>
          <span className='text-[12px] font-bold text-ink-secondary/50'>
            {replyItem.author_name}
          </span>
          {replyItem.author_badge && (
            <span className='rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-primary'>
              {replyItem.author_badge}
            </span>
          )}
        </div>
        <p className='mt-0.5 whitespace-pre-wrap text-xs  text-ink-primary'>
          {replyItem.body}
        </p>
        <div className='header'>
          <div className='row'>
            <span className='text-[10px] text-ink-secondary/50'>
              {relativeTime}
            </span>

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
            <button
              onClick={() => onReplyTo(replyItem)}
              className='cursor-pointer text-[10px] font-semibold text-ink-secondary/70 hover:text-primary'
            >
              Reply
            </button>
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
        {replyTo === replyItem.id && (
          <div className='mt-2 flex gap-2 rounded-lg bg-background-secondary/60 p-2 animate-in fade-in slide-in-from-top-1 duration-200'>
            <Avatar
              name={currentUserName}
              src={currentUserAvatar || undefined}
              size='sm'
            />
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              onKeyDown={onEnter}
              rows={2}
              minHeight={48}
              placeholder={`Reply to ${replyItem.author_name}...`}
              className='min-w-0 flex-1 border-0 bg-transparent text-xs outline-none p-0 shadow-none'
            />
            <Button
              size='sm'
              onClick={() => onSubmitReplyTo(replyItem)}
              disabled={!reply.trim()}
            >
              Send
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className='space-y-5 py-2'>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className='flex gap-2.5'>
          <div className='h-9 w-9 shrink-0 rounded-full skeleton' />
          <div className='flex-1 space-y-2'>
            <div className='h-3 w-28 rounded skeleton' />
            <div className='h-3 w-full rounded skeleton' />
            <div className='h-3 w-2/3 rounded skeleton' />
          </div>
        </div>
      ))}
    </div>
  );
}
