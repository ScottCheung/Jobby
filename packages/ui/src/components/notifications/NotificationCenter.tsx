/** @format */

'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  PackageOpen,
  AlertCircle,
  MessageSquare,
  Edit3,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { UserNotification } from '@/lib/types';
import { useLayoutStore } from '@/lib/store/layout-store';
import { showGlobalToast } from '@/lib/toast';
import { useRelativeTime } from '@/lib/use-relative-time';
import { cn } from '@/lib/utils';
import { useConsole } from '@/components/ConsoleContext';
import { Avatar } from '../UI/Avatar/Avatar';
import { EmptyPlaceHolder } from '../UI/EmptyPlaceHolder';

const notificationIcons = {
  comment_reply: MessageCircle,
  comment_like: Heart,
  answer_reply: MessageCircle,
  answer_comment_reply: MessageCircle,
  answer_like: Heart,
  answer_comment_like: Heart,
  collection_updated: PackageOpen,
  collection_archived: PackageOpen,
  question_feedback: AlertCircle,
} as const;

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const { user } = useConsole();
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const load = async () => setNotifications(await api.notifications());
  useEffect(() => {
    void load().catch(() => undefined);
    const refresh = (event: Event) => {
      const recipientId = (event as CustomEvent<{ user_id?: string }>).detail
        ?.user_id;
      if (!recipientId || recipientId === user?.id)
        void load().catch(() => undefined);
    };
    window.addEventListener('jobby:notification-event', refresh);
    return () =>
      window.removeEventListener('jobby:notification-event', refresh);
  }, [user?.id]);
  const unread = notifications.filter((item) => !item.read_at).length;
  return (
    <button
      onClick={() =>
        openDrawer({
          id: 'notification-center',
          width: 420,
          content: (
            <NotificationDrawer
              notifications={notifications}
              onChanged={load}
              userId={user?.id}
            />
          ),
        })
      }
      className='label inline-flex items-center relative cursor-pointer group justify-center text-ink-secondary hover:text-ink-primary rounded-md p-2 transition-colors hover:bg-primary/10'
      aria-label='Open notifications'
    >
      <Bell className='h-5 w-5 group-hover:rotate-0 rotate-18 transition-all' />
      {unread > 0 && (
        <span className='absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white'>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

function NotificationDrawer({
  notifications,
  onChanged,
  userId,
}: {
  notifications: UserNotification[];
  onChanged: () => Promise<void>;
  userId?: string;
}) {
  const router = useRouter();
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);
  const [items, setItems] = useState(notifications);
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'all' | 'likes' | 'comments' | 'system'
  >('all');

  useEffect(() => setItems(notifications), [notifications]);
  useEffect(() => {
    const refresh = async (event: Event) => {
      const recipientId = (event as CustomEvent<{ user_id?: string }>).detail
        ?.user_id;
      if (recipientId && recipientId !== userId) return;
      setItems(await api.notifications());
    };
    window.addEventListener('jobby:notification-event', refresh);
    return () =>
      window.removeEventListener('jobby:notification-event', refresh);
  }, [userId]);

  const markAll = async () => {
    await api.markAllNotificationsRead();
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: new Date().toISOString() })),
    );
    await onChanged();
  };

  const loadHistory = async () => {
    if (isLoadingHistory || !hasMoreHistory) return;
    setIsLoadingHistory(true);
    const page = await api.notifications({
      unreadOnly: false,
      limit: 15,
      before: historyCursor || undefined,
    });
    setItems((current) => [
      ...new Map([...current, ...page].map((item) => [item.id, item])).values(),
    ]);
    setHistoryCursor(page.at(-1)?.created_at || null);
    setHasMoreHistory(page.length === 15);
    setHasLoadedHistory(true);
    setIsLoadingHistory(false);
  };

  const openViewComment = async (item: UserNotification) => {
    if (!item.read_at) {
      await api.markNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ?
            { ...entry, read_at: new Date().toISOString() }
          : entry,
        ),
      );
      void onChanged();
    }

    if (!item.question_id && !item.action_url) {
      setUnavailableIds((current) => new Set(current).add(item.id));
      showGlobalToast('This notification is no longer available.');
      return;
    }

    closeDrawer();
    let targetUrl =
      item.question_id ?
        `/interview-prep/practice/${item.question_id}?mode=free&shuffle=0&tab=comment`
      : item.action_url || '';

    if (
      typeof item.metadata?.answer_id === 'string' &&
      typeof item.metadata?.comment_id === 'string' &&
      !targetUrl.includes('#')
    ) {
      targetUrl += `#answer-comment-${item.metadata.comment_id}`;
    } else if (
      typeof item.metadata?.answer_id === 'string' &&
      !targetUrl.includes('#')
    ) {
      targetUrl += `#answer-${item.metadata.answer_id}`;
    } else if (item.metadata?.comment_id && !targetUrl.includes('#')) {
      targetUrl += `#comment-${item.metadata.comment_id}`;
    }

    router.push(targetUrl);
    setTimeout(() => {
      window.dispatchEvent(new Event('hashchange'));
    }, 300);

    if (targetUrl.includes('#')) {
      const available = await verifyNotificationTarget(targetUrl);
      if (!available) {
        setUnavailableIds((current) => new Set(current).add(item.id));
      }
    }
  };

  const openEditQuestion = async (item: UserNotification) => {
    if (!item.read_at) {
      await api.markNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ?
            { ...entry, read_at: new Date().toISOString() }
          : entry,
        ),
      );
      void onChanged();
    }

    if (!item.question_id) return;
    closeDrawer();
    router.push(`/interview-prep/library?edit=${item.question_id}`);
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'likes')
      return (
        item.kind === 'comment_like' ||
        item.kind === 'answer_like' ||
        item.kind === 'answer_comment_like'
      );
    if (activeTab === 'comments')
      return (
        item.kind === 'comment_reply' ||
        item.kind === 'answer_reply' ||
        item.kind === 'answer_comment_reply'
      );
    if (activeTab === 'system')
      return ![
        'comment_like',
        'comment_reply',
        'answer_like',
        'answer_reply',
        'answer_comment_reply',
        'answer_comment_like',
      ].includes(item.kind);
    return true;
  });

  return (
    <div className='min-h-full p-5 flex flex-col'>
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-sm font-semibold text-ink-primary'>
            Notifications
          </p>
          <p className='mt-1 text-xs text-ink-secondary'>
            Updates that need your attention.
          </p>
        </div>
        <button
          onClick={() => void markAll()}
          disabled={!items.some((item) => !item.read_at)}
          className='flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary disabled:opacity-40'
        >
          <CheckCheck className='h-4 w-4' />
          Mark all read
        </button>
      </div>

      <div className='flex gap-2 mt-4 bg-background-secondary p-1 rounded-xl shrink-0'>
        {[
          { id: 'all', label: 'All' },
          { id: 'likes', label: 'Likes' },
          { id: 'comments', label: 'Comments' },
          { id: 'system', label: 'System' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'label inline-flex items-center cursor-pointer group justify-center text-ink-secondary hover:text-ink-primary rounded-md p-2 transition-colors hover:bg-primary/10',
              activeTab === tab.id ?
                'bg-panel shadow-sm text-ink-primary'
              : 'text-ink-secondary hover:text-ink-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className='mt-4 space-y-1 overflow-y-auto flex-1 min-h-0 -mx-2 px-2'
        onScroll={(event) => {
          const node = event.currentTarget;
          if (
            hasLoadedHistory &&
            hasMoreHistory &&
            node.scrollTop + node.clientHeight >= node.scrollHeight - 48
          ) {
            void loadHistory();
          }
        }}
      >
        {filteredItems.length === 0 ?
          <EmptyPlaceHolder
            icon={Bell}
            message='No notifications yet.'
            className='border-0 bg-transparent py-10'
          />
        : filteredItems.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              isUnavailable={unavailableIds.has(item.id)}
              onOpenViewComment={() => void openViewComment(item)}
              onOpenEditQuestion={
                item.question_id && item.kind === 'question_feedback' ?
                  () => void openEditQuestion(item)
                : undefined
              }
            />
          ))
        }
      </div>
      {!hasLoadedHistory && (
        <button
          type='button'
          onClick={() => void loadHistory()}
          className='mt-3 text-xs font-semibold text-primary hover:text-primary-hover'
        >
          Load previous notifications
        </button>
      )}
      {isLoadingHistory && (
        <p className='mt-3 text-center text-xs text-ink-secondary'>
          Loading...
        </p>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  isUnavailable,
  onOpenViewComment,
  onOpenEditQuestion,
}: {
  item: UserNotification;
  isUnavailable: boolean;
  onOpenViewComment: () => void;
  onOpenEditQuestion?: () => void;
}) {
  const relative = useRelativeTime(item.created_at);
  const metadata = item.metadata || {};
  const actorName =
    typeof metadata.actor_name === 'string' ? metadata.actor_name : 'Someone';
  const actorAvatar =
    typeof metadata.actor_avatar_url === 'string' ?
      metadata.actor_avatar_url
    : null;
  const actorBadge =
    typeof metadata.actor_badge === 'string' ? metadata.actor_badge : '';
  const parentBody =
    typeof metadata.parent_body === 'string' ? metadata.parent_body : '';
  const rawCommentBody =
    typeof metadata.comment_body === 'string' ? metadata.comment_body : '';
  const commentBody = stripReplyPrefix(rawCommentBody);
  const questionTitle =
    typeof metadata.question_title === 'string' ? metadata.question_title : '';
  return (
    <div
      onClick={onOpenViewComment}
      className={cn(
        'group relative flex w-full cursor-pointer gap-3 border-b rounded-tl-2xl! rounded-br-2xl! rounded-lg border-border/50 p-3 pr-4 text-left transition hover:bg-background-secondary/50',
        !item.read_at && 'bg-primary/5',
      )}
    >
      <div className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary '>
        {actorAvatar ?
          <img
            src={actorAvatar}
            alt=''
            className='h-full w-full object-cover'
          />
        : <Avatar src='' name={actorName} />}
      </div>
      <div className='min-w-0 flex-1 flex flex-col justify-between'>
        <div>
          <div className='flex items-center justify-between gap-2'>
            <p className='flex items-center gap-1.5 text-xs font-semibold text-ink-primary'>
              {actorName}
              {actorBadge && (
                <span className='rounded-full border border-primary/30 px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary'>
                  {actorBadge}
                </span>
              )}
              {isUnavailable && (
                <span className='rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-700'>
                  Deleted
                </span>
              )}
            </p>
            {!item.read_at && (
              <span className='h-2 w-2 shrink-0 rounded-full bg-primary' />
            )}
          </div>
          <p className='mt-1 text-xs text-ink-secondary'>
            {item.kind === 'question_feedback' ?
              'submitted feedback'
            : item.kind === 'comment_like' ?
              'liked your comment'
            : item.kind === 'comment_reply' ?
              'replied to your comment'
            : item.kind === 'answer_like' ?
              'liked your answer'
            : item.kind === 'answer_reply' ?
              'replied to your answer'
            : item.kind === 'answer_comment_like' ?
              'liked your reply'
            : item.kind === 'answer_comment_reply' ?
              'replied to your reply'
            : item.title || 'sent an update'}{' '}
            · {relative}
          </p>
          {(commentBody || item.message) && (
            <p className='mt-2 text-xs font-medium leading-relaxed text-ink-primary bg-background-secondary/40 p-2 rounded-lg border border-border/40'>
              {commentBody || item.message}
            </p>
          )}
          {parentBody && (
            <p className='mt-2 border-l-2 border-primary/40 pl-2 text-xs leading-5 text-ink-secondary italic'>
              {parentBody}
            </p>
          )}
          {questionTitle && (
            <p className='mt-2 truncate text-[11px] font-medium text-ink-secondary flex items-center gap-1'>
              <span className='text-primary font-semibold'>Question ·</span>{' '}
              {questionTitle}
            </p>
          )}
        </div>

        {/* Action Buttons Row */}
        {item.question_id && (
          <div className='mt-3 flex items-center gap-2 pt-2 border-t border-border/30'>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewComment();
              }}
              className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold transition-colors cursor-pointer'
            >
              <MessageSquare className='w-3.5 h-3.5' />
              <span>View Comment</span>
            </button>

            {onOpenEditQuestion && (
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEditQuestion();
                }}
                className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-[11px] font-semibold transition-colors cursor-pointer'
              >
                <Edit3 className='w-3.5 h-3.5' />
                <span>Edit Question</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function stripReplyPrefix(body: string): string {
  const match = body.match(/^Reply\s+[^:]+:\s*([\s\S]*)$/);
  return match ? match[1] : body;
}

async function verifyNotificationTarget(url: string): Promise<boolean> {
  const hashIndex = url.indexOf('#');
  if (hashIndex < 0) return true;
  const targetId = url.slice(hashIndex + 1);
  if (!targetId) return true;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    if (document.getElementById(targetId)) return true;
  }

  showGlobalToast('This related content was deleted.');
  return false;
}
