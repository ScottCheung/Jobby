/** @format */

import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
  titleClassName,
  descriptionClassName,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 py-14 text-center', className)}>
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-primary/10', iconClassName)}>
        <Icon className='h-4.5 w-4.5 text-primary' />
      </div>
      <p className={cn('text-sm font-semibold text-ink-primary', titleClassName)}>
        {title}
      </p>
      {description && (
        <p className={cn('text-xs text-ink-secondary/70', descriptionClassName)}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
