/** @format */

'use client';
import {
  Button,
  Checkbox,
  EmptyPlaceHolder,
  Input,
  Switch,
  Modal,
} from '@jobby/ui';
import React, { useState, useEffect } from 'react';
import { X, Sliders, BookOpen, Clock, Search, Star } from 'lucide-react';
import type { InterviewQuestion, InterviewCategory } from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';
import { showGlobalToast } from '@/lib/toast';

interface CustomizePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: InterviewCategory[];
  questions: InterviewQuestion[];
  isSubmitting: boolean;
  initialPreset: 'sprint' | 'tactical' | 'master' | 'custom';
  onSubmit: (settings: {
    name: string;
    duration: number;
    spacedRepetition: boolean;
    questionLimitEnabled: boolean;
    questionLimit: number;
    selectionMethod: 'smart' | 'manual';
    focusedCategories: string[];
    manuallySelectedQuestionIds: string[];
  }) => Promise<void>;
}

export function CustomizePlanModal({
  isOpen,
  onClose,
  categories,
  questions,
  isSubmitting,
  initialPreset,
  onSubmit,
}: CustomizePlanModalProps) {
  // Plan creation form states
  const [name, setName] = useState('My Custom Prep Plan');
  const [duration, setDuration] = useState<number>(14);
  const [spacedRepetition, setSpacedRepetition] = useState(true);
  const [questionLimitEnabled, setQuestionLimitEnabled] = useState(false);
  const [questionLimit, setQuestionLimit] = useState<number>(10);
  const [selectionMethod, setSelectionMethod] = useState<'smart' | 'manual'>(
    'smart',
  );
  const [focusedCategories, setFocusedCategories] = useState<string[]>([]);
  const [manuallySelectedQuestionIds, setManuallySelectedQuestionIds] =
    useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [showManualFilters, setShowManualFilters] = useState(false);
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterImportances, setFilterImportances] = useState<number[]>([]);
  const [filterFrequencies, setFilterFrequencies] = useState<string[]>([]);

  // Sync initial preset values when opened
  useEffect(() => {
    if (isOpen) {
      if (initialPreset === 'sprint') {
        setName('🚀 7-Day Sprint Interview Prep');
        setDuration(7);
        setSpacedRepetition(true);
        setQuestionLimitEnabled(false);
        setSelectionMethod('smart');
        // Pre-populate with high importance/frequency category rules
        setFocusedCategories([]);
        setManuallySelectedQuestionIds([]);
      } else if (initialPreset === 'tactical') {
        setName('🎯 14-Day Tactical Booster');
        setDuration(14);
        setSpacedRepetition(true);
        setQuestionLimitEnabled(false);
        setSelectionMethod('smart');
        setFocusedCategories([]);
        setManuallySelectedQuestionIds([]);
      } else if (initialPreset === 'master') {
        setName('🏆 30-Day Interview Master');
        setDuration(30);
        setSpacedRepetition(true);
        setQuestionLimitEnabled(false);
        setSelectionMethod('smart');
        setFocusedCategories([]);
        setManuallySelectedQuestionIds([]);
      } else {
        setName('My Custom Prep Plan');
        setDuration(14);
        setSpacedRepetition(true);
        setQuestionLimitEnabled(false);
        setSelectionMethod('smart');
        setFocusedCategories([]);
        setManuallySelectedQuestionIds([]);
      }
      setQuestionSearch('');
      setShowManualFilters(false);
      setFilterCategoryIds([]);
      setFilterImportances([]);
      setFilterFrequencies([]);
    }
  }, [isOpen, initialPreset]);

  // Adjust default limit when enabling limit
  useEffect(() => {
    if (questionLimitEnabled && questions.length > 0) {
      setQuestionLimit(Math.min(10, questions.length));
    }
  }, [questionLimitEnabled, questions.length]);

  // Manual list filters
  const filteredQuestions = questions.filter((q) => {
    const term = questionSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      q.title.toLowerCase().includes(term) ||
      (q.category?.name && q.category.name.toLowerCase().includes(term));

    const matchesCategory =
      filterCategoryIds.length === 0 ||
      (q.category_id && filterCategoryIds.includes(q.category_id));

    const matchesImportance =
      filterImportances.length === 0 ||
      (q.importance_score !== null &&
        q.importance_score !== undefined &&
        filterImportances.includes(q.importance_score));

    const matchesFrequency =
      filterFrequencies.length === 0 ||
      (q.frequency && filterFrequencies.includes(q.frequency));

    return (
      matchesSearch && matchesCategory && matchesImportance && matchesFrequency
    );
  });

  const toggleFocusedCategory = (catId: string) => {
    setFocusedCategories((prev) =>
      prev.includes(catId) ?
        prev.filter((id) => id !== catId)
      : [...prev, catId],
    );
  };

  const toggleManualQuestionSelection = (qId: string) => {
    setManuallySelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId],
    );
  };

  // Estimate total questions
  const getSelectedQuestionsCount = () => {
    if (selectionMethod === 'manual') {
      return manuallySelectedQuestionIds.length;
    }

    // Filter questions by focused categories
    let pool = questions;
    if (focusedCategories.length > 0) {
      pool = questions.filter(
        (q) => q.category_id && focusedCategories.includes(q.category_id),
      );
    }

    if (questionLimitEnabled) {
      return Math.min(questionLimit, pool.length);
    }
    return pool.length;
  };

  const selectedQsCount = getSelectedQuestionsCount();
  const baseQsPerDay = Math.max(1, Math.ceil(selectedQsCount / duration));

  // Ebbinghaus review estimation: each question creates Day +1, +3, +7, +14 review tasks
  // (capped at duration bounds)
  const getEstimatedReviewTasks = () => {
    if (!spacedRepetition) return 0;
    let reviewsCount = 0;
    const intervals = [1, 3, 7, 14];

    for (let i = 0; i < selectedQsCount; i++) {
      const baseDayIndex = Math.min(Math.floor(i / baseQsPerDay), duration - 1);
      for (const interval of intervals) {
        if (baseDayIndex + interval < duration) {
          reviewsCount++;
        }
      }
    }
    return reviewsCount;
  };

  const totalReviewsCount = getEstimatedReviewTasks();
  const totalTasksCount = selectedQsCount + totalReviewsCount;
  const avgTotalTasksPerDay = Math.max(
    1,
    Math.ceil(totalTasksCount / duration),
  );

  const handleFormSubmit = () => {
    if (
      selectionMethod === 'manual' &&
      manuallySelectedQuestionIds.length === 0
    ) {
      showGlobalToast('Select at least one question.');
      return;
    }

    onSubmit({
      name: name.trim() || 'My Customized Plan',
      duration,
      spacedRepetition,
      questionLimitEnabled,
      questionLimit,
      selectionMethod,
      focusedCategories,
      manuallySelectedQuestionIds,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      layoutId='Customize Your Plan'
      className='w-[95vw] h-[90vh] max-w-7xl'
    >
      {/* Modal Header */}
      <div className=' flex items-center justify-between shrink-0 '>
        <div className='flex items-center gap-2'>
          <Sliders className='w-5 h-5 text-primary' />
          <h3 className='title-card'>Customize Your Plan</h3>
        </div>
        <button type='button' onClick={onClose} className='panel-lg'>
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Modal Body Container */}
      <div className='flex-1 p-6 grid grid-cols-1 md:grid-cols-3 overflow-hidden min-h-0 divide-y md:divide-y-0 md:divide-x divide-dashed divide-primary/20 gap-6'>
        {/* Left Column (Span 2): Configurations */}
        <div className='md:col-span-2 overflow-y-auto  flex flex-col pr-6 custom-scrollbar-primary'>
          {/* 1. Plan Name */}
          <div className='flex flex-col gap-2'>
            <label className='label'>Plan Name</label>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='E.g., FAANG System Design Plan'
              className='input'
            />
          </div>

          {/* 2. Duration slider */}
          <div className='flex flex-col gap-2'>
            <div className='flex justify-between items-center label'>
              <span className=''>Plan Duration</span>
              <span className='body-lg text-primary'>{duration} Days</span>
            </div>
            <input
              type='range'
              min='3'
              max='60'
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className='accent-primary cursor-pointer w-full mt-2 h-2 bg-muted'
            />
            <div className='label-sm flex justify-between text-ink-secondary/70 px-1'>
              <span>3 Days</span>
              <span>14 Days</span>
              <span>30 Days</span>
              <span>60 Days</span>
            </div>
          </div>

          {/* 3. Spaced Repetition Toggle */}
          <div className='flex items-center justify-between py-2 border-t border-b border-primary/40'>
            <div className='flex flex-col gap-1 pr-4'>
              <span className='label'>
                Spaced Repetition Review (Ebbinghaus curve)
              </span>
              <span className='body-sm text-ink-secondary max-w-lg'>
                Auto-schedule review tasks on Day +1, +3, +7, and +14 relative
                to question introduction to optimize memory retention.
              </span>
            </div>
            <Switch
              checked={spacedRepetition}
              onCheckedChange={setSpacedRepetition}
            />
          </div>

          {/* 4. Total Question Limit */}
          <div className='flex flex-col gap-2 py-2 border-b border-primary/40'>
            <div className='flex items-center justify-between'>
              <div className='flex flex-col gap-1 pr-4'>
                <span className='label'>Limit Total Questions</span>
                <span className='body-sm text-ink-secondary'>
                  Select how many questions from your target pool to include.
                </span>
              </div>
              <Switch
                checked={questionLimitEnabled}
                onCheckedChange={setQuestionLimitEnabled}
              />
            </div>
            {questionLimitEnabled && (
              <div className='flex items-center gap-3 mt-2'>
                <Input
                  type='number'
                  min='1'
                  max={questions.length}
                  value={questionLimit}
                  onChange={(e) =>
                    setQuestionLimit(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className='w-32'
                />
                <span className='label-sm'>
                  questions (max {questions.length})
                </span>
              </div>
            )}
          </div>

          {/* 5. Select Mode (Smart vs Manual) */}
          <div className='flex flex-col gap-2 pt-2'>
            <label className='label'>Question Select Mode</label>
            <div className='grid grid-cols-2 gap-2 bg-background-secondary rounded-xl p-1.5 max-w-sm'>
              <button
                type='button'
                onClick={() => setSelectionMethod('smart')}
                className={cn(
                  'label-sm py-2 rounded-lg transition-all',
                  selectionMethod === 'smart' ?
                    'bg-panel text-ink-primary shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary',
                )}
              >
                Smart Filter
              </button>
              <button
                type='button'
                onClick={() => setSelectionMethod('manual')}
                className={cn(
                  'label-sm py-2 rounded-lg transition-all',
                  selectionMethod === 'manual' ?
                    'bg-panel text-ink-primary shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary',
                )}
              >
                Manual Checklist
              </button>
            </div>
          </div>

          {/* Smart Filter options */}
          {selectionMethod === 'smart' && categories.length > 0 && (
            <div className='flex flex-col gap-2 mt-2'>
              <label className='label'>Focus Topics (Optional)</label>
              <div className='flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1'>
                {categories.map((cat) => {
                  const isFocused = focusedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type='button'
                      onClick={() => toggleFocusedCategory(cat.id)}
                      className={cn(
                        'label-sm px-3 py-1.5 rounded-full transition-all border',
                        isFocused ?
                          'bg-primary/10 text-primary border-primary/20'
                        : 'bg-background-secondary border-primary/50 text-ink-secondary hover:text-ink-primary',
                      )}
                    >
                      {cleanName(cat.name)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual Questions Checklist */}
          {selectionMethod === 'manual' && (
            <div className='flex flex-col gap-3 border   rounded-2xl p-4 bg-background-secondary/20 min-h-[420px] transition-all duration-300'>
              <div className='flex items-center gap-2 shrink-0'>
                <div className='flex items-center gap-2.5 bg-panel px-3.5 py-2.5 rounded-xl border   flex-1'>
                  <Search className='w-4 h-4 text-ink-secondary shrink-0' />
                  <input
                    type='text'
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    placeholder='Search questions by title or category...'
                    className='body-md bg-transparent border-none w-full text-ink-primary focus:outline-none placeholder:text-ink-secondary/60'
                  />
                </div>
                <button
                  type='button'
                  onClick={() => setShowManualFilters(!showManualFilters)}
                  className={cn(
                    'label flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all shrink-0 h-[46px]',
                    (
                      showManualFilters ||
                        filterCategoryIds.length > 0 ||
                        filterImportances.length > 0 ||
                        filterFrequencies.length > 0
                    ) ?
                      'bg-primary/10 text-primary border-primary/30 font-bold'
                    : 'bg-white dark:bg-background   text-ink-secondary hover:text-ink-primary',
                  )}
                >
                  <Sliders className='w-4 h-4' />
                  <span className='hidden sm:inline'>Filters</span>
                  {(filterCategoryIds.length > 0 ||
                    filterImportances.length > 0 ||
                    filterFrequencies.length > 0) && (
                    <span className='w-4 h-4 flex items-center justify-center bg-primary text-primary-foreground rounded-full text-[10px] font-bold'>
                      {filterCategoryIds.length +
                        filterImportances.length +
                        filterFrequencies.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Collapsible Filter Section */}
              {showManualFilters && (
                <div className='flex flex-col gap-3 p-3 bg-background-secondary/40 rounded-xl border border-primary/50 animate-in fade-in slide-in-from-top-1 duration-150 shrink-0'>
                  {/* Category Filter */}
                  {categories.length > 0 && (
                    <div className='flex flex-col gap-1.5'>
                      <span className='text-[10px] uppercase font-bold text-ink-secondary tracking-wider'>
                        Category
                      </span>
                      <div className='flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar-primary'>
                        {categories.map((cat) => {
                          const active = filterCategoryIds.includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              type='button'
                              onClick={() => {
                                setFilterCategoryIds((prev) =>
                                  prev.includes(cat.id) ?
                                    prev.filter((c) => c !== cat.id)
                                  : [...prev, cat.id],
                                );
                              }}
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all',
                                active ?
                                  'bg-primary/10 text-primary border-primary/35 font-bold'
                                : 'bg-panel border-primary text-ink-secondary hover:text-ink-primary',
                              )}
                            >
                              {cleanName(cat.name)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Importance + Frequency Row */}
                  <div className='flex flex-wrap gap-4 pt-1 border-t border-primary/40'>
                    {/* Importance */}
                    <div className='flex flex-col gap-1.5'>
                      <span className='text-[10px] uppercase font-bold text-ink-secondary tracking-wider'>
                        Importance
                      </span>
                      <div className='flex gap-1'>
                        {[5, 4, 3, 2, 1].map((n) => {
                          const active = filterImportances.includes(n);
                          return (
                            <button
                              key={n}
                              type='button'
                              onClick={() => {
                                setFilterImportances((prev) =>
                                  prev.includes(n) ?
                                    prev.filter((i) => i !== n)
                                  : [...prev, n],
                                );
                              }}
                              className={cn(
                                'flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all',
                                active ?
                                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/40'
                                : 'bg-panel border-primary text-ink-secondary hover:text-ink-primary',
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
                    <div className='flex flex-col gap-1.5'>
                      <span className='text-[10px] uppercase font-bold text-ink-secondary tracking-wider'>
                        Frequency
                      </span>
                      <div className='flex gap-1'>
                        {['High', 'Medium', 'Low'].map((f) => {
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
                              onClick={() => {
                                setFilterFrequencies((prev) =>
                                  prev.includes(f) ?
                                    prev.filter((i) => i !== f)
                                  : [...prev, f],
                                );
                              }}
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all',
                                active ? activeColor : (
                                  'bg-panel border-primary text-ink-secondary hover:text-ink-primary'
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

                  {/* Clear Button */}
                  {(filterCategoryIds.length > 0 ||
                    filterImportances.length > 0 ||
                    filterFrequencies.length > 0) && (
                    <div className='flex justify-end pt-1.5 border-t border-primary/40'>
                      <button
                        type='button'
                        onClick={() => {
                          setFilterCategoryIds([]);
                          setFilterImportances([]);
                          setFilterFrequencies([]);
                        }}
                        className='text-[10px] text-rose-500 hover:text-rose-600 font-bold transition-colors'
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className='flex-1 overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar-primary'>
                {filteredQuestions.map((q) => {
                  const isSelected = manuallySelectedQuestionIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleManualQuestionSelection(q.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-background-secondary/50',
                        isSelected ?
                          'border-primary bg-primary/5'
                        : 'border-primary/50 bg-panel',
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          toggleManualQuestionSelection(q.id)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className='shrink-0'
                      />
                      <div className='flex flex-col gap-1'>
                        <span className='label line-clamp-1 leading-snug'>
                          {q.title}
                        </span>
                        <span className='label-sm'>
                          {q.category?.name ?
                            cleanName(q.category.name)
                          : 'Unclassified'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {filteredQuestions.length === 0 && (
                  <EmptyPlaceHolder
                    message='No questions found.'
                    className='border-0 bg-transparent py-8'
                  />
                )}
              </div>

              <div className='label-sm flex justify-between items-center pt-2.5 border-t   shrink-0'>
                <span>Select study items manually:</span>
                <span className='font-bold text-primary'>
                  {manuallySelectedQuestionIds.length} Selected
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Span 1): Live Plan Preview */}
        <div className=''>
          <div className='flex flex-col gap-5'>
            <h4 className='label-overline'>Summary</h4>

            {/* Visual Preview Card */}
            <div className='panel-sm px-6! flex flex-col gap-4 relative overflow-hidden'>
              <div className='flex flex-col gap-1'>
                <h3 className='title-section text-ink-primary line-clamp-2'>
                  {name.trim() || 'My Customized Plan'}
                </h3>
                <div className='text-[12px] text-ink-secondary mt-1'>
                  {spacedRepetition ?
                    'Includes automatic Ebbinghaus Spaced Repetition reviews scheduled on Day +1, +3, +7, and +14.'
                  : 'Single-session training plan without forgetting curve reviews.'
                  }
                </div>
              </div>

              <div className='label grid grid-cols-2 gap-4 pt-2'>
                <div className='flex flex-col gap-1'>
                  <span className='title-sub'>{duration} Days</span>
                  <span className='text-meta flex items-center gap-1'>
                    <Clock className='w-3.5 h-3.5 text-ink-secondary' />{' '}
                    Duration
                  </span>
                </div>
                <div className='flex flex-col gap-1'>
                  <span className='title-sub'>{selectedQsCount} Questions</span>
                  <span className='text-meta flex items-center gap-1'>
                    <BookOpen className='w-3.5 h-3.5 text-ink-secondary' />{' '}
                    Questions
                  </span>
                </div>
              </div>

              <div className='flex flex-col  leading-relaxed gap-2 border-t border-primary/40 pt-3'>
                <div className='flex justify-between items-center text-ink-primary font-semibold'>
                  <span className='text-meta'>Daily Base Pace:</span>
                  <span className='body-lg'>
                    ~{baseQsPerDay}{' '}
                    <span className='text-[10px]'>new Qs / day</span>
                  </span>
                </div>
                {spacedRepetition && (
                  <div className='flex justify-between items-center text-ink-primary font-semibold'>
                    <span className='text-meta'>
                      Daily Tasks (incl. reviews):
                    </span>
                    <span className='body-lg'>
                      ~{avgTotalTasksPerDay}{' '}
                      <span className='text-[10px]'>Qs / day</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Task Breakdown stats */}
            <div className='body-md flex flex-col px-6! gap-2 panel-sm'>
              <div className='flex justify-between items-center font-medium'>
                <span className='text-ink-secondary'>
                  Initial Practice Tasks
                </span>
                <span className='text-ink-primary font-bold'>
                  {selectedQsCount}
                </span>
              </div>
              {spacedRepetition && (
                <div className='flex justify-between items-center font-medium'>
                  <span className='text-ink-secondary'>
                    Review Tasks (Spaced)
                  </span>
                  <span className='text-ink-primary font-bold'>
                    {totalReviewsCount}
                  </span>
                </div>
              )}
              <div className='flex justify-between items-center pt-2.5 border-t   font-extrabold text-ink-primary'>
                <span>Total Scheduled Tasks</span>
                <span className='text-primary'>{totalTasksCount}</span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className='flex gap-3 pt-6 shrink-0 mt-8 md:mt-0'>
            <Button variant='ghost' onClick={onClose} className='flex-1'>
              Cancel
            </Button>
            <Button
              onClick={handleFormSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting || selectedQsCount === 0}
              className='flex-1'
            >
              Activate Plan
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
