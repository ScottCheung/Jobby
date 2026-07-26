/** @format */

'use client';
import React, {
  useEffect,
  useState,
  useCallback,
  useDeferredValue,
  useMemo,
  startTransition,
  useRef,
} from 'react';
import {
  Search,
  FileText,
  Trash2,
  Save,
  Undo2,
  X,
  SlidersHorizontal,
  MousePointer2,
  PlayCircle,
  FolderPlus,
  FolderMinus,
  FolderInput,
  Loader2,
  Link,
  Info,
} from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { practiceCache } from '../practice/practice-cache';
import type {
  InterviewQuestion,
  InterviewCategory,
  InterviewTag,
  InterviewCollection,
  User,
} from '@/lib/types';
import { Tooltip } from '@/components/UI/tooltip';
import { cn, cleanName } from '@/lib/utils';
import { useLayoutStore } from '@/lib/store/layout-store';
import { useDebounce } from '@/lib/hooks/useDebounce';
import dynamic from 'next/dynamic';

const BatchImportModal = dynamic(
  () =>
    import('./_components/BatchImportModal').then(
      (mod) => mod.BatchImportModal,
    ),
  { ssr: false },
);
const AddQuestionsToCollectionModal = dynamic(
  () =>
    import('./_components/AddQuestionsToCollectionModal').then(
      (mod) => mod.AddQuestionsToCollectionModal,
    ),
  { ssr: false },
);
const BatchAssignCategoryModal = dynamic(
  () =>
    import('./_components/BatchAssignCategoryModal').then(
      (mod) => mod.BatchAssignCategoryModal,
    ),
  { ssr: false },
);
const CollectionFormModal = dynamic(
  () =>
    import('../collections/_components/CollectionFormModal').then(
      (mod) => mod.CollectionFormModal,
    ),
  { ssr: false },
);

import { QuestionForm } from './_components/QuestionForm';
import { FilterSidebar } from './_components/FilterSidebar';
import { QuestionRow } from './_components/QuestionRow';
import { QuestionsFilterDrawer } from './_components/QuestionsFilterDrawer';
import { Button } from '@/components/UI/Button';
import { showGlobalToast } from '@/lib/toast';
import { List, type RowComponentProps } from 'react-window';
import { div } from 'framer-motion/client';

const QUESTION_ROW_HEIGHT = 72;
const PRACTICE_BUTTON_SAFE_SPACE = 120;

type LibraryPracticeRowProps = {
  items: InterviewQuestion[];
  categories: InterviewCategory[];
  selectedIds: string[];
  isSelectionMode: boolean;
  gridColsClass: string;
  isDrawerOpen: boolean;
  drawerOpenId: string | null;
  currentUserId?: string;
  collections: InterviewCollection[];
  onSelectChange: (id: string, checked: boolean) => void;
  onInlineUpdate: (id: string, updates: Partial<InterviewQuestion>) => void;
  onOpenEdit: (q: InterviewQuestion) => void;
  onDeleteQuestion: (id: string) => void;
  onArchiveQuestion: (id: string) => void;
  isLoadingMore: boolean;
};

function LibraryPracticeRow({
  index,
  style,
  items,
  categories,
  selectedIds,
  isSelectionMode,
  gridColsClass,
  isDrawerOpen,
  drawerOpenId,
  currentUserId,
  collections,
  onSelectChange,
  onInlineUpdate,
  onOpenEdit,
  onDeleteQuestion,
  onArchiveQuestion,
  isLoadingMore,
}: RowComponentProps<LibraryPracticeRowProps>) {
  if (index >= items.length) {
    return (
      <div style={style} className='flex items-start justify-center pt-4'>
        {isLoadingMore && (
          <div className='flex items-center gap-2 text-sm font-medium text-ink-secondary'>
            <Loader2 className='h-4 w-4 animate-spin text-primary' />
            <span>Loading more items...</span>
          </div>
        )}
      </div>
    );
  }

  const question = items[index];
  return (
    <div style={{ ...style, overflow: 'visible' }}>
      <QuestionRow
        question={question}
        isSelectionMode={isSelectionMode}
        isSelected={selectedIds.includes(question.id)}
        onSelectChange={onSelectChange}
        onInlineUpdate={onInlineUpdate}
        onOpenEdit={onOpenEdit}
        onDeleteQuestion={onDeleteQuestion}
        onArchiveQuestion={onArchiveQuestion}
        categories={categories}
        gridColsClass={gridColsClass}
        isDrawerSelected={isDrawerOpen && drawerOpenId === question.id}
        currentUserId={currentUserId}
        collections={collections}
      />
    </div>
  );
}

