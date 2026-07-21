/** @format */

'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

import { useLayoutStore } from '@/lib/store/layout-store';
import { cn } from '@/lib/utils';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

export function Toaster() {
  const notification = useLayoutStore((state) => state.notification);
  const removeNotification = useLayoutStore(
    (state) => state.actions.removeNotification,
  );
  const Icon =
    notification && notification.type !== 'info' ?
      icons[notification.type]
    : null;

  React.useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => {
      removeNotification(notification.id);
    }, notification.duration ?? 1500);
    return () => window.clearTimeout(timeout);
  }, [notification, removeNotification]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.id}
          initial={{
            opacity: 0,
            y: 10,
            scale: 0.99,
            backdropFilter: 'blur(0px)',
          }}
          animate={{ opacity: 1, y: 0, scale: 1, backdropFilter: 'blur(8px)' }}
          exit={{ opacity: 0, y: 10, scale: 0.99, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.18 }}
          className='fixed bottom-1/2 left-1/2 z-50 -translate-x-1/2 rounded-card -translate-y-1/2 overflow-hidden'
        >
          <div
            className={cn(
              'label-sm flex items-center gap-3 px-card py-3',
              'bg-black/50 text-white',
              // notification.type === 'error' && 'bg-red-500/30 text-error',
              // notification.type === 'success' && 'bg-emerald-500/25 text-white',
              // notification.type === 'warning' && 'bg-amber-500/25 text-white',
              // notification.type === 'info' && 'bg-black/50 text-white',
            )}
          >
            {/* {Icon && <Icon className='h-4 w-4 shrink-0' />} */}
            <span className='max-w-[70vw] whitespace-pre-wrap text-center text-white'>
              {notification.message}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
