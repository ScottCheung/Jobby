/** @format */

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import React from 'react';

type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';
type ProgressVariant = 'solid' | 'gradient';
type ProgressColor = 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: ProgressSize;
  variant?: ProgressVariant;
  color?: ProgressColor;
  showValue?: boolean;
  isIndeterminate?: boolean;
  label?: string;
}

const sizeStyles = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

const colorStyles = {
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-blue-500',
};

const gradientStyles = {
  primary: 'bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600',
  success: 'bg-gradient-to-r from-success-400 via-success-500 to-success-600',
  warning: 'bg-gradient-to-r from-warning-400 via-warning-500 to-warning-600',
  danger: 'bg-gradient-to-r from-danger-400 via-danger-500 to-danger-600',
  info: 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600',
};

export const ProgressBar = React.memo<ProgressBarProps>(
  ({
    value,
    max = 100,
    size = 'md',
    variant = 'solid',
    color = 'primary',
    showValue = false,
    isIndeterminate = false,
    label,
    className,
    ...props
  }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const colorStyle =
      variant === 'gradient' ? gradientStyles[color] : colorStyles[color];

    return (
      <div className='w-full' {...props}>
        {(label || showValue) && (
          <div className='flex justify-between mb-1'>
            {label && <span className='text-sm text-gray-600'>{label}</span>}
            {showValue && (
              <span className='text-sm text-gray-600'>
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        )}
        <div
          className={cn(
            'w-full bg-gray-200 rounded-full overflow-hidden',
            sizeStyles[size],
            className,
          )}
        >
          <motion.div
            className={cn(
              'h-full rounded-full ',
              colorStyle,
              isIndeterminate && 'animate-progress-indeterminate',
            )}
            initial={{ width: 0 }}
            whileInView={{ width: isIndeterminate ? '100%' : `${percentage}%` }}
            viewport={{ once: true, margin: '30%' }}
            transition={{
              duration: 2,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        </div>
      </div>
    );
  },
);

ProgressBar.displayName = 'ProgressBar';
