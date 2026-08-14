'use client';
/** @format */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Collapse } from '../../animation';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {}

export function H1({ className, ...props }: TypographyProps) {
  return (
    <h1
      className={cn(
        'title-page md:text-4xl',
        className,
      )}
      {...props}
    />
  );
}

export function H2({ className, ...props }: TypographyProps) {
  return (
    <h2
      className={cn(
        'title-section tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

export function H3({ className, ...props }: TypographyProps) {
  return (
    <h3
      className={cn(
        'title-card tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

export function H4({ className, ...props }: TypographyProps) {
  return (
    <h4
      className={cn(
        'title-sub text-ink-secondary',
        className,
      )}
      {...props}
    />
  );
}

export function P({ className, ...props }: TypographyProps) {
  return (
    <p
      className={cn('label text-ink-secondary', className)}
      {...props}
    />
  );
}

export function Lead({ className, ...props }: TypographyProps) {
  return (
    <p className={cn('body-lg text-ink-secondary', className)} {...props} />
  );
}

export function Small({ className, ...props }: TypographyProps) {
  return (
    <small
      className={cn(
        'label-sm leading-none',
        className,
      )}
      {...props}
    />
  );
}

export function Muted({ className, ...props }: TypographyProps) {
  return (
    <p className={cn('body-md text-ink-secondary', className)} {...props} />
  );
}

export function Error({
  className,
  content,
  show,
  children,
  ...props
}: TypographyProps & { content?: React.ReactNode; show?: boolean }) {
  const message = content || children;
  // Auto-show if message checks out and is not simply 'true' (which renders nothing but would trigger visibility)
  const shouldShow = !!message && message !== true;
  const isVisible = show ?? shouldShow;

  return (
    <Collapse isOpen={isVisible} className='overflow-hidden'>
      <p
        className={cn(
          'text-[12px] text-red-500 pl-2 flex items-center mt-1 font-medium',
          className,
        )}
        role='alert'
        {...props}
      >
        {message}
      </p>
    </Collapse>
  );
}
