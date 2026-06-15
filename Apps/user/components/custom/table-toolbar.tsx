/** @format */

'use client';

import * as React from 'react';
import { Search, Settings2, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/UI/popover';
import { AccountFilter, type Account } from './account-filter';
import { cn } from '@/lib/utils';
import { H4 } from '@/components/UI/text/typography';

interface TableToolbarProps {
  search: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    isDebouncing?: boolean;
  };

  filter?: {
    accounts: Account[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    totalCount?: number;
    title?: string;
  };
  onSettingsClick: () => void;
  className?: string;
  isSettingsOpen?: boolean;
  children?: React.ReactNode;
}

export function TableToolbar({
  search,
  filter,
  onSettingsClick,
  className,
  isSettingsOpen,
  children,
}: TableToolbarProps) {
  const hasActiveFilters = filter ? filter.selectedIds.length > 0 : false;

  return (
    <div className={cn('flex gap-4 flex-1 ', className)}>
      {/* Search */}
      <div className='relative flex-1 group'>
        {filter ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type='button'
                className='absolute left-4 top-1/2 -translate-y-1/2 p-1 -ml-1 rounded-full hover:bg-glass transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary z-10'
              >
                <Search
                  className={cn(
                    'size-4 text-ink-secondary transition-colors',
                    'group-focus-within:text-primary',
                    hasActiveFilters && 'text-primary fill-primary/20',
                  )}
                />
                {hasActiveFilters && (
                  <span className='absolute top-0.5 right-0.5 size-1.5 bg-primary rounded-full border border-background' />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className='w-[340px] md:w-[600px] lg:w-[800px] p-card rounded-card'
              align='start'
            >
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <H4>{filter.title || 'Filter by Account'}</H4>
                  {hasActiveFilters && (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-auto p-0 text-xs text-ink-secondary hover:text-ink-primary'
                      onClick={() => filter.onSelectionChange([])}
                    >
                      Reset
                    </Button>
                  )}
                </div>
                <div className='max-h-[400px]  overflow-y-auto pr-2 -mr-2'>
                  <AccountFilter
                    accounts={filter.accounts}
                    selectedIds={filter.selectedIds}
                    onSelectionChange={filter.onSelectionChange}
                    totalCount={filter.totalCount}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Search className='absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-secondary group-focus-within:text-primary transition-colors' />
        )}

        <Input
          placeholder={search.placeholder || 'Search...'}
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          className={cn(
            '!pl-11 rounded-full text-ink-secondary',
            search.value.length > 0 && 'pr-11',
          )}
        />
        <AnimatePresence mode='wait'>
          {search.isDebouncing ? (
            <motion.div
              key='spinner'
              initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
              transition={{ duration: 0.15 }}
              className='absolute right-1 top-1/2 -translate-y-1/2 p-3 pointer-events-none'
            >
              <Loader2 className='size-4 animate-spin text-primary' />
            </motion.div>
          ) : search.value.length > 0 ? (
            <motion.button
              key='clear-button'
              type='button'
              initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => search.onChange('')}
              className='absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-3 text-ink-secondary transition-colors cursor-pointer hover:text-ink-primary hover:bg-background'
            >
              <X className='size-4' />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className='flex items-center gap-2 bg-glass p-1 rounded-full'>
        {children}
        {/* View Settings */}
        <Button
          variant={isSettingsOpen ? 'default' : 'ghost'}
          size='icon'
          className='rounded-full'
          onClick={onSettingsClick}
          title='View Settings'
        >
          <Settings2 className='size-4' />
        </Button>
      </div>
    </div>
  );
}
