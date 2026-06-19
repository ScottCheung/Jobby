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
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

export function CollapsibleHeader({
  title,
  icon,
  isCollapsed,
  actions,
  className,
}: CollapsibleHeaderProps) {
  return (
    <motion.div
      layout
      transition={springTransition}
      className={cn(
        'flex flex-wrap items-center justify-between w-full pb-4 shrink-0 select-none transition-colors duration-1000',
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
        {icon && (
          <motion.div
            layout
            transition={springTransition}
            className={cn(
              'flex items-center justify-center text-emerald-500 shrink-0',
              isCollapsed ? 'scale-75' : 'scale-100',
            )}
          >
            {icon}
          </motion.div>
        )}
        <motion.h2
          layout
          transition={springTransition}
          className={cn(
            'font-bold text-zinc-900 dark:text-zinc-50 origin-left tracking-tight shrink-0',
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
          transition={springTransition}
          className={cn(
            'flex items-center gap-3',
            isCollapsed ?
              'flex-1 justify-end max-w-2xl'
            : 'w-full justify-between mt-3',
          )}
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}
