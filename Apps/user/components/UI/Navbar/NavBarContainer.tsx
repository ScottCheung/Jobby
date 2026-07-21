/** @format */

'use client';
import React from 'react';
import { cn } from '@/lib/utils';

interface NavBarContainerProps {
  title: string;
  description?: string;
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
  compactChildren?: React.ReactNode;
  expandedHeightClassName?: string;
  compactHeightClassName?: string;
}

export function NavBarContainer({
  title,
  description,
  compact = false,
  children,
  className,
  compactChildren,
  expandedHeightClassName = 'h-[104px]',
  compactHeightClassName = 'h-[68px]',
}: NavBarContainerProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px] border border-border/60 bg-panel/95 px-5 shadow-[0px_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-border/80',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_38%),linear-gradient(135deg,rgba(244,244,245,0.9),rgba(255,255,255,0.45)_40%,rgba(244,244,245,0.6))] transition-opacity duration-150 dark:bg-[radial-gradient(circle_at_top_left,rgba(39,39,42,0.85),transparent_35%),linear-gradient(135deg,rgba(9,9,11,0.92),rgba(24,24,27,0.7)_40%,rgba(39,39,42,0.5))]',
          compact ? 'opacity-60' : 'opacity-100',
        )}
      />

      <div
        className={cn(
          'relative',
          compact ? compactHeightClassName : expandedHeightClassName,
        )}
      >
        <div
          className={cn(
            'absolute inset-0 flex flex-col justify-center gap-4 transition-opacity duration-150',
            compact ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
        >
          <div className='min-w-0'>
            <h2 className='title-section tracking-tight'>
              {title}
            </h2>
            {description && (
              <p className='body-md mt-1 text-ink-primary0'>
                {description}
              </p>
            )}
          </div>
          <div className='flex w-full items-center gap-3'>{children}</div>
        </div>

        <div
          className={cn(
            'absolute inset-0 flex items-center gap-4 transition-opacity duration-150',
            compact ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <div className='min-w-0 shrink-0'>
            <h2 className='title-card tracking-tight'>
              {title}
            </h2>
          </div>
          <div className='min-w-0 flex-1'>
            {compactChildren ?? children}
          </div>
        </div>
      </div>
    </div>
  );
}
