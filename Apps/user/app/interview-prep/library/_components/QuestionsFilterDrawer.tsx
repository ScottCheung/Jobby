/** @format */

'use client';

import React from 'react';
import { X, Star } from 'lucide-react';
import type { InterviewCategory, InterviewTag } from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';

export interface QuestionsFilterDrawerProps {
  categories: InterviewCategory[];
  tags: InterviewTag[];
  selectedCategoryIds: string[];
  setSelectedCategoryIds: (ids: string[]) => void;
  selectedTagIds: string[];
  setSelectedTagIds: (ids: string[]) => void;
  selectedImportances: number[];
  setSelectedImportances: React.Dispatch<React.SetStateAction<number[]>>;
  selectedFrequencies: string[];
  setSelectedFrequencies: React.Dispatch<React.SetStateAction<string[]>>;
  onClose: () => void;
}

export function QuestionsFilterDrawer({
  categories,
  tags,
  selectedCategoryIds,
  setSelectedCategoryIds,
  selectedTagIds,
  setSelectedTagIds,
  selectedImportances,
  setSelectedImportances,
  selectedFrequencies,
  setSelectedFrequencies,
  onClose,
}: QuestionsFilterDrawerProps) {
  const hasActiveFilters =
    selectedCategoryIds.length > 0 ||
    selectedTagIds.length > 0 ||
    selectedImportances.length > 0 ||
    selectedFrequencies.length > 0;

  const handleClearAll = () => {
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setSelectedImportances([]);
    setSelectedFrequencies([]);
  };

  const handleCategoryClick = (id: string | null) => {
    if (id === null) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(
        selectedCategoryIds.includes(id) ?
          selectedCategoryIds.filter((x) => x !== id)
        : [...selectedCategoryIds, id],
      );
    }
  };

  const handleTagClick = (id: string | null) => {
    if (id === null) {
      setSelectedTagIds([]);
    } else {
      setSelectedTagIds(
        selectedTagIds.includes(id) ?
          selectedTagIds.filter((x) => x !== id)
        : [...selectedTagIds, id],
      );
    }
  };

  return (
    <div className='flex flex-col h-full bg-panel text-ink-primary'>
      {/* Header */}
      <div className='p-5 border-b border-border/40 flex items-center justify-between shrink-0 bg-background-secondary/20'>
        <div>
          <h3 className='text-base font-bold'>Filters</h3>
          <p className='text-xs text-ink-secondary mt-0.5'>
            Refine the questions library list
          </p>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='text-ink-secondary hover:text-ink-primary p-1 rounded-lg hover:bg-background-secondary hover:bg-background-secondary transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar-primary'>
        {/* Category Filter */}
        {categories.length > 0 && (
          <div className='flex flex-col gap-2.5'>
            <span className='label-overline'>
              Category
            </span>
            <div className='flex flex-wrap gap-1.5'>
              <button
                type='button'
                onClick={() => handleCategoryClick(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  selectedCategoryIds.length === 0 ?
                    'bg-primary/10 text-primary border-primary/30 font-bold'
                  : 'border-border dark:border-border text-ink-secondary hover:text-ink-primary hover:border-primary/30 bg-panel',
                )}
              >
                All Categories
              </button>
              {categories.map((cat) => {
                const active = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type='button'
                    onClick={() => handleCategoryClick(cat.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      active ?
                        'bg-primary/10 text-primary border-primary/30 font-bold'
                      : 'border-border dark:border-border text-ink-secondary hover:text-ink-primary hover:border-primary/30 bg-panel',
                    )}
                  >
                    {cleanName(cat.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tag Filter */}
        {tags.length > 0 && (
          <div className='flex flex-col gap-2.5 pt-4 border-t border-border/40'>
            <span className='label-overline'>
              Tag
            </span>
            <div className='flex flex-wrap gap-1.5'>
              <button
                type='button'
                onClick={() => handleTagClick(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  selectedTagIds.length === 0 ?
                    'bg-primary/10 text-primary border-primary/30 font-bold'
                  : 'border-border dark:border-border text-ink-secondary hover:text-ink-primary hover:border-primary/30 bg-panel',
                )}
              >
                All Tags
              </button>
              {tags.map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type='button'
                    onClick={() => handleTagClick(tag.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      active ?
                        'bg-primary/10 text-primary border-primary/30 font-bold'
                      : 'border-border dark:border-border text-ink-secondary hover:text-ink-primary hover:border-primary/30 bg-panel',
                    )}
                  >
                    #{cleanName(tag.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Importance Filter */}
        <div className='flex flex-col gap-2.5 pt-4 border-t border-border/40'>
          <span className='label-overline'>
            Importance
          </span>
          <div className='flex gap-1.5'>
            {[5, 4, 3, 2, 1].map((n) => {
              const active = selectedImportances.includes(n);
              return (
                <button
                  key={n}
                  type='button'
                  onClick={() =>
                    setSelectedImportances((prev) =>
                      prev.includes(n) ?
                        prev.filter((x) => x !== n)
                      : [...prev, n],
                    )
                  }
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                    active ?
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/40 font-extrabold'
                    : 'border-border dark:border-border text-ink-secondary hover:text-ink-primary bg-panel',
                  )}
                >
                  {n}
                  <Star
                    className={cn(
                      'w-3.5 h-3.5',
                      active && 'fill-amber-500 text-amber-500',
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Frequency Filter */}
        <div className='flex flex-col gap-2.5 pt-4 border-t border-border/40'>
          <span className='label-overline'>
            Frequency
          </span>
          <div className='flex gap-1.5'>
            {['High', 'Medium', 'Low'].map((f) => {
              const active = selectedFrequencies.includes(f);
              const activeColor =
                f === 'High' ?
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-400/40 font-bold'
                : f === 'Medium' ?
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/40 font-bold'
                : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-400/40 font-bold';
              return (
                <button
                  key={f}
                  type='button'
                  onClick={() =>
                    setSelectedFrequencies((prev) =>
                      prev.includes(f) ?
                        prev.filter((x) => x !== f)
                      : [...prev, f],
                    )
                  }
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
                    active ? activeColor : (
                      'border-border dark:border-border text-ink-secondary hover:text-ink-primary bg-panel'
                    ),
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className='p-5 border-t border-border/40 flex justify-between gap-2 shrink-0 bg-background-secondary/20'>
        {hasActiveFilters ?
          <button
            type='button'
            onClick={handleClearAll}
            className='px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-955/20 text-red-600 dark:text-red-400 text-sm font-semibold transition-colors'
          >
            Clear All
          </button>
        : <div />}
        <button
          type='button'
          onClick={onClose}
          className='px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity'
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
}
