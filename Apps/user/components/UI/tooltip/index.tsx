/** @format */

'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const TooltipRoot = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;
const style =
  'z-50  break-words  rounded-xl bg-white/90 dark:bg-black/90 backdrop-blur-xl px-3 py-2 text-sm border-3 border-primary/20 text-ink-primary  shadow-lg pointer-events-none dark:border-border dark:bg-background dark:text-zinc-100';
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
  size?: 'sm' | 'md' | 'lg' | 'xl';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  size = 'md',
  className,
  delay = 50,
}: TooltipProps) {
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        {content && (
          <TooltipContent
            side={side}
            className={cn(
              style,
              className,
              size === 'sm' && 'max-w-48!',
              size === 'md' && 'max-w-96!',
              size === 'lg' && 'max-w-[70vw]!',
              size === 'xl' && 'max-w-full!',
            )}
          >
            {content}
          </TooltipContent>
        )}
      </TooltipRoot>
    </TooltipProvider>
  );
}

export function Kbd({
  children,
  className,
  size = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center cursor-help rounded border border-border/80 bg-background-secondary/80 px-1 py-0.5 font-mono text-[9px] font-bold text-ink-primary shadow-xs leading-none select-none ml-1',

        className,
      )}
    >
      {children}
    </kbd>
  );
}

export { TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider };
