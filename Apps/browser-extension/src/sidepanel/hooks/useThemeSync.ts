/** @format */

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../background/api-client';
import type { AuthStatus } from '../../shared/contracts/auth';

export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange' | 'rose';
export type ThemeMode = 'dark' | 'light' | 'system';

const COLOR_STORAGE_KEY = 'auto-job-ui-theme-color';
const MODE_STORAGE_KEY = 'auto-job-ui-theme';

export function useThemeSync(authStatus?: AuthStatus) {
  const [themeColor, setThemeColor] = useState<ThemeColor>('green');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  // Apply theme attributes to document.documentElement
  const applyThemeToDOM = useCallback((color: ThemeColor, mode: ThemeMode) => {
    const root = document.documentElement;
    root.setAttribute('data-theme-color', color);

    root.classList.remove('light', 'dark');
    if (mode === 'dark') {
      root.classList.add('dark');
    } else if (mode === 'light') {
      root.classList.add('light');
    } else {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isSystemDark ? 'dark' : 'light');
    }
  }, []);

  // 1. Initial load from chrome.storage.local
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([COLOR_STORAGE_KEY, MODE_STORAGE_KEY], (items) => {
        const cachedColor = ((items && items[COLOR_STORAGE_KEY]) as ThemeColor) || 'green';
        const cachedMode = ((items && items[MODE_STORAGE_KEY]) as ThemeMode) || 'system';
        setThemeColor(cachedColor);
        setThemeMode(cachedMode);
        applyThemeToDOM(cachedColor, cachedMode);
      });
    }
  }, [applyThemeToDOM]);

  // 2. Fetch user profile theme when connected to synchronize user settings
  useEffect(() => {
    if (!authStatus?.connected) return;

    let isMounted = true;
    const fetchProfileTheme = async () => {
      try {
        const profile = await apiClient.request<{
          extra_data?: Record<string, unknown>;
        }>('/api/profile');

        if (!isMounted || !profile?.extra_data) return;

        const remoteColor = profile.extra_data[COLOR_STORAGE_KEY] as ThemeColor | undefined;
        const remoteMode = profile.extra_data[MODE_STORAGE_KEY] as ThemeMode | undefined;

        if (remoteColor && ['blue', 'purple', 'green', 'orange', 'rose'].includes(remoteColor)) {
          setThemeColor(remoteColor);
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            void chrome.storage.local.set({ [COLOR_STORAGE_KEY]: remoteColor });
          }
        }

        if (remoteMode && ['light', 'dark', 'system'].includes(remoteMode)) {
          setThemeMode(remoteMode);
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            void chrome.storage.local.set({ [MODE_STORAGE_KEY]: remoteMode });
          }
        }
      } catch (err) {
        // Silent catch if user is not fully authenticated or network drops
      }
    };

    void fetchProfileTheme();

    return () => {
      isMounted = false;
    };
  }, [authStatus?.connected]);

  // 3. Listen to chrome.storage changes to sync instantly across extension views/tabs
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local') return;

      let colorChanged: ThemeColor | null = null;
      let modeChanged: ThemeMode | null = null;

      if (changes[COLOR_STORAGE_KEY]?.newValue) {
        colorChanged = changes[COLOR_STORAGE_KEY].newValue as ThemeColor;
      }
      if (changes[MODE_STORAGE_KEY]?.newValue) {
        modeChanged = changes[MODE_STORAGE_KEY].newValue as ThemeMode;
      }

      if (colorChanged !== null || modeChanged !== null) {
        setThemeColor((prevColor) => {
          const nextColor = colorChanged ?? prevColor;
          setThemeMode((prevMode) => {
            const nextMode = modeChanged ?? prevMode;
            applyThemeToDOM(nextColor, nextMode);
            return nextMode;
          });
          return nextColor;
        });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [applyThemeToDOM]);

  // Listen to system dark mode changes if mode is 'system'
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyThemeToDOM(themeColor, 'system');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [applyThemeToDOM, themeColor, themeMode]);

  useEffect(() => {
    applyThemeToDOM(themeColor, themeMode);
  }, [applyThemeToDOM, themeColor, themeMode]);

  return { themeColor, themeMode };
}
