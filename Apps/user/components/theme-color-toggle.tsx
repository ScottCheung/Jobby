/** @format */

'use client';

import * as React from 'react';
import { Palette } from 'lucide-react';
import { useTheme, ThemeColor } from '@/components/theme-provider';
import { Tooltip } from '@/components/UI/tooltip';

const colors: ThemeColor[] = ['blue', 'purple', 'green', 'orange', 'rose'];

export function ThemeColorToggle() {
  const { themeColor, setThemeColor } = useTheme();

  const toggleColor = () => {
    const currentIndex = colors.indexOf(themeColor);
    const nextIndex = (currentIndex + 1) % colors.length;
    setThemeColor(colors[nextIndex]);
  };

  return (
    <Tooltip
      content={
        <span className='text-xs'>
          Theme Color:{' '}
          <span className='capitalize font-bold'>{themeColor}</span> (Click to
          change)
        </span>
      }
      side='right'
      delay={100}
    >
      <button
        onClick={toggleColor}
        className='inline-flex items-center cursor-pointer group justify-center text-ink-secondary hover:text-ink-primary rounded-md p-2 text-sm font-medium transition-colors hover:bg-primary/10 '
        aria-label='Toggle theme color'
      >
        <Palette className='h-[1.2rem] w-[1.2rem] transition-transform duration-300 group-hover:rotate-45' />
        <span className='sr-only'>Toggle theme color</span>
      </button>
    </Tooltip>
  );
}
