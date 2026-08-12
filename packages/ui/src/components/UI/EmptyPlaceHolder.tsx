/** @format */

import * as React from 'react';
import { LucideIcon, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EmptyPlaceHolderProps {
  icon?: LucideIcon | null;
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
  icon: Icon = FileText,
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

  return (
    <div className={cn('panel-lg items-center justify-center', className)}>
      <div className='py-6 text-center w-full flex flex-col items-center justify-center'>
        {Icon && (
          <Icon
            className={cn(
              'w-16 h-16 mx-auto text-ink-secondary/40 mb-3',
              iconClassName,
            )}
          />
        )}

        <p className={cn('body-md text-ink-secondary/60 font-medium', messageClassName || titleClassName)}>
          {displayTitle}
        </p>

        {description && (
          <p className={cn('text-xs text-ink-secondary/70 mt-1 max-w-sm mx-auto', descriptionClassName)}>
            {description}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
