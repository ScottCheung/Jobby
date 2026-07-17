/** @format */

'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  FileText,
  Trash2,
  Save,
  Undo2,
  X,
  SlidersHorizontal,
  Star,
  PlayCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { practiceCache } from '../practice/practice-cache';
import type {
  InterviewQuestion,
  InterviewCategory,
  InterviewTag,
} from '@/lib/types';
import { Tooltip } from '@/components/UI/tooltip';
import { cn, cleanName } from '@/lib/utils';
import { useLayoutStore } from '@/lib/store/layout-store';
import { QuestionForm } from './_components/QuestionForm';
import { BatchImportModal } from './_components/BatchImportModal';
import { FilterSidebar } from './_components/FilterSidebar';
import { QuestionRow } from './_components/QuestionRow';
import { QuestionsFilterDrawer } from './_components/QuestionsFilterDrawer';
import { Button } from '@/components/UI/Button';

export default function QuestionsLibraryPage() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<
    InterviewQuestion[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [tags, setTags] = useState<InterviewTag[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Batch Import Modal visibility state
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: 'title' | 'category' | 'answer';
  } | null>(null);

  const [selectedImportances, setSelectedImportances] = useState<number[]>([]);
  const [selectedFrequencies, setSelectedFrequencies] = useState<string[]>([]);

  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);
  const addNotification = useLayoutStore(
    (state) => state.actions.addNotification,
  );
  const isDrawerOpen = useLayoutStore((state) => state.isDrawerOpen);
  const drawerOpenId = useLayoutStore((state) => state.drawerConfig.id);

  const handleOpenFilters = useCallback(() => {
    openDrawer({
      id: 'questions-filter',
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
    if (isDrawerOpen && drawerOpenId === 'questions-filter') {
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

  const fetchQuestions = async () => {
    try {
      const data = await api.interviewQuestions();
      practiceCache.questions = data;
      setQuestions(data);
      setOriginalQuestions(JSON.parse(JSON.stringify(data)));
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    }
  };

  const initData = async (forceRefetch = false) => {
    if (practiceCache.questions && !forceRefetch) {
      setQuestions(practiceCache.questions);
      setOriginalQuestions(JSON.parse(JSON.stringify(practiceCache.questions)));
      setCategories(practiceCache.categories || []);
      setIsLoading(false);
      try {
        const tagsData = await api.interviewTags();
        setTags(tagsData);
      } catch (err) {}
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();
    try {
      const [qs, cats, tagsData] = await Promise.all([
        api.interviewQuestions(),
        api.interviewCategories(),
        api.interviewTags(),
      ]);

      practiceCache.questions = qs;
      practiceCache.categories = cats;

      setQuestions(qs);
      setOriginalQuestions(JSON.parse(JSON.stringify(qs)));
      setCategories(cats);
      setTags(tagsData);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to initialize questions page:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDuration = 500; // 0.5 seconds
      if (elapsed < minDuration) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDuration - elapsed),
        );
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void initData();
  }, []);

  const getModifiedQuestions = () => {
    return questions.filter((q) => {
      const orig = originalQuestions.find((o) => o.id === q.id);
      if (!orig) return false;
      return (
        q.title !== orig.title ||
        q.category_id !== orig.category_id ||
        q.frequency !== orig.frequency ||
        q.importance_score !== orig.importance_score ||
        q.answer_objective !== orig.answer_objective
      );
    });
  };

  const modified = getModifiedQuestions();
  const hasChanges = modified.length > 0;

  const handleSaveAll = async () => {
    if (modified.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(
        modified.map((q) =>
          api.updateInterviewQuestion(q.id, {
            title: q.title,
            category_id: q.category_id,
            frequency: q.frequency,
            importance_score: q.importance_score,
            answer_objective: q.answer_objective,
          }),
        ),
      );
      addNotification({
        type: 'success',
        message: 'All changes saved successfully',
      });
      await fetchQuestions();
    } catch (err) {
      console.error('Failed to save changes:', err);
      addNotification({
        type: 'error',
        message: 'Failed to save changes. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardAll = () => {
    if (
      !window.confirm('Are you sure you want to discard all unsaved changes?')
    )
      return;
    setQuestions(JSON.parse(JSON.stringify(originalQuestions)));
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?'))
      return;
    if (
      hasChanges &&
      !window.confirm(
        'You have unsaved changes. Deleting this question will reload the questions and discard all other unsaved changes. Continue?',
      )
    )
      return;
    try {
      await api.deleteInterviewQuestion(id);
      addNotification({
        type: 'success',
        message: 'Question deleted successfully',
      });
      await fetchQuestions();
    } catch (err) {
      console.error('Failed to delete question:', err);
      addNotification({ type: 'error', message: 'Failed to delete question' });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (
      hasChanges &&
      !window.confirm(
        'You have unsaved changes. Batch deleting will reload the questions and discard all other unsaved changes. Continue?',
      )
    )
      return;
    if (
      !window.confirm(
        `Are you sure you want to delete the ${selectedIds.length} selected questions? This action cannot be undone.`,
      )
    )
      return;

    setIsSaving(true);
    try {
      await Promise.all(
        selectedIds.map((id) => api.deleteInterviewQuestion(id)),
      );
      addNotification({
        type: 'success',
        message: `Successfully deleted ${selectedIds.length} questions`,
      });
      setIsSelectionMode(false);
      await fetchQuestions();
    } catch (err) {
      console.error('Failed to delete selected questions:', err);
      addNotification({
        type: 'error',
        message: 'Failed to delete some selected questions',
      });
      await fetchQuestions(); // Sync back
    } finally {
      setIsSaving(false);
    }
  };

  const handleInlineUpdate = (
    id: string,
    updates: Partial<InterviewQuestion>,
  ) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
  };

  const handleOpenBatchImport = () => {
    if (hasChanges) {
      addNotification({
        type: 'warning',
        message: 'Please save or discard your changes before batch importing.',
      });
      return;
    }
    setIsBatchImportOpen(true);
  };

  const handleOpenEditQuestion = (q: InterviewQuestion) => {
    if (hasChanges) {
      addNotification({
        type: 'warning',
        message: 'Please save or discard your changes before editing details.',
      });
      return;
    }
    openDrawer({
      width: 550,
      id: q.id,
      content: (
        <QuestionForm
          question={q}
          categories={categories}
          tags={tags}
          onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
          onCancel={closeDrawer}
          onSave={async (payload) => {
            await api.updateInterviewQuestion(q.id, payload);
            addNotification({
              type: 'success',
              message: 'Question updated successfully',
            });
            await fetchQuestions();
            closeDrawer();
          }}
        />
      ),
    });
  };

  // Filter logic
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategoryIds.length === 0 ||
      (q.category_id !== null &&
        q.category_id !== undefined &&
        selectedCategoryIds.includes(q.category_id));
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

  const handleStartPractice = () => {
    if (filteredQuestions.length === 0) {
      addNotification({
        type: 'warning',
        message: 'No questions to practice.',
      });
      return;
    }
    if (filteredQuestions.length === questions.length) {
      router.push(`/interview-prep/practice/${questions[0].id}?mode=free`);
    } else {
      sessionStorage.setItem(
        'practiceCustomIds',
        JSON.stringify(filteredQuestions.map((q) => q.id)),
      );
      router.push(
        `/interview-prep/practice/${filteredQuestions[0].id}?mode=custom`,
      );
    }
  };

  const gridColsClass =
    isSelectionMode ?
      'grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,3.5fr)]'
    : 'grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,3.5fr)]';

  return (
    <div className='flex gap-4 h-full relative overflow-hidden'>
      {/* 1. Sidebar Panel */}
      <FilterSidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        categories={categories}
        tags={tags}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={setSelectedCategoryIds}
        selectedTagIds={selectedTagIds}
        setSelectedTagIds={setSelectedTagIds}
        questions={questions}
      />

      {/* 2. Questions List (Full Width) */}
      <div className='panel-xl pb-0! flex flex-col overflow-hidden '>
        {/* Header Tools */}
        <div className='flex items-center justify-between gap-4 shrink-0'>
          <div className='flex items-center gap-2 flex-1 max-w-md'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
              <input
                type='text'
                placeholder='Search questions...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='w-full pl-9 pr-4 py-2 text-sm rounded-xl  bg-panel dark:bg-zinc-955 dark:border-border focus:outline-none focus:border-primary/50 dark:focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:focus:ring-zinc-750 text-ink-primary'
              />
            </div>
            <button
              onClick={() => {
                if (isDrawerOpen && drawerOpenId === 'questions-filter') {
                  closeDrawer();
                } else {
                  handleOpenFilters();
                }
              }}
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-xl border transition-all shrink-0',
                (
                  (isDrawerOpen && drawerOpenId === 'questions-filter') ||
                    selectedCategoryIds.length > 0 ||
                    selectedTagIds.length > 0 ||
                    selectedImportances.length > 0 ||
                    selectedFrequencies.length > 0
                ) ?
                  'bg-primary/10 text-primary border-primary/30'
                : 'bg-panel border-border dark:border-border text-ink-secondary hover:text-ink-primary',
              )}
            >
              <Tooltip content='Filters' side='bottom'>
                <div className='flex items-center justify-center w-full h-full relative'>
                  <SlidersHorizontal className='w-4 h-4' />
                  {(selectedCategoryIds.length > 0 ||
                    selectedTagIds.length > 0 ||
                    selectedImportances.length > 0 ||
                    selectedFrequencies.length > 0) && (
                    <span className='absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center bg-primary text-primary-foreground rounded-full text-[9px] font-bold ring-1 ring-white dark:ring-background'>
                      {selectedCategoryIds.length +
                        selectedTagIds.length +
                        selectedImportances.length +
                        selectedFrequencies.length}
                    </span>
                  )}
                </div>
              </Tooltip>
            </button>
          </div>
          <div className='flex gap-2'>
            {isSelectionMode ?
              <>
                <Tooltip content='Cancel Selection' side='bottom'>
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedIds([]);
                    }}
                    disabled={isSaving}
                    className='flex items-center justify-center w-9 h-9 text-ink-primary bg-background-secondary hover:bg-background-secondary dark:bg-panel dark:hover:bg-panel rounded-xl transition-colors dark:border-zinc-850/60'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </Tooltip>
                {selectedIds.length > 0 && (
                  <Tooltip
                    content={`Delete Selected (${selectedIds.length})`}
                    side='bottom'
                  >
                    <button
                      onClick={handleDeleteSelected}
                      disabled={isSaving}
                      className='flex items-center justify-center w-9 h-9 text-red-655 bg-red-50 hover:bg-red-100/80 dark:text-red-400 dark:bg-red-955/20 dark:hover:bg-red-955/30 rounded-xl transition-colors border border-red-200/50 dark:border-red-900/30 disabled:opacity-50'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </Tooltip>
                )}
              </>
            : <Tooltip content='Select Multiple' side='bottom'>
                <button
                  onClick={() => setIsSelectionMode(true)}
                  disabled={isSaving}
                  className='flex items-center justify-center w-9 h-9 text-ink-primary bg-zinc-200 hover:bg-zinc-300 dark:bg-panel dark:hover:bg-panel rounded-xl transition-colors dark:border-zinc-850/60'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </Tooltip>
            }

            {hasChanges && (
              <>
                <Tooltip
                  content={`Discard All Changes (${modified.length})`}
                  side='bottom'
                >
                  <button
                    onClick={handleDiscardAll}
                    disabled={isSaving}
                    className='flex items-center justify-center w-9 h-9 text-red-650 bg-red-50 hover:bg-red-100/80 dark:text-red-400 dark:bg-red-955/20 dark:hover:bg-red-955/30 rounded-xl transition-colors border border-red-200/50 dark:border-red-900/30 disabled:opacity-50'
                  >
                    <Undo2 className='w-4 h-4' />
                  </button>
                </Tooltip>
                <Tooltip content='Save Changes' side='bottom'>
                  <button
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className='flex items-center justify-center w-9 h-9 text-primary-foreground bg-primary hover:opacity-90 rounded-xl transition-opacity disabled:opacity-50'
                  >
                    <Save className='w-4 h-4' />
                  </button>
                </Tooltip>
              </>
            )}
            <Button
              onClick={handleOpenBatchImport}
              Icon={FileText}
              size='md'
              // className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-xl transition-opacity whitespace-nowrap'
            >
              {/* <FileText className='w-4 h-4' /> */}
              Import Questions
            </Button>
          </div>
        </div>
        {/* List Header */}
        <div
          className={cn(
            'grid text-[11px] font-bold text-ink-secondary uppercase tracking-wider px-4 py-3 shrink-0 ',
            gridColsClass,
          )}
        >
          {isSelectionMode && (
            <div className='flex justify-center items-center'>
              <input
                type='checkbox'
                checked={
                  filteredQuestions.length > 0 &&
                  filteredQuestions.every((q) => selectedIds.includes(q.id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    const allIds = filteredQuestions.map((q) => q.id);
                    setSelectedIds((prev) =>
                      Array.from(new Set([...prev, ...allIds])),
                    );
                  } else {
                    const filteredIds = filteredQuestions.map((q) => q.id);
                    setSelectedIds((prev) =>
                      prev.filter((id) => !filteredIds.includes(id)),
                    );
                  }
                }}
                className='w-4 h-4 rounded bg-background-primary/20 text-primary focus:ring-primary accent-primary cursor-pointer'
              />
            </div>
          )}
          <div className='px-2'>Question</div>
          <div className='px-2'>Category</div>
          <div className='px-2'>Frequency</div>
          <div className='px-2'>Importance</div>
          <div className='px-2'>Your Answer</div>
        </div>

        {/* Table Content */}
        <div className='flex-1 overflow-y-auto fade-out-tb'>
          {isLoading ?
            <QuestionListSkeleton />
          : filteredQuestions.length === 0 ?
            <div className='p-12 flex flex-col items-center justify-center text-center'>
              <FileText className='w-12 h-12 text-ink-secondary mb-4 opacity-50' />
              <h3 className='text-lg font-medium text-ink-primary mb-1'>
                No questions found
              </h3>
              <p className='text-sm text-ink-secondary max-w-sm'>
                {search ?
                  'Try adjusting your search criteria.'
                : 'Add your first interview question to get started.'}
              </p>
            </div>
          : <div className='flex flex-col '>
              {filteredQuestions.map((q) => {
                const orig = originalQuestions.find((o) => o.id === q.id);
                return (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    originalQuestion={orig}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.includes(q.id)}
                    onSelectChange={(id, checked) => {
                      setSelectedIds((prev) =>
                        checked ? [...prev, id] : prev.filter((x) => x !== id),
                      );
                    }}
                    editingCell={editingCell}
                    setEditingCell={setEditingCell}
                    onInlineUpdate={handleInlineUpdate}
                    categories={categories}
                    onOpenEdit={handleOpenEditQuestion}
                    gridColsClass={gridColsClass}
                    isDrawerSelected={isDrawerOpen && drawerOpenId === q.id}
                  />
                );
              })}
            </div>
          }
        </div>
      </div>

      {/* Batch Import Modal Component */}
      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        categories={categories}
        tags={tags}
        selectedCategoryId={
          selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : null
        }
        onImportSuccess={fetchQuestions}
        addNotification={addNotification}
      />

      {/* Floating Practice Button */}
      {questions.length > 0 && !isSelectionMode && !hasChanges && (
        <div className='absolute bottom-4 right-4 z-20 animate-in slide-in-from-bottom-8 fade-in duration-300'>
          <Tooltip
            content={
              filteredQuestions.length === questions.length ?
                'Free Roam Mode: Randomly practice all your questions'
              : `Custom Set Mode: Practice the ${filteredQuestions.length} selected questions`
            }
            side='left'
            delay={100}
          >
            <button
              onClick={handleStartPractice}
              className='flex items-center gap-2 pl-4 pr-6 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full shadow-xl shadow-primary/30 transition-transform hover:-translate-y-1 active:translate-y-0'
            >
              <PlayCircle className='w-5 h-5 mr-3' />
              {filteredQuestions.length === questions.length ?
                'Start Practice (All)'
              : `Practice (${filteredQuestions.length} Selected)`}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function QuestionListSkeleton() {
  return (
    <div className='flex flex-col gap-3 p-4 animate-pulse'>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className='grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,3.5fr)] items-center py-4 border-b border-border/50'
        >
          <div className='h-4 bg-panel rounded w-2/3'></div>
          <div className='h-4 bg-panel rounded w-1/2'></div>
          <div className='h-4 bg-panel rounded w-1/3'></div>
          <div className='h-4 bg-panel rounded w-1/4'></div>
          <div className='h-4 bg-panel rounded w-3/4'></div>
        </div>
      ))}
    </div>
  );
}
