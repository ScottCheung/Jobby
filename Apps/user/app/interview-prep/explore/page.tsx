/** @format */

'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type {
  InterviewCategory,
  InterviewCollection,
  InterviewQuestion,
  PracticeRecord,
  User,
} from '@/lib/types';
import { getInterviewCategoryLabel } from '@/lib/interview-categories';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { showGlobalToast } from '@/lib/toast';
import { CollectionFormModal } from '../collections/_components/CollectionFormModal';
import { ExploreHeader } from './_components/ExploreHeader';
import {
  dedupeQuestions,
  getQuestionActivityBadge,
  isToday,
  rankedWindow,
  timestamp,
} from './_components/explore-utils';
import { NewForYouSection } from './_sections/NewForYouSection';
import {
  RecommendationSection,
  type RecommendationFeed,
  type RankingMode,
} from './_sections/RecommendationSection';
import { QuestionSetsSection } from './_sections/QuestionSetsSection';

const SECTION_IDS = [
  'new',
  'today-picks',
  'comprehensive-trend',
  'season-trend',
  'month-trend',
  'week-trend',
  'sets',
];

function ExplorePageContent() {
  const router = useRouter();
  const confirm = useConfirmStore((state) => state.confirm);
  const contentRef = useRef<HTMLDivElement>(null);

  const [collections, setCollections] = useState<InterviewCollection[]>([]);
  const [createdCollections, setCreatedCollections] = useState<
    InterviewCollection[]
  >([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [rankingQuestions, setRankingQuestions] = useState<
    Record<RankingMode, InterviewQuestion[]>
  >({
    hot: [],
    season: [],
    week: [],
    month: [],
  });
  const [forYouQuestions, setForYouQuestions] = useState<InterviewQuestion[]>(
    [],
  );
  const [questionPool, setQuestionPool] = useState<InterviewQuestion[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [activeTheme, setActiveTheme] = useState('All');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingNewForYou, setIsRefreshingNewForYou] = useState(false);
  const [refreshingRecommendation, setRefreshingRecommendation] =
    useState<RecommendationFeed | null>(null);
  const [recommendationOffsets, setRecommendationOffsets] = useState<
    Record<RecommendationFeed, number>
  >({
    forYou: 0,
    hot: 0,
    season: 0,
    month: 0,
    week: 0,
  });
  const [newForYouOffset, setNewForYouOffset] = useState(0);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedCollectionToEdit, setSelectedCollectionToEdit] =
    useState<InterviewCollection | null>(null);

  const load = async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const visit = await api.recordExploreVisit().catch(() => null);
      const [
        sets,
        mine,
        user,
        personalQuestions,
        hotQuestions,
        seasonQuestions,
        weeklyQuestions,
        monthlyQuestions,
        newestQuestions,
        records,
        categoryOptions,
      ] = await Promise.all([
        api.interviewCollections(),
        api.myCreatedCollections().catch(() => []),
        api.me().catch(() => null),
        api.forYouQuestions().catch(() => []),
        api.searchGlobalQuestions('', 'hot').catch(() => []),
        api.searchGlobalQuestions('', 'season').catch(() => []),
        api.searchGlobalQuestions('', 'week').catch(() => []),
        api.searchGlobalQuestions('', 'month').catch(() => []),
        api.searchGlobalQuestions('', 'newest').catch(() => []),
        api.practiceRecords().catch(() => []),
        api.interviewCategories().catch(() => []),
      ]);

      setCollections(sets);
      setCreatedCollections(mine);
      setCurrentUser(user);
      setLastLoginAt(visit?.last_login_at || null);
      setCategories(categoryOptions);
      setQuestionPool(
        dedupeQuestions([
          ...personalQuestions,
          ...hotQuestions,
          ...seasonQuestions,
          ...weeklyQuestions,
          ...monthlyQuestions,
          ...newestQuestions,
        ]),
      );
      setPracticeRecords(records);
      setForYouQuestions(personalQuestions);
      setRankingQuestions({
        hot: hotQuestions,
        season: seasonQuestions,
        week: weeklyQuestions,
        month: monthlyQuestions,
      });
      setRecommendationOffsets({
        forYou: 0,
        hot: 0,
        season: 0,
        month: 0,
        week: 0,
      });
      setNewForYouOffset(0);
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not load Explore.',
      );
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  useEffect(() => {
    const sync = () => void load(false);
    window.addEventListener('playbookLibraryUpdated', sync);
    return () => window.removeEventListener('playbookLibraryUpdated', sync);
  }, []);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (current) {
          window.dispatchEvent(
            new CustomEvent('explore:section-change', {
              detail: { sectionId: current.target.id },
            }),
          );
        }
      },
      { root, rootMargin: '-8% 0px -60% 0px', threshold: [0.05, 0.4] },
    );

    SECTION_IDS.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const handleScrollEnd = () => {
      const atBottom =
        root.scrollHeight - root.scrollTop - root.clientHeight < 4; // 容差几像素
      if (atBottom) {
        window.dispatchEvent(
          new CustomEvent('explore:section-change', {
            detail: { sectionId: SECTION_IDS[SECTION_IDS.length - 1] },
          }),
        );
      }
    };

    root.addEventListener('scroll', handleScrollEnd, { passive: true });
    return () => root.removeEventListener('scroll', handleScrollEnd);
  }, []);

  useEffect(() => {
    const handleNavigation = (event: Event) => {
      const sectionId = (event as CustomEvent<{ sectionId?: string }>).detail
        ?.sectionId;
      if (!sectionId || !SECTION_IDS.includes(sectionId)) return;

      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    };

    window.addEventListener('explore:navigate', handleNavigation);
    return () =>
      window.removeEventListener('explore:navigate', handleNavigation);
  }, []);

  useEffect(() => {
    const handleThemeSelection = (event: Event) => {
      const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme;
      if (!theme) return;
      setActiveTheme(theme);
      document.getElementById('sets')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    };

    window.addEventListener('explore:set-theme', handleThemeSelection);
    return () =>
      window.removeEventListener('explore:set-theme', handleThemeSelection);
  }, []);

  const publishedSets = collections.filter((set) => set.status === 'published');
  const officialSets = publishedSets.filter(
    (set) => set.collection_type === 'official',
  );
  const communitySets = publishedSets.filter(
    (set) =>
      set.collection_type === 'community' &&
      set.creator_user_id !== currentUser?.id,
  );
  const myPersonalSets = createdCollections.filter(
    (set) => set.status !== 'archived',
  );
  const archivedSets = createdCollections.filter(
    (set) => set.status === 'archived',
  );
  const allVisibleSets = useMemo(
    () => [...officialSets, ...communitySets, ...myPersonalSets],
    [collections, createdCollections, currentUser?.id],
  );
  const themeCategories = useMemo(
    () =>
      categories
        .filter((category) => category.is_system !== false)
        .sort(
          (a, b) =>
            (a.sort_order ?? 100) - (b.sort_order ?? 100) ||
            getInterviewCategoryLabel(a).localeCompare(
              getInterviewCategoryLabel(b),
            ),
        ),
    [categories],
  );
  const matchesCollectionFilters = (set: InterviewCollection) => {
    const matchesTheme = activeTheme === 'All' || set.theme === activeTheme;
    return matchesTheme;
  };
  const filteredSets = allVisibleSets.filter(matchesCollectionFilters);
  const filteredOfficialSets = officialSets.filter(matchesCollectionFilters);
  const filteredCommunitySets = communitySets.filter(matchesCollectionFilters);
  const filteredPersonalSets = myPersonalSets.filter(matchesCollectionFilters);
  const filteredArchivedSets = archivedSets.filter(matchesCollectionFilters);
  const newQuestions = useMemo(
    () =>
      questionPool
        .filter((question) => getQuestionActivityBadge(question, lastLoginAt))
        .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at)),
    [lastLoginAt, questionPool],
  );
  const visibleNewQuestions = useMemo(
    () => rankedWindow(newQuestions, newForYouOffset, 12),
    [newForYouOffset, newQuestions],
  );
  const practicedTodayIds = useMemo(
    () =>
      new Set(
        practiceRecords
          .filter((record) =>
            isToday(record.submitted_at || record.date || record.created_at),
          )
          .map((record) => record.question_id),
      ),
    [practiceRecords],
  );

  const recommendationPanels = [
    {
      id: 'forYou' as const,
      anchorId: 'today-picks',
      title: "Today's Picks",
      description:
        'Tailored to your saved, practised, interaction and followed content. You use more, it will more smart.',
      questions: rankedWindow(forYouQuestions, recommendationOffsets.forYou, 4),
      showReason: true,
    },
    {
      id: 'hot' as const,
      anchorId: 'comprehensive-trend',
      title: 'Comprehensive Trend',
      description: 'High-quality questions with durable overall momentum.',
      questions: rankedWindow(
        rankingQuestions.hot,
        recommendationOffsets.hot,
        4,
      ),
    },
    {
      id: 'season' as const,
      anchorId: 'season-trend',
      title: 'Season Trend',
      description: 'Questions gaining traction over the last 90 days.',
      questions: rankedWindow(
        rankingQuestions.season,
        recommendationOffsets.season,
        4,
      ),
    },
    {
      id: 'month' as const,
      anchorId: 'month-trend',
      title: 'Month Trend',
      description: 'Questions with the strongest recent monthly activity.',
      questions: rankedWindow(
        rankingQuestions.month,
        recommendationOffsets.month,
        4,
      ),
    },
    {
      id: 'week' as const,
      anchorId: 'week-trend',
      title: 'Week Trend',
      description: 'Fresh momentum from the past seven days.',
      questions: rankedWindow(
        rankingQuestions.week,
        recommendationOffsets.week,
        4,
      ),
    },
  ];

  const handlePracticeQuestion = (question: InterviewQuestion) => {
    router.push(
      `/interview-prep/practice/${question.display_number || question.id}`,
    );
  };

  const refreshRecommendedQuestions = (feed: RecommendationFeed) => {
    const items = feed === 'forYou' ? forYouQuestions : rankingQuestions[feed];
    if (items.length <= 4) return;
    setRefreshingRecommendation(feed);
    window.setTimeout(() => {
      setRecommendationOffsets((offsets) => ({
        ...offsets,
        [feed]: (offsets[feed] + 4) % items.length,
      }));
      window.setTimeout(() => setRefreshingRecommendation(null), 160);
    }, 160);
  };

  const refreshNewForYou = () => {
    if (newQuestions.length <= 12) return;
    setIsRefreshingNewForYou(true);
    window.setTimeout(() => {
      setNewForYouOffset((offset) => (offset + 12) % newQuestions.length);
      window.setTimeout(() => setIsRefreshingNewForYou(false), 160);
    }, 160);
  };

  const handleFollow = async (collection: InterviewCollection) => {
    const isLocked = !collection.is_purchased && collection.price_coins > 0;
    const ok = await confirm({
      title: isLocked ? 'Unlock Question Set?' : 'Follow Question Set?',
      message:
        isLocked ?
          `Unlock "${collection.title}" for ${collection.price_coins} coins? The creator receives a share of the reward.`
        : `Follow "${collection.title}" so its questions appear in your Library practice range?`,
      confirmLabel: isLocked ? 'Unlock & Follow' : 'Follow',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setActiveId(collection.id);
    try {
      await api.addCollectionToLibrary(collection.id);
      await load(false);
      showGlobalToast('Question Set followed');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not follow set.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleUnfollow = async (collection: InterviewCollection) => {
    const ok = await confirm({
      title: 'Unfollow Question Set?',
      message: `Remove "${collection.title}" from your Library practice range? Your answers and history are preserved.`,
      confirmLabel: 'Unfollow',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setActiveId(collection.id);
    try {
      await api.removeCollectionFromLibrary(collection.id);
      await load(false);
      showGlobalToast('Question Set unfollowed');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not unfollow set.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleSaveQuestion = async (question: InterviewQuestion) => {
    setActiveId(question.id);
    try {
      await api.saveInterviewQuestion(question.id);
      setRankingQuestions(
        (rankings) =>
          Object.fromEntries(
            Object.entries(rankings).map(([ranking, items]) => [
              ranking,
              items.map((item) =>
                item.id === question.id ? { ...item, is_saved: true } : item,
              ),
            ]),
          ) as Record<RankingMode, InterviewQuestion[]>,
      );
      setForYouQuestions((items) =>
        items.map((item) =>
          item.id === question.id ? { ...item, is_saved: true } : item,
        ),
      );
      setQuestionPool((items) =>
        items.map((item) =>
          item.id === question.id ? { ...item, is_saved: true } : item,
        ),
      );
      showGlobalToast('Question saved to Library');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not save question.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const updateQuestionEverywhere = (
    questionId: string,
    update: (question: InterviewQuestion) => InterviewQuestion,
  ) => {
    setForYouQuestions((items) =>
      items.map((item) => (item.id === questionId ? update(item) : item)),
    );
    setRankingQuestions(
      (rankings) =>
        Object.fromEntries(
          Object.entries(rankings).map(([ranking, items]) => [
            ranking,
            items.map((item) => (item.id === questionId ? update(item) : item)),
          ]),
        ) as Record<RankingMode, InterviewQuestion[]>,
    );
    setQuestionPool((items) =>
      items.map((item) => (item.id === questionId ? update(item) : item)),
    );
  };

  const handleFavoriteQuestion = async (question: InterviewQuestion) => {
    try {
      const summary = await api.toggleQuestionFavorite(question.id);
      updateQuestionEverywhere(question.id, (item) => ({
        ...item,
        is_favorited: summary.is_favorited,
        metrics: {
          ...item.metrics,
          favorite_count: summary.favorite_count,
          upvote_count: summary.upvote_count,
          downvote_count: summary.downvote_count,
        },
      }));
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not update favorite.',
      );
    }
  };

  const handleReactToQuestion = async (
    question: InterviewQuestion,
    value: 'up' | 'down' | null,
  ) => {
    try {
      const summary = await api.updateQuestionCommunityReaction(
        question.id,
        value,
      );
      updateQuestionEverywhere(question.id, (item) => ({
        ...item,
        user_reaction: summary.user_reaction as 'up' | 'down' | null,
        metrics: {
          ...item.metrics,
          favorite_count: summary.favorite_count,
          upvote_count: summary.upvote_count,
          downvote_count: summary.downvote_count,
        },
      }));
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not update reaction.',
      );
    }
  };

  const handleEdit = (collection: InterviewCollection) => {
    setSelectedCollectionToEdit(collection);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (collection: InterviewCollection) => {
    const ok = await confirm({
      title: 'Delete Question Set?',
      message: `Delete "${collection.title}"? If other users already follow it, it will be archived instead.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setActiveId(collection.id);
    try {
      await api.deleteInterviewCollection(collection.id);
      await load(false);
      showGlobalToast('Question Set removed');
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not delete set.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleRestore = async (collection: InterviewCollection) => {
    setActiveId(collection.id);
    try {
      await api.updateInterviewCollection(collection.id, { status: 'draft' });
      await load(false);
      showGlobalToast('Question Set restored to My Personal Sets');
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not restore set.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleSaveCollection = async (payload: {
    title: string;
    description?: string;
    theme?: string;
    price_coins?: number;
    status: string;
    question_ids: string[];
    cover_file?: File;
  }) => {
    if (selectedCollectionToEdit) {
      const updated = await api.updateInterviewCollection(
        selectedCollectionToEdit.id,
        payload,
      );
      if (payload.cover_file) {
        await api.uploadCollectionCover(updated.id, payload.cover_file);
      }
      showGlobalToast('Question Set updated');
    } else {
      const created = await api.createInterviewCollection(payload);
      if (payload.cover_file) {
        await api.uploadCollectionCover(created.id, payload.cover_file);
      }
      showGlobalToast(
        payload.status === 'published' ?
          'Question Set shared to Community'
        : 'Personal Question Set created',
      );
    }
    setIsFormModalOpen(false);
    setSelectedCollectionToEdit(null);
    await load(false);
  };

  return (
    <main className='flex h-full min-h-0 w-full flex-col overflow-hidden'>
      {isFormModalOpen && (
        <CollectionFormModal
          collection={selectedCollectionToEdit}
          onSave={handleSaveCollection}
          onClose={() => {
            setIsFormModalOpen(false);
            setSelectedCollectionToEdit(null);
          }}
        />
      )}

      <div
        ref={contentRef}
        className='min-h-0 flex-1 body overflow-y-auto overscroll-y-contain w-full custom-scrollbar-primary'
      >
        <ExploreHeader
          onCreateSet={() => {
            setSelectedCollectionToEdit(null);
            setIsFormModalOpen(true);
          }}
        />
        <div className='grid min-w-0 gap-7'>
          <NewForYouSection
            questions={visibleNewQuestions}
            lastLoginAt={lastLoginAt}
            activeId={activeId}
            isLoading={isLoading}
            isRefreshing={isRefreshingNewForYou}
            canRefresh={newQuestions.length > 12}
            onRefresh={refreshNewForYou}
            onSaveQuestion={handleSaveQuestion}
            onPracticeQuestion={handlePracticeQuestion}
            onFavoriteQuestion={handleFavoriteQuestion}
            onReactToQuestion={handleReactToQuestion}
          />
          <RecommendationSection
            panels={recommendationPanels}
            activeId={activeId}
            isLoading={isLoading}
            practicedTodayIds={practicedTodayIds}
            onRefresh={refreshRecommendedQuestions}
            refreshingFeed={refreshingRecommendation}
            onSaveQuestion={handleSaveQuestion}
            onPracticeQuestion={handlePracticeQuestion}
            onFavoriteQuestion={handleFavoriteQuestion}
            onReactToQuestion={handleReactToQuestion}
          />
          <QuestionSetsSection
            searchQuery=''
            activeTheme={activeTheme}
            categories={themeCategories}
            onSelectTheme={setActiveTheme}
            matchingSets={filteredSets}
            officialSets={filteredOfficialSets}
            communitySets={filteredCommunitySets}
            personalSets={filteredPersonalSets}
            archivedSets={filteredArchivedSets}
            isLoading={isLoading}
            lastLoginAt={lastLoginAt}
            activeId={activeId}
            currentUserId={currentUser?.id}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
          />
        </div>
      </div>
    </main>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className='body-md panel-sm flex h-full items-center justify-center gap-3 p-8 text-ink-secondary'>
          <Loader2 className='h-5 w-5 animate-spin text-primary' />
          Loading Explore...
        </div>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}
