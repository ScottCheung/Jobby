import { create } from 'zustand';

export type AuthModalMode = 'login' | 'signup';

export interface AuthModalOptions {
  mode?: AuthModalMode;
  next?: string;
  reason?: string;
  onSuccess?: () => void;
}

interface AuthModalState {
  isOpen: boolean;
  mode: AuthModalMode;
  next?: string;
  reason?: string;
  onSuccess?: () => void;
  actions: {
    openAuthModal: (options?: AuthModalOptions) => void;
    closeAuthModal: () => void;
    setMode: (mode: AuthModalMode) => void;
  };
}

export const useAuthModalStore = create<AuthModalState>()((set) => ({
  isOpen: false,
  mode: 'login',
  next: undefined,
  reason: undefined,
  onSuccess: undefined,
  actions: {
    openAuthModal: (options) =>
      set({
        isOpen: true,
        mode: options?.mode ?? 'login',
        next: options?.next,
        reason: options?.reason,
        onSuccess: options?.onSuccess,
      }),
    closeAuthModal: () =>
      set({
        isOpen: false,
        reason: undefined,
        onSuccess: undefined,
      }),
    setMode: (mode) => set({ mode }),
  },
}));

/**
 * Global helper to trigger auth modal from anywhere
 */
export function openGlobalAuthModal(options?: AuthModalOptions) {
  useAuthModalStore.getState().actions.openAuthModal(options);
}
