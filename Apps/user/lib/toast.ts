/** @format */

'use client';

import { useLayoutStore } from '@/lib/store/layout-store';

export function showGlobalToast(message: string, duration = 4000) {
  useLayoutStore.getState().actions.addNotification({
    type: 'info',
    message,
    duration,
  });
}
