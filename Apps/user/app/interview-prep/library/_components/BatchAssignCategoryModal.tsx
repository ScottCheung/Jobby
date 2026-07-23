/** @format */

'use client';

import React, { useState } from 'react';
import { X, Folder, FolderX, Check, Search, Loader2 } from 'lucide-react';
import type { InterviewCategory } from '@/lib/types';
import { cleanName, cn } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/layout/modal';

interface BatchAssignCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  categories: InterviewCategory[];
  onAssignCategory: (categoryId: string | null) => Promise<void>;
}

export function BatchAssignCategoryModal({
  isOpen,
  onClose,
  selectedCount,
  categories,
  onAssignCategory,
}: BatchAssignCategoryModalProps) {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredCategories = categories.filter((cat) =>
    cleanName(cat.name).toLowerCase().includes(search.toLowerCase()),
  );

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onAssignCategory(selectedCatId);
      onClose();
    } catch (err) {
      console.error('Failed to batch assign category:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className='w-[90vw] max-w-md max-h-[85vh] text-ink-primary'
    >
      {/* Header */}
      <div className='flex items-center justify-between border-b border-border/40 px-6 py-5 shrink-0 bg-background-secondary/5'>
        <div>
          <h2 className='title-card text-ink-primary'>Assign Category</h2>
          <p className='body-sm text-ink-secondary mt-0.5'>
            Apply category to {selectedCount} selected question
            {selectedCount === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={onClose}
          disabled={isSaving}
          className='rounded-xl p-1.5 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors disabled:opacity-50'
        >
          <X className='h-5 w-5' />
        </button>
      </div>

      {/* Category Search */}
      {categories.length > 5 && (
        <div className='px-6 pt-4 shrink-0'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary' />
            <input
              type='text'
              placeholder='Search categories...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='body-md w-full pl-9 pr-4 py-2 rounded-xl bg-panel dark:bg-background-secondary dark:border-border focus:outline-none focus:border-primary/50 text-ink-primary'
            />
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-2 max-h-[50vh] min-h-[180px]'>
        {/* Uncategorized Option */}
        <button
          type='button'
          onClick={() => setSelectedCatId(null)}
          className={cn(
            'flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left',
            selectedCatId === null ?
              'bg-primary/10 border-primary text-primary font-semibold shadow-sm'
            : 'border-border/60 hover:border-primary/30 hover:bg-background-secondary/40 text-ink-primary',
          )}
        >
          <div className='flex items-center gap-3 min-w-0'>
            <div className='w-9 h-9 rounded-xl bg-zinc-500/15 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0'>
              <FolderX className='w-5 h-5' />
            </div>
            <div className='flex flex-col min-w-0'>
              <span className='label text-sm truncate'>Uncategorized</span>
              <span className='body-xs text-ink-secondary truncate'>
                Clear existing category
              </span>
            </div>
          </div>
          {selectedCatId === null && (
            <div className='w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 ml-2'>
              <Check className='w-3.5 h-3.5 stroke-[3]' />
            </div>
          )}
        </button>

        {/* Standard Categories */}
        {filteredCategories.map((cat) => {
          const isSelected = selectedCatId === cat.id;
          const cleanedName = cleanName(cat.name);
          return (
            <button
              key={cat.id}
              type='button'
              onClick={() => setSelectedCatId(cat.id)}
              className={cn(
                'flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left',
                isSelected ?
                  'bg-primary/10 border-primary text-primary font-semibold shadow-sm'
                : 'border-border/60 hover:border-primary/30 hover:bg-background-secondary/40 text-ink-primary',
              )}
            >
              <div className='flex items-center gap-3 min-w-0'>
                <div className='w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0'>
                  <Folder className='w-5 h-5' />
                </div>
                <span className='label text-sm truncate'>{cleanedName}</span>
              </div>
              {isSelected && (
                <div className='w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 ml-2'>
                  <Check className='w-3.5 h-3.5 stroke-[3]' />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className='flex items-center justify-end gap-3 p-6 border-t border-border/40 bg-background-secondary/5 shrink-0'>
        <Button
          variant='outline'
          onClick={onClose}
          disabled={isSaving}
          className='rounded-full'
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSaving}
          className='rounded-full flex items-center gap-2'
        >
          {isSaving && <Loader2 className='w-4 h-4 animate-spin' />}
          {isSaving ?
            'Updating...'
          : `Apply to ${selectedCount} Question${selectedCount === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Modal>
  );
}
