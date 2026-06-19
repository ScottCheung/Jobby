import { create } from 'zustand';
import type { ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
}

interface LayoutState {
  isSidebarCollapsed: boolean;
  notifications: Notification[];
  isDrawerOpen: boolean;
  drawerConfig: {
    width: number | string;
    content: ReactNode;
  };
  actions: {
    toggleSidebar: () => void;
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
    openDrawer: (config: { width?: number | string; content: ReactNode }) => void;
    closeDrawer: () => void;
  };
}

export const useLayoutStore = create<LayoutState>()((set) => ({
  isSidebarCollapsed: true,
  notifications: [],
  isDrawerOpen: false,
  drawerConfig: {
    width: 400,
    content: null,
  },
  actions: {
    toggleSidebar: () =>
      set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    addNotification: (notification) =>
      set((state) => ({
        notifications: [
          ...state.notifications,
          { ...notification, id: Math.random().toString(36).substring(7) },
        ],
      })),
    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
    openDrawer: (config) =>
      set(() => ({
        isDrawerOpen: true,
        drawerConfig: {
          width: config.width ?? 400,
          content: config.content,
        },
      })),
    closeDrawer: () =>
      set(() => ({
        isDrawerOpen: false,
      })),
  },
}));
