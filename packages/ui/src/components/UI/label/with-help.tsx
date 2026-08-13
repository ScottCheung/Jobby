'use client';
/** @format */

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from '@/components/UI/tooltip';

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
      <div className='row'>
        <label className='label'>
          {label}
          {required && <span className='text-red-500 ml-1'>*</span>}
        </label>
        {required && (
          <span className='rounded-sm bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-500'>
            Required
          </span>
        )}
        {!required && optional && (
          <span className='rounded-sm bg-background-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-secondary'>
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
