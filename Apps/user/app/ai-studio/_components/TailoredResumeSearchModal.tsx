/** @format */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Sparkles,
  FileText,
  Building,
  Briefcase,
  History,
  Trash2,
  Check,
} from 'lucide-react';
import { Button } from '@jobby/ui';
import type { TailoredResume } from '@/lib/api';
import { formatRelativeTime } from '@/lib/use-relative-time';
import { cn } from '@/lib/utils';

function documentTypeLabel(item: TailoredResume): string[] {
  const rawAi = item.raw_ai_response as
    | { generated_documents?: { resume?: boolean; cover_letter?: boolean }; cover_letter?: string }
    | undefined;
  const generated = rawAi?.generated_documents;
  const hasCl = Boolean(item.cover_letter || rawAi?.cover_letter || generated?.cover_letter);
  const hasCv = Boolean(item.resume_data && Object.keys(item.resume_data).length > 0) || Boolean(generated?.resume);

  if (hasCv && hasCl) return ['CV', 'CL'];
  if (hasCl) return ['CL'];
  return ['CV'];
}

interface TailoredResumeSearchModalProps {
  items: TailoredResume[];
  selectedId?: string;
  onSelect: (item: TailoredResume) => void;
  onDelete?: (item: TailoredResume) => void;
  onClose: () => void;
}

export function TailoredResumeSearchModal({
  items,
  selectedId,
  onSelect,
  onDelete,
  onClose,
}: TailoredResumeSearchModalProps) {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'cv' | 'cl'>('all');

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      // Type filter
      const types = documentTypeLabel(item);
      if (filterType === 'cv' && !types.includes('CV')) return false;
      if (filterType === 'cl' && !types.includes('CL')) return false;

      // Text query match
      if (!q) return true;
      const titleMatch = item.job_title?.toLowerCase().includes(q);
      const companyMatch = item.company?.toLowerCase().includes(q);
      const skillMatch = item.core_competencies?.some((s) =>
        s.toLowerCase().includes(q),
      );
      return Boolean(titleMatch || companyMatch || skillMatch);
    });
  }, [items, query, filterType]);

  return (
    <div className='flex h-full max-h-[85vh] flex-col p-6 space-y-4'>
      {/* Header & Title */}
      <div className='flex items-center justify-between border-b border-primary/20 pb-3'>
        <div className='flex items-center gap-2.5'>
          <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary'>
            <History className='h-5 w-5' />
          </div>
          <div>
            <h2 className='text-base font-bold text-ink-primary'>
              Search & Switch Tailored Documents
            </h2>
            <p className='text-xs text-ink-secondary'>
              Total {items.length} tailored records · Select any to switch immediately
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className='flex h-8 w-8 items-center justify-center rounded-xl text-ink-secondary hover:bg-panel hover:text-ink-primary transition-colors cursor-pointer'
        >
          <X className='h-4 w-4' />
        </button>
      </div>

      {/* Search Input & Filter Tabs */}
      <div className='space-y-3'>
        <div className='relative'>
          <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-secondary' />
          <input
            type='text'
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search by job title, company name, or core skills...'
            className='w-full rounded-2xl border border-primary/20 bg-background/80 pl-10 pr-10 py-2.5 text-xs text-ink-primary placeholder:text-ink-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs'
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className='absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-primary cursor-pointer'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className='flex items-center gap-2'>
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
              filterType === 'all' ?
                'bg-primary text-white shadow-xs'
              : 'bg-panel/70 text-ink-secondary hover:text-ink-primary border border-primary/15',
            )}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setFilterType('cv')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
              filterType === 'cv' ?
                'bg-primary text-white shadow-xs'
              : 'bg-panel/70 text-ink-secondary hover:text-ink-primary border border-primary/15',
            )}
          >
            CVs
          </button>
          <button
            onClick={() => setFilterType('cl')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
              filterType === 'cl' ?
                'bg-primary text-white shadow-xs'
              : 'bg-panel/70 text-ink-secondary hover:text-ink-primary border border-primary/15',
            )}
          >
            Cover Letters
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className='custom-scrollbar-primary flex-1 overflow-y-auto space-y-2 pr-1'>
        {filteredItems.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center text-ink-secondary'>
            <Search className='h-8 w-8 text-ink-secondary/40 mb-2' />
            <p className='text-xs font-semibold'>No matching tailored records found</p>
            <p className='text-[11px] text-ink-secondary/70 mt-0.5'>
              Try a different keyword or clear search filters
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.id === selectedId;
            const isProcessing = item.status === 'processing';
            const timeAgo = isProcessing ? 'Generating' : formatRelativeTime(item.created_at);
            const docLabels = documentTypeLabel(item);

            return (
              <div
                key={item.id}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className={cn(
                  'group flex items-center justify-between gap-4 rounded-2xl p-3.5 transition-all cursor-pointer border',
                  isSelected ?
                    'bg-primary/10 border-primary shadow-xs text-primary'
                  : 'bg-panel/60 border-primary/15 hover:border-primary/40 hover:bg-panel text-ink-primary',
                )}
              >
                <div className='min-w-0 flex-1 space-y-1'>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs font-bold truncate text-ink-primary'>
                      {item.job_title || 'Untitled Tailored Role'}
                    </span>
                    <div className='flex items-center gap-1 shrink-0'>
                      {docLabels.map((lbl, idx) => (
                        <span
                          key={idx}
                          className='rounded-md bg-primary text-white px-1.5 py-0.5 text-[8px] font-extrabold uppercase'
                        >
                          {lbl}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className='flex items-center gap-2 text-[11px] text-ink-secondary truncate'>
                    <span className='font-semibold text-ink-primary/90'>
                      {item.company || 'Unknown Company'}
                    </span>
                    <span>•</span>
                    <span>{timeAgo}</span>
                    {item.core_competencies && item.core_competencies.length > 0 && (
                      <>
                        <span>•</span>
                        <span className='truncate text-ink-secondary/80'>
                          {item.core_competencies.slice(0, 3).join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  {onDelete && !isProcessing && (
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item);
                      }}
                      className='opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-ink-secondary hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer'
                      title='Delete record'
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </button>
                  )}

                  <Button
                    size='sm'
                    variant={isSelected ? 'default' : 'secondary'}
                    className='!h-7 !px-3 text-xs'
                  >
                    {isSelected ? 'Active' : 'Switch'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
