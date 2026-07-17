/** @format */

import * as React from 'react';
import { LucideIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyPlaceHolderProps {
  icon?: LucideIcon | null;
  message?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  messageClassName?: string;
}

export function EmptyPlaceHolder({
  icon: Icon = FileText,
  message,
  children,
  className,
  iconClassName,
  messageClassName,
}: EmptyPlaceHolderProps) {
  return (
    <div className={cn('panel-lg items-center', className)}>
      <div className='py-6 text-center w-full'>
        {Icon && (
          <Icon
            className={cn(
              'w-20 h-20 mx-auto text-ink-secondary/10 mb-4',
              iconClassName,
            )}
          />
        )}

        <p className={cn('text-sm text-ink-secondary/30', messageClassName)}>
          {message || 'No Content'}
        </p>

        {children}
      </div>
    </div>
  );
}
