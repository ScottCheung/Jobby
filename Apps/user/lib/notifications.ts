import { useLayoutStore } from '@/lib/store/layout-store'
export type { Notification, NotificationType } from '@/lib/store/layout-store'

// Re-export hook for components that might use it (like Toaster)
// But we should update Toaster to use useLayoutStore directly or provide a compatibility hook if needed.
// For now, we will remove useNotificationStore and expect Toaster to be updated.

export const notify = {
    success: (message: string, title?: string) =>
        useLayoutStore.getState().actions.addNotification({ type: 'success', message, title }),
    error: (message: string, title?: string) =>
        useLayoutStore.getState().actions.addNotification({ type: 'error', message, title }),
    info: (message: string, title?: string) =>
        useLayoutStore.getState().actions.addNotification({ type: 'info', message, title }),
    warning: (message: string, title?: string) =>
        useLayoutStore.getState().actions.addNotification({ type: 'warning', message, title }),
}
