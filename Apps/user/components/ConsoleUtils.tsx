/** @format */

'use client';

import React from 'react';
import { RefreshCw, Settings, Trash2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JobApplication } from '@/lib/types';

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IconButton({
  label,
  icon,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  icon: 'async' | 'edit' | 'delete' | 'open';
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const Icon = {
    async: RefreshCw,
    edit: Settings,
    delete: Trash2,
    open: ExternalLink,
  }[icon];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'p-2 rounded-xl transition-all border border-zinc-200/60 dark:border-zinc-800/60 bg-panel hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 dark:hover:bg-zinc-800/40 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.96] shadow-xs cursor-pointer',
        danger &&
          'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-955/20 border-red-100 dark:border-red-900/30',
      )}
    >
      <Icon className='w-4 h-4' />
    </button>
  );
}

export function renderPagination(
  currentPage: number,
  totalItems: number,
  itemsPerPage: number,
  onPageChange: (page: number) => void,
) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className='flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800/60 pt-4 mt-4'>
      <span className='text-xs text-zinc-500 dark:text-zinc-400'>
        Showing <span className='font-semibold'>{startIdx}</span> to{' '}
        <span className='font-semibold'>{endIdx}</span> of{' '}
        <span className='font-semibold'>{totalItems}</span> entries
      </span>
      <div className='flex items-center gap-2'>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className='p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer'
        >
          <ChevronLeft className='w-4 h-4' />
        </button>
        <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-300 px-2'>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className='p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer'
        >
          <ChevronRight className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
}