export default function QuestionsLibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editQuestionId = searchParams?.get('edit');
  const handledEditIdRef = useRef<string | null>(null);

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const questionsLengthRef = useRef(0);
  useEffect(() => {
    questionsLengthRef.current = questions.length;
  }, [questions.length]);
  const [originalQuestions, setOriginalQuestions] = useState<
    InterviewQuestion[]
  >([]);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [libraryTotalCount, setLibraryTotalCount] = useState<number | null>(
    null,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [tags, setTags] = useState<InterviewTag[]>([]);
  const [collections, setCollections] = useState<InterviewCollection[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    () => searchParams?.get('category')?.split(',').filter(Boolean) || [],
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    () => searchParams?.get('tag')?.split(',').filter(Boolean) || [],
  );
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    () => searchParams?.get('collection')?.split(',').filter(Boolean) || [],
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] =
    useState<InterviewCollection | null>(null);
  const [collectionActionId, setCollectionActionId] = useState<string | null>(
    null,
  );
  const [isAddQuestionsModalOpen, setIsAddQuestionsModalOpen] = useState(false);
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] =
    useState(false);

  const activeCollectionId =
    selectedCollectionIds.length === 1 ? selectedCollectionIds[0] : null;
  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const isActiveCollectionOwned =
    activeCollection?.creator_user_id === currentUser?.id;
  const confirm = useConfirmStore((state) => state.confirm);

  const [search, setSearch] = useState<string>(
    () => searchParams?.get('search') || '',
  );
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [isLoading, setIsLoading] = useState(true);
  const [isPracticeLoading, setIsPracticeLoading] = useState(false);

  // Batch Import Modal visibility state
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: 'title' | 'category' | 'answer';
  } | null>(null);

  const [selectedImportances, setSelectedImportances] = useState<number[]>(
    () =>
      searchParams
        ?.get('importance')
        ?.split(',')
        .map(Number)
        .filter((n) => !isNaN(n)) || [],
  );
  const [selectedFrequencies, setSelectedFrequencies] = useState<string[]>(
    () => searchParams?.get('frequency')?.split(',').filter(Boolean) || [],
  );

  // Keep the click/input paint ahead of list, drawer, and network-state updates.
  const updateSelectedCategoryIds = useCallback((ids: string[]) => {
    startTransition(() => setSelectedCategoryIds(ids));
  }, []);
  const updateSelectedTagIds = useCallback((ids: string[]) => {
    startTransition(() => setSelectedTagIds(ids));
  }, []);
  const updateSelectedCollectionIds = useCallback((ids: string[]) => {
    startTransition(() => setSelectedCollectionIds(ids));
  }, []);
  const updateSelectedImportances = useCallback(
    (action: React.SetStateAction<number[]>) => {
      startTransition(() => setSelectedImportances(action));
    },
    [],
  );
  const updateSelectedFrequencies = useCallback(
    (action: React.SetStateAction<string[]>) => {
      startTransition(() => setSelectedFrequencies(action));
    },
    [],
  );

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
          setSelectedCategoryIds={updateSelectedCategoryIds}
          selectedTagIds={selectedTagIds}
          setSelectedTagIds={updateSelectedTagIds}
          selectedImportances={selectedImportances}
          setSelectedImportances={updateSelectedImportances}
          selectedFrequencies={selectedFrequencies}
          setSelectedFrequencies={updateSelectedFrequencies}
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
    updateSelectedCategoryIds,
    updateSelectedTagIds,
    updateSelectedImportances,
    updateSelectedFrequencies,
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

  const BATCH_SIZE = 20;
  const hasServerSideFilters =
    selectedCategoryIds.length > 0 ||
    selectedCollectionIds.length > 0 ||
    selectedTagIds.length > 0 ||
    selectedImportances.length > 0 ||
    selectedFrequencies.length > 0 ||
    debouncedSearch.length > 0;

  const buildServerFilterParams = () => ({
    search: debouncedSearch || undefined,
    category_ids:
      selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    collection_ids:
      selectedCollectionIds.length > 0 ? selectedCollectionIds : undefined,
    tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    importance_scores:
      selectedImportances.length > 0 ? selectedImportances : undefined,
    frequencies:
      selectedFrequencies.length > 0 ? selectedFrequencies : undefined,
  });

  const fetchQuestions = async (reset = true) => {
    const startTime = Date.now();
    try {
      if (reset) {
        setIsLoading(true);
        setIsPracticeLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      const offset = reset ? 0 : questionsLengthRef.current;
      const syncCache = !hasServerSideFilters;
      const res = await api.interviewQuestions({
        limit: BATCH_SIZE,
        offset,
        ...buildServerFilterParams(),
      });
      const data = res.items || [];
      const total = res.total ?? data.length;

      if (reset) {
        if (syncCache) {
          practiceCache.questions = data;
          practiceCache.totalQuestionCount = total;
          practiceCache.hasMoreQuestions =
            res.has_more ?? data.length === BATCH_SIZE;
          setLibraryTotalCount(total);
          window.dispatchEvent(
            new CustomEvent('jobby:libraryCountUpdated', { detail: total }),
          );
        }
        setQuestions(data);
        setOriginalQuestions(JSON.parse(JSON.stringify(data)));
        setSelectedIds([]);
        setTotalCount(total);
      } else {
        setQuestions((prev) => {
          const existingIds = new Set(prev.map((q) => q.id));
          const uniqueNewData = data.filter((q) => !existingIds.has(q.id));
          const next = [...prev, ...uniqueNewData];
          if (syncCache) {
            practiceCache.questions = next;
          }
          return next;
        });
        setTotalCount(total);
        setOriginalQuestions((prev) => {
          const existingIds = new Set(prev.map((q) => q.id));
          const uniqueNewData = data.filter((q) => !existingIds.has(q.id));
          return [...prev, ...JSON.parse(JSON.stringify(uniqueNewData))];
        });
        if (syncCache) {
          practiceCache.totalQuestionCount = total;
          practiceCache.hasMoreQuestions =
            res.has_more ?? data.length === BATCH_SIZE;
          setLibraryTotalCount(total);
          window.dispatchEvent(
            new CustomEvent('jobby:libraryCountUpdated', { detail: total }),
          );
        }
      }

      setHasMore(res.has_more ?? data.length === BATCH_SIZE);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDuration = 500; // Enforce minimum 0.5s loading state for smooth UI transitions
      if (elapsed < minDuration) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDuration - elapsed),
        );
      }
      if (reset) {
        setIsLoading(false);
        setIsPracticeLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  const loadNextBatch = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    void fetchQuestions(false);
  }, [isLoading, isLoadingMore, hasMore]);

  const initData = async (forceRefetch = false, silent = false) => {
    if (practiceCache.questions && !forceRefetch && !hasServerSideFilters) {
      setQuestions(practiceCache.questions);
      setTotalCount(
        practiceCache.totalQuestionCount ?? practiceCache.questions.length,
      );
      setLibraryTotalCount(
        practiceCache.totalQuestionCount ?? practiceCache.questions.length,
      );
      setHasMore(practiceCache.hasMoreQuestions ?? false);
      window.dispatchEvent(
        new CustomEvent('jobby:libraryCountUpdated', {
          detail:
            practiceCache.totalQuestionCount ?? practiceCache.questions.length,
        }),
      );
      setOriginalQuestions(JSON.parse(JSON.stringify(practiceCache.questions)));
      setCategories(practiceCache.categories || []);
      setIsLoading(false);
      try {
        const [tagsData, collectionData, myCollections, user] =
          await Promise.all([
            api.interviewTags(),
            api.interviewCollections(),
            api.myCreatedCollections().catch(() => []),
            api.me().catch(() => null),
          ]);
        setTags(tagsData);
        if (user) setCurrentUser(user);
        const libCols = collectionData.filter(
          (collection) =>
            collection.is_in_library && collection.status !== 'archived',
        );
        const combinedMap = new Map<string, InterviewCollection>();
        libCols.forEach((c) => combinedMap.set(c.id, c));
        myCollections.forEach((c) => {
          if (c.status !== 'archived') {
            combinedMap.set(c.id, c);
          }
        });
        setCollections(Array.from(combinedMap.values()));
      } catch (err) {}
      return;
    }

    if (!silent) setIsLoading(true);
    const startTime = Date.now();
    try {
      const [qsRes, cats, tagsData, collectionData, myCollections, user] =
        await Promise.all([
          api.interviewQuestions({
            limit: BATCH_SIZE,
            offset: 0,
            ...buildServerFilterParams(),
          }),
          api.interviewCategories(),
          api.interviewTags(),
          api.interviewCollections(),
          api.myCreatedCollections().catch(() => []),
          api.me().catch(() => null),
        ]);

      const qs = qsRes.items || [];
      const total = qsRes.total ?? qs.length;

      if (!hasServerSideFilters) {
        practiceCache.questions = qs;
        practiceCache.totalQuestionCount = total;
        practiceCache.hasMoreQuestions =
          qsRes.has_more ?? qs.length === BATCH_SIZE;
        practiceCache.categories = cats;
        setLibraryTotalCount(total);
        window.dispatchEvent(
          new CustomEvent('jobby:libraryCountUpdated', { detail: total }),
        );
      }

      setQuestions(qs);
      setHasMore(qsRes.has_more ?? qs.length === BATCH_SIZE);
      setTotalCount(total);
      setOriginalQuestions(JSON.parse(JSON.stringify(qs)));
      setCategories(cats);
      setTags(tagsData);
      if (user) setCurrentUser(user);
      const libCols = collectionData.filter(
        (collection) =>
          collection.is_in_library && collection.status !== 'archived',
      );
      const combinedMap = new Map<string, InterviewCollection>();
      libCols.forEach((c) => combinedMap.set(c.id, c));
      myCollections.forEach((c) => {
        if (c.status !== 'archived') {
          combinedMap.set(c.id, c);
        }
      });
      setCollections(Array.from(combinedMap.values()));
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to initialize questions page:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDuration = 500; // 0.5 seconds
      if (!silent && elapsed < minDuration) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDuration - elapsed),
        );
      }
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    void initData(true);
  }, [pathname]);

  useEffect(() => {
    if (!editQuestionId || handledEditIdRef.current === editQuestionId) return;
    handledEditIdRef.current = editQuestionId;
    const targetQ = questions.find((q) => q.id === editQuestionId);
    if (targetQ) {
      handleOpenEditQuestion(targetQ);
    } else {
      api
        .getInterviewQuestion(editQuestionId)
        .then((q) => {
          if (q) handleOpenEditQuestion(q);
        })
        .catch(() => undefined);
    }
  }, [editQuestionId, questions]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategoryIds.length > 0)
      params.set('category', selectedCategoryIds.join(','));
    if (selectedCollectionIds.length > 0)
      params.set('collection', selectedCollectionIds.join(','));
    if (selectedTagIds.length > 0) params.set('tag', selectedTagIds.join(','));
    if (selectedImportances.length > 0)
      params.set('importance', selectedImportances.join(','));
    if (selectedFrequencies.length > 0)
      params.set('frequency', selectedFrequencies.join(','));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (editQuestionId) params.set('edit', editQuestionId);

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
    window.history.replaceState(null, '', targetUrl);
  }, [
    selectedCategoryIds,
    selectedCollectionIds,
    selectedTagIds,
    selectedImportances,
    selectedFrequencies,
    debouncedSearch,
    editQuestionId,
    pathname,
  ]);

  useEffect(() => {
    if (isLoading) return;
    void fetchQuestions(true);
  }, [
    selectedCategoryIds,
    selectedCollectionIds,
    selectedTagIds,
    selectedImportances,
    selectedFrequencies,
    debouncedSearch,
  ]);

  useEffect(() => {
    const syncLibrary = () => void initData(true, true);
    window.addEventListener('playbookLibraryUpdated', syncLibrary);
    return () =>
      window.removeEventListener('playbookLibraryUpdated', syncLibrary);
  }, []);

  const modified = useMemo(() => {
    const originalById = new Map(originalQuestions.map((q) => [q.id, q]));
    return questions.filter((q) => {
      const orig = originalById.get(q.id);
      if (!orig) return false;
      const answerChanged =
        q.can_edit ?
          q.answer_objective !== orig.answer_objective
        : q.my_answer !== orig.my_answer;
      return (
        q.title !== orig.title ||
        q.category_id !== orig.category_id ||
        q.frequency !== orig.frequency ||
        q.importance_score !== orig.importance_score ||
        answerChanged
      );
    });
  }, [questions, originalQuestions]);
  const hasChanges = modified.length > 0;

  const handleSaveAll = async () => {
    if (modified.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(
        modified.map((q) => {
          return api.updateInterviewQuestion(
            q.id,
            q.can_edit ?
              {
                title: q.title,
                category_id: q.category_id,
                frequency: q.frequency,
                importance_score: q.importance_score,
                answer_objective: q.answer_objective,
                my_answer: q.my_answer,
              }
            : {
                category_id: q.category_id,
                frequency: q.frequency,
                importance_score: q.importance_score,
                my_answer: q.my_answer,
              },
          );
        }),
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

  const handleDiscardAll = async () => {
    const accepted = await confirm({
      title: 'Discard Changes',
      message: 'Are you sure you want to discard all unsaved changes?',
      confirmLabel: 'Discard',
      type: 'warning',
    });
    if (!accepted) return;
    setQuestions(JSON.parse(JSON.stringify(originalQuestions)));
  };

  const handleDeleteQuestion = async (id: string) => {
    const accepted = await confirm({
      title: 'Remove Saved Question',
      message:
        'Remove this question from your saved Library? If it belongs to a collection you subscribe to, it may still appear through that collection.',
      confirmLabel: 'Remove Saved',
      type: 'delete',
    });
    if (!accepted) return;
    if (hasChanges) {
      const continueWithChanges = await confirm({
        title: 'Unsaved Changes Warning',
        message:
          'You have unsaved changes. Removing this saved question will reload the questions and discard all other unsaved changes. Continue?',
        confirmLabel: 'Discard & Remove',
        type: 'warning',
      });
      if (!continueWithChanges) return;
    }
    try {
      await api.deleteInterviewQuestion(id);
      addNotification({
        type: 'success',
        message: 'Question removed from saved Library',
      });
      await fetchQuestions();
    } catch (err) {
      console.error('Failed to remove saved question:', err);
      addNotification({
        type: 'error',
        message: 'Failed to remove saved question',
      });
    }
  };

  const handleArchiveQuestion = async (id: string) => {
    const question = questions.find((item) => item.id === id);
    const accepted = await confirm({
      title: 'Archive Public Question?',
      message:
        question ?
          `Archive "${question.title}" from the public question bank? It will disappear from search, recommendations, Library practice lists, and Question Sets. Existing practice history is preserved.`
        : 'Archive this question from the public question bank? It will disappear from search, recommendations, Library practice lists, and Question Sets. Existing practice history is preserved.',
      confirmLabel: 'Archive Question',
      type: 'delete',
    });
    if (!accepted) return;
    if (hasChanges) {
      const continueWithChanges = await confirm({
        title: 'Unsaved Changes Warning',
        message:
          'You have unsaved changes. Archiving this question will reload the questions and discard all other unsaved changes. Continue?',
        confirmLabel: 'Discard & Archive',
        type: 'warning',
      });
      if (!continueWithChanges) return;
    }
    try {
      await api.archiveInterviewQuestion(id);
      addNotification({
        type: 'success',
        message: 'Question archived from the public question bank',
      });
      await fetchQuestions();
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (err) {
      console.error('Failed to archive question:', err);
      addNotification({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to archive question',
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const savedSelectedIds = selectedIds.filter(
      (id) => questions.find((q) => q.id === id)?.is_saved,
    );
    if (savedSelectedIds.length === 0) {
      addNotification({
        type: 'info',
        message: 'No saved questions selected',
      });
      return;
    }
    if (hasChanges) {
      const continueWithChanges = await confirm({
        title: 'Unsaved Changes Warning',
        message:
          'You have unsaved changes. Removing saved questions will reload the questions and discard all other unsaved changes. Continue?',
        confirmLabel: 'Discard & Continue',
        type: 'warning',
      });
      if (!continueWithChanges) return;
    }
    const savedQuestionLabel = `question${savedSelectedIds.length === 1 ? '' : 's'}`;
    const accepted = await confirm({
      title: 'Remove Saved Questions',
      message: `Remove ${savedSelectedIds.length} selected ${savedQuestionLabel} from your saved Library? Collection subscriptions can still show matching questions.`,
      confirmLabel: 'Remove Saved',
      type: 'delete',
    });
    if (!accepted) return;

    setIsSaving(true);
    try {
      await Promise.all(
        savedSelectedIds.map((id) => api.deleteInterviewQuestion(id)),
      );
      addNotification({
        type: 'success',
        message: `Removed ${savedSelectedIds.length} saved ${savedQuestionLabel}`,
      });
      setIsSelectionMode(false);
      await fetchQuestions();
    } catch (err) {
      console.error('Failed to remove selected saved questions:', err);
      addNotification({
        type: 'error',
        message: 'Failed to remove some saved questions',
      });
      await fetchQuestions(); // Sync back
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSelectedFromCollection = async () => {
    if (!activeCollection || selectedIds.length === 0) return;
    const accepted = await confirm({
      title: 'Remove from Collection',
      message: `Are you sure you want to remove the ${selectedIds.length} selected questions from this collection? This only removes their reference from this collection; the original questions will remain in your library.`,
      confirmLabel: 'Remove Reference',
      type: 'remove',
    });
    if (!accepted) return;
    setIsSaving(true);
    try {
      const currentIds = activeCollection.question_ids || [];
      const idsToRemove = new Set(selectedIds);
      const newIds = currentIds.filter((id) => !idsToRemove.has(id));

      await api.updateInterviewCollection(activeCollection.id, {
        question_ids: newIds,
      });
      addNotification({
        type: 'success',
        message: `Successfully removed ${selectedIds.length} questions from collection`,
      });
      setSelectedIds([]);
      setIsSelectionMode(false);
      await initData(true, true);
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        message:
          err instanceof Error ?
            err.message
          : 'Failed to remove questions from collection',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddQuestionsToCollection = async (questionIdsToAdd: string[]) => {
    if (!activeCollection) return;
    try {
      const currentIds = activeCollection.question_ids || [];
      const newIds = Array.from(new Set([...currentIds, ...questionIdsToAdd]));
      await api.updateInterviewCollection(activeCollection.id, {
        question_ids: newIds,
      });
      addNotification({
        type: 'success',
        message: 'Questions added to collection successfully',
      });
      setIsAddQuestionsModalOpen(false);
      await initData(true, true);
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        message:
          err instanceof Error ?
            err.message
          : 'Failed to add questions to collection',
      });
    }
  };

  const handleBatchAssignCategory = async (targetCategoryId: string | null) => {
    if (selectedIds.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          api.updateInterviewQuestion(id, { category_id: targetCategoryId }),
        ),
      );
      const catName =
        targetCategoryId ?
          categories.find((c) => c.id === targetCategoryId)?.name
        : null;
      addNotification({
        type: 'success',
        message:
          targetCategoryId ?
            `Updated category to "${cleanName(catName || '')}" for ${selectedIds.length} question${selectedIds.length === 1 ? '' : 's'}`
          : `Cleared category for ${selectedIds.length} question${selectedIds.length === 1 ? '' : 's'}`,
      });
      setSelectedIds([]);
      setIsSelectionMode(false);
      await fetchQuestions();
    } catch (err) {
      console.error('Failed to batch assign category:', err);
      addNotification({
        type: 'error',
        message: 'Failed to update category for selected questions',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCollectionAddOrRestore = async (
    collection: InterviewCollection,
  ) => {
    const isRestoring =
      collection.library_status === 'partial' ||
      (collection.library_status === 'not_added' && collection.is_in_library);
    const isLocked = !collection.is_purchased && collection.price_coins > 0;
    const questionLabel =
      collection.missing_question_count === 1 ?
        '1 missing question'
      : `${collection.missing_question_count} missing questions`;
    const accepted = await confirm(
      isRestoring ?
        {
          title: 'Restore missing questions?',
          message: `Restore ${questionLabel} from "${collection.title}"? Your answers and practice history will stay intact.`,
          confirmLabel: 'Restore Questions',
          cancelLabel: 'Cancel',
        }
      : isLocked ?
        {
          title: 'Unlock collection?',
          message: `Spend ${collection.price_coins} coins to add "${collection.title}" to your Library?`,
          confirmLabel: 'Unlock & Add',
          cancelLabel: 'Cancel',
        }
      : {
          title: 'Add to Library?',
          message: `Add "${collection.title}" to your Library?`,
          confirmLabel: 'Add to Library',
          cancelLabel: 'Cancel',
        },
    );
    if (!accepted) return;

    setCollectionActionId(collection.id);
    try {
      const result = await api.addCollectionToLibrary(collection.id);
      showGlobalToast(
        result.questions_added > 0 ?
          `${result.questions_added} question${result.questions_added === 1 ? '' : 's'} ${isRestoring ? 'restored' : 'added'}`
        : 'Collection is already complete in your Library',
      );
      await initData(true, true);
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not update collection.',
      );
    } finally {
      setCollectionActionId(null);
    }
  };

  const handleCollectionRemove = async (collection: InterviewCollection) => {
    const accepted = await confirm({
      title: 'Remove collection from Library?',
      message: `Remove all active questions from "${collection.title}"? Your purchase, answers, and practice history are preserved.`,
      confirmLabel: 'Remove from Library',
      cancelLabel: 'Cancel',
      type: 'remove',
    });
    if (!accepted) return;

    setCollectionActionId(collection.id);
    try {
      await api.removeCollectionFromLibrary(collection.id);
      setSelectedCollectionIds((ids) =>
        ids.filter((id) => id !== collection.id),
      );
      showGlobalToast('Collection removed from Library');
      await initData(true, true);
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not remove collection.',
      );
    } finally {
      setCollectionActionId(null);
    }
  };

  const handleCollectionEdit = (collection: InterviewCollection) => {
    setCollectionToEdit(collection);
    setIsCollectionModalOpen(true);
  };

  const handleCollectionArchive = async (collection: InterviewCollection) => {
    const accepted = await confirm({
      title: 'Stop maintaining collection?',
      message: `"${collection.title}" will no longer be available to new users. Existing owners keep access and you can publish it again later.`,
      confirmLabel: 'Stop Maintaining',
      cancelLabel: 'Cancel',
      type: 'warning',
    });
    if (!accepted) return;

    setCollectionActionId(collection.id);
    try {
      await api.updateInterviewCollection(collection.id, {
        status: 'archived',
      });
      setSelectedCollectionIds((ids) =>
        ids.filter((id) => id !== collection.id),
      );
      showGlobalToast('Collection is no longer maintained');
      await initData(true, true);
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not update collection.',
      );
    } finally {
      setCollectionActionId(null);
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
    if (!q.can_edit) {
      addNotification({
        type: 'warning',
        message:
          'Only the contributor can edit public question details. You can still update your personal answer inline.',
      });
      return;
    }
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
  // Every visible result now comes from the same server-side query used for practice.
  const filteredQuestions = questions;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPracticeQuestions = useMemo(
    () => questions.filter((q) => selectedIdSet.has(q.id)),
    [questions, selectedIdSet],
  );
  const hasActiveFilters =
    selectedCategoryIds.length > 0 ||
    selectedTagIds.length > 0 ||
    selectedImportances.length > 0 ||
    selectedFrequencies.length > 0 ||
    selectedCollectionIds.length > 0 ||
    debouncedSearch.length > 0;
  const practiceQuestions =
    selectedPracticeQuestions.length > 0 ? selectedPracticeQuestions
    : hasActiveFilters ? filteredQuestions
    : questions;
  const shouldStartCustomPractice =
    selectedPracticeQuestions.length > 0 || hasActiveFilters;

  const fetchAllMatchingQuestions = async () => {
    const allQuestions: InterviewQuestion[] = [];
    let offset = 0;
    let more = true;

    while (more) {
      const response = await api.interviewQuestions({
        limit: 200,
        offset,
        ...buildServerFilterParams(),
      });
      const page = response.items || [];
      allQuestions.push(...page);
      more = response.has_more ?? page.length === 200;
      offset += page.length;
      if (page.length === 0) break;
    }

    return allQuestions;
  };

  const handleStartPractice = async () => {
    if (practiceQuestions.length === 0) {
      addNotification({
        type: 'warning',
        message: 'No questions to practice.',
      });
      return;
    }

    practiceCache.questions = null;
    practiceCache.totalQuestionCount = null;
    practiceCache.hasMoreQuestions = null;

    if (shouldStartCustomPractice) {
      let customQuestions = practiceQuestions;
      if (selectedPracticeQuestions.length === 0) {
        try {
          customQuestions = await fetchAllMatchingQuestions();
        } catch (error) {
          console.error(
            'Failed to load the complete filtered practice set:',
            error,
          );
          addNotification({
            type: 'error',
            message:
              'Could not load the full filtered practice set. Please try again.',
          });
          return;
        }
      }
      if (customQuestions.length === 0) {
        addNotification({
          type: 'warning',
          message: 'No questions to practice.',
        });
        return;
      }
      practiceCache.questions = customQuestions;
      practiceCache.totalQuestionCount = customQuestions.length;
      practiceCache.hasMoreQuestions = false;
      try {
        sessionStorage.setItem(
          'practiceCustomIds',
          JSON.stringify(customQuestions.map((q) => q.id)),
        );
      } catch {}
      router.push(
        `/interview-prep/practice/${customQuestions[0].id}?mode=custom`,
      );
      return;
    }

    router.push(`/interview-prep/practice/${questions[0].id}?mode=free`);
  };

  const gridColsClass =
    isSelectionMode ?
      'grid-cols-[36px_minmax(0,3.2fr)_minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_88px]'
    : 'grid-cols-[minmax(0,3.2fr)_minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_88px]';

  const totalFilteredCount = totalCount ?? practiceQuestions.length;

  return (
    <div className='flex h-full min-h-0 gap-4 overflow-hidden relative'>
      {/* 1. Sidebar Panel */}
      <FilterSidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        categories={categories}
        tags={tags}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={updateSelectedCategoryIds}
        selectedTagIds={selectedTagIds}
        setSelectedTagIds={updateSelectedTagIds}
        questions={questions}
        libraryTotalCount={libraryTotalCount ?? totalCount ?? questions.length}
        collections={collections}
        selectedCollectionIds={selectedCollectionIds}
        setSelectedCollectionIds={updateSelectedCollectionIds}
        onCreateCollection={() => setIsCollectionModalOpen(true)}
        currentUserId={currentUser?.id}
        collectionActionId={collectionActionId}
        onCollectionAddOrRestore={handleCollectionAddOrRestore}
        onCollectionRemove={handleCollectionRemove}
        onCollectionEdit={handleCollectionEdit}
        onCollectionArchive={handleCollectionArchive}
      />

      {/* 2. Questions List (Full Width) */}
      <div className='panel-xl pb-0! flex min-h-0 w-full flex-col overflow-hidden relative'>
        {/* Header Tools */}
        <div className='flex items-center justify-between gap-4 shrink-0'>
          <div className='flex items-center gap-2 flex-1 max-w-md'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary' />
              <input
                type='text'
                placeholder='Search questions...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='body-md w-full pl-9 pr-4 py-2 rounded-xl bg-panel dark:bg-background-secondary dark:border-border focus:outline-none focus:border-primary/50 dark:focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:focus:ring-primary/20 text-ink-primary'
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
                    className='flex items-center justify-center w-9 h-9 text-ink-primary bg-background-secondary hover:bg-background-secondary/80 dark:bg-panel dark:hover:bg-panel rounded-xl transition-colors border border-border'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </Tooltip>
                {selectedIds.length > 0 && (
                  <>
                    <Tooltip
                      content={`Assign Category (${selectedIds.length})`}
                      side='bottom'
                    >
                      <button
                        onClick={() => setIsBatchCategoryModalOpen(true)}
                        disabled={isSaving}
                        className='flex items-center justify-center w-9 h-9 text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors border border-primary/30 disabled:opacity-50'
                      >
                        <FolderInput className='w-4 h-4' />
                      </button>
                    </Tooltip>
                    {activeCollection ?
                      isActiveCollectionOwned && (
                        <Tooltip
                          content={`Remove from Collection (${selectedIds.length})`}
                          side='bottom'
                        >
                          <button
                            onClick={handleRemoveSelectedFromCollection}
                            disabled={isSaving}
                            className='flex items-center justify-center w-9 h-9 text-rose-605 bg-rose-50 hover:bg-rose-100/80 dark:text-rose-400 dark:bg-rose-955/20 dark:hover:bg-rose-955/30 rounded-xl transition-colors border border-rose-200/50 dark:border-rose-900/30 disabled:opacity-50'
                          >
                            <FolderMinus className='w-4 h-4' />
                          </button>
                        </Tooltip>
                      )
                    : <Tooltip
                        content={`Remove Saved (${selectedIds.length})`}
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
                    }
                  </>
                )}
              </>
            : <Tooltip content='Select Multiple' side='bottom'>
                <button
                  onClick={() => setIsSelectionMode(true)}
                  disabled={isSaving}
                  className='flex items-center justify-center w-9 h-9 text-ink-primary bg-background-secondary hover:bg-background-secondary/80 dark:bg-panel dark:hover:bg-panel rounded-xl transition-colors border border-border'
                >
                  <MousePointer2 className='w-4 h-4' />
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
                    className='flex items-center justify-center w-9 h-9 text-red-655 bg-red-50 hover:bg-red-100/80 dark:text-red-400 dark:bg-red-955/20 dark:hover:bg-red-955/30 rounded-xl transition-colors border border-red-200/50 dark:border-red-900/30 disabled:opacity-50'
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
            {activeCollection && isActiveCollectionOwned && (
              <Tooltip
                content={`Add Questions to Collection: ${activeCollection.title}`}
                side='bottom'
              >
                <Button
                  layoutId='add-questions-to-collection'
                  onClick={() => setIsAddQuestionsModalOpen(true)}
                  Icon={FolderPlus}
                  disabled={isSaving}
                  size='md'
                >
                  Add Questions
                </Button>
              </Tooltip>
            )}
            {!(activeCollection && isActiveCollectionOwned) && (
              <Tooltip
                content='Import Questions into your Library for practice'
                side='bottom'
              >
                <Button
                  layoutId='Import Questions'
                  onClick={handleOpenBatchImport}
                  Icon={FileText}
                  size='md'
                  className='transition-none!'
                >
                  Import Questions
                </Button>
              </Tooltip>
            )}
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
          <div className='pr-3'>Question</div>
          <div className='pr-3'>Category</div>
          <div className='pr-3'>Key Info</div>
          <div className='pr-3'>Collection</div>
          <div className='pr-3'>Contributor</div>
          <div className='pr-2 text-right'>Actions</div>
        </div>

        {/* Table Content */}
        <div className='fade-out-tb relative flex-1 min-h-0 overflow-hidden'>
          {isLoading ?
            <QuestionListSkeleton />
          : filteredQuestions.length === 0 ?
            <div className='p-12 flex flex-col items-center justify-center text-center'>
              <FileText className='w-12 h-12 text-ink-secondary mb-4 opacity-50' />
              <h3 className='title-card text-ink-primary mb-1'>
                {activeCollection ?
                  'This collection is empty'
                : 'No questions found'}
              </h3>
              <p className='body-md text-ink-secondary max-w-sm mb-4'>
                {activeCollection ?
                  'Add questions from your library to populate this collection.'
                : 'Import or add questions to build your personalized practice list.'
                }
              </p>
              {activeCollection && isActiveCollectionOwned && (
                <Button
                  onClick={() => setIsAddQuestionsModalOpen(true)}
                  Icon={FolderPlus}
                >
                  Add Questions
                </Button>
              )}
            </div>
          : <div className='h-full min-h-0'>
              {/* <QuestionListSkeleton /> */}
              <List
                rowComponent={LibraryPracticeRow}
                rowCount={filteredQuestions.length + 1}
                rowHeight={(index) =>
                  index < filteredQuestions.length ?
                    QUESTION_ROW_HEIGHT
                  : PRACTICE_BUTTON_SAFE_SPACE
                }
                rowProps={{
                  items: filteredQuestions,
                  categories,
                  selectedIds,
                  isSelectionMode,
                  gridColsClass,
                  isDrawerOpen,
                  drawerOpenId: drawerOpenId ?? null,
                  currentUserId: currentUser?.id,
                  collections,
                  onSelectChange: (id, checked) => {
                    setSelectedIds((prev) =>
                      checked ? [...prev, id] : prev.filter((x) => x !== id),
                    );
                  },
                  onInlineUpdate: handleInlineUpdate,
                  onOpenEdit: handleOpenEditQuestion,
                  onDeleteQuestion: handleDeleteQuestion,
                  onArchiveQuestion: handleArchiveQuestion,
                  isLoadingMore,
                }}
                onRowsRendered={({ stopIndex }) => {
                  if (
                    stopIndex >= filteredQuestions.length - 5 &&
                    hasMore &&
                    !isLoadingMore
                  ) {
                    loadNextBatch();
                  }
                }}
                overscanCount={6}
                className='h-full min-h-0'
                style={{ height: '100%', minHeight: 0 }}
                defaultHeight={600}
              />
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
      {questions.length > 0 &&
        !hasChanges &&
        (!isSelectionMode || selectedPracticeQuestions.length > 0) && (
          <div className='absolute bottom-4 right-4 z-20 animate-in slide-in-from-bottom-8 fade-in duration-300'>
            {isPracticeLoading || isLoading ?
              <button
                disabled
                className='flex items-center gap-2 pl-4 pr-6 py-4 bg-primary/80 text-primary-foreground font-bold rounded-full shadow-xl shadow-primary/30 opacity-90 cursor-not-allowed'
              >
                <Loader2 className='w-5 h-5 mr-3 animate-spin' />
                Practice (Calculating...)
              </button>
            : practiceQuestions.length > 0 && (
                <Tooltip
                  content={
                    shouldStartCustomPractice ?
                      selectedPracticeQuestions.length > 0 ?
                        `Custom Set Mode: Practice the ${selectedPracticeQuestions.length} selected questions`
                      : `Custom Set Mode: Practice the ${totalFilteredCount} filtered questions`

                    : 'Free Roam Mode: Randomly practice all your questions'
                  }
                  side='left'
                  delay={100}
                >
                  <button
                    onClick={handleStartPractice}
                    className='flex items-center gap-2 pl-4 pr-6 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full shadow-xl shadow-primary/30 transition-transform hover:-translate-y-1 active:translate-y-0'
                  >
                    <PlayCircle className='w-5 h-5 mr-3' />
                    {shouldStartCustomPractice ?
                      selectedPracticeQuestions.length > 0 ?
                        `Practice (${selectedPracticeQuestions.length} Selected)`
                      : `Practice (${totalFilteredCount} Filtered)`
                    : 'Start Practice (All)'}
                  </button>
                </Tooltip>
              )
            }
          </div>
        )}
      {/* Custom Collection Creation & Edit Modal */}
      {isCollectionModalOpen && (
        <CollectionFormModal
          collection={collectionToEdit}
          defaultStatus='draft'
          categories={categories}
          onSave={async (payload) => {
            try {
              if (collectionToEdit) {
                const updated = await api.updateInterviewCollection(
                  collectionToEdit.id,
                  payload,
                );
                if (payload.cover_file)
                  await api.uploadCollectionCover(
                    updated.id,
                    payload.cover_file,
                  );
                showGlobalToast('Collection updated');
              } else {
                const created = await api.createInterviewCollection(payload);
                if (payload.cover_file)
                  await api.uploadCollectionCover(
                    created.id,
                    payload.cover_file,
                  );
                showGlobalToast('Collection created as a private draft');
              }
              setCollectionToEdit(null);
              setIsCollectionModalOpen(false);
              await initData(true, true);
            } catch (err) {
              console.error(err);
              showGlobalToast(
                err instanceof Error ?
                  err.message
                : 'Could not save collection.',
              );
              throw err;
            }
          }}
          onClose={() => {
            setCollectionToEdit(null);
            setIsCollectionModalOpen(false);
          }}
        />
      )}
      {isAddQuestionsModalOpen && activeCollection && (
        <AddQuestionsToCollectionModal
          isOpen={isAddQuestionsModalOpen}
          onClose={() => setIsAddQuestionsModalOpen(false)}
          collection={activeCollection}
          questions={questions}
          categories={categories}
          tags={tags}
          onSave={handleAddQuestionsToCollection}
        />
      )}
      {isBatchCategoryModalOpen && (
        <BatchAssignCategoryModal
          isOpen={isBatchCategoryModalOpen}
          onClose={() => setIsBatchCategoryModalOpen(false)}
          selectedCount={selectedIds.length}
          categories={categories}
          onAssignCategory={handleBatchAssignCategory}
        />
      )}
    </div>
  );
}

function QuestionListSkeleton() {
  return (
    <div className='flex flex-col gap-3 p-4 animate-text-shimmer-primary animate-text-shimmer'>
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={i}
          className='grid grid-cols-[minmax(0,3.2fr)_minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_88px] items-center py-4 border-b border-border/50'
        >
          <div className='h-4 bg-muted rounded w-3/4'></div>
          <div className='h-4 bg-muted rounded w-1/2'></div>
          <div className='h-4 bg-muted rounded w-2/3'></div>
          <div className='h-4 bg-muted rounded w-1/2'></div>
          <div className='h-4 bg-muted rounded w-1/3'></div>
          <div className='h-4 bg-muted rounded w-full'></div>
        </div>
      ))}
    </div>
  );
}
