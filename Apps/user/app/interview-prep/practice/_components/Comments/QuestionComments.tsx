/** @format */

'use client';
import { Avatar, EmptyState, Textarea } from '@jobby/ui';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bookmark,
  Check,
  Copy,
  Crown,
  Flag,
  Heart,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type {
  QuestionAnswer,
  QuestionAnswerComment,
  QuestionComment,
} from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { useRelativeTime } from '@/lib/use-relative-time';
import { cn } from '@/lib/utils';
import { useConsole } from '@/components/ConsoleContext';

import { CommentItem } from './CommentItem';
import { ReplyItem } from './ReplyItem';
import { CommentSkeleton } from './CommentSkeleton';
import {
  kinds,
  CommentKind,
  ReportReason,
  kindTag,
  updateComment,
  appendReply,
  findComment,
  removeComment,
} from './utils';

export function QuestionComments({ questionId }: { questionId: string }) {
  const { user } = useConsole();
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [exampleAnswers, setExampleAnswers] = useState<QuestionAnswer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [sessionPostedIds, setSessionPostedIds] = useState<Set<string>>(
    new Set(),
  );
  const [highlightedCommentId, setHighlightedCommentId] = useState<
    string | null
  >(null);
  const [kind, setKind] = useState<'all' | CommentKind>('all');
  const [draft, setDraft] = useState('');
  const [draftKind, setDraftKind] = useState<CommentKind>('discussion');
  const [isComposing, setIsComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [reportMenuFor, setReportMenuFor] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [poppedLikeId, setPoppedLikeId] = useState<string | null>(null);
  const [answerReplyTarget, setAnswerReplyTarget] = useState<{
    answerId: string;
    parentCommentId?: string | null;
    parentContributorName?: string | null;
    parentIsReply?: boolean;
  } | null>(null);
  const [answerEditTarget, setAnswerEditTarget] = useState<{
    answerId: string;
    commentId: string;
    parentContributorName?: string | null;
    parentIsReply?: boolean;
  } | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [answerEditBody, setAnswerEditBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<QuestionComment[]>([]);
  const nextCursorRef = useRef<string | null>(null);
  const requestVersionRef = useRef(0);
  const [hashTarget, setHashTarget] = useState<string | null>(null);

  const cancelReplyContext = (collapse = false) => {
    if (reply.trim()) {
      setDraft((current) => current || reply);
      setReply('');
    }
    setReplyTo(null);
    setAnswerReplyTarget(null);
    setAnswerEditTarget(null);
    setAnswerDraft('');
    setAnswerEditBody('');
    if (collapse) setIsComposing(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        footerRef.current &&
        !footerRef.current.contains(event.target as Node)
      ) {
        cancelReplyContext(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [reply]);

  const load = async (reset = true, showSkeleton = true) => {
    if (!reset && isFetchingMore) return;
    const startedAt = Date.now();
    if (showSkeleton) setIsLoading(true);
    if (!reset) setIsFetchingMore(true);
    try {
      const [page, answers] = await Promise.all([
        kind === 'example' ?
          Promise.resolve({ items: [], next_cursor: null })
        : api.questionComments(questionId, {
            kind: kind === 'all' ? undefined : kind,
            before: reset ? undefined : nextCursor || undefined,
          }),
        api.questionAnswers(questionId, { answer_type: 'example' }),
      ]);
      const remaining = Math.max(0, 500 - (Date.now() - startedAt));
      if (remaining)
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setExampleAnswers(
        answers.filter((answer) => answer.status !== 'archived'),
      );
      setComments((items) => {
        const merged = reset ? page.items : [...items, ...page.items];
        const deduplicated = [
          ...new Map(merged.map((comment) => [comment.id, comment])).values(),
        ];
        commentsRef.current = deduplicated;
        return deduplicated;
      });
      const cursor = page.next_cursor || null;
      nextCursorRef.current = cursor;
      setNextCursor(cursor);
      return page;
    } finally {
      if (showSkeleton) setIsLoading(false);
      if (!reset) setIsFetchingMore(false);
    }
  };

  const revealHashTarget = async (
    initialItems = commentsRef.current,
    initialCursor = nextCursorRef.current,
    version = requestVersionRef.current,
  ) => {
    const hash = window.location.hash;
    setHashTarget(hash || null);
    const targetId = hash.replace(/^#comment-/, '');
    if (!targetId || targetId === hash.substring(1)) return;

    let items = initialItems;
    let cursor = initialCursor;
    let loadedMore = false;

    // A reply is returned inside its top-level comment, so only top-level pages
    // need to be fetched to reveal any comment referenced by a notification.
    while (!findComment(items, targetId) && cursor) {
      const page = await api.questionComments(questionId, {
        kind: kind === 'all' ? undefined : kind,
        before: cursor,
      });
      if (version !== requestVersionRef.current) return;

      items = [
        ...new Map(
          [...items, ...page.items].map((comment) => [comment.id, comment]),
        ).values(),
      ];
      cursor = page.next_cursor || null;
      loadedMore = true;
    }

    if (version !== requestVersionRef.current || !findComment(items, targetId))
      return;

    if (loadedMore) {
      commentsRef.current = items;
      nextCursorRef.current = cursor;
      setComments(items);
      setNextCursor(cursor);
    }

    // Wait for React to commit the loaded comment before querying its anchor.
    setHighlightedCommentId(targetId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (version !== requestVersionRef.current) return;
        document
          .getElementById(`comment-${targetId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => setHighlightedCommentId(null), 3000);
      });
    });
  };

  useEffect(() => {
    const version = ++requestVersionRef.current;
    setComments([]);
    setExampleAnswers([]);
    setNextCursor(null);
    commentsRef.current = [];
    nextCursorRef.current = null;
    void load(true)
      .then(
        (page) =>
          void revealHashTarget(
            page?.items,
            page?.next_cursor || null,
            version,
          ),
      )
      .catch(() => {
        setIsLoading(false);
        showGlobalToast('Could not load comments.');
      });
  }, [questionId, kind]);

  useEffect(() => {
    const handleHash = () => {
      setHashTarget(window.location.hash || null);
      void revealHashTarget();
    };

    // In Next.js App Router, hash changes don't always fire standard hashchange if it's pushed by router.
    // We listen to hashchange, but also the component will remount or re-render.
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [questionId, kind]);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          question_id?: string;
          comment_id?: string;
          like_count?: number;
          event_type?: string;
          actor_user_id?: string;
        }>
      ).detail;
      if (detail?.question_id !== questionId) return;
      if (
        detail.event_type === 'comment.created' &&
        detail.actor_user_id === user?.id
      )
        return;
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
    const onAnswerRealtime = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          question_id?: string;
          answer_id?: string;
          comment_id?: string;
          actor_user_id?: string;
        }>
      ).detail;
      if (detail?.question_id !== questionId) return;
      void api
        .questionAnswers(questionId, { answer_type: 'example' })
        .then((answers) =>
          setExampleAnswers(
            answers.filter((answer) => answer.status !== 'archived'),
          ),
        )
        .catch(() => undefined);
    };
    window.addEventListener('jobby:answer-event', onAnswerRealtime);
    return () =>
      window.removeEventListener('jobby:answer-event', onAnswerRealtime);
  }, [questionId]);

  const observerTarget = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !nextCursor || isFetchingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void load(false, false);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [nextCursor, isFetchingMore, kind, questionId]);

  useEffect(() => {
    if (replyTo || answerReplyTarget || answerEditTarget) {
      requestAnimationFrame(() => {
        const input = mainInputRef.current;
        if (input) {
          input.focus();
          const length = input.value.length;
          input.setSelectionRange(length, length);
        }
      });
    }
  }, [replyTo, answerReplyTarget, answerEditTarget]);

  const wait = (ms: number) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

  const retryOnce = async <T,>(request: () => Promise<T>) => {
    try {
      return await request();
    } catch {
      await wait(450);
      return request();
    }
  };

  const post = async (parentId?: string) => {
    if (isSubmitting) return;
    if (editFor) {
      const rawBody = editBody.trim();
      if (!rawBody) return;

      const targetCommentId = editFor;
      const targetComment = findComment(comments, targetCommentId);
      if (!targetComment) return;

      const previous = targetComment;
      const optimisticBody =
        targetComment.parent_id && targetComment.body.startsWith('Reply ') ?
          `Reply ${targetComment.body.match(/^Reply\s+([^:]+):/)?.[1] || 'Member'}: ${rawBody}`
        : rawBody;

      setComments((items) =>
        updateComment(items, editFor, (item) => ({
          ...item,
          body: optimisticBody,
        })),
      );

      setEditBody('');
      setEditFor(null);
      setIsComposing(false);

      try {
        setIsSubmitting(true);
        const saved = await retryOnce(() =>
          api.updateQuestionComment(questionId, targetCommentId, {
            body: optimisticBody,
          }),
        );
        setComments((items) =>
          updateComment(items, targetCommentId, () => saved),
        );
      } catch {
        setComments((items) =>
          updateComment(items, targetCommentId, () => previous),
        );
        setEditFor(targetCommentId);
        setEditBody(rawBody);
        setIsComposing(true);
        showGlobalToast('Could not edit comment.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const rawBody = (parentId ? reply : draft).trim();
    if (!rawBody) return;
    if (!parentId && draftKind === 'example') {
      try {
        setIsSubmitting(true);
        const created = await retryOnce(() =>
          api.createQuestionAnswer(questionId, {
            source: 'community',
            answer_type: 'example',
            status: 'published',
            body: rawBody,
            metadata: { posted_from: 'community_feed' },
          }),
        );
        setExampleAnswers((items) => [created, ...items]);
        setHashTarget(`#answer-${created.id}`);
        setDraft('');
        setIsComposing(false);
      } catch {
        setDraft(rawBody);
        setIsComposing(true);
        showGlobalToast('Could not post example. Your message was restored.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
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

    const flashAndScroll = (targetId: string) => {
      setSessionPostedIds((prev) => new Set(prev).add(targetId));
      setHighlightedCommentId(targetId);
      setTimeout(() => {
        const el = document.getElementById(`comment-${targetId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => {
        setHighlightedCommentId(null);
      }, 3000);
    };

    setComments((items) =>
      parentId ?
        appendReply(items, parentId, optimistic)
      : [...items, optimistic],
    );
    flashAndScroll(optimistic.id);

    if (parentId) {
      setReply('');
      setReplyTo(null);
    } else {
      setDraft('');
      setIsComposing(false);
    }
    try {
      setIsSubmitting(true);
      const saved = await retryOnce(() =>
        api.createQuestionComment(questionId, {
          kind: optimistic.kind,
          body,
          parent_id: parentId,
        }),
      );
      setComments((items) => updateComment(items, optimistic.id, () => saved));
      setSessionPostedIds((prev) => {
        const next = new Set(prev);
        next.delete(optimistic.id);
        next.add(saved.id);
        return next;
      });
      setHighlightedCommentId((prev) =>
        prev === optimistic.id ? saved.id : prev,
      );
      // Notify other components (e.g. comment count badge) about the new comment
      window.dispatchEvent(
        new CustomEvent('jobby:comment-event', {
          detail: {
            question_id: questionId,
            comment_id: saved.id,
            event_type: 'comment.created',
            actor_user_id: user?.id,
            _local: true,
          },
        }),
      );
      setTimeout(() => {
        const el = document.getElementById(`comment-${saved.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch {
      setComments((items) => removeComment(items, optimistic.id));
      if (parentId) {
        setReply(rawBody);
        setReplyTo(parentId);
      } else {
        setDraft(rawBody);
      }
      setIsComposing(true);
      showGlobalToast('Could not post comment. Your message was restored.');
    } finally {
      setIsSubmitting(false);
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
    setComments((items) => removeComment(items, commentId));
    try {
      await api.deleteQuestionComment(questionId, commentId);
      // Notify other components about the deleted comment
      window.dispatchEvent(
        new CustomEvent('jobby:comment-event', {
          detail: {
            question_id: questionId,
            comment_id: commentId,
            event_type: 'comment.deleted',
            actor_user_id: user?.id,
            _local: true,
          },
        }),
      );
    } catch {
      setComments(previous);
      showGlobalToast('Could not delete comment.');
    }
  };
  const postAnswerComment = async () => {
    if (isSubmitting) return;
    if (answerEditTarget) {
      const rawBody = answerEditBody.trim();
      if (!rawBody) return;
      const target = answerEditTarget;
      const body =
        target.parentIsReply ?
          `Reply ${target.parentContributorName || 'Member'}: ${rawBody}`
        : rawBody;
      try {
        setIsSubmitting(true);
        await retryOnce(() =>
          api.updateQuestionAnswerComment(target.answerId, target.commentId, {
            body,
          }),
        );
        window.dispatchEvent(
          new CustomEvent('jobby:answer-event', {
            detail: {
              question_id: questionId,
              answer_id: target.answerId,
              comment_id: target.commentId,
              event_type: 'answer.comment_updated',
              comment: {
                answer_id: target.answerId,
                comment_id: target.commentId,
                body,
              },
            },
          }),
        );
        setHashTarget(`#answer-comment-${target.commentId}`);
        setAnswerEditTarget(null);
        setAnswerEditBody('');
        setIsComposing(false);
      } catch {
        setAnswerEditTarget(target);
        setAnswerEditBody(rawBody);
        setIsComposing(true);
        showGlobalToast('Could not edit reply.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!answerReplyTarget) return;
    const target = answerReplyTarget;
    const rawBody = answerDraft.trim();
    if (!rawBody) return;
    const body =
      // An answer is the root of this thread, so every comment target needs a reply label.
      target.parentCommentId ?
        `Reply ${target.parentContributorName || 'Member'}: ${rawBody}`
      : rawBody;
    try {
      setIsSubmitting(true);
      const saved = await retryOnce(() =>
        api.createQuestionAnswerComment(target.answerId, {
          body,
          parent_id: target.parentCommentId || undefined,
        }),
      );
      setExampleAnswers((items) =>
        items.map((item) =>
          item.id === target.answerId ?
            { ...item, comment_count: item.comment_count + 1 }
          : item,
        ),
      );
      window.dispatchEvent(
        new CustomEvent('jobby:answer-event', {
          detail: {
            question_id: questionId,
            answer_id: target.answerId,
            comment_id: saved.id,
            event_type: 'answer.comment_created',
            parent_comment_id: target.parentCommentId || null,
            comment: saved,
          },
        }),
      );
      setHashTarget(`#answer-comment-${saved.id}`);
      setAnswerReplyTarget(null);
      setAnswerDraft('');
      setIsComposing(false);
    } catch {
      setAnswerReplyTarget(target);
      setAnswerDraft(rawBody);
      setIsComposing(true);
      showGlobalToast('Could not send reply. Your message was restored.');
    } finally {
      setIsSubmitting(false);
    }
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
      const setValue =
        editFor ? setEditBody
        : answerEditTarget ? setAnswerEditBody
        : answerReplyTarget ? setAnswerDraft
        : replyTo ? setReply
        : setDraft;
      setValue(
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

  const sortedComments = comments;
  const visibleExamples =
    kind === 'discussion' || kind === 'feedback' ? [] : exampleAnswers;
  const totalVisibleItems =
    visibleExamples.length + (kind === 'example' ? 0 : sortedComments.length);

  return (
    <div className='flex h-full min-h-0 flex-col'>
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
            {totalVisibleItems}
            {kind !== 'example' && nextCursor ? '+' : ''} items
          </span>
        )}
      </div>
      <div className='body'>
        {isLoading ?
          <CommentSkeleton />
        : totalVisibleItems === 0 ?
          <EmptyState
            IP={10}
            title='Nothing here yet'
            description='Be the first to share feedback, discussion, or an example answer.'
          />
        : <>
            {visibleExamples.length > 0 && (
              <div className='mb-5 space-y-3'>
                {(kind === 'all' || kind === 'example') && (
                  <div className='flex items-center gap-2 px-1'>
                    <Crown className='h-4 w-4 text-success' />
                    <span className='text-xs font-semibold text-ink-secondary'>
                      Community Examples
                    </span>
                  </div>
                )}
                {visibleExamples.map((answer, idx) => (
                  <ExampleAnswerCard
                    key={`${answer.id}-${idx}`}
                    answer={answer}
                    currentUserId={user?.id || null}
                    highlightTarget={hashTarget}
                    onStartReply={(payload) => {
                      setAnswerReplyTarget(payload);
                      setAnswerEditTarget(null);
                      setAnswerDraft('');
                      setAnswerEditBody('');
                      setIsComposing(true);
                    }}
                    onStartEdit={(payload) => {
                      setAnswerEditTarget({
                        answerId: payload.answerId,
                        commentId: payload.commentId,
                        parentContributorName: payload.parentContributorName,
                        parentIsReply: payload.parentIsReply,
                      });
                      setAnswerReplyTarget(null);
                      setAnswerEditBody(payload.body);
                      setAnswerDraft('');
                      setIsComposing(true);
                    }}
                    onAnswerChange={(updater) =>
                      setExampleAnswers((items) =>
                        items.map((item) =>
                          item.id === answer.id ? updater(item) : item,
                        ),
                      )
                    }
                    activeReplyTargetId={
                      answerReplyTarget?.answerId === answer.id ?
                        answerReplyTarget.parentCommentId || answer.id
                      : answerEditTarget?.answerId === answer.id ?
                        answerEditTarget.commentId
                      : null
                    }
                    onAnswerRemove={(answerId) =>
                      setExampleAnswers((items) =>
                        items.filter((item) => item.id !== answerId),
                      )
                    }
                    onToggleLike={async () => {
                      const nextValue =
                        answer.user_reaction === 'up' ? null : 'up';
                      const previous = answer;
                      setExampleAnswers((items) =>
                        items.map((item) =>
                          item.id === answer.id ?
                            {
                              ...item,
                              user_reaction: nextValue,
                              upvote_count:
                                item.upvote_count +
                                (item.user_reaction === 'up' ? -1 : 1),
                              reaction_count:
                                item.reaction_count +
                                (item.user_reaction === 'up' ? -1 : 1),
                            }
                          : item,
                        ),
                      );
                      try {
                        const updated = await api.updateQuestionAnswerReaction(
                          answer.id,
                          nextValue,
                        );
                        setExampleAnswers((items) =>
                          items.map((item) =>
                            item.id === answer.id ? updated : item,
                          ),
                        );
                      } catch {
                        setExampleAnswers((items) =>
                          items.map((item) =>
                            item.id === answer.id ? previous : item,
                          ),
                        );
                        showGlobalToast('Could not update like.');
                      }
                    }}
                  />
                ))}
              </div>
            )}
            {kind !== 'example' &&
              sortedComments.map((comment, idx) => (
                <div key={`${comment.id}-${idx}`}>
                  <CommentItem
                    comment={comment}
                    sessionPostedIds={sessionPostedIds}
                    highlightedCommentId={
                      highlightedCommentId || replyTo || editFor
                    }
                    onReplyTo={(target) => {
                      if (!replyTo && draft.trim()) {
                        setReply(draft);
                        setDraft('');
                      }
                      setReplyTo(target.id);
                      setEditFor(null);
                      setIsComposing(true);
                    }}
                    onEdit={(target) => {
                      setEditFor(target.id);
                      setReplyTo(null);
                      let originalBody = target.body;
                      const colonMatch = target.body.match(
                        /^Reply\s+([^:]+):\s*([\s\S]*)$/,
                      );
                      if (colonMatch) originalBody = colonMatch[2];
                      else {
                        const spaceMatch = target.body.match(
                          /^@([^\s:]+)\s+([\s\S]*)$/,
                        );
                        if (spaceMatch) originalBody = spaceMatch[2];
                      }
                      setEditBody(originalBody);
                      setIsComposing(true);
                      requestAnimationFrame(() =>
                        mainInputRef.current?.focus(),
                      );
                    }}
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
                    onEditReply={(replyItem) => {
                      setEditFor(replyItem.id);
                      setReplyTo(null);
                      let originalBody = replyItem.body;
                      const colonMatch = replyItem.body.match(
                        /^Reply\s+([^:]+):\s*([\s\S]*)$/,
                      );
                      if (colonMatch) originalBody = colonMatch[2];
                      else {
                        const spaceMatch = replyItem.body.match(
                          /^@([^\s:]+)\s+([\s\S]*)$/,
                        );
                        if (spaceMatch) originalBody = spaceMatch[2];
                      }
                      setEditBody(originalBody);
                      setIsComposing(true);
                      requestAnimationFrame(() =>
                        mainInputRef.current?.focus(),
                      );
                    }}
                  />
                </div>
              ))}
          </>
        }
        {!isLoading && kind !== 'example' && nextCursor && (
          <div ref={observerTarget} className='py-6 flex justify-center'>
            {isFetchingMore ?
              <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            : <div className='h-5 w-5' />}
          </div>
        )}
      </div>
      <div className='footer col relative z-10 w-full' ref={footerRef}>
        {isComposing &&
          !replyTo &&
          !editFor &&
          !answerReplyTarget &&
          !answerEditTarget && (
            <div className='mb-2 absolute -top-8 flex gap-1.5'>
              {kinds.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setDraftKind(value as CommentKind)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all',
                    draftKind === value ?
                      'bg-primary text-primary-foreground'
                    : 'bg-background-secondary text-ink-secondary/70 hover:text-ink-primary',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        <div
          onClick={() => {
            setIsComposing(true);
            mainInputRef.current?.focus();
          }}
          className={cn(
            ' border border-border bg-background-secondary/40  w-full  transition-all',
            isComposing ?
              'p-2 items-start col rounded-2xl'
            : 'rounded-3xl p-1.5  row items-center cursor-text',
          )}
        >
          <div className='row w-full'>
            <Avatar
              name={user?.display_name || 'You'}
              src={user?.avatar_url || undefined}
              size='md'
            />
            {isComposing && (
              <div className='flex-1 flex items-center justify-between pr-2'>
                <div className='flex items-center gap-1.5'>
                  <p className='text-[10px] text-ink-secondary/70'>
                    {editFor ?
                      'Edit comment...'
                    : answerEditTarget ?
                      'Edit reply...'
                    : replyTo ?
                      `Reply ${findComment(comments, replyTo)?.author_name || 'member'}:`
                    : answerReplyTarget ?
                      `Reply ${answerReplyTarget.parentContributorName || 'member'}:`
                    : 'Add a comment...'}
                  </p>
                </div>
                {(replyTo ||
                  editFor ||
                  answerReplyTarget ||
                  answerEditTarget) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editFor) setEditBody('');
                      else if (answerEditTarget) setAnswerEditBody('');
                      else if (replyTo) setReply('');
                      else if (answerReplyTarget) setAnswerDraft('');
                    }}
                    className='text-[10px] cursor-pointer font-semibold text-ink-secondary/50 hover:text-primary transition-colors'
                  >
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>
          {isComposing && (
            <Textarea
              ref={mainInputRef}
              value={
                editFor ? editBody
                : answerEditTarget ?
                  answerEditBody
                : answerReplyTarget ?
                  answerDraft
                : replyTo ?
                  reply
                : draft
              }
              onFocus={() => setIsComposing(true)}
              onChange={(event) => {
                if (editFor) setEditBody(event.target.value);
                else if (answerEditTarget)
                  setAnswerEditBody(event.target.value);
                else if (answerReplyTarget) setAnswerDraft(event.target.value);
                else if (replyTo) setReply(event.target.value);
                else setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (answerReplyTarget || answerEditTarget) {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void postAnswerComment();
                  }
                  return;
                }
                void submitOnEnter(event, replyTo || undefined);
              }}
              placeholder={'Enter to send · Shift+Enter for a new line'}
              rows={isComposing ? 3 : 1}
              minHeight={isComposing ? 72 : 36}
              showClearButton={false}
              className='min-h-6 flex-1 border-0 bg-transparent w-full text-ink-primary outline-none text-xs px-2 placeholder:text-[10px] placeholder:text-ink-secondary/20 p-0 shadow-none'
            />
          )}

          <div className='row justify-end w-full'>
            <button
              onClick={toggleVoice}
              aria-label={
                isListening ? 'Stop voice input' : 'Start voice input'
              }
              className={cn(
                'rounded-full p-1.5 transition-colors',
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
              onClick={() =>
                void (answerReplyTarget || answerEditTarget ?
                  postAnswerComment()
                : post(replyTo || undefined))
              }
              disabled={
                isSubmitting ||
                !(
                  editFor ? editBody
                  : answerEditTarget ? answerEditBody
                  : answerReplyTarget ? answerDraft
                  : replyTo ? reply
                  : draft).trim()
              }
              aria-label={
                editFor || answerEditTarget ? 'Save comment' : 'Send comment'
              }
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                (
                  (editFor ? editBody
                  : answerEditTarget ? answerEditBody
                  : answerReplyTarget ? answerDraft
                  : replyTo ? reply
                  : draft
                  ).trim()
                ) ?
                  'bg-primary text-primary-foreground shadow-sm'
                : 'bg-transparent text-ink-secondary/50',
                isSubmitting && 'cursor-wait opacity-70',
              )}
            >
              <ArrowUp className='h-3.5 w-3.5' />
            </button>
            {isComposing && (
              <p className='mt-1.5 px-1 absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-ink-secondary/70'></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExampleAnswerCard({
  answer,
  currentUserId,
  highlightTarget,
  onAnswerChange,
  activeReplyTargetId,
  onAnswerRemove,
  onToggleLike,
  onStartReply,
  onStartEdit,
}: {
  answer: QuestionAnswer;
  currentUserId: string | null;
  highlightTarget?: string | null;
  onAnswerChange: (updater: (answer: QuestionAnswer) => QuestionAnswer) => void;
  activeReplyTargetId?: string | null;
  onAnswerRemove: (answerId: string) => void;
  onToggleLike: () => Promise<void>;
  onStartReply: (payload: {
    answerId: string;
    parentCommentId?: string | null;
    parentContributorName?: string | null;
    parentIsReply?: boolean;
  }) => void;
  onStartEdit: (payload: {
    answerId: string;
    commentId: string;
    parentContributorName?: string | null;
    parentIsReply?: boolean;
    body: string;
  }) => void;
}) {
  const relativeTime = useRelativeTime(answer.created_at);
  const [comments, setComments] = useState<QuestionAnswerComment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const highlightedAnswerCommentId =
    highlightTarget?.startsWith('#answer-comment-') ?
      highlightTarget.slice('#answer-comment-'.length)
    : null;
  const isActiveTarget = activeReplyTargetId === answer.id;

  useEffect(() => {
    void api
      .questionAnswerComments(answer.id)
      .then((page) => setComments(page.items))
      .catch(() => undefined)
      .finally(() => setIsLoadingComments(false));
  }, [answer.id]);

  useEffect(() => {
    const onAnswerRealtime = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          answer_id?: string;
          actor_user_id?: string;
          event_type?: string;
          parent_comment_id?: string | null;
          comment?:
            | QuestionAnswerComment
            | {
                answer_id?: string;
                comment_id?: string;
                body?: string;
              };
        }>
      ).detail;
      if (detail?.answer_id !== answer.id) return;
      if (
        detail.event_type === 'answer.comment_created' &&
        detail.comment &&
        'id' in detail.comment
      ) {
        const createdComment = detail.comment;
        setComments((items) =>
          detail.parent_comment_id ?
            appendAnswerReply(items, detail.parent_comment_id, createdComment)
          : [createdComment, ...items],
        );
        return;
      }
      if (
        detail.event_type === 'answer.comment_updated' &&
        detail.comment &&
        'comment_id' in detail.comment &&
        typeof detail.comment.comment_id === 'string' &&
        typeof detail.comment.body === 'string'
      ) {
        const updatedCommentId = detail.comment.comment_id;
        const updatedBody = detail.comment.body;
        setComments((items) =>
          updateAnswerComment(items, updatedCommentId, (item) => ({
            ...item,
            body: updatedBody,
            updated_at: new Date().toISOString(),
          })),
        );
        return;
      }
      if (
        detail.actor_user_id &&
        currentUserId &&
        detail.actor_user_id === currentUserId &&
        detail.event_type === 'answer.comment_created'
      )
        return;
      void api
        .questionAnswerComments(answer.id)
        .then((page) => setComments(page.items))
        .catch(() => undefined);
    };
    window.addEventListener('jobby:answer-event', onAnswerRealtime);
    return () =>
      window.removeEventListener('jobby:answer-event', onAnswerRealtime);
  }, [answer.id, currentUserId]);

  useEffect(() => {
    if (!highlightTarget) return;
    const answerHash = `#answer-${answer.id}`;
    const commentPrefix = '#answer-comment-';
    const commentId =
      highlightTarget.startsWith(commentPrefix) ?
        highlightTarget.slice(commentPrefix.length)
      : null;
    if (highlightTarget !== answerHash && !commentId) return;

    const hasTargetComment =
      commentId ? hasAnswerComment(comments, commentId) : false;
    if (highlightTarget === answerHash || hasTargetComment) {
      setIsHighlighted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target =
            commentId ?
              document.getElementById(`answer-comment-${commentId}`)
            : document.getElementById(`answer-${answer.id}`);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      window.setTimeout(() => setIsHighlighted(false), 3000);
    }
  }, [answer.id, comments, highlightTarget]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const copyAnswer = async () => {
    await navigator.clipboard?.writeText(answer.body || '');
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1200);
  };

  const toggleSave = async () => {
    const previous = answer.is_saved;
    onAnswerChange((current) => ({ ...current, is_saved: !current.is_saved }));
    try {
      const result = await api.toggleQuestionAnswerSave(answer.id);
      onAnswerChange((current) => ({ ...current, is_saved: result.saved }));
    } catch {
      onAnswerChange((current) => ({ ...current, is_saved: previous }));
      showGlobalToast('Could not save answer.');
    }
  };

  const reportAnswer = async (reason: ReportReason) => {
    const previous = answer.is_reported;
    onAnswerChange((current) => ({ ...current, is_reported: true }));
    try {
      await api.reportQuestionAnswer(answer.id, reason);
      setMenuOpen(false);
      showGlobalToast('Report submitted.');
    } catch {
      onAnswerChange((current) => ({ ...current, is_reported: previous }));
      showGlobalToast('Could not submit report.');
    }
  };

  const removeAnswer = async () => {
    try {
      const updated = await api.updateQuestionAnswer(answer.id, {
        status: 'archived',
      });
      onAnswerChange(() => updated);
      onAnswerRemove(answer.id);
    } catch {
      showGlobalToast('Could not delete answer.');
    }
  };

  const likeComment = async (comment: QuestionAnswerComment) => {
    const previous = comment;
    setComments((items) =>
      updateAnswerComment(items, comment.id, (item) => ({
        ...item,
        is_liked: !item.is_liked,
        like_count: item.like_count + (item.is_liked ? -1 : 1),
      })),
    );
    try {
      const result = await api.toggleQuestionAnswerCommentLike(
        answer.id,
        comment.id,
      );
      setComments((items) =>
        updateAnswerComment(items, comment.id, (item) => ({
          ...item,
          is_liked: result.liked,
          like_count: result.like_count,
        })),
      );
    } catch {
      setComments((items) =>
        updateAnswerComment(items, comment.id, () => previous),
      );
      showGlobalToast('Could not update like.');
    }
  };

  const reportComment = async (
    comment: QuestionAnswerComment,
    reason: ReportReason,
  ) => {
    const previous = comment;
    setComments((items) =>
      updateAnswerComment(items, comment.id, (item) => ({
        ...item,
        is_reported: true,
      })),
    );
    try {
      await api.reportQuestionAnswerComment(answer.id, comment.id, reason);
      showGlobalToast('Report submitted.');
    } catch {
      setComments((items) =>
        updateAnswerComment(items, comment.id, () => previous),
      );
      showGlobalToast('Could not submit report.');
    }
  };

  const removeComment = async (commentId: string) => {
    const previous = comments;
    setComments((items) => removeAnswerComment(items, commentId));
    try {
      await api.deleteQuestionAnswerComment(answer.id, commentId);
      onAnswerChange((current) => ({
        ...current,
        comment_count: Math.max(0, current.comment_count - 1),
      }));
    } catch {
      setComments(previous);
      showGlobalToast('Could not delete reply.');
    }
  };

  return (
    <article
      id={`answer-${answer.id}`}
      className={cn('space-y-4 transition-colors duration-1000')}
    >
      <div
        className={cn(
          'group flex p-2 rounded-tl-2xl! rounded-xl  hover:bg-primary/5',
          (isHighlighted || isActiveTarget) && 'bg-primary/5',
        )}
      >
        <div className='flex justify-between gap-2.5 w-full'>
          <Avatar
            name={answer.author_name || 'Community'}
            src={answer.author_avatar_url || undefined}
            size='sm'
          />
          <div className='min-w-0 flex-1'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-[10px] font-bold text-ink-secondary/60'>
                {answer.author_name || 'Community Member'}
              </span>
              {answer.author_badge && (
                <span
                  className={cn(
                    'rounded-full px-1.5 border-1 py-0.5 text-[6px] font-extrabold uppercase tracking-wide',
                    answer.author_badge === 'Admin' ? 'border-info text-info '
                    : answer.author_badge === 'Contributor' ?
                      ' border-rose-500 text-rose-600'
                    : ' border-primary text-primary',
                  )}
                >
                  {answer.author_badge}
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide',
                  kindTag.example,
                )}
              >
                example
              </span>
              {answer.is_recommended && (
                <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-primary'>
                  <Crown className='h-3 w-3' />
                  Picked
                </span>
              )}
            </div>
            <button
              onClick={() =>
                onStartReply({
                  answerId: answer.id,
                  parentContributorName:
                    answer.author_name || 'Community member',
                })
              }
              className='mt-1 block w-full cursor-pointer whitespace-pre-wrap text-left text-sm text-ink-primary'
            >
              {answer.is_locked ?
                'AI answer locked. Unlock it from the Practice tab.'
              : answer.body}
            </button>
            <div className='mt-1.5 flex items-center gap-3'>
              <span className='text-[10px] text-ink-secondary/70'>
                {relativeTime}
              </span>
              <button
                onClick={() =>
                  onStartReply({
                    answerId: answer.id,
                    parentContributorName:
                      answer.author_name || 'Community member',
                  })
                }
                className='cursor-pointer text-[11px] font-bold text-ink-secondary/50 hover:text-primary'
              >
                Reply
              </button>
            </div>
          </div>
        </div>
        <div className='col justify-between'>
          <div ref={menuRef} className='relative ml-auto'>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                'rounded-full p-1 text-ink-secondary/70 opacity-0 transition-opacity hover:bg-background-secondary hover:text-ink-primary group-hover:opacity-100',
                menuOpen && 'opacity-100',
              )}
              aria-label='Answer actions'
            >
              <MoreHorizontal className='h-4 w-4' />
            </button>
            {menuOpen && (
              <div className='absolute right-0 top-7 z-20 w-40 rounded-xl border border-border bg-background-primary p-1 shadow-lg'>
                <button
                  onClick={() => void copyAnswer()}
                  className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary hover:bg-background-secondary'
                >
                  {isCopied ?
                    <Check className='h-3 w-3 text-emerald-500' />
                  : <Copy className='h-3 w-3' />}
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => void toggleSave()}
                  className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary hover:bg-background-secondary'
                >
                  <Bookmark
                    className={cn(
                      'h-3 w-3',
                      answer.is_saved && 'fill-current text-primary',
                    )}
                  />
                  {answer.is_saved ? 'Saved' : 'Save'}
                </button>
                {answer.can_manage && (
                  <button
                    onClick={() => void removeAnswer()}
                    className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-500/10'
                  >
                    <Trash2 className='h-3 w-3' />
                    Delete
                  </button>
                )}
                {!answer.can_manage && (
                  <>
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
                        onClick={() => void reportAnswer(value)}
                        disabled={answer.is_reported}
                        className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary/70 hover:bg-background-secondary disabled:opacity-50'
                      >
                        <Flag className='h-3 w-3' />
                        {label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => void onToggleLike()}
            className={cn(
              'flex cursor-pointer items-center gap-1 text-[11px] font-bold transition-colors',
              answer.user_reaction === 'up' ?
                'text-rose-500'
              : 'text-ink-secondary/70 hover:text-rose-500',
            )}
          >
            <Heart
              className={cn(
                'h-3.5 w-3.5',
                answer.user_reaction === 'up' && 'fill-current',
              )}
            />
            {answer.upvote_count || ''}
          </button>
        </div>
      </div>
      <div>
        {isLoadingComments ?
          <div className='text-xs text-ink-secondary/60'>
            Loading replies...
          </div>
        : comments.length === 0 ?
          null
        : <AnswerCommentReplies
            comments={comments}
            onStartReply={onStartReply}
            onStartEdit={onStartEdit}
            onLike={(comment) => void likeComment(comment)}
            onReport={(comment, reason) => void reportComment(comment, reason)}
            onDelete={(commentId) => void removeComment(commentId)}
            highlightedCommentId={
              highlightedAnswerCommentId ||
              (activeReplyTargetId && activeReplyTargetId !== answer.id ?
                activeReplyTargetId
              : null)
            }
          />
        }
      </div>
    </article>
  );
}

function AnswerCommentReplies({
  comments,
  ...props
}: {
  comments: QuestionAnswerComment[];
} & AnswerCommentHandlers) {
  return (
    <div className='pl-[38px] space-y-3'>
      {flattenAnswerComments(comments).map((comment) => (
        <AnswerCommentReply key={comment.id} comment={comment} {...props} />
      ))}
    </div>
  );
}

type AnswerCommentHandlers = {
  onStartReply: (payload: {
    answerId: string;
    parentCommentId?: string | null;
    parentContributorName?: string | null;
    parentIsReply?: boolean;
  }) => void;
  onStartEdit: (payload: {
    answerId: string;
    commentId: string;
    parentContributorName?: string | null;
    parentIsReply?: boolean;
    body: string;
  }) => void;
  onLike: (comment: QuestionAnswerComment) => void;
  onReport: (comment: QuestionAnswerComment, reason: ReportReason) => void;
  onDelete: (commentId: string) => void;
  highlightedCommentId?: string | null;
};

function AnswerCommentReply({
  comment,
  onStartReply,
  onStartEdit,
  onLike,
  onReport,
  onDelete,
  highlightedCommentId,
}: AnswerCommentHandlers & {
  comment: QuestionAnswerComment;
}) {
  const viewComment = asReplyView(comment);

  const startReply = (target: QuestionComment) => {
    onStartReply({
      answerId: comment.answer_id,
      parentCommentId: target.id,
      parentContributorName: target.author_name,
      parentIsReply: Boolean(target.parent_id),
    });
  };

  const startEdit = (target: QuestionComment) => {
    onStartEdit({
      answerId: comment.answer_id,
      commentId: target.id,
      parentContributorName: target.author_name,
      parentIsReply: Boolean(target.parent_id),
      body: replyBody(target.body),
    });
  };

  return (
    <ReplyItem
      replyItem={viewComment}
      idPrefix='answer-comment-'
      highlightedCommentId={highlightedCommentId || null}
      onReply={() => startReply(viewComment)}
      onLike={() => onLike(comment)}
      likePopped={false}
      onReport={(reason) => onReport(comment, reason)}
      onDelete={() => onDelete(comment.id)}
      onEdit={() => startEdit(viewComment)}
    />
  );
}

function asReplyView(comment: QuestionAnswerComment): QuestionComment {
  return {
    ...comment,
    question_id: comment.answer_id,
    kind: 'discussion',
    replies: [],
  };
}

function flattenAnswerComments(
  comments: QuestionAnswerComment[],
): QuestionAnswerComment[] {
  return comments.flatMap((comment) => [
    comment,
    ...flattenAnswerComments(comment.replies),
  ]);
}

function replyBody(body: string) {
  return body.match(/^Reply\s+([^:]+):\s*([\s\S]*)$/)?.[2] || body;
}

function hasAnswerComment(items: QuestionAnswerComment[], id: string): boolean {
  return items.some(
    (comment) => comment.id === id || hasAnswerComment(comment.replies, id),
  );
}

function updateAnswerComment(
  items: QuestionAnswerComment[],
  id: string,
  update: (comment: QuestionAnswerComment) => QuestionAnswerComment,
): QuestionAnswerComment[] {
  return items.map((comment) =>
    comment.id === id ?
      update(comment)
    : { ...comment, replies: updateAnswerComment(comment.replies, id, update) },
  );
}

function appendAnswerReply(
  items: QuestionAnswerComment[],
  parentId: string,
  reply: QuestionAnswerComment,
): QuestionAnswerComment[] {
  return items.map((comment) =>
    comment.id === parentId ?
      { ...comment, replies: [...comment.replies, reply] }
    : {
        ...comment,
        replies: appendAnswerReply(comment.replies, parentId, reply),
      },
  );
}

function removeAnswerComment(
  items: QuestionAnswerComment[],
  id: string,
): QuestionAnswerComment[] {
  return items
    .filter((comment) => comment.id !== id)
    .map((comment) => ({
      ...comment,
      replies: removeAnswerComment(comment.replies, id),
    }));
}
