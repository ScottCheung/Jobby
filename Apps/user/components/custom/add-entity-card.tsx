/** @format */

'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AddEntityCardProps {
  onClick: () => void;
  label: string;
  className?: string;
}

export function AddEntityCard({
  onClick,
  label,
  className,
}: AddEntityCardProps) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-gray-200 bg-transparent transition-all hover:border-primary/50 hover:bg-primary/5 dark:border-zinc-700 dark:hover:border-primary/50',
        className,
      )}
    >
      <div className='flex w-12 h-12 items-center justify-center rounded-full bg-gray-500/10 text-gray-400 transition-all duration-300 ease-in-out group-hover:w-24 group-hover:h-24 group-hover:bg-primary/10 group-hover:text-primary dark:bg-zinc-800 dark:text-ink-secondary'>
        <Plus className='w-6 h-6 transition-all duration-300 ease-in-out group-hover:w-12 group-hover:h-12' />
      </div>
      <p className='text-sm font-semibold text-gray-600 transition-colors group-hover:text-primary dark:text-gray-400'>
        {label}
      </p>
    </motion.div>
  );
}
