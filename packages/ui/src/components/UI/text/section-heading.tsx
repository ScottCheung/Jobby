/** @format */

'use client';
/** @format */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div';
  size?: 'sm' | 'md' | 'lg';
  markerClassName?: string;
  action?: React.ReactNode;
  withBackdrop?: boolean;
}

const sizeConfig = {
  sm: {
    heading: 'text-xs sm:text-sm pl-5',
    marker: 'w-2 h-[80%] min-h-[13px]',
  },
  md: {
    heading: 'text-sm sm:text-base pl-7',
    marker: 'w-2.5 h-full',
  },
  lg: {
    heading: 'text-base sm:text-lg pl-8',
    marker: 'w-3 h-full',
  },
};

export const SectionHeading = React.forwardRef<
  HTMLHeadingElement,
  SectionHeadingProps
>(function SectionHeading(
  {
    as: Component = 'h2',
    size = 'md',
    className,
    markerClassName,
    action,
    withBackdrop = false,
    children,
    ...props
  },
  ref,
) {
  const config = sizeConfig[size] || sizeConfig.md;

  const headingContent = (
    <Component
      ref={ref as any}
      className={cn(
        'relative font-bold text-ink-primary z-10 flex items-center',
        config.heading,
        className,
      )}
      {...props}
    >
      <div
        className='absolute left-0 inset-y-0 flex items-center pointer-events-none'
        aria-hidden='true'
      >
        <div
          className={cn(
            'bg-primary-gradient rounded-br-full rounded-tl-full transition-all',
            config.marker,
            markerClassName,
          )}
        />
      </div>
      <div className='z-30 min-w-0'>{children}</div>
      {withBackdrop && (
        <div
          aria-hidden='true'
          className='w-full h-full bg-background-primary absolute blur-sm scale-105 pointer-events-none -z-20 left-0 top-0'
        />
      )}
    </Component>
  );

  if (action) {
    return (
      <div className='relative flex items-center justify-between gap-3'>
        {headingContent}
        <div className='shrink-0 z-20'>{action}</div>
      </div>
    );
  }

  return headingContent;
});
