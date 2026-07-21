/** @format */

'use client';

import { KeyboardEvent, useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, MessageCircle, Mic, Send, Square } from 'lucide-react';
import { api } from '@/lib/api';
import type { QuestionComment } from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useConsole } from '@/components/ConsoleContext';
import { EmptyState } from '@/components/UI/EmptyState';
import { Avatar } from './Avatar';
import { CommentItem } from './CommentItem';
import { CommentSkeleton } from './CommentSkeleton';
import {
  kinds,
  CommentKind,
  ReportReason,
  kindDot,
  updateComment,
  appendReply,
  findComment,
  removeComment,
} from './utils';

export function QuestionComments({ questionId }: { questionId: string }) {
  const { user } = useConsole();
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
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
  const recognitionRef = useRef<any>(null);
  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setIsComposing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const load = async (reset = true, showSkeleton = true) => {
    if (!reset && isFetchingMore) return;
    const startedAt = Date.now();
    if (showSkeleton) setIsLoading(true);
    if (!reset) setIsFetchingMore(true);
    try {
      const page = await api.questionComments(questionId, {
        kind: kind === 'all' ? undefined : kind,
        before: reset ? undefined : nextCursor || undefined,
      });
      const remaining = Math.max(0, 500 - (Date.now() - startedAt));
      if (remaining)
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setComments((items) => (reset ? page.items : [...items, ...page.items]));
      setNextCursor(page.next_cursor || null);
      setThreadId(page.question_id);
    } finally {
      if (showSkeleton) setIsLoading(false);
      if (!reset) setIsFetchingMore(false);
    }
  };
  useEffect(() => {
    setComments([]);
    setNextCursor(null);
    void load(true)
      .then(() => {
        if (window.location.hash) {
          setTimeout(() => {
            const id = window.location.hash.substring(1);
            const el = document.getElementById(id);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setHighlightedCommentId(id.replace('comment-', ''));
              setTimeout(() => setHighlightedCommentId(null), 3000);
            }
          }, 500);
        }
      })
      .catch(() => {
        setIsLoading(false);
        showGlobalToast('Could not load comments.');
      });
  }, [questionId, kind]);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash) {
        setTimeout(() => {
          const id = window.location.hash.substring(1);
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedCommentId(id.replace('comment-', ''));
            setTimeout(() => setHighlightedCommentId(null), 3000);
          }
        }, 100);
      }
    };

    // In Next.js App Router, hash changes don't always fire standard hashchange if it's pushed by router.
    // We listen to hashchange, but also the component will remount or re-render.
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{ question_id?: string }>).detail;
      if (threadId && detail?.question_id === threadId)
        void load(true, false).catch(() => undefined);
    };
    window.addEventListener('jobby:comment-event', onRealtime);
    return () => window.removeEventListener('jobby:comment-event', onRealtime);
  }, [questionId, kind, threadId]);

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
    if (replyTo) {
      requestAnimationFrame(() => {
        const input = mainInputRef.current;
        if (input) {
          input.focus();
          const length = input.value.length;
          input.setSelectionRange(length, length);
        }
      });
    }
  }, [replyTo]);

  const post = async (parentId?: string) => {
    if (editFor) {
      const rawBody = editBody.trim();
      if (!rawBody) return;

      const targetComment = findComment(comments, editFor);
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
        const saved = await api.updateQuestionComment(questionId, editFor, {
          body: rawBody,
        });
        setComments((items) => updateComment(items, editFor, () => saved));
      } catch {
        setComments((items) => updateComment(items, editFor, () => previous));
        showGlobalToast('Could not edit comment.');
      }
      return;
    }

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
      author_name: 'You',
      author_avatar_url: null,
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
      const saved = await api.createQuestionComment(questionId, {
        kind: optimistic.kind,
        body: rawBody,
        parent_id: parentId,
      });
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
      setTimeout(() => {
        const el = document.getElementById(`comment-${saved.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
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
    setComments((items) => removeComment(items, commentId));
    try {
      await api.deleteQuestionComment(questionId, commentId);
    } catch {
      setComments(previous);
      showGlobalToast('Could not delete comment.');
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

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      const aNew = sessionPostedIds.has(a.id) ? 1 : 0;
      const bNew = sessionPostedIds.has(b.id) ? 1 : 0;
      if (aNew !== bNew) return bNew - aNew;

      const aBase = a.like_count - (a.is_liked ? 1 : 0);
      const bBase = b.like_count - (b.is_liked ? 1 : 0);
      if (aBase !== bBase) return bBase - aBase;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [comments]);

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
            {comments.length}
            {nextCursor ? '+' : ''} comments
          </span>
        )}
      </div>
      <div className='body'>
        {isLoading ?
          <CommentSkeleton />
        : sortedComments.length === 0 ?
          <EmptyState
            icon={MessageCircle}
            title='No comments yet'
            description='Be the first to start the conversation.'
          />
        : <AnimatePresence initial={false}>
            {sortedComments.map((comment) => (
              <motion.div
                key={comment.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <CommentItem
                  comment={comment}
                  sessionPostedIds={sessionPostedIds}
                  highlightedCommentId={
                    highlightedCommentId || replyTo || editFor
                  }
                  onReplyTo={(target) => {
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
                    requestAnimationFrame(() => mainInputRef.current?.focus());
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
                    requestAnimationFrame(() => mainInputRef.current?.focus());
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        }
        {!isLoading && nextCursor && (
          <div ref={observerTarget} className='py-6 flex justify-center'>
            {isFetchingMore ?
              <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            : <div className='h-5 w-5' />}
          </div>
        )}
      </div>
      <div className='footer col relative z-10 w-full' ref={footerRef}>
        {isComposing && (
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
            : 'rounded-3xl p-1  row items-center cursor-text',
          )}
        >
          <div className='row w-full'>
            <Avatar
              name={user?.display_name || 'You'}
              url={user?.avatar_url}
              small
            />
            {isComposing && (
              <div className='flex-1 flex items-center justify-between pr-2'>
                <p className='text-[10px] text-ink-secondary/70'>
                  {editFor ?
                    'Edit comment...'
                  : replyTo ?
                    `Reply ${findComment(comments, replyTo)?.author_name || 'member'}:`
                  : 'Add a comment...'}
                </p>
                {(replyTo || editFor) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplyTo(null);
                      setReply('');
                      setEditFor(null);
                      setEditBody('');
                    }}
                    className='text-[10px] font-semibold text-ink-secondary/50 hover:text-ink-primary transition-colors'
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
          {isComposing && (
            <textarea
              ref={mainInputRef}
              value={
                editFor ? editBody
                : replyTo ?
                  reply
                : draft
              }
              onFocus={() => setIsComposing(true)}
              onChange={(event) => {
                if (editFor) setEditBody(event.target.value);
                else if (replyTo) setReply(event.target.value);
                else setDraft(event.target.value);
              }}
              onKeyDown={(event) => submitOnEnter(event, replyTo || undefined)}
              placeholder={'Enter to send · Shift+Enter for a new line'}
              rows={isComposing ? 3 : 1}
              className='min-h-6 flex-1 resize-none bg-transparent w-full text-ink-primary outline-none text-xs px-2  placeholder:text-[10px] placeholder:text-ink-secondary/20'
            />
          )}

          <div className='row justify-end w-full'>
            <button
              onClick={toggleVoice}
              aria-label={
                isListening ? 'Stop voice input' : 'Start voice input'
              }
              className={cn(
                'mb-0.5 rounded-full p-1.5 transition-colors',
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
              onClick={() => void post(replyTo || undefined)}
              disabled={
                !(
                  editFor ? editBody
                  : replyTo ? reply
                  : draft).trim()
              }
              aria-label={editFor ? 'Save comment' : 'Send comment'}
              className={cn(
                'mb-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-all',
                (
                  (editFor ? editBody
                  : replyTo ? reply
                  : draft
                  ).trim()
                ) ?
                  'bg-primary text-primary-foreground shadow-sm'
                : 'bg-transparent text-ink-secondary/50',
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
