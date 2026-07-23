/** @format */

'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  PackageOpen,
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

const notificationIcons = {
  comment_reply: MessageCircle,
  comment_like: Heart,
  answer_reply: MessageCircle,
  answer_comment_reply: MessageCircle,
  answer_like: Heart,
  answer_comment_like: Heart,
  collection_updated: PackageOpen,
  collection_archived: PackageOpen,
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

  const open = async (item: UserNotification) => {
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
    const targetUrl =
      item.action_url ||
      (item.question_id ?
        `/interview-prep/practice/${item.question_id}?mode=free&tab=comment`
      : null);
    if (targetUrl) {
      closeDrawer();
      let finalUrl = targetUrl;
      if (
        typeof item.metadata?.answer_id === 'string' &&
        typeof item.metadata?.comment_id === 'string' &&
        !finalUrl.includes('#')
      ) {
        finalUrl += `#answer-comment-${item.metadata.comment_id}`;
      } else if (
        typeof item.metadata?.answer_id === 'string' &&
        !finalUrl.includes('#')
      ) {
        finalUrl += `#answer-${item.metadata.answer_id}`;
      } else if (item.metadata?.comment_id && !finalUrl.includes('#')) {
        finalUrl += `#comment-${item.metadata.comment_id}`;
      }
      router.push(finalUrl);
      setTimeout(() => {
        window.dispatchEvent(new Event('hashchange'));
      }, 300);
      if (finalUrl.includes('#')) {
        const available = await verifyNotificationTarget(finalUrl);
        if (!available) {
          setUnavailableIds((current) => new Set(current).add(item.id));
        }
      }
    } else {
      setUnavailableIds((current) => new Set(current).add(item.id));
      showGlobalToast('This notification is no longer available.');
    }
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
          <div className='py-16 text-center text-sm text-ink-secondary'>
            No notifications yet.
          </div>
        : filteredItems.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              isUnavailable={unavailableIds.has(item.id)}
              onOpen={() => void open(item)}
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
  onOpen,
}: {
  item: UserNotification;
  isUnavailable: boolean;
  onOpen: () => void;
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
    <button
      onClick={onOpen}
      className={cn(
        'flex w-full cursor-pointer gap-3 border-b rounded-tl-2xl! rounded-br-2xl!  rounded-lg  border-border/50 p-2 pr-6! pb-6! text-left transition hover:bg-background-secondary/50',
        !item.read_at && 'bg-primary/5',
      )}
    >
      <div className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary'>
        {actorAvatar ?
          <img
            src={actorAvatar}
            alt=''
            className='h-full w-full object-cover'
          />
        : <Avatar src='' name={actorName} />}
      </div>
      <div className='min-w-0 flex-1'>
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
          {item.kind === 'comment_like' ?
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
        {commentBody && (
          <p className='mt-2 text-sm font-semibold leading-5 text-ink-primary'>
            {(
              [
                'comment_reply',
                'answer_reply',
                'answer_comment_reply',
                'comment_like',
                'answer_comment_like',
              ].includes(item.kind)
            ) ?
              commentBody
            : ''}
          </p>
        )}
        {parentBody && (
          <p className='mt-2 border-l-3 border-primary/40 pl-2 text-xs leading-5 text-ink-secondary'>
            {parentBody}
          </p>
        )}
        {questionTitle && (
          <p className='mt-2 truncate text-[10px] font-medium text-ink-secondary'>
            Question · {questionTitle}
          </p>
        )}
        {!commentBody && (
          <p className='mt-1 text-xs leading-5 text-ink-secondary whitespace-pre-line'>
            {item.message}
          </p>
        )}
      </div>
    </button>
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
