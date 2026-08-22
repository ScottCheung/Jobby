/** @format */

import * as React from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

let activeToast: ToastItem | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function showToast(toast: Omit<ToastItem, 'id'> | string) {
  const item: ToastItem =
    typeof toast === 'string'
      ? {
          id: Math.random().toString(36).substring(7),
          type: 'info',
          message: toast,
          duration: 1200,
        }
      : {
          id: Math.random().toString(36).substring(7),
          type: toast.type || 'info',
          message: toast.message,
          title: toast.title,
          duration: toast.duration ?? 1200,
        };

  activeToast = item;
  notifyListeners();
}

export function removeToast(id?: string) {
  if (!id || activeToast?.id === id) {
    activeToast = null;
    notifyListeners();
  }
}

export function useToast(): ToastItem | null {
  return React.useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => activeToast,
    () => null,
  );
}

export function showGlobalToast(message: string, duration = 1200) {
  showToast({ type: 'info', message, duration });
}

export const notify = {
  success: (message: string, title?: string, duration = 1200) =>
    showToast({ type: 'success', message, title, duration }),
  error: (message: string, title?: string, duration = 1800) =>
    showToast({ type: 'error', message, title, duration }),
  info: (message: string, title?: string, duration = 1200) =>
    showToast({ type: 'info', message, title, duration }),
  warning: (message: string, title?: string, duration = 1500) =>
    showToast({ type: 'warning', message, title, duration }),
};
