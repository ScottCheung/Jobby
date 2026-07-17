/** @format */

'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const TooltipRoot = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;
const style =
  'z-50 max-w-[50vw] break-words rounded-xl bg-panel backdrop-blur-sm px-3 py-2 text-[13px] text-ink-primary shadow-lg pointer-events-none dark:border-border dark:bg-background dark:text-zinc-100';
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 16, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(style, className)}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Wrapper component to match previous API
interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
  delay = 50,
}: TooltipProps) {
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        {content && (
          <TooltipContent side={side} className={cn(style, className)}>
            {content}
          </TooltipContent>
        )}
      </TooltipRoot>
    </TooltipProvider>
  );
}

export { TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider };
