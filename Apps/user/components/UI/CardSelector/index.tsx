/** @format */

'use client';

import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import AnimatedIcon from '@/components/UI/SVGanimation/StatusSVG';
import { cn } from '@/lib/utils';

export type CardSelectorOption<T extends string> = {
  value: T;
  title: string;
  description: string;
  icon: LucideIcon;
  accentColor?: string;
};

type CardSelectorProps<T extends string> = {
  ariaLabel: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly CardSelectorOption<T>[];
  className?: string;
};

const ACCENT_BORDER_CLASSES: Record<string, string> = {
  'slate-500': 'border-slate-500',
  success: 'border-success',
  'amber-500': 'border-amber-500',
};

const ACCENT_BG_CLASSES: Record<string, string> = {
  'slate-500': 'bg-slate-500',
  success: 'bg-success',
  'amber-500': 'bg-amber-500',
};

/** A compact, accessible card-based selector for high-level product choices. */
export function CardSelector<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
  className,
}: CardSelectorProps<T>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn('grid gap-3 sm:grid-cols-3', className)}
      role='radiogroup'
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        const accentBorder = option.accentColor
          ? (ACCENT_BORDER_CLASSES[option.accentColor] || `border-${option.accentColor}`)
          : 'border-primary';

        const accentBg = option.accentColor
          ? (ACCENT_BG_CLASSES[option.accentColor] || `bg-${option.accentColor}`)
          : 'bg-primary';

        const accentText = option.accentColor ? 'text-white' : 'text-primary-foreground';

        return (
          <button
            key={option.value}
            type='button'
            role='radio'
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'group relative flex min-h-36 flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              selected ?
                accentBorder
              : 'border-transparent bg-background/35 hover:border-primary/40 hover:bg-background-secondary/50',
            )}
          >
            <div className='flex w-full items-start justify-between gap-3'>
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                  selected ?
                    cn(accentBg, accentText)
                  : 'bg-background-secondary text-ink-secondary group-hover:text-primary',
                )}
              >
                <Icon className='h-5 w-5' />
              </div>
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                  selected ?
                    cn(accentBorder, accentBg, accentText)
                  : 'border-border bg-background',
                )}
              >
                {selected && (
                  <AnimatedIcon type='check' className='h-3.5 w-3.5' />
                )}
              </div>
            </div>
            <div className='mt-4'>
              <div className='text-sm font-semibold text-ink-primary'>
                {option.title}
              </div>
              <p className='mt-1.5 text-xs leading-relaxed text-ink-secondary'>
                {option.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
