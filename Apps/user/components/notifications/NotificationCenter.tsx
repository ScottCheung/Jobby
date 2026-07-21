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
import { useRelativeTime } from '@/lib/use-relative-time';
import { cn } from '@/lib/utils';
import { useConsole } from '@/components/ConsoleContext';

const notificationIcons = {
  comment_reply: MessageCircle,
  comment_like: Heart,
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
      className='relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink-secondary transition hover:bg-background-secondary hover:text-ink-primary'
      aria-label='Open notifications'
    >
      <Bell className='h-5 w-5' />
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
    if (item.action_url) {
      closeDrawer();
      let finalUrl = item.action_url;
      if (item.metadata?.comment_id && !finalUrl.includes('#')) {
        finalUrl += `#comment-${item.metadata.comment_id}`;
      }
      router.push(finalUrl);
      setTimeout(() => {
        window.dispatchEvent(new Event('hashchange'));
      }, 300);
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'likes') return item.kind === 'comment_like';
    if (activeTab === 'comments') return item.kind === 'comment_reply';
    if (activeTab === 'system')
      return item.kind !== 'comment_like' && item.kind !== 'comment_reply';
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

      <div className='mt-4 space-y-1 overflow-y-auto flex-1 min-h-0 -mx-2 px-2'>
        {filteredItems.length === 0 ?
          <div className='py-16 text-center text-sm text-ink-secondary'>
            No notifications yet.
          </div>
        : filteredItems.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onOpen={() => void open(item)}
            />
          ))
        }
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  onOpen,
}: {
  item: UserNotification;
  onOpen: () => void;
}) {
  const Icon =
    notificationIcons[item.kind as keyof typeof notificationIcons] || Bell;
  const relative = useRelativeTime(item.created_at);
  return (
    <button
      onClick={onOpen}
      className={cn(
        'flex w-full cursor-pointer gap-3 rounded-xl p-3 text-left transition hover:bg-background-secondary',
        !item.read_at && 'bg-primary/5',
      )}
    >
      <div className='mt-0.5 rounded-full bg-primary/10 p-2 text-primary shrink-0'>
        <Icon className='h-4 w-4' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2'>
          <p className='truncate text-sm font-semibold text-ink-primary'>
            {item.title || 'Update'}
          </p>
          {!item.read_at && (
            <span className='h-2 w-2 shrink-0 rounded-full bg-primary' />
          )}
        </div>
        <p className='mt-1 text-xs leading-5 text-ink-secondary'>
          {item.message}
        </p>
        <p className='mt-1 text-[10px] text-ink-secondary'>{relative}</p>
      </div>
    </button>
  );
}
