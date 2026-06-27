/** @format */

'use client';

import { useToastStore } from '@/lib/store/toast-store';

let toastTimer: number | null = null;

export function showGlobalToast(message: string, duration = 2600) {
  const { setMessage, clearMessage } = useToastStore.getState();

  setMessage(message);

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    clearMessage();
    toastTimer = null;
  }, duration);
}
