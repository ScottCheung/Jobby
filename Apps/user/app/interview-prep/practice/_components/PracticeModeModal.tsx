/** @format */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Shuffle,
  ListChecks,
  CalendarCheck,
  Star,
  Search,
  Check,
} from 'lucide-react';
import type {
  InterviewQuestion,
  InterviewCategory,
  PracticePlan,
} from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import { Checkbox } from '@/components/UI/checkbox';
import { Modal } from '@/components/layout/modal';

export type PracticeMode = 'free' | 'custom' | 'plan';

interface PracticeModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: PracticeMode;
  currentCustomIds: string[];
  questions: InterviewQuestion[];
  categories: InterviewCategory[];
  activePlan: PracticePlan | null;
  onConfirm: (mode: PracticeMode, customIds: string[]) => void;
}

const FREQUENCY_OPTIONS = ['High', 'Medium', 'Low'] as const;
const IMPORTANCE_OPTIONS = [5, 4, 3, 2, 1] as const;

export function PracticeModeModal({
  isOpen,
  onClose,
  currentMode,
  currentCustomIds,
  questions,
  categories,
  activePlan,
  onConfirm,
}: PracticeModeModalProps) {
  // Local state — committed only when user clicks "Apply"
  const [localMode, setLocalMode] = useState<PracticeMode>(currentMode);
  const [localCustomIds, setLocalCustomIds] =
    useState<string[]>(currentCustomIds);

  // Filters
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterImportances, setFilterImportances] = useState<number[]>([]);
  const [filterFrequencies, setFilterFrequencies] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalMode(currentMode);
      setLocalCustomIds(currentCustomIds);
      setFilterCategoryIds([]);
      setFilterImportances([]);
      setFilterFrequencies([]);
      setSearch('');
    }
  }, [isOpen, currentMode, currentCustomIds]);

  const filteredQuestions = useMemo(() => {
    let qs = questions;
    if (filterCategoryIds.length > 0)
      qs = qs.filter(
        (q) => q.category_id && filterCategoryIds.includes(q.category_id),
      );
    if (filterImportances.length > 0)
      qs = qs.filter(
        (q) =>
          q.importance_score != null &&
          filterImportances.includes(q.importance_score),
      );
    if (filterFrequencies.length > 0)
      qs = qs.filter(
        (q) => q.frequency && filterFrequencies.includes(q.frequency),
      );
    const term = search.toLowerCase().trim();
    if (term) qs = qs.filter((q) => q.title.toLowerCase().includes(term));
    return qs;
  }, [
    questions,
    filterCategoryIds,
    filterImportances,
    filterFrequencies,
    search,
  ]);

  const allFilteredSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((q) => localCustomIds.includes(q.id));
  const someFilteredSelected =
    !allFilteredSelected &&
    filteredQuestions.some((q) => localCustomIds.includes(q.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredQuestions.map((q) => q.id));
      setLocalCustomIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newIds = filteredQuestions.map((q) => q.id);
      setLocalCustomIds((prev) => Array.from(new Set([...prev, ...newIds])));
    }
  };

  const toggleCategory = (id: string) =>
    setFilterCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  const toggleImportance = (n: number) =>
    setFilterImportances((prev) =>
      prev.includes(n) ? prev.filter((i) => i !== n) : [...prev, n],
    );
  const toggleFrequency = (f: string) =>
    setFilterFrequencies((prev) =>
      prev.includes(f) ? prev.filter((i) => i !== f) : [...prev, f],
    );

  const modeCards = [
    {
      value: 'free' as PracticeMode,
      label: 'Free Roam',
      desc: 'Full library in random order, loops forever',
      icon: Shuffle,
      accentClass: 'border-primary text-primary bg-primary/10',
      iconClass: 'text-primary',
    },
    {
      value: 'custom' as PracticeMode,
      label: 'Custom Set',
      desc: 'Hand-pick questions by category, importance, or frequency',
      icon: ListChecks,
      accentClass: 'border-primary text-primary bg-primary/10',
      iconClass: 'text-primary',
    },
    ...(activePlan ?
      [
        {
          value: 'plan' as PracticeMode,
          label: 'Plan Mode',
          desc: "Today's scheduled tasks from your active prep plan",
          icon: CalendarCheck,
          accentClass: 'border-primary text-primary bg-primary/10',
          iconClass: 'text-primary',
        },
      ]
    : []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className='w-[92vw] max-w-3xl max-h-[88vh]'
    >
        {/* Header */}
        <div className='flex items-center justify-between pb-3 border-b border-border shrink-0'>
          <div>
            <h3 className='text-base font-bold text-ink-primary'>
              Practice Mode
            </h3>
            <p className='text-xs text-ink-secondary mt-0.5'>
              Choose how questions are selected and sequenced
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'
          >
            <X className='w-4 h-4 text-ink-secondary' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto custom-scrollbar-primary p-5 flex flex-col gap-5'>
          {/* Mode Cards */}
          <div className='grid grid-cols-3 gap-3'>
            {modeCards.map((m) => {
              const isSelected = localMode === m.value;
              const Icon = m.icon;
              return (
                <button
                  key={m.value}
                  type='button'
                  onClick={() => setLocalMode(m.value)}
                  className={cn(
                    'relative flex flex-col gap-2.5! p-4!  text-left transition-all duration-200',
                    isSelected ?
                      'border-primary/30 rounded-xl  bg-gradient-to-br from-primary/10 via-primary/5 to-background  '
                    : 'status-panel  hover:-translate-y-1 hover:scale-[1.015] hover:shadow-xl hover:shadow-black/5',
                  )}
                >
                  {isSelected && (
                    <div className='absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center'>
                      <Check className='w-2.5 h-2.5 text-primary-foreground' />
                    </div>
                  )}
                  <Icon
                    className={cn(
                      'w-6 h-6',
                      isSelected ? m.iconClass : 'text-ink-primary',
                    )}
                  />
                  <div>
                    <p
                      className={cn('text-base font-bold ', 'text-ink-primary')}
                    >
                      {m.label}
                    </p>
                    <p
                      className={cn(
                        'text-xs text-ink-secondary leading-snug mt-0.5',
                      )}
                    >
                      {m.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Custom Set Configuration ── */}
          {localMode === 'custom' && (
            <div className='flex flex-col gap-4 border border-border rounded-2xl p-4 bg-zinc-50/30 dark:bg-zinc-900/10'>
              {/* Category filter */}
              {categories.length > 0 && (
                <div className='flex flex-col gap-2'>
                  <span className='label'>Category</span>
                  <div className='flex flex-wrap gap-1.5'>
                    {categories.map((cat) => {
                      const active = filterCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type='button'
                          onClick={() => toggleCategory(cat.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                            active ?
                              'bg-primary/10 text-primary border-primary/30'
                            : 'border-border text-ink-secondary hover:text-ink-primary hover:border-primary/30',
                          )}
                        >
                          {cleanName(cat.name)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Importance + Frequency row */}
              <div className='flex flex-wrap gap-6'>
                {/* Importance */}
                <div className='flex flex-col gap-2'>
                  <span className=' label'>Importance</span>
                  <div className='flex gap-1.5'>
                    {IMPORTANCE_OPTIONS.map((n) => {
                      const active = filterImportances.includes(n);
                      return (
                        <button
                          key={n}
                          type='button'
                          onClick={() => toggleImportance(n)}
                          className={cn(
                            'flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-bold border transition-all',
                            active ?
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/40'
                            : 'border-border text-ink-secondary hover:text-ink-primary',
                          )}
                        >
                          {n}
                          <Star
                            className={cn(
                              'w-2.5 h-2.5',
                              active && 'fill-amber-500 text-amber-500',
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Frequency */}
                <div className='flex flex-col gap-2'>
                  <span className='label'>Frequency</span>
                  <div className='flex gap-1.5'>
                    {FREQUENCY_OPTIONS.map((f) => {
                      const active = filterFrequencies.includes(f);
                      const activeColor =
                        f === 'High' ?
                          'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-400/40'
                        : f === 'Medium' ?
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/40'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-400/40';
                      return (
                        <button
                          key={f}
                          type='button'
                          onClick={() => toggleFrequency(f)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
                            active ? activeColor : (
                              'border-border text-ink-secondary hover:text-ink-primary'
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

              {/* Search + Bulk select toolbar */}
              <div className='flex items-center gap-2'>
                <div className='flex items-center gap-2 flex-1 bg-panel px-3 py-2 rounded-lg border border-border'>
                  <Search className='w-3.5 h-3.5 text-ink-secondary shrink-0' />
                  <input
                    type='text'
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${filteredQuestions.length} questions...`}
                    className='bg-transparent text-xs w-full focus:outline-none text-ink-primary placeholder:text-ink-secondary'
                  />
                  {search && (
                    <button onClick={() => setSearch('')}>
                      <X className='w-3 h-3 text-zinc-400 hover:text-ink-primary' />
                    </button>
                  )}
                </div>

                {/* Select all matching */}
                <button
                  type='button'
                  onClick={toggleSelectAllFiltered}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all shrink-0 whitespace-nowrap',
                    allFilteredSelected ?
                      'bg-primary/10 text-primary border-primary/30'
                    : someFilteredSelected ?
                      'bg-primary/5 text-primary border-primary/20'
                    : 'border-border text-ink-secondary hover:text-ink-primary hover:border-primary/30',
                  )}
                >
                  {allFilteredSelected ?
                    `Deselect All (${filteredQuestions.length})`
                  : `Select All (${filteredQuestions.length})`}
                </button>
              </div>

              {/* Question checklist */}
              <div className='border border-border rounded-xl overflow-hidden'>
                <div className='max-h-60 overflow-y-auto custom-scrollbar-primary divide-y divide-border/50'>
                  {filteredQuestions.map((q) => {
                    const checked = localCustomIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() =>
                          setLocalCustomIds((prev) =>
                            prev.includes(q.id) ?
                              prev.filter((i) => i !== q.id)
                            : [...prev, q.id],
                          )
                        }
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                          checked ? 'bg-primary/5' : (
                            'hover:bg-zinc-50 dark:hover:bg-zinc-900/30'
                          ),
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setLocalCustomIds((prev) =>
                              prev.includes(q.id) ?
                                prev.filter((i) => i !== q.id)
                              : [...prev, q.id],
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className='shrink-0'
                        />
                        <span className='text-xs font-medium text-ink-primary flex-1 line-clamp-1'>
                          {q.title}
                        </span>
                        <div className='flex items-center gap-2 shrink-0'>
                          {q.importance_score != null && (
                            <span className='flex items-center gap-0.5 text-[10px] text-amber-500 font-bold'>
                              {q.importance_score}
                              <Star className='w-2.5 h-2.5 fill-amber-500' />
                            </span>
                          )}
                          {q.frequency && (
                            <span
                              className={cn(
                                'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                (
                                  q.frequency === 'High' ||
                                    q.frequency === 'Hard'
                                ) ?
                                  'bg-rose-500/10 text-rose-600'
                                : q.frequency === 'Medium' ?
                                  'bg-amber-500/10 text-amber-600'
                                : 'bg-green-500/10 text-green-600',
                              )}
                            >
                              {q.frequency === 'Hard' ?
                                'High'
                              : q.frequency === 'Easy' ?
                                'Low'
                              : q.frequency}
                            </span>
                          )}
                          {q.category?.name && (
                            <span className='text-[9px] text-ink-secondary hidden sm:inline'>
                              {cleanName(q.category.name)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredQuestions.length === 0 && (
                    <div className='flex items-center justify-center p-8 text-sm text-ink-secondary italic'>
                      No questions match the current filters.
                    </div>
                  )}
                </div>

                {/* Checklist footer */}
                <div className='flex items-center justify-between px-3 py-2 bg-zinc-50/60 dark:bg-zinc-900/20 border-t border-border/50'>
                  <span className='text-xs text-ink-secondary font-medium'>
                    {localCustomIds.length === 0 ?
                      'No selection — all questions will be used'
                    : `${localCustomIds.length} / ${questions.length} questions selected`
                    }
                  </span>
                  {localCustomIds.length > 0 && (
                    <button
                      type='button'
                      onClick={() => setLocalCustomIds([])}
                      className='text-xs text-rose-500 hover:text-rose-600 font-semibold transition-colors'
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Plan Mode info */}
          {localMode === 'plan' && activePlan && (
            <div className='flex flex-col gap-2 border border-border rounded-2xl p-4 bg-zinc-50/30 dark:bg-zinc-900/10'>
              <p className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
                Active Plan
              </p>
              <p className='text-sm font-semibold text-ink-primary'>
                {activePlan.name}
              </p>
              <p className='text-xs text-ink-secondary leading-relaxed'>
                Practice will follow today&apos;s scheduled tasks. When all
                today&apos;s tasks are submitted, the session will automatically
                advance to the next pending day.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex gap-3 p-5 border-t border-border shrink-0'>
          <Button variant='ghost' onClick={onClose} className='flex-1'>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(localMode, localCustomIds)}
            className='flex-1'
          >
            Go to Practice
          </Button>
        </div>
    </Modal>
  );
}
