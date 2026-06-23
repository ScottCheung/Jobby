/** @format */

'use client';

import * as React from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DrawerProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  isOpen: boolean;
  onClose?: () => void;
  width?: number | string;
  children: React.ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  width = 400,
  children,
  className,
  ...props
}: DrawerProps) {
  const springTransition = {
    type: 'spring',
    stiffness: 400,
    damping: 40,
  } as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type='button'
            aria-label='Close drawer'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className='fixed inset-0 z-30   cursor-pointer'
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            // transition={springTransition}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6 }}
            className={cn(
              'fixed right-0 top-0 z-30 h-screen backdrop-blur-[20px] overflow-hidden border-l border-border bg-background/20 shadow-2xl shadow-primary/20',
              className,
            )}
            style={{ width }}
            {...props}
          >
            <div
              className='h-full overflow-y-auto scrollbar-gutter-stable'
              style={{
                width,
                scrollbarGutter: 'stable',
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
