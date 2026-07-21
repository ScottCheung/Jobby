/** @format */

'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import { isDesktopRuntime } from '@/lib/runtime';

export type BrowserSessionStatus = {
  exists: boolean;
  isRunning: boolean;
  path: string;
  sizeMb: number;
} | null;

export type BrowserSessionVerification = {
  checkedAt: string;
  results: {
    linkedin: {
      loggedIn: boolean;
      detail: string;
    };
    seek: {
      loggedIn: boolean;
      detail: string;
    };
  };
} | null;

type BrowserSessionStore = {
  isReady: boolean;
  profilePath: string;
  showClearConfirm: boolean;
  showCloseOtherChromePrompt: boolean;
  isCheckingStatus: boolean;
  isOpeningChrome: boolean;
  isClosingChrome: boolean;
  isClosingAllChrome: boolean;
  isClearingSession: boolean;
  isVerifyingSession: boolean;
  sessionStatus: BrowserSessionStatus;
  sessionVerification: BrowserSessionVerification;
  setIsReady: (value: boolean) => void;
  setProfilePath: (value: string) => void;
  setShowClearConfirm: (value: boolean) => void;
  setShowCloseOtherChromePrompt: (value: boolean) => void;
  setIsCheckingStatus: (value: boolean) => void;
  setIsOpeningChrome: (value: boolean) => void;
  setIsClosingChrome: (value: boolean) => void;
  setIsClosingAllChrome: (value: boolean) => void;
  setIsClearingSession: (value: boolean) => void;
  setIsVerifyingSession: (value: boolean) => void;
  setSessionStatus: (value: BrowserSessionStatus) => void;
  setSessionVerification: (value: BrowserSessionVerification) => void;
  
  // Actions
  loadSettings: () => Promise<void>;
  checkStatus: () => Promise<void>;
  openChrome: () => Promise<void>;
  closeChrome: () => Promise<void>;
  closeOtherChromeAndContinue: () => Promise<void>;
  clearSession: () => Promise<void>;
  verifySession: () => Promise<void>;
};

