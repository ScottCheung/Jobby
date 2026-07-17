/** @format */

import React from 'react';
import { CheckCircle2, Folder } from 'lucide-react';
import type { InterviewCategory } from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';

interface CategorySelectorProps {
  importDefaultCategory: string;
  setImportDefaultCategory: (val: string) => void;
  categories: InterviewCategory[];
}

export function CategorySelector({
  importDefaultCategory,
  setImportDefaultCategory,
  categories,
}: CategorySelectorProps) {
  return (
    <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'>
      {/* No Category */}
      <button
        type='button'
        onClick={() => setImportDefaultCategory('')}
        className={cn(
          'group relative flex h-28 flex-col items-center justify-center overflow-hidden rounded-2xl  transition-all duration-300 cursor-pointer',
          importDefaultCategory === '' ?
            'bg-gradient-to-br from-primary/5 via-primary/5 to-background  scale-[1.02]'
          : 'status-panel hover:-translate-y-1 hover:scale-[1.015] hover:shadow-xl hover:shadow-black/5',
        )}
      >
        {/* Top Glow */}
        {importDefaultCategory === '' && (
          <div className='absolute inset-0'>
            <div className='absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-primary/15 to-transparent' />
          </div>
        )}

        {/* Check */}
        {importDefaultCategory === '' && (
          <CheckCircle2 className='absolute right-3 top-3 h-5 w-5 text-primary' />
        )}

        <Folder
          className={cn(
            'mb-3 h-10 w-10 transition-all duration-300',
            importDefaultCategory === '' ?
              'text-primary drop-shadow-sm'
            : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300',
          )}
        />

        <span
          className={cn(
            'max-w-[120px] truncate px-2 text-sm font-medium tracking-tight',
            importDefaultCategory === '' ? 'text-primary' : (
              'text-zinc-700 dark:text-zinc-300'
            ),
          )}
        >
          No Category
        </span>
      </button>

      {/* Categories */}
      {categories.map((cat) => {
        const isSelected = importDefaultCategory === cat.id;

        return (
          <button
            key={cat.id}
            type='button'
            onClick={() => setImportDefaultCategory(cat.id)}
            className={cn(
              'group relative flex h-28 flex-col items-center justify-center overflow-hidden  transition-all duration-300 cursor-pointer',
              isSelected ?
                'border-primary/30 rounded-xl  bg-gradient-to-br from-primary/10 via-primary/5 to-background  '
              : 'status-panel hover:-translate-y-1 hover:scale-[1.015] hover:shadow-xl hover:shadow-black/5',
            )}
          >
            {/* Top Glow */}
            {isSelected && (
              <div className='absolute inset-0'>
                <div className='absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-primary/15 to-transparent' />
              </div>
            )}

            {/* Check */}
            {isSelected && (
              <CheckCircle2 className='absolute right-3 top-3 h-4 w-4 text-primary' />
            )}

            <Folder
              className={cn(
                'mb-3 h-10 w-10 transition-all duration-300',
                isSelected ?
                  'text-primary fill-primary '
                : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300',
              )}
            />

            <span
              className={cn(
                ' truncate px-2 text-center text-sm font-medium tracking-tight',
                isSelected ? 'text-primary' : (
                  'text-zinc-700 dark:text-zinc-300'
                ),
              )}
            >
              {cleanName(cat.name)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
