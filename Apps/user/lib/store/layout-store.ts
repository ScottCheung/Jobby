import { create } from 'zustand';
import type { ReactNode } from 'react';
import type {
  CelebrationEventKey,
  CelebrationStyleConfig,
  CelebrationType,
} from '@/lib/celebration-config';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
}

export interface Celebration {
  id: string;
  message?: string;
  duration?: number;
  type?: CelebrationType;
  eventKey?: CelebrationEventKey;
  style?: CelebrationStyleConfig;
}

interface LayoutState {
  isSidebarCollapsed: boolean;
  notification: Notification | null;
  celebration: Celebration | null;
  isDrawerOpen: boolean;
  drawerConfig: {
    width: number | string;
    content: ReactNode;
    id?: string;
  };
  actions: {
    toggleSidebar: () => void;
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
    triggerCelebration: (celebration?: Omit<Celebration, 'id'>) => void;
    clearCelebration: () => void;
    openDrawer: (config: { width?: number | string; content: ReactNode; id?: string }) => void;
    closeDrawer: () => void;
  };
}

export const useLayoutStore = create<LayoutState>()((set) => ({
  isSidebarCollapsed: true,
  notification: null,
  celebration: null,
  isDrawerOpen: false,
  drawerConfig: {
    width: 400,
    content: null,
    id: undefined,
  },
  actions: {
    toggleSidebar: () =>
      set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    addNotification: (notification) =>
      set(() => ({
        notification: {
          ...notification,
          id: Math.random().toString(36).substring(7),
        },
      })),
    removeNotification: (id) =>
      set((state) => ({
        notification: state.notification?.id === id ? null : state.notification,
      })),
    triggerCelebration: (celebration) =>
      set(() => ({
        celebration: {
          id: Math.random().toString(36).substring(7),
          duration: celebration?.duration ?? 2600,
          message: celebration?.message,
          type: celebration?.type,
          eventKey: celebration?.eventKey,
          style: celebration?.style,
        },
      })),
    clearCelebration: () => set(() => ({ celebration: null })),
    openDrawer: (config) =>
      set(() => ({
        isDrawerOpen: true,
        drawerConfig: {
          width: config.width ?? 400,
          content: config.content,
          id: config.id,
        },
      })),
    closeDrawer: () =>
      set((state) => ({
        isDrawerOpen: false,
        drawerConfig: {
          ...state.drawerConfig,
          id: undefined,
        },
      })),
  },
}));
