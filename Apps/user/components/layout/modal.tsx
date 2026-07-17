/** @format */

'use client';

import * as React from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ModalProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  isOpen: boolean;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
  children: React.ReactNode;
  containerClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  closeOnOverlayClick = true,
  children,
  className,
  containerClassName,
  ...props
}: ModalProps) {
  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key press to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6',
            containerClassName,
          )}
        >
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className='absolute inset-0 bg-background/20 backdrop-blur-sm cursor-pointer'
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={cn(
              'relative z-10 card backdrop-blur-[20px] shadow-brand w-full flex flex-col overflow-hidden bg-background dark:bg-white/10!',
              className,
            )}
            {...props}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
