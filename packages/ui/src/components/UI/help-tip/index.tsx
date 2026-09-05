/** @format */

'use client';

import React from 'react';
import { HelpCircle } from '@jobby/ui/components/icons';
import { Button } from '../Button';
import { Tooltip } from '../tooltip';
import { cn } from '../../../lib/utils';

type HelpTipProps = {
  content: React.ReactNode;
  className?: string;
};

export function HelpTip({ content, className }: HelpTipProps) {
  return (
    <Tooltip
      content={
        <div className='body-sm max-w-xs'>{content}</div>
      }
      side='top'
    >
      <Button
        type='button'
        aria-label='Help'
        className={cn(
          'inline-flex h-6 w-6 items-center cursor-help justify-center rounded-full text-ink-secondary/20 transition-colors hover:text-primary',
          className,
        )}
      >
        <HelpCircle className='h-6 w-6' />
      </Button>
    </Tooltip>
  );
}
