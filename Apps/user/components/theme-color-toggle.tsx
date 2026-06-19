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
        className='inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-all duration-200 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary cursor-pointer'
        aria-label='Toggle theme color'
      >
        <Palette className='h-[1.2rem] w-[1.2rem] transition-transform duration-300 hover:rotate-45' />
        <span className='sr-only'>Toggle theme color</span>
      </button>
    </Tooltip>
  );
}
