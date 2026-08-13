'use client';
/** @format */

import * as React from 'react';
import { IPEmotion } from './IPEmotion';
import { cn } from '@/lib/utils';

export interface EmptyPlaceHolderProps {
  Icon?: React.ElementType | null;
  icon?: React.ElementType | null;
  IP?: number;
  message?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  messageClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function EmptyPlaceHolder({
  Icon,
  icon,
  IP = 1,
  message,
  title,
  description,
  children,
  className,
  iconClassName,
  messageClassName,
  titleClassName,
  descriptionClassName,
}: EmptyPlaceHolderProps) {
  const displayTitle = title || message || 'No Content';
  const EffectiveIcon = Icon || icon;

  return (
    <div className={cn('panel-lg items-center justify-center', className)}>
      <div className='py-6 text-center w-full flex flex-col items-center justify-center'>
        {EffectiveIcon && (
          <EffectiveIcon className={cn('w-50 h-50 mx-auto -mt-10 ', iconClassName)} />
        )}
        {IP && (
          <IPEmotion
            emotionId={IP}
            className={cn('w-50 h-50 mx-auto -mt-10 ')}
          />
        )}

        <p
          className={cn(
            'text-lg text-ink-primary font-medium',
            messageClassName || titleClassName,
          )}
        >
          {displayTitle}
        </p>

        {description && (
          <p
            className={cn(
              'text-xs text-ink-secondary/70 mt-1 max-w-sm mx-auto',
              descriptionClassName,
            )}
          >
            {description}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
