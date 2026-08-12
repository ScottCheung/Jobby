/** @format */

'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useConfirmStore, resolveConfirm } from '@/lib/store/confirm-store';
import { Button } from '../UI/Button';
import { Trash2, FolderMinus, AlertTriangle, Info } from 'lucide-react';

export function GlobalConfirm() {
  const { isOpen, title, message, confirmLabel, cancelLabel, type } =
    useConfirmStore();

  const getIcon = () => {
    switch (type) {
      case 'delete':
        return (
          <div className='w-12 h-12 rounded-2xl bg-primary/50 text-primary-foreground flex items-center justify-center mb-4 shrink-0'>
            <Trash2 className='w-5 h-5' />
          </div>
        );
      case 'remove':
        return (
          <div className='w-12 h-12 rounded-2xl bg-primary/50 text-primary-foreground flex items-center justify-center mb-4 shrink-0'>
            <FolderMinus className='w-5 h-5' />
          </div>
        );
      case 'warning':
        return (
          <div className='w-12 h-12 rounded-2xl bg-primary/50 text-primary-foreground flex items-center justify-center mb-4 shrink-0'>
            <AlertTriangle className='w-5 h-5' />
          </div>
        );
      case 'info':
        return (
          <div className='w-12 h-12 rounded-2xl bg-primary/50 text-primary-foreground flex items-center justify-center mb-4 shrink-0'>
            <Info className='w-5 h-5' />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center px-4'>
          <motion.button
            type='button'
            aria-label='Close confirmation'
            className='absolute inset-0 bg-black/45 backdrop-blur-sm'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => resolveConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className='relative w-full max-w-md rounded-3xl border border-border/60 bg-panel p-6 shadow-2xl'
          >
            {getIcon()}
            <h3 className='title-card'>{title}</h3>
            <p className='body-md mt-2 text-ink-secondary'>{message}</p>
            <div className='mt-6 flex items-center justify-end gap-3'>
              <Button variant={'ghost'} onClick={() => resolveConfirm(false)}>
                {cancelLabel}
              </Button>
              <Button onClick={() => resolveConfirm(true)}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
