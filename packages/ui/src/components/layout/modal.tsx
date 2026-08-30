/** @format */

'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ModalProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  isOpen: boolean;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
  children: React.ReactNode;
  containerClassName?: string;
  layoutId?: string;
}

export function Modal({
  isOpen,
  onClose,
  closeOnOverlayClick = true,
  children,
  className,
  containerClassName,
  layoutId,
  ...props
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key='modal-portal-wrapper'
          layoutRoot
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            containerClassName,
          )}
        >
          {/* Backdrop Overlay */}
          <motion.div
            key='modal-backdrop'
            initial={{ opacity: 0, backdropFilter: 'blur(0px) brightness(1)' }}
            animate={{
              opacity: 1,
              backdropFilter: 'blur(20px)',
            }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.2 }}
            className='absolute inset-0 z-0 bg-background/20 cursor-pointer'
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Modal Container */}
          <motion.div
            key='modal-content-container'
            layout
            layoutId={layoutId}
            initial={layoutId ? undefined : { y: 10, scale: 0.9, opacity: 0 }}
            animate={
              layoutId
                ? undefined
                : {
                    y: 0,
                    scale: 1,
                    opacity: 1,
                  }
            }
            exit={
              layoutId
                ? undefined
                : {
                    y: 10,
                    scale: 0.9,
                    opacity: 0,
                  }
            }
            transition={{
              type: 'spring',
              duration: 0.7,
              bounce: 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={layoutId ? { transition: 'none' } : undefined}
            className={cn(
              'relative z-50 card backdrop-blur-[20px] md:shadow-brand w-full flex flex-col overflow-hidden bg-background dark:bg-black/10!',
              className,
            )}
            {...props}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
