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
  MousePointer2,
  PlayCircle,
  FolderPlus,
  FolderMinus,
  FolderInput,
  Loader2,
  Link,
  Info,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
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
import { cn, cleanName, matchesCollection } from '@/lib/utils';
import { useLayoutStore } from '@/lib/store/layout-store';
import dynamic from 'next/dynamic';

const BatchImportModal = dynamic(
  () => import('./_components/BatchImportModal').then((mod) => mod.BatchImportModal),
  { ssr: false },
);
const AddQuestionsToCollectionModal = dynamic(
  () => import('./_components/AddQuestionsToCollectionModal').then((mod) => mod.AddQuestionsToCollectionModal),
  { ssr: false },
);
const BatchAssignCategoryModal = dynamic(
  () => import('./_components/BatchAssignCategoryModal').then((mod) => mod.BatchAssignCategoryModal),
  { ssr: false },
);
const CollectionFormModal = dynamic(
  () => import('../collections/_components/CollectionFormModal').then((mod) => mod.CollectionFormModal),
  { ssr: false },
);

import { QuestionForm } from './_components/QuestionForm';
import { FilterSidebar } from './_components/FilterSidebar';
import { QuestionRow } from './_components/QuestionRow';
import { QuestionsFilterDrawer } from './_components/QuestionsFilterDrawer';
import { Button } from '@/components/UI/Button';
import { showGlobalToast } from '@/lib/toast';
import { VirtualList } from '@/components/UI/VirtualList';

