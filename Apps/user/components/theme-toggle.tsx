/** @format */

'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className='inline-flex items-center cursor-pointer group justify-center text-ink-secondary hover:text-ink-primary rounded-md p-2 text-sm font-medium transition-colors hover:bg-primary/10  '
    >
      {/* Sun 图标 */}
      <Sun
        className='h-[1.2rem] w-[1.2rem] transition-all duration-500 ease-out 
  dark:-rotate-90 dark:scale-0 dark:opacity-0 
  rotate-0  scale-100 opacity-100'
      />

      {/* Moon 图标 */}
      <Moon
        className='absolute h-[1.2rem] w-[1.2rem] transition-all duration-500 ease-out 
  rotate-90 scale-0 opacity-0 
  dark:rotate-0  dark:scale-100 dark:opacity-100'
      />

      <span className='sr-only'>Toggle theme</span>
    </button>
  );
}