export const useBrowserSessionStore = create<BrowserSessionStore>()((set, get) => ({
  isReady: false,
  profilePath: '',
  showClearConfirm: false,
  showCloseOtherChromePrompt: false,
  isCheckingStatus: false,
  isOpeningChrome: false,
  isClosingChrome: false,
  isClosingAllChrome: false,
  isClearingSession: false,
  isVerifyingSession: false,
  sessionStatus: null,
  sessionVerification: null,
  setIsReady: (value) => set({ isReady: value }),
  setProfilePath: (value) => set({ profilePath: value }),
  setShowClearConfirm: (value) => set({ showClearConfirm: value }),
  setShowCloseOtherChromePrompt: (value) => set({ showCloseOtherChromePrompt: value }),
  setIsCheckingStatus: (value) => set({ isCheckingStatus: value }),
  setIsOpeningChrome: (value) => set({ isOpeningChrome: value }),
  setIsClosingChrome: (value) => set({ isClosingChrome: value }),
  setIsClosingAllChrome: (value) => set({ isClosingAllChrome: value }),
  setIsClearingSession: (value) => set({ isClearingSession: value }),
  setIsVerifyingSession: (value) => set({ isVerifyingSession: value }),
  setSessionStatus: (value) => set({ sessionStatus: value }),
  setSessionVerification: (value) => set({ sessionVerification: value }),

  loadSettings: async () => {
    try {
      const runtimeSettings = await api.runtimeSettings();
      const customPath =
        (runtimeSettings.settings?.browser_profile_path as string) || '';
      set({ profilePath: customPath });
    } catch (e) {
      console.error('Failed to load runtime settings for browser page:', e);
    } finally {
      set({ isReady: true });
    }
  },

  checkStatus: async () => {
    if (
      !isDesktopRuntime() ||
      !window.autoJobDesktop?.checkChromeSessionStatus
    ) {
      return;
    }
    set({ isCheckingStatus: true });
    try {
      const pathToCheck = get().profilePath.trim() || '~/.auto-job-apply-profile';
      const status =
        await window.autoJobDesktop.checkChromeSessionStatus(pathToCheck);
      set({ sessionStatus: status });
    } catch (e) {
      console.error('Failed to check chrome session status:', e);
    } finally {
      set({ isCheckingStatus: false });
    }
  },

  openChrome: async () => {
    if (!isDesktopRuntime() || !window.autoJobDesktop?.openChromeSession) {
      showGlobalToast('This only works in the desktop app.');
      return;
    }
    set({ isOpeningChrome: true });
    const pathToCheck = get().profilePath.trim() || '~/.auto-job-apply-profile';
    try {
      const res = await window.autoJobDesktop.openChromeSession(pathToCheck);
      if (res.ok) {
        showGlobalToast(
          'Browser opened. Sign in there, then close it when you are done.',
        );
        setTimeout(() => {
          void get().checkStatus();
        }, 1000);
      } else if (res.code === 'close_other_chrome_windows') {
        set({ showCloseOtherChromePrompt: true });
      } else {
        showGlobalToast(res.error || 'Could not open the browser.');
      }
    } catch (e: any) {
      showGlobalToast(`Could not open the browser: ${e.message || e}`);
    } finally {
      set({ isOpeningChrome: false });
    }
  },

  closeOtherChromeAndContinue: async () => {
    if (!isDesktopRuntime() || !window.autoJobDesktop?.closeAllChromeWindows) {
      showGlobalToast('This only works in the desktop app.');
      return;
    }

    set({ isClosingAllChrome: true });
    try {
      const res = await window.autoJobDesktop.closeAllChromeWindows();
      if (!res.ok) {
        showGlobalToast(res.error || 'Could not close Chrome.');
        return;
      }

      set({ showCloseOtherChromePrompt: false });
      showGlobalToast('Other Chrome windows closed. Opening login browser...');
      setTimeout(() => {
        void get().openChrome();
      }, 500);
    } catch (e: any) {
      showGlobalToast(`Could not close Chrome: ${e.message || e}`);
    } finally {
      set({ isClosingAllChrome: false });
    }
  },

  closeChrome: async () => {
    if (!isDesktopRuntime() || !window.autoJobDesktop?.closeChromeSession) {
      showGlobalToast('This only works in the desktop app.');
      return;
    }
    set({ isClosingChrome: true });
    try {
      const res = await window.autoJobDesktop.closeChromeSession();
      if (res.ok) {
        showGlobalToast('Login browser closed');
        setTimeout(() => {
          void get().checkStatus();
        }, 800);
      } else {
        showGlobalToast(res.error || 'Could not close the browser.');
      }
    } catch (e: any) {
      showGlobalToast(`Could not close the browser: ${e.message || e}`);
    } finally {
      set({ isClosingChrome: false });
    }
  },

  clearSession: async () => {
    if (!isDesktopRuntime() || !window.autoJobDesktop?.clearChromeSession) {
      showGlobalToast('This only works in the desktop app.');
      return;
    }
    set({ isClearingSession: true });
    const pathToCheck = get().profilePath.trim() || '~/.auto-job-apply-profile';
    try {
      const res = await window.autoJobDesktop.clearChromeSession(pathToCheck);
      if (res.ok) {
        showGlobalToast('Saved login cleared');
        set({ showClearConfirm: false });
        void get().checkStatus();
      } else {
        showGlobalToast(res.error || 'Could not clear saved login.');
      }
    } catch (e: any) {
      showGlobalToast(`Could not clear saved login: ${e.message || e}`);
    } finally {
      set({ isClearingSession: false });
    }
  },

  verifySession: async () => {
    if (!isDesktopRuntime() || !window.autoJobDesktop?.verifyBrowserSession) {
      showGlobalToast('This only works in the desktop app.');
      return;
    }

    const runningNow = get().sessionStatus?.isRunning;

    if (runningNow && window.autoJobDesktop?.closeChromeSession) {
      set({ isClosingChrome: true });
      showGlobalToast('Closing login browser...');
      try {
        const closeRes = await window.autoJobDesktop.closeChromeSession();
        if (!closeRes.ok) {
          showGlobalToast(closeRes.error || 'Could not close the browser.');
          set({ isClosingChrome: false });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
        await get().checkStatus();
      } catch (e: any) {
        showGlobalToast(`Could not close the browser: ${e.message || e}`);
        set({ isClosingChrome: false });
        return;
      } finally {
        set({ isClosingChrome: false });
      }
    }

    set({ isVerifyingSession: true });
    const pathToCheck = get().profilePath.trim() || '~/.auto-job-apply-profile';
    try {
      const res = await window.autoJobDesktop.verifyBrowserSession(pathToCheck);
      if (res.ok && res.results && res.checkedAt) {
        set({
          sessionVerification: {
            checkedAt: res.checkedAt,
            results: res.results,
          },
        });
        showGlobalToast('Login check complete');
      } else {
        set({ sessionVerification: null });
        showGlobalToast(res.error || 'Could not check saved login.');
      }
    } catch (e: any) {
      set({ sessionVerification: null });
      showGlobalToast(`Could not check saved login: ${e.message || e}`);
    } finally {
      set({ isVerifyingSession: false });
    }
  },
}));
