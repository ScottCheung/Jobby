/** @format */

import { Tooltip } from '@jobby/ui';
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
          : ' hover:-translate-y-1 hover:scale-[1.015]',
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
              'text-primary fill-primary '
            : 'text-muted fill-muted dark:text-zinc-400 dark:fill-zinc-400',
          )}
        />

        <span
          className={cn(
            'label max-w-[120px] truncate px-2',
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
          >
            <Tooltip
              content={
                <div>
                  {' '}
                  Put all import questions into
                  <span className='text-primary font-semibold '>
                    {' '}
                    {cleanName(cat.name)}
                  </span>{' '}
                  category folder
                </div>
              }
              className={cn(
                'group overflow-hidden  transition-all duration-300 cursor-pointer',
                isSelected ?
                  'border-primary/30  bg-gradient-to-br from-primary/10 via-primary/5 to-background  '
                : ' hover:-translate-y-1 hover:scale-[1.015] ',
              )}
            >
              <div className='relative flex h-28 flex-col rounded-xl  items-center justify-center overflow-hidden'>
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
                    : 'text-muted fill-muted dark:text-zinc-400 dark:fill-zinc-400',
                  )}
                />

                <span
                  className={cn(
                    'label max-w-[120px] truncate px-2 text-center text-xs!',
                    isSelected ? 'text-primary' : (
                      'text-zinc-700 dark:text-zinc-300'
                    ),
                  )}
                >
                  {cleanName(cat.name)}
                </span>
              </div>
            </Tooltip>
          </button>
        );
      })}
    </div>
  );
}
