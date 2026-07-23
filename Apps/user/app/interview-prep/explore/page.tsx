/** @format */

'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Compass,
  Dumbbell,
  Bookmark,
  Gem,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import type {
  InterviewCollection,
  InterviewQuestion,
  PracticeRecord,
  User,
} from '@/lib/types';
import { cn, formatInterviewDuration } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { showGlobalToast } from '@/lib/toast';
import { ScrollableContainer } from '@/components/layout/ScrollableContainer';
import { CollectionCard } from '../collections/_components/CollectionCard';
import { CollectionFormModal } from '../collections/_components/CollectionFormModal';

const THEMES = [
  'Behaviour',
  'About You',
  'Experience',
  'Role-specific',
  'Company',
] as const;

const THEME_ICONS = {
  Behaviour: MessageCircle,
  'About You': UserRound,
  Experience: BriefcaseBusiness,
  'Role-specific': Gem,
  Company: Building2,
} satisfies Record<(typeof THEMES)[number], React.ElementType>;

function shuffleItems<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function isToday(value?: string | null) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function cleanName(value?: string | null) {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeQuestionTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeQuestions(questions: InterviewQuestion[]) {
  const byTitle = new Map<string, InterviewQuestion>();
  questions.forEach((question) => {
    const key =
      question.normalized_title ||
      normalizeQuestionTitle(question.title) ||
      question.id;
    const existing = byTitle.get(key);
    if (!existing || (question.is_saved && !existing.is_saved)) {
      byTitle.set(key, question);
    }
  });
  return Array.from(byTitle.values());
}

function getCategoryPresentation(question: InterviewQuestion) {
  const label = cleanName(question.category?.name) || 'General';
  const normalized = label.toLowerCase();
  if (normalized.includes('behav')) return { label, Icon: MessageCircle };
  if (normalized.includes('about')) return { label, Icon: UserRound };
  if (normalized.includes('experience'))
    return { label, Icon: BriefcaseBusiness };
  if (normalized.includes('role')) return { label, Icon: Users };
  if (normalized.includes('company')) return { label, Icon: Building2 };
  return { label, Icon: BookOpen };
}

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirmStore((state) => state.confirm);

  const initialQuery =
    searchParams ? searchParams.get('q') || searchParams.get('search') || '' : '';
  const initialTheme = searchParams ? searchParams.get('theme') || 'All' : 'All';

  const [collections, setCollections] = useState<InterviewCollection[]>([]);
  const [createdCollections, setCreatedCollections] = useState<
    InterviewCollection[]
  >([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [recommendedQuestions, setRecommendedQuestions] = useState<
    InterviewQuestion[]
  >([]);
  const [questionPool, setQuestionPool] = useState<InterviewQuestion[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [questionResults, setQuestionResults] = useState<InterviewQuestion[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTheme, setActiveTheme] = useState<string>(initialTheme);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshingQuestions, setIsRefreshingQuestions] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedCollectionToEdit, setSelectedCollectionToEdit] =
    useState<InterviewCollection | null>(null);

  // Sync searchQuery and activeTheme with URL query string seamlessly
  useEffect(() => {
    const q =
      searchParams ? searchParams.get('q') || searchParams.get('search') || '' : '';
    const theme = searchParams ? searchParams.get('theme') || 'All' : 'All';
    if (q !== searchQuery) setSearchQuery(q);
    if (theme !== activeTheme) setActiveTheme(theme);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    const q = searchQuery.trim();
    if (q) {
      if (params.get('q') !== q) {
        params.set('q', q);
        changed = true;
      }
    } else {
      if (params.has('q')) {
        params.delete('q');
        changed = true;
      }
      if (params.has('search')) {
        params.delete('search');
        changed = true;
      }
    }

    if (activeTheme && activeTheme !== 'All') {
      if (params.get('theme') !== activeTheme) {
        params.set('theme', activeTheme);
        changed = true;
      }
    } else {
      if (params.has('theme')) {
        params.delete('theme');
        changed = true;
      }
    }

    if (changed) {
      const newSearch = params.toString();
      const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, [searchQuery, activeTheme]);

  const load = async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const [sets, mine, user, questions, records] = await Promise.all([
        api.interviewCollections(),
        api.myCreatedCollections().catch(() => []),
        api.me().catch(() => null),
        api.searchGlobalQuestions('').catch(() => []),
        api.practiceRecords().catch(() => []),
      ]);
      const uniqueQuestions = dedupeQuestions(questions);
      setCollections(sets);
      setCreatedCollections(mine);
      setCurrentUser(user);
      setQuestionPool(uniqueQuestions);
      setPracticeRecords(records);
      setRecommendedQuestions(shuffleItems(uniqueQuestions).slice(0, 8));
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not load Explore.',
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
    const query = searchQuery.trim();
    if (query.length < 2) {
      setQuestionResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const handle = window.setTimeout(() => {
      void api
        .searchGlobalQuestions(query)
        .then((results) => {
          if (!cancelled) setQuestionResults(dedupeQuestions(results));
        })
        .catch(() => {
          if (!cancelled) setQuestionResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [searchQuery]);

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
    [officialSets, communitySets, myPersonalSets],
  );

  const filteredSets = allVisibleSets.filter((set) => {
    const matchesTheme = activeTheme === 'All' || set.theme === activeTheme;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      set.title.toLowerCase().includes(query) ||
      (set.description || '').toLowerCase().includes(query) ||
      (set.theme || '').toLowerCase().includes(query);
    return matchesTheme && matchesSearch;
  });

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

  const refreshRecommendedQuestions = () => {
    if (questionPool.length === 0) return;
    setIsRefreshingQuestions(true);
    window.setTimeout(() => {
      setRecommendedQuestions(shuffleItems(questionPool).slice(0, 8));
      window.setTimeout(() => setIsRefreshingQuestions(false), 160);
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
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not follow set.',
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
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not unfollow set.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleSaveQuestion = async (question: InterviewQuestion) => {
    setActiveId(question.id);
    try {
      await api.saveInterviewQuestion(question.id);
      setRecommendedQuestions((items) =>
        items.map((item) =>
          item.id === question.id ? { ...item, is_saved: true } : item,
        ),
      );
      setQuestionResults((items) =>
        items.map((item) =>
          item.id === question.id ? { ...item, is_saved: true } : item,
        ),
      );
      showGlobalToast('Question saved to Library');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not save question.',
      );
    } finally {
      setActiveId(null);
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
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not delete set.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleRestore = async (collection: InterviewCollection) => {
    setActiveId(collection.id);
    try {
      await api.updateInterviewCollection(collection.id, {
        status: 'draft',
      });
      await load(false);
      showGlobalToast('Question Set restored to My Personal Sets');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not restore set.',
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
      if (payload.cover_file)
        await api.uploadCollectionCover(updated.id, payload.cover_file);
      showGlobalToast('Question Set updated');
    } else {
      const created = await api.createInterviewCollection(payload);
      if (payload.cover_file)
        await api.uploadCollectionCover(created.id, payload.cover_file);
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

  const renderSetSection = (
    title: string,
    icon: React.ReactNode,
    items: InterviewCollection[],
    empty: string,
  ) => (
    <section className='grid gap-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          {icon}
          <h2 className='title-card'>{title}</h2>
        </div>
      </div>
      {isLoading ?
        <div className='body-md panel-sm flex items-center gap-3 p-5 text-ink-secondary'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Loading sets...
        </div>
      : items.length === 0 ?
        <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-8 text-center text-ink-secondary'>
          {empty}
        </div>
      : <ScrollableContainer>
          {items.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onAdd={handleFollow}
              onRemove={handleUnfollow}
              isLoading={activeId === collection.id}
              currentUserId={currentUser?.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRestore={handleRestore}
            />
          ))}
        </ScrollableContainer>
      }
    </section>
  );

  const questionsToShow =
    searchQuery.trim().length >= 2 ? questionResults : recommendedQuestions;

  return (
    <main className='flex h-full flex-col overflow-hidden panel-xl p-0!'>
      <div className='shrink-0 border-b border-border/40 p-5 pb-0'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h1 className='title-page flex items-center gap-2'>
                <Compass className='h-5 w-5 text-primary' />
                Explore
              </h1>
              <p className='body-sm mt-1 text-ink-secondary'>
                Discover public questions and Question Sets, or manage your
                personal sets.
              </p>
            </div>
            <Button
              onClick={() => {
                setSelectedCollectionToEdit(null);
                setIsFormModalOpen(true);
              }}
              Icon={Plus}
            >
              Create Question Set
            </Button>
          </div>

          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary' />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder='Search questions or Question Sets'
              className='body-md w-full rounded-2xl border border-border bg-background-secondary/60 py-3 pl-10 pr-4 text-ink-primary outline-none transition-colors focus:border-primary/50 focus:bg-background-primary/60'
            />
            {isSearching && (
              <Loader2 className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary' />
            )}
          </div>
        </div>
      </div>

      <div className='flex-1 body p-5 '>
        <div className='grid gap-8'>
          <section className='grid gap-3'>
            <div className='flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2'>
                <Sparkles className='h-4 w-4 text-primary' />
                <h2 className='title-card'>
                  {searchQuery.trim().length >= 2 ?
                    'Matching Questions'
                  : 'Recommended Questions'}
                </h2>
              </div>
              {searchQuery.trim().length < 2 && (
                <button
                  onClick={refreshRecommendedQuestions}
                  className='inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background-secondary text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary'
                  title='Refresh recommendations'
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4',
                      isRefreshingQuestions && 'animate-spin',
                    )}
                  />
                </button>
              )}
            </div>
            {questionsToShow.length === 0 ?
              <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-8 text-center text-ink-secondary'>
                {searchQuery.trim().length >= 2 ?
                  'No matching questions yet.'
                : 'No recommended questions available.'}
              </div>
            : <div
                className={cn(
                  'grid gap-3 transition-opacity duration-300 md:grid-cols-2 xl:grid-cols-4',
                  isRefreshingQuestions && 'opacity-20',
                )}
              >
                {questionsToShow.map((question) => {
                  const { label: categoryLabel, Icon: CategoryIcon } =
                    getCategoryPresentation(question);
                  const practicedToday = practicedTodayIds.has(question.id);
                  const durationLabel = question.estimated_duration_seconds ?
                    formatInterviewDuration(question.estimated_duration_seconds)
                  : 'Ready';

                  return (
                    <article
                      key={question.id}
                      className='relative rounded-2xl rounded-br-3xl border col justify-between border-border/50 bg-panel/70 p-4 transition-colors hover:border-primary/40'
                    >
                      <button
                        onClick={() => handleSaveQuestion(question)}
                        disabled={activeId === question.id}
                        className={cn(
                          'absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                          question.is_saved ?
                            'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border bg-background-secondary text-ink-secondary hover:border-primary/50 hover:text-primary',
                        )}
                        title={question.is_saved ? 'Saved' : 'Save to Library'}
                      >
                        {activeId === question.id ?
                          <Loader2 className='h-4 w-4 animate-spin' />
                        : question.is_saved ?
                          <CheckCircle2 className='h-4 w-4' />
                        : <Plus className='h-4 w-4' />}
                      </button>

                      <div className='flex min-h-[70px] flex-col gap-3 pr-9'>
                        <div className='flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-primary'>
                          <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1'>
                            <CategoryIcon className='h-3.5 w-3.5' />
                            {categoryLabel}
                          </span>
                          {question.difficulty && (
                            <span className='rounded-full bg-background-secondary px-2 py-1 text-ink-secondary'>
                              {question.difficulty}
                            </span>
                          )}
                        </div>
                        <h3 className='text-sm font-bold leading-snug text-ink-primary line-clamp-3'>
                          {question.title}
                        </h3>
                      </div>
                      <div className='mt-4 flex items-end justify-between gap-2'>
                        {practicedToday ?
                          <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                            <CheckCircle2 className='h-3.5 w-3.5' />
                            Practiced today
                          </span>
                        : <span className='text-xs text-ink-secondary'>
                            {durationLabel}
                          </span>
                        }
                        <div className='flex justify-end col'>
                          <Button
                            onClick={() =>
                              router.push(
                                `/interview-prep/practice/${question.display_number || question.id}`,
                              )
                            }
                            Icon={Dumbbell}
                          >
                            Practice
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            }
          </section>

          {renderSetSection(
            searchQuery.trim() || activeTheme !== 'All' ?
              'Matching Question Sets'
            : 'Recommended Question Sets',
            <Sparkles className='h-4 w-4 text-primary' />,
            filteredSets.slice(0, 12),
            'No matching Question Sets yet.',
          )}

          <section className='grid gap-3'>
            <div className='flex items-center gap-2'>
              <Compass className='h-4 w-4 text-primary' />
              <h2 className='title-card'>Themes</h2>
            </div>
            <div className='grid gap-3 md:grid-cols-5'>
              {THEMES.map((theme) => {
                const count = allVisibleSets.filter(
                  (set) => set.theme === theme,
                ).length;
                const ThemeIcon = THEME_ICONS[theme];
                return (
                  <button
                    key={theme}
                    onClick={() => setActiveTheme(theme)}
                    className='rounded-2xl border border-border/50 bg-background-secondary/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5'
                  >
                    <span className='mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                      <ThemeIcon className='h-4.5 w-4.5' />
                    </span>
                    <div className='text-sm font-bold text-ink-primary'>
                      {theme}
                    </div>
                    <div className='mt-1 text-xs text-ink-secondary'>
                      {count} set{count === 1 ? '' : 's'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {renderSetSection(
            'Official Sets',
            <BadgeCheck className='h-4 w-4 text-primary' />,
            officialSets,
            'No official Question Sets available.',
          )}
          {renderSetSection(
            'Community Sets',
            <Users className='h-4 w-4 text-primary' />,
            communitySets,
            'No community Question Sets available.',
          )}
          {renderSetSection(
            'My Personal Sets',
            <BookOpen className='h-4 w-4 text-primary' />,
            myPersonalSets,
            'Create your first personal Question Set.',
          )}
          {archivedSets.length > 0 &&
            renderSetSection(
              'Archived Personal Sets',
              <BookOpen className='h-4 w-4 text-rose-500' />,
              archivedSets,
              'No archived personal sets.',
            )}
        </div>
      </div>

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
    </main>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className='body-md panel-sm flex items-center justify-center gap-3 p-8 text-ink-secondary h-full'>
          <Loader2 className='h-5 w-5 animate-spin text-primary' />
          Loading Explore...
        </div>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}
