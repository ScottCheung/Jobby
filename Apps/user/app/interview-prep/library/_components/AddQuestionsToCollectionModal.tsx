/** @format */

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  Search,
  SlidersHorizontal,
  Folder,
  Star,
  Loader2,
  FolderPlus,
  RotateCcw,
} from 'lucide-react';
import type {
  InterviewQuestion,
  InterviewCategory,
  InterviewTag,
  InterviewCollection,
} from '@/lib/types';
import { cleanName, cn } from '@/lib/utils';
import { Button } from '@jobby/ui';
import { Modal } from '@/components/layout/modal';
import { useLayoutStore } from '@/lib/store/layout-store';
import { QuestionsFilterDrawer } from './QuestionsFilterDrawer';
import { EmptyPlaceHolder } from '@/components/UI/EmptyPlaceHolder';

interface AddQuestionsToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: InterviewCollection;
  questions: InterviewQuestion[];
  categories: InterviewCategory[];
  tags: InterviewTag[];
  onSave: (ids: string[]) => Promise<void>;
}

export function AddQuestionsToCollectionModal({
  isOpen,
  onClose,
  collection,
  questions,
  categories,
  tags,
  onSave,
}: AddQuestionsToCollectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedImportances, setSelectedImportances] = useState<number[]>([]);
  const [selectedFrequencies, setSelectedFrequencies] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);
  const isDrawerOpen = useLayoutStore((state) => state.isDrawerOpen);
  const drawerOpenId = useLayoutStore((state) => state.drawerConfig.id);

  // Exclude questions that are already in the collection
  const candidates = useMemo(() => {
    const existingSet = new Set(collection.question_ids || []);
    return questions.filter((q) => !existingSet.has(q.id));
  }, [questions, collection.question_ids]);

  // Filter candidates based on current criteria
  const filteredCandidates = useMemo(() => {
    return candidates.filter((q) => {
      const matchesSearch =
        search === '' || q.title.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategoryIds.length === 0 ||
        selectedCategoryIds.some((catId) => {
          if (catId === 'uncategorized') return !q.category_id;
          return q.category_id === catId;
        });
      const matchesTag =
        selectedTagIds.length === 0 ||
        q.tags?.some((t) => selectedTagIds.includes(t.id));
      const matchesImportance =
        selectedImportances.length === 0 ||
        (q.importance_score !== null &&
          q.importance_score !== undefined &&
          selectedImportances.includes(q.importance_score));
      const matchesFrequency =
        selectedFrequencies.length === 0 ||
        (q.frequency !== null &&
          q.frequency !== undefined &&
          selectedFrequencies.includes(q.frequency));

      return (
        matchesSearch &&
        matchesCategory &&
        matchesTag &&
        matchesImportance &&
        matchesFrequency
      );
    });
  }, [
    candidates,
    search,
    selectedCategoryIds,
    selectedTagIds,
    selectedImportances,
    selectedFrequencies,
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));

  const allFilteredSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((q) => selectedIds.includes(q.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredCandidates.map((q) => q.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const newIds = filteredCandidates.map((q) => q.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...newIds])));
    }
  };

  const handleClearAllFilters = () => {
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setSelectedImportances([]);
    setSelectedFrequencies([]);
    setSearch('');
  };

  const handleOpenFilters = useCallback(() => {
    openDrawer({
      id: 'collection-questions-filter',
      width: 400,
      content: (
        <QuestionsFilterDrawer
          categories={categories}
          tags={tags}
          selectedCategoryIds={selectedCategoryIds}
          setSelectedCategoryIds={setSelectedCategoryIds}
          selectedTagIds={selectedTagIds}
          setSelectedTagIds={setSelectedTagIds}
          selectedImportances={selectedImportances}
          setSelectedImportances={setSelectedImportances}
          selectedFrequencies={selectedFrequencies}
          setSelectedFrequencies={setSelectedFrequencies}
          onClose={closeDrawer}
        />
      ),
    });
  }, [
    categories,
    tags,
    selectedCategoryIds,
    selectedTagIds,
    selectedImportances,
    selectedFrequencies,
    openDrawer,
    closeDrawer,
  ]);

  useEffect(() => {
    if (isDrawerOpen && drawerOpenId === 'collection-questions-filter') {
      handleOpenFilters();
    }
  }, [
    selectedCategoryIds,
    selectedTagIds,
    selectedImportances,
    selectedFrequencies,
    isDrawerOpen,
    drawerOpenId,
    handleOpenFilters,
  ]);

  const handleCloseModal = () => {
    if (drawerOpenId === 'collection-questions-filter') {
      closeDrawer();
    }
    onClose();
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    setIsSaving(true);
    try {
      if (drawerOpenId === 'collection-questions-filter') {
        closeDrawer();
      }
      await onSave(selectedIds);
    } catch (err) {
      console.error('Failed to add questions to collection:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const activeFiltersCount =
    selectedCategoryIds.length +
    selectedTagIds.length +
    selectedImportances.length +
    selectedFrequencies.length;

  return (
    <Modal
      isOpen={isOpen}
      layoutId='add-questions-to-collection'
      onClose={handleCloseModal}
      className='w-[92vw] max-w-4xl max-h-[88vh] text-ink-primary'
    >
      {/* Header */}
      <div className='flex items-center justify-between border-b border-border/40 px-6 py-5 shrink-0 bg-background-secondary/5'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0'>
            <FolderPlus className='w-5 h-5' />
          </div>
          <div>
            <h2 className='title-card text-ink-primary'>
              Add Questions to &quot;{cleanName(collection.title)}&quot;
            </h2>
            <p className='body-sm text-ink-secondary mt-0.5'>
              Filter, select, and batch add questions from your library
            </p>
          </div>
        </div>
        <button
          onClick={handleCloseModal}
          disabled={isSaving}
          className='rounded-xl p-1.5 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors disabled:opacity-50'
        >
          <X className='h-5 w-5' />
        </button>
      </div>

      {/* Filter Bar */}
      <div className='px-6 pt-4 pb-3 border-b border-border/40 flex flex-col gap-3 shrink-0 bg-panel'>
        <div className='flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary' />
            <input
              type='text'
              placeholder='Search candidate questions...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='body-md w-full pl-9 pr-8 py-2 rounded-xl bg-background-secondary/40 dark:bg-background-secondary border border-border/50 focus:outline-none focus:border-primary/50 text-ink-primary'
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className='absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-primary'
              >
                <X className='w-3.5 h-3.5' />
              </button>
            )}
          </div>

          <button
            type='button'
            onClick={() => {
              if (
                isDrawerOpen &&
                drawerOpenId === 'collection-questions-filter'
              ) {
                closeDrawer();
              } else {
                handleOpenFilters();
              }
            }}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0',
              (
                (isDrawerOpen &&
                  drawerOpenId === 'collection-questions-filter') ||
                  activeFiltersCount > 0
              ) ?
                'bg-primary/10 text-primary border-primary/30'
              : 'border-border dark:border-border text-ink-secondary hover:text-ink-primary bg-panel',
            )}
          >
            <SlidersHorizontal className='w-4 h-4' />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className='w-4.5 h-4.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center'>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className='flex items-center gap-1.5 flex-wrap pt-1'>
            <span className='text-[10px] font-bold text-ink-secondary uppercase tracking-wider mr-1'>
              Active Filters:
            </span>

            {selectedCategoryIds.map((catId) => (
              <span
                key={catId}
                className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium'
              >
                {catId === 'uncategorized' ?
                  'Uncategorized'
                : cleanName(categoryMap.get(catId) || '')}
                <button
                  onClick={() =>
                    setSelectedCategoryIds((prev) =>
                      prev.filter((id) => id !== catId),
                    )
                  }
                  className='hover:text-primary-dark ml-0.5'
                >
                  <X className='w-3 h-3' />
                </button>
              </span>
            ))}

            {selectedTagIds.map((tagId) => (
              <span
                key={tagId}
                className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-xs font-medium'
              >
                #{cleanName(tagMap.get(tagId) || '')}
                <button
                  onClick={() =>
                    setSelectedTagIds((prev) =>
                      prev.filter((id) => id !== tagId),
                    )
                  }
                  className='hover:opacity-75 ml-0.5'
                >
                  <X className='w-3 h-3' />
                </button>
              </span>
            ))}

            {selectedImportances.map((score) => (
              <span
                key={score}
                className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-medium'
              >
                {score} Stars
                <button
                  onClick={() =>
                    setSelectedImportances((prev) =>
                      prev.filter((s) => s !== score),
                    )
                  }
                  className='hover:opacity-75 ml-0.5'
                >
                  <X className='w-3 h-3' />
                </button>
              </span>
            ))}

            {selectedFrequencies.map((freq) => (
              <span
                key={freq}
                className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-medium'
              >
                {freq} Freq
                <button
                  onClick={() =>
                    setSelectedFrequencies((prev) =>
                      prev.filter((f) => f !== freq),
                    )
                  }
                  className='hover:opacity-75 ml-0.5'
                >
                  <X className='w-3 h-3' />
                </button>
              </span>
            ))}

            <button
              onClick={handleClearAllFilters}
              className='text-xs text-ink-secondary hover:text-ink-primary flex items-center gap-1 ml-1 underline decoration-dotted'
            >
              <RotateCcw className='w-3 h-3' />
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Master Select Bar */}
      <div className='flex items-center justify-between px-6 py-3 bg-background-secondary/10 border-b border-border/40 shrink-0'>
        <label className='flex items-center gap-3 cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={allFilteredSelected}
            onChange={toggleSelectAllFiltered}
            disabled={filteredCandidates.length === 0}
            className='w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer'
          />
          <span className='text-xs font-semibold text-ink-primary'>
            {allFilteredSelected ?
              'Deselect All Filtered'
            : 'Select All Filtered'}
          </span>
        </label>

        <span className='text-xs text-ink-secondary'>
          Showing{' '}
          <strong className='text-ink-primary'>
            {filteredCandidates.length}
          </strong>{' '}
          candidate question{filteredCandidates.length === 1 ? '' : 's'} (
          {selectedIds.length} selected)
        </span>
      </div>

      {/* Candidate Questions List */}
      <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-2 min-h-[250px] max-h-[48vh]'>
        {filteredCandidates.length === 0 ?
          <EmptyPlaceHolder
            icon={Search}
            title='No candidate questions found'
            description='Try adjusting your search criteria or clearing filters to find questions.'
            className='border-0 bg-transparent py-8'
          />
        : filteredCandidates.map((q) => {
            const isChecked = selectedIds.includes(q.id);
            const categoryName =
              q.category_id ? categoryMap.get(q.category_id) : null;
            return (
              <div
                key={q.id}
                onClick={() =>
                  setSelectedIds((prev) =>
                    prev.includes(q.id) ?
                      prev.filter((x) => x !== q.id)
                    : [...prev, q.id],
                  )
                }
                className={cn(
                  'flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer select-none',
                  isChecked ?
                    'bg-primary/5 border-primary/40 shadow-xs'
                  : 'border-border/60 hover:border-primary/30 hover:bg-background-secondary/30',
                )}
              >
                <input
                  type='checkbox'
                  checked={isChecked}
                  onChange={() => {}} // Handled by container click
                  className='w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary shrink-0 cursor-pointer'
                />

                <div className='flex-1 min-w-0 flex flex-col gap-1.5'>
                  <span className='text-sm font-semibold text-ink-primary leading-snug line-clamp-2'>
                    {q.title}
                  </span>

                  <div className='flex items-center gap-2 flex-wrap text-xs text-ink-secondary'>
                    {categoryName ?
                      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium'>
                        <Folder className='w-3 h-3' />
                        {cleanName(categoryName)}
                      </span>
                    : <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-500 text-[11px] font-medium'>
                        Uncategorized
                      </span>
                    }

                    {q.importance_score && (
                      <span className='inline-flex items-center gap-0.5 text-amber-500 font-semibold text-[11px]'>
                        <Star className='w-3 h-3 fill-amber-500' />
                        {q.importance_score}
                      </span>
                    )}

                    {q.frequency && (
                      <span className='px-2 py-0.5 rounded-md bg-background-secondary text-[10px] font-semibold uppercase text-ink-secondary'>
                        {q.frequency}
                      </span>
                    )}

                    {q.tags && q.tags.length > 0 && (
                      <div className='flex items-center gap-1'>
                        {q.tags.slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            className='text-[10px] text-ink-secondary/80'
                          >
                            #{cleanName(t.name)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>

      {/* Footer */}
      <div className='flex items-center justify-between p-6 border-t border-border/40 bg-background-secondary/5 shrink-0'>
        <div className='text-xs text-ink-secondary'>
          {selectedIds.length > 0 ?
            <span className='text-primary font-semibold'>
              {selectedIds.length} question{selectedIds.length === 1 ? '' : 's'}{' '}
              selected
            </span>
          : 'Select questions to add to this collection'}
        </div>

        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            onClick={handleCloseModal}
            disabled={isSaving}
            className='rounded-full'
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedIds.length === 0}
            className='rounded-full flex items-center gap-2'
          >
            {isSaving && <Loader2 className='w-4 h-4 animate-spin' />}
            {isSaving ? 'Adding...' : `Add Selected (${selectedIds.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
