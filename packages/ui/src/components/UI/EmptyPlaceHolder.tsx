/** @format */

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
          <EffectiveIcon
            className={cn('w-50 h-50 mx-auto -mt-10 ', iconClassName)}
          />
        )}
        <div className='absolute'>
          {IP && (
            <IPEmotion
              emotionId={IP}
              className={cn('w-70 h-70 mx-auto -mt-10 ')}
            />
          )}
        </div>

        <p
          className={cn(
            'text-xs mt-60 font-bold text-foreground max-w-[400px] uppercase tracking-wider',
            messageClassName || titleClassName,
          )}
        >
          {displayTitle}
        </p>

        {description && (
          <p
            className={cn(
              'text-[11px] mt-3 leading-relaxed text-muted-foreground max-w-[220px]',
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
