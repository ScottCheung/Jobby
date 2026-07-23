/** @format */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useConsole } from '@/components/ConsoleContext';

type Theme = 'dark' | 'light' | 'system';
export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange' | 'rose';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultColor?: ThemeColor;
  storageKey?: string;
  colorStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  themeColor: 'green',
  setThemeColor: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultColor = 'green',
  storageKey = 'auto-job-ui-theme',
  colorStorageKey = 'auto-job-ui-theme-color',
  ...props
}: ThemeProviderProps) {
  const { profile, hasLoadedInitialData, updateProfileExtra } = useConsole();
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [themeColor, setThemeColor] = useState<ThemeColor>(defaultColor);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!hasLoadedInitialData) return;

    const savedTheme = profile.extra_data?.[storageKey] as Theme | undefined;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    const savedColor = profile.extra_data?.[colorStorageKey] as
      | ThemeColor
      | undefined;
    if (savedColor) {
      setThemeColor(savedColor);
    }

    setMounted(true);
  }, [colorStorageKey, hasLoadedInitialData, profile.extra_data, storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = () => {
      root.classList.remove('light', 'dark');

      if (theme === 'system') {
        const systemTheme =
          window.matchMedia('(prefers-color-scheme: dark)').matches ?
            'dark'
          : 'light';

        if (systemTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.add('light');
        }
      } else if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        applyTheme();
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else {
        mediaQuery.addListener(listener);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', listener);
        } else {
          mediaQuery.removeListener(listener);
        }
      };
    }
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme-color', themeColor);
  }, [themeColor]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setTheme(theme);
      void updateProfileExtra({ [storageKey]: theme });
    },
    themeColor,
    setThemeColor: (color: ThemeColor) => {
      setThemeColor(color);
      void updateProfileExtra({ [colorStorageKey]: color });
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {mounted ? children : null}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
