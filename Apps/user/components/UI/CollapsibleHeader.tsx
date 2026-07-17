/** @format */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CollapsibleHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  isCollapsed: boolean;
  actions?: React.ReactNode;
  className?: string;
}

// Custom spring transition for smooth, organic, and jitter-free animations
export const springTransition = {
  duration: 1,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function CollapsibleHeader({
  title,
  isCollapsed,
  actions,
  className,
}: CollapsibleHeaderProps) {
  return (
    <motion.div
      layout
      transition={springTransition}
      className={cn(
        'flex flex-wrap items-center justify-between w-full pb-4 shrink-0 select-none ',
        // isCollapsed ? ' pb-2' : ' pb-0 mb-4',
        className,
      )}
    >
      {/* Title Area: w-full when expanded to force actions to wrap, w-auto when collapsed */}
      <motion.div
        layout
        transition={springTransition}
        className={cn(
          'flex items-center gap-2',
          isCollapsed ? 'w-auto' : 'w-full',
        )}
      >
        <motion.h2
          layout
          transition={springTransition}
          className={cn(
            'font-bold text-ink-primary origin-left tracking-tight shrink-0',
            isCollapsed ? 'text-lg' : 'text-2xl',
          )}
        >
          {title}
        </motion.h2>
      </motion.div>

      {/* Actions Area: w-full when expanded, flex-1 justify-end when collapsed */}
      {actions && (
        <motion.div
          layout
          // animate={{ y: isCollapsed ? -5 : 0 }}
          transition={springTransition}
          // className={cn(
          // 'flex items-center gap-3',
          //   isCollapsed ?
          //     'flex-1 justify-end max-w-2xl'
          //   : 'w-full justify-between mt-3',
          // )}
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}
