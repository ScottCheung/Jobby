/** @format */

'use client';
/** @format */

import * as React from 'react';
import { HelpCircle } from '@jobby/ui/components/icons';
import { cn } from '@/lib/utils';
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from '../tooltip';

export interface LabelWithHelpProps {
  label: string;
  helpTextShort?: string;
  helpTextLong?: string;
  className?: string;
  required?: boolean;
  optional?: boolean;
}

export const LabelWithHelp: React.FC<LabelWithHelpProps> = ({
  label,
  helpTextShort,
  helpTextLong,
  className,
  required = false,
  optional = false,
}) => {
  // 合并 helpText 内容：优先使用 helpText / helpTextLong / helpTextShort
  const tooltipText = (helpTextLong || helpTextShort || '').trim();
  const hasHelpText = tooltipText.length > 0;

  return (
    <div className={cn('col', className)}>
      <div className='flex items-center gap-1.5'>
        <label className='text-xs font-semibold text-ink-primary select-none'>
          {label}
          {required && <span className='text-rose-500 font-bold ml-0.5'>*</span>}
        </label>
        {optional && (
          <span className='rounded-sm bg-background-secondary px-1 py-0.2 text-[8px] font-semibold uppercase tracking-wide text-ink-secondary'>
            Optional
          </span>
        )}
        {hasHelpText && (
          <TooltipProvider delayDuration={200}>
            <TooltipRoot>
              <TooltipTrigger asChild>
                <button type='button' className='inline-flex items-center'>
                  <HelpCircle className='size-3.5 text-ink-secondary cursor-help hover:text-primary transition-colors' />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side='right'
                className='body-sm max-w-xs'
                sideOffset={5}
              >
                <p>{tooltipText}</p>
              </TooltipContent>
            </TooltipRoot>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};
