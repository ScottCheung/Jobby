/** @format */

'use client';
/** @format */

// import { ViewportAnimation } from '@/stories/Animation/ViewportAnimation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import React from 'react';

type CircularProgressSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type CircularProgressVariant = 'solid' | 'gradient';
type CircularProgressColor =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'black'
  | 'white';

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: CircularProgressSize;
  variant?: CircularProgressVariant;
  color?: CircularProgressColor;
  showValue?: boolean;
  isIndeterminate?: boolean;
  thickness?: number;
  duration?: number;
}

const textSizes = {
  xs: 'body-sm',
  sm: 'body-md',
  md: 'body-lg',
  lg: 'title-card',
  xl: 'title-section',
};

const colorStyles = {
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  info: 'stroke-blue',
  black: 'stroke-black',
  white: 'stroke-white',
};

const gradientStyles = {
  primary: 'stroke-[url(#gradient-primary)]',
  success: 'stroke-[url(#gradient-success)]',
  warning: 'stroke-[url(#gradient-warning)]',
  danger: 'stroke-[url(#gradient-danger)]',
  info: 'stroke-[url(#gradient-info)]',
  black: 'stroke-[url(#gradient-black)]',
  white: 'stroke-[url(#gradient-white)]',
};

export const CircularProgress = React.memo<CircularProgressProps>(
  ({
    value,
    max = 100,
    size = 'md',
    variant = 'solid',
    color = 'primary',
    showValue = false,
    isIndeterminate = false,
    thickness = 12,
    duration = 0.8,
    className,
    ...props
  }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const radius =
      size === 'xs' ? 24
      : size === 'sm' ? 36
      : size === 'md' ? 48
      : size === 'lg' ? 64
      : size === 'xl' ? 80
      : 96;
    const normalizedRadius = Math.max(0, radius - thickness / 2);
    const circumference = 2 * Math.PI * normalizedRadius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const dashArray =
      isIndeterminate ?
        `${circumference * 0.3} ${circumference * 0.7}`
      : circumference;

    return (
      <div
        className={cn(
          'relative inline-flex  items-center justify-center',
          className,
        )}
        {...props}
      >
        <React.Fragment>
          <svg
            className={cn(
              'transform -rotate-90 origin-center  transition-transform duration-300',
              isIndeterminate && 'animate-spin',
            )}
            width={radius * 2}
            height={radius * 2}
            viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          >
            <defs>
              {variant === 'gradient' && (
                <>
                  <linearGradient
                    id='gradient-primary'
                    x1='0%'
                    y1='0%'
                    x2='100%'
                    y2='100%'
                  >
                    <stop offset='0%' stopColor='var(--primary, #10b981)' />
                    <stop
                      offset='100%'
                      stopColor='var(--color-primary-accent, #3b82f6)'
                    />
                  </linearGradient>
                  <linearGradient
                    id='gradient-success'
                    x1='0%'
                    y1='0%'
                    x2='100%'
                    y2='100%'
                  >
                    <stop offset='0%' stopColor='#10b981' />
                    <stop offset='100%' stopColor='#34d399' />
                  </linearGradient>
                  <linearGradient
                    id='gradient-warning'
                    x1='0%'
                    y1='0%'
                    x2='100%'
                    y2='100%'
                  >
                    <stop offset='0%' stopColor='#f59e0b' />
                    <stop offset='100%' stopColor='#fbbf24' />
                  </linearGradient>
                  <linearGradient
                    id='gradient-danger'
                    x1='0%'
                    y1='0%'
                    x2='100%'
                    y2='100%'
                  >
                    <stop offset='0%' stopColor='#ef4444' />
                    <stop offset='100%' stopColor='#f87171' />
                  </linearGradient>
                  <linearGradient
                    id='gradient-info'
                    x1='0%'
                    y1='0%'
                    x2='100%'
                    y2='100%'
                  >
                    <stop offset='0%' stopColor='#3b82f6' />
                    <stop offset='100%' stopColor='#60a5fa' />
                  </linearGradient>
                </>
              )}
            </defs>
            <circle
              className={cn('stroke-muted/20 dark:stroke-border/40')}
              strokeWidth={thickness}
              fill='none'
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <motion.circle
              className={cn(
                variant === 'solid' ?
                  colorStyles[color]
                : gradientStyles[color],
              )}
              initial={{ strokeDashoffset: circumference }}
              animate={{
                strokeDashoffset:
                  isIndeterminate ? circumference * 0.7 : strokeDashoffset,
              }}
              transition={{
                duration: duration,
                ease: [0.16, 1, 0.3, 1],
              }}
              strokeWidth={thickness}
              strokeDasharray={dashArray}
              strokeLinecap='round'
              fill='none'
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          {showValue && (
            <motion.span
              className={cn(
                'absolute text-gray-600 font-medium',
                textSizes[size],
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {Math.round(percentage)}
            </motion.span>
          )}
        </React.Fragment>
      </div>
    );
  },
);

CircularProgress.displayName = 'CircularProgress';
