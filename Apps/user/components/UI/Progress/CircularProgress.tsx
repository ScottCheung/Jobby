/** @format */

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
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const colorStyles = {
  primary: 'stroke-primary-500',
  success: 'stroke-success-500',
  warning: 'stroke-warning-500',
  danger: 'stroke-danger-500',
  info: 'stroke-blue-500',
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
    duration = 3,
    className,
    ...props
  }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const radius =
      size === 'xs'
        ? 24
        : size === 'sm'
          ? 36
          : size === 'md'
            ? 48
            : size === 'lg'
              ? 64
              : size === 'xl'
                ? 80
                : 96;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    return (
      <div
        className={cn(
          'relative inline-flex items-center justify-center',
          className,
        )}
        {...props}
      >

        <svg
          className='transform -rotate-90'
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
                  y2='0%'
                >
                  <stop offset='0%' className='stop-color-primary-400' />
                  <stop offset='100%' className='stop-color-primary-600' />
                </linearGradient>
                <linearGradient
                  id='gradient-success'
                  x1='0%'
                  y1='0%'
                  x2='100%'
                  y2='0%'
                >
                  <stop offset='0%' className='stop-color-success-400' />
                  <stop offset='100%' className='stop-color-success-600' />
                </linearGradient>
                <linearGradient
                  id='gradient-warning'
                  x1='0%'
                  y1='0%'
                  x2='100%'
                  y2='0%'
                >
                  <stop offset='0%' className='stop-color-warning-400' />
                  <stop offset='100%' className='stop-color-warning-600' />
                </linearGradient>
                <linearGradient
                  id='gradient-danger'
                  x1='0%'
                  y1='0%'
                  x2='100%'
                  y2='0%'
                >
                  <stop offset='0%' className='stop-color-danger-400' />
                  <stop offset='100%' className='stop-color-danger-600' />
                </linearGradient>
                <linearGradient
                  id='gradient-info'
                  x1='0%'
                  y1='0%'
                  x2='100%'
                  y2='0%'
                >
                  <stop offset='0%' className='stop-color-blue-400' />
                  <stop offset='100%' className='stop-color-blue-600' />
                </linearGradient>
              </>
            )}
          </defs>
          <circle
            className={cn('stroke-gray-200')}
            strokeWidth={thickness}
            fill='none'
            r={radius - thickness / 2}
            cx={radius}
            cy={radius}
          />
          <motion.circle
            className={cn(
              variant === 'solid'
                ? colorStyles[color]
                : gradientStyles[color],
            )}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{
              strokeDashoffset: isIndeterminate ? 0 : strokeDashoffset,
              rotate: isIndeterminate ? 360 : 0,
            }}
            viewport={{
              margin: '25% 0px -25% 0px',
              once: true,
              amount: 0.25,
            }}
            transition={{
              duration: isIndeterminate ? 1 : duration,
              ease: [0.22, 1, 0.36, 1],
              repeat: isIndeterminate ? Infinity : 0,
            }}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeLinecap='round'
            fill='none'
            r={radius - thickness / 2}
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
            {Math.round(percentage)}%
          </motion.span>
        )}

      </div>
    );
  },
);

CircularProgress.displayName = 'CircularProgress';
