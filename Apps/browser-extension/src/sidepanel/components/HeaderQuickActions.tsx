/** @format */

import { HelpCircle, Moon, Palette, Sun } from 'lucide-react';
import { Tooltip } from '@jobby/ui/components/UI/tooltip';
import type { ThemeColor, ThemeMode } from '../hooks/useThemeSync';

interface HeaderQuickActionsProps {
  themeColor: ThemeColor;
  themeMode: ThemeMode;
  onToggleThemeColor: () => void;
  onToggleThemeMode: () => void;
}

const COLOR_NAMES: Record<ThemeColor, string> = {
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  orange: 'Orange',
  rose: 'Rose',
};

export function HeaderQuickActions({
  themeColor,
  themeMode,
  onToggleThemeColor,
  onToggleThemeMode,
}: HeaderQuickActionsProps) {
  const webAppBaseUrl = (
    import.meta.env.VITE_WEB_APP_URL || 'http://localhost:3000'
  ).replace(/\/$/, '');

  const handleFeedback = () => {
    window.open(`${webAppBaseUrl}/feedback`, '_blank');
  };

  const isDarkMode =
    themeMode === 'dark' ||
    (themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className='header-quick-actions' aria-label='Quick tools'>
      {/* 1. Feedback Button */}
      <Tooltip
        content={
          <div className='flex flex-col gap-0.5 text-xs'>
            <span className='font-semibold text-foreground'>Feedback & Suggestions</span>
            <span className='text-[10px] text-muted-foreground'>
              Open feedback page in web app
            </span>
          </div>
        }
        side='bottom'
        delay={100}
      >
        <button
          type='button'
          onClick={handleFeedback}
          className='header-action-btn'
          aria-label='Feedback and suggestions'
        >
          <HelpCircle className='h-3.5 w-3.5' />
        </button>
      </Tooltip>

      {/* 2. Theme Color Toggle */}
      <Tooltip
        content={
          <div className='flex flex-col gap-0.5 text-xs'>
            <div className='flex items-center gap-1.5'>
              <span className='font-semibold text-foreground'>Theme Color:</span>
              <span className='font-bold capitalize text-primary'>
                {COLOR_NAMES[themeColor] || themeColor}
              </span>
            </div>
            <span className='text-[10px] text-muted-foreground'>
              Click to cycle color theme
            </span>
          </div>
        }
        side='bottom'
        delay={100}
      >
        <button
          type='button'
          onClick={onToggleThemeColor}
          className='header-action-btn group'
          aria-label={`Current theme color: ${themeColor}. Click to change.`}
        >
          <Palette className='h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45 text-primary' />
        </button>
      </Tooltip>

      {/* 3. Dark/Light Mode Quick Toggle */}
      <Tooltip
        content={
          <div className='flex flex-col gap-0.5 text-xs'>
            <span className='font-semibold text-foreground'>
              {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </span>
            <span className='text-[10px] text-muted-foreground'>
              Current: {themeMode === 'system' ? 'System (' + (isDarkMode ? 'Dark' : 'Light') + ')' : isDarkMode ? 'Dark' : 'Light'}
            </span>
          </div>
        }
        side='bottom'
        delay={100}
      >
        <button
          type='button'
          onClick={onToggleThemeMode}
          className='header-action-btn group'
          aria-label='Toggle light and dark mode'
        >
          <div className='relative h-3.5 w-3.5 flex items-center justify-center'>
            <Sun
              className={`h-3.5 w-3.5 transition-all duration-300 ease-out absolute ${
                isDarkMode
                  ? '-rotate-90 scale-0 opacity-0'
                  : 'rotate-0 scale-100 opacity-100 text-amber-500'
              }`}
            />
            <Moon
              className={`h-3.5 w-3.5 transition-all duration-300 ease-out absolute ${
                isDarkMode
                  ? 'rotate-0 scale-100 opacity-100 text-blue-400'
                  : 'rotate-90 scale-0 opacity-0'
              }`}
            />
          </div>
        </button>
      </Tooltip>
    </div>
  );
}
