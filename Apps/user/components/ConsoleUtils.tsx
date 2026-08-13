/** @format */

'use client';

import React from 'react';
import { Settings, Trash2, ExternalLink, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JobApplication } from '@/lib/types';

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const absDiffMs = Math.abs(diffMs);
  const diffSec = Math.floor(absDiffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffDays >= 14) {
    return formatDate(iso);
  }

  if (diffMs < 0) {
    if (diffDays >= 1) {
      return `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
    }
    if (diffHr >= 1) {
      return `in ${diffHr} ${diffHr === 1 ? 'hour' : 'hours'}`;
    }
    if (diffMin >= 1) {
      return `in ${diffMin} ${diffMin === 1 ? 'min' : 'mins'}`;
    }
    return 'in moments';
  }

  if (diffDays >= 1) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
  if (diffHr >= 1) {
    return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diffMin >= 1) {
    return `${diffMin} ${diffMin === 1 ? 'min' : 'mins'} ago`;
  }
  return 'just now';
}

export function IconButton({
  label,
  icon,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  icon: 'edit' | 'delete' | 'open' | 'resume';
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const Icon = {
    edit: Settings,
    delete: Trash2,
    open: ExternalLink,
    resume: FileText,
  }[icon];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'p-2 rounded-xl transition-all border border-border/50 bg-panel hover:bg-zinc-50 text-ink-primary0 hover:text-zinc-900 dark:hover:bg-background-secondary/40 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.96] shadow-xs cursor-pointer',
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
    <div className='flex items-center justify-between border-t border-border/50 pt-4 mt-4'>
      <span className='text-meta text-ink-primary0'>
        Showing <span className='font-semibold'>{startIdx}</span> to{' '}
        <span className='font-semibold'>{endIdx}</span> of{' '}
        <span className='font-semibold'>{totalItems}</span> entries
      </span>
      <div className='flex items-center gap-2'>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className='p-1.5 rounded-lg border border-border hover:bg-background-secondary text-ink-primary0 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer'
        >
          <ChevronLeft className='w-4 h-4' />
        </button>
        <span className='label-sm px-2'>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className='p-1.5 rounded-lg border border-border hover:bg-background-secondary text-ink-primary0 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer'
        >
          <ChevronRight className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
}