export default function QuestionsLibraryPage() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<
    InterviewQuestion[]
  >([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [tags, setTags] = useState<InterviewTag[]>([]);
  const [collections, setCollections] = useState<InterviewCollection[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
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

  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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

  const BATCH_SIZE = 20;

  const fetchQuestions = async (reset = true) => {
    try {
      if (!reset) setIsLoadingMore(true);
      const offset = reset ? 0 : questions.length;
      const data = await api.interviewQuestions({ limit: BATCH_SIZE, offset });

      if (reset) {
        practiceCache.questions = data;
        setQuestions(data);
        setOriginalQuestions(JSON.parse(JSON.stringify(data)));
        setSelectedIds([]);
      } else {
        setQuestions((prev) => {
          const next = [...prev, ...data];
          practiceCache.questions = next;
          return next;
        });
        setOriginalQuestions((prev) => [...prev, ...JSON.parse(JSON.stringify(data))]);
      }

      setHasMore(data.length === BATCH_SIZE);
      window.dispatchEvent(new CustomEvent('jobby:libraryCountUpdated', { detail: reset ? data.length : questions.length + data.length }));
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadNextBatch = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    void fetchQuestions(false);
  }, [isLoading, isLoadingMore, hasMore, questions.length]);

  const initData = async (forceRefetch = false, silent = false) => {
    if (practiceCache.questions && !forceRefetch) {
      setQuestions(practiceCache.questions);
      window.dispatchEvent(new CustomEvent('jobby:libraryCountUpdated', { detail: practiceCache.questions.length }));
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
      const [qs, cats, tagsData, collectionData, myCollections, user] =
        await Promise.all([
          api.interviewQuestions({ limit: BATCH_SIZE, offset: 0 }),
          api.interviewCategories(),
          api.interviewTags(),
          api.interviewCollections(),
          api.myCreatedCollections().catch(() => []),
          api.me().catch(() => null),
        ]);

      practiceCache.questions = qs;
      practiceCache.categories = cats;

      setQuestions(qs);
      setHasMore(qs.length === BATCH_SIZE);
      window.dispatchEvent(new CustomEvent('jobby:libraryCountUpdated', { detail: qs.length }));
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
    const syncLibrary = () => void initData(true, true);
    window.addEventListener('playbookLibraryUpdated', syncLibrary);
    return () =>
      window.removeEventListener('playbookLibraryUpdated', syncLibrary);
  }, []);

  const getModifiedQuestions = () => {
    return questions.filter((q) => {
      const orig = originalQuestions.find((o) => o.id === q.id);
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
  };

  const modified = getModifiedQuestions();
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
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase());
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
    const matchesCollectionFilter =
      selectedCollectionIds.length === 0 ||
      selectedCollectionIds.some((cId) => {
        const col = collections.find((c) => c.id === cId);
        return col ? matchesCollection(q, col) : false;
      });

    return (
      matchesSearch &&
      matchesCategory &&
      matchesTag &&
      matchesImportance &&
      matchesFrequency &&
      matchesCollectionFilter
    );
  });
  const collectionMap = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const sourceCollections = collections.filter((collection) =>
    questions.some((question) =>
      question.collection_ids?.includes(collection.id),
    ),
  );

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
      'grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_120px]'
    : 'grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_120px]';

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
        collections={collections}
        selectedCollectionIds={selectedCollectionIds}
        setSelectedCollectionIds={setSelectedCollectionIds}
        onCreateCollection={() => setIsCollectionModalOpen(true)}
        currentUserId={currentUser?.id}
        collectionActionId={collectionActionId}
        onCollectionAddOrRestore={handleCollectionAddOrRestore}
        onCollectionRemove={handleCollectionRemove}
        onCollectionEdit={handleCollectionEdit}
        onCollectionArchive={handleCollectionArchive}
      />

      {/* 2. Questions List (Full Width) */}
      <div className='panel-xl pb-0! flex flex-col overflow-hidden w-full relative'>
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
          <div className='px-2'>Question</div>
          <div className='px-2'>Category</div>
          <div className='px-2'>Collection</div>
          <div className='px-2'>Author</div>
          <div className='px-2'>Frequency</div>
          <div className='px-2'>Importance</div>
          <div className='px-2 text-right pr-4'>Actions</div>
        </div>

        {/* Table Content */}
        <div className='flex-1 overflow-hidden fade-out-tb relative'>
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
          : <VirtualList
              items={filteredQuestions}
              itemHeight={56}
              buffer={5}
              getItemKey={(q) => q.id}
              onLoadMore={loadNextBatch}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              className='h-full divide-y divide-border/40'
              renderItem={(q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.includes(q.id)}
                  onSelectChange={(id, checked) => {
                    setSelectedIds((prev) =>
                      checked ? [...prev, id] : prev.filter((x) => x !== id),
                    );
                  }}
                  onInlineUpdate={handleInlineUpdate}
                  onOpenEdit={handleOpenEditQuestion}
                  onDeleteQuestion={handleDeleteQuestion}
                  onArchiveQuestion={handleArchiveQuestion}
                  categories={categories}
                  gridColsClass={gridColsClass}
                  isDrawerSelected={isDrawerOpen && drawerOpenId === q.id}
                  currentUserId={currentUser?.id}
                  collections={collections}
                />
              )}
            />
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
          {filteredQuestions.length > 0 && (
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
          )}
        </div>
      )}
      {/* Custom Collection Creation & Edit Modal */}
      {isCollectionModalOpen && (
        <CollectionFormModal
          collection={collectionToEdit}
          defaultStatus='draft'
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
    <div className='flex flex-col gap-3 p-4 animate-pulse'>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className='grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,2.5fr)] items-center py-4 border-b border-border/50'
        >
          <div className='h-4 bg-panel rounded w-2/3'></div>
          <div className='h-4 bg-panel rounded w-1/2'></div>
          <div className='h-4 bg-panel rounded w-1/3'></div>
          <div className='h-4 bg-panel rounded w-1/4'></div>
          <div className='h-4 bg-panel rounded w-1/4'></div>
          <div className='h-4 bg-panel rounded w-1/4'></div>
          <div className='h-4 bg-panel rounded w-3/4'></div>
        </div>
      ))}
    </div>
  );
}
