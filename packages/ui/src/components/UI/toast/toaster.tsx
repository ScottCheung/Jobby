/** @format */

'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast, removeToast } from './toast-store';

export function Toaster({ className }: { className?: string }) {
  const notification = useToast();

  React.useEffect(() => {
    if (!notification) return;
    const duration = notification.duration ?? 2500;
    const timeout = window.setTimeout(() => {
      removeToast(notification.id);
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.id}
          initial={{
            opacity: 0,
            scale: 0.9,
            y: 8,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.9,
            y: -6,
          }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className={className}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 24px',
              minHeight: '44px',
              boxSizing: 'border-box',
              backgroundColor: '#09090b',
              color: '#ffffff',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow:
                '0 20px 40px -8px rgba(0, 0, 0, 0.85), 0 6px 16px rgba(0, 0, 0, 0.6)',
              maxWidth: 'calc(100vw - 32px)',
              width: 'max-content',
              userSelect: 'none',
            }}
          >
            {/* {notification.type === 'success' && (
              <CheckCircle2
                style={{
                  width: '18px',
                  height: '18px',
                  color: '#10b981',
                  flexShrink: 0,
                }}
              />
            )}
            {notification.type === 'error' && (
              <XCircle
                style={{
                  width: '18px',
                  height: '18px',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              />
            )}
            {notification.type === 'warning' && (
              <AlertTriangle
                style={{
                  width: '18px',
                  height: '18px',
                  color: '#f59e0b',
                  flexShrink: 0,
                }}
              />
            )}
            {notification.type === 'info' && (
              <Info
                style={{
                  width: '18px',
                  height: '18px',
                  color: '#38bdf8',
                  flexShrink: 0,
                }}
              />
            )} */}
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                fontFamily:
                  'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: '#ffffff',
                lineHeight: '1.4',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {notification.message}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
