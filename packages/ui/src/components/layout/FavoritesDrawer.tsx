/** @format */

'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  MessageSquare,
  Bookmark,
  BookOpen,
  Search,
  X,
  Loader2,
  ExternalLink,
  ChevronRight,
  Layers,
  Filter,
  RefreshCw,
} from '@jobby/ui/components/icons';
import { api } from '@/lib/api';
import type {
  InterviewQuestion,
  FavoritedCommentSummary,
  SavedAnswerSummary,
  SavedCollectionSummary,
  UserFavoritesCounts,
} from '@/lib/types';
import { useLayoutStore } from '@/lib/store/layout-store';
import { showGlobalToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { EmptyPlaceHolder } from '../UI/EmptyPlaceHolder';
import { motion, AnimatePresence } from 'framer-motion';

type TabType = 'questions' | 'comments' | 'answers' | 'collections';
type CommentSubFilter = 'liked' | 'mine';

const PAGE_SIZE = 15;
const MIN_SKELETON_DELAY_MS = 500;

export function FavoritesDrawer({
  initialTab = 'questions',
}: {
  initialTab?: TabType;
} = {}) {
  const router = useRouter();
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [commentFilter, setCommentFilter] = useState<CommentSubFilter>('liked');
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<UserFavoritesCounts | null>(null);

  // Items and pagination state
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [comments, setComments] = useState<FavoritedCommentSummary[]>([]);
  const [answers, setAnswers] = useState<SavedAnswerSummary[]>([]);
  const [collections, setCollections] = useState<SavedCollectionSummary[]>([]);

  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unfavoritingIds, setUnfavoritingIds] = useState<Set<string>>(
    new Set(),
  );

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch count summary
  const loadCounts = useCallback(async () => {
    try {
      const res = await api.userFavoritesCounts();
      setCounts(res);
    } catch (err) {
      console.error('Failed to load favorites counts:', err);
    }
  }, []);

  // Fetch initial data for active tab with 0.5s minimum skeleton loader
  const loadTabData = useCallback(
    async (tab: TabType, cFilter: CommentSubFilter) => {
      setLoading(true);
      isFetchingRef.current = true;
      setNextOffset(0);

      const delayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_SKELETON_DELAY_MS),
      );

      try {
        let fetchPromise: Promise<unknown>;

        if (tab === 'questions') {
          fetchPromise = api.userFavoritesQuestions(PAGE_SIZE, 0);
        } else if (tab === 'comments') {
          fetchPromise = api.userFavoritesComments(cFilter, PAGE_SIZE, 0);
        } else if (tab === 'answers') {
          fetchPromise = api.userFavoritesAnswers(PAGE_SIZE, 0);
        } else {
          fetchPromise = api.userFavoritesCollections(PAGE_SIZE, 0);
        }

        const [res] = (await Promise.all([fetchPromise, delayPromise])) as [
          { items: unknown[]; has_more: boolean; next_offset?: number | null },
          unknown,
        ];

        if (tab === 'questions') {
          setQuestions(res.items as InterviewQuestion[]);
        } else if (tab === 'comments') {
          setComments(res.items as FavoritedCommentSummary[]);
        } else if (tab === 'answers') {
          setAnswers(res.items as SavedAnswerSummary[]);
        } else {
          setCollections(res.items as SavedCollectionSummary[]);
        }

        setHasMore(res.has_more);
        setNextOffset(res.next_offset || PAGE_SIZE);
      } catch (err) {
        console.error('Failed to fetch favorites tab data:', err);
        showGlobalToast('Failed to load items');
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [],
  );

  // Fetch next page on scroll
  const loadMore = async () => {
    if (loadingMore || !hasMore || isFetchingRef.current) return;
    setLoadingMore(true);
    isFetchingRef.current = true;

    try {
      if (activeTab === 'questions') {
        const res = await api.userFavoritesQuestions(PAGE_SIZE, nextOffset);
        setQuestions((prev) => [
          ...prev,
          ...(res.items as InterviewQuestion[]),
        ]);
        setHasMore(res.has_more);
        setNextOffset(res.next_offset || nextOffset + PAGE_SIZE);
      } else if (activeTab === 'comments') {
        const res = await api.userFavoritesComments(
          commentFilter,
          PAGE_SIZE,
          nextOffset,
        );
        setComments((prev) => [
          ...prev,
          ...(res.items as FavoritedCommentSummary[]),
        ]);
        setHasMore(res.has_more);
        setNextOffset(res.next_offset || nextOffset + PAGE_SIZE);
      } else if (activeTab === 'answers') {
        const res = await api.userFavoritesAnswers(PAGE_SIZE, nextOffset);
        setAnswers((prev) => [...prev, ...(res.items as SavedAnswerSummary[])]);
        setHasMore(res.has_more);
        setNextOffset(res.next_offset || nextOffset + PAGE_SIZE);
      } else if (activeTab === 'collections') {
        const res = await api.userFavoritesCollections(PAGE_SIZE, nextOffset);
        setCollections((prev) => [
          ...prev,
          ...(res.items as SavedCollectionSummary[]),
        ]);
        setHasMore(res.has_more);
        setNextOffset(res.next_offset || nextOffset + PAGE_SIZE);
      }
    } catch (err) {
      console.error('Failed to load next page:', err);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    void loadTabData(activeTab, commentFilter);
  }, [activeTab, commentFilter, loadTabData]);

  // Scroll listener for infinite scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      void loadMore();
    }
  };

  const handleToggleFavoriteQuestion = async (
    e: React.MouseEvent,
    qId: string,
  ) => {
    e.stopPropagation();
    setUnfavoritingIds((prev) => new Set(prev).add(qId));
    try {
      await api.toggleQuestionFavorite(qId);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      showGlobalToast('Removed from favorites');
      void loadCounts();
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (err) {
      showGlobalToast('Failed to update favorite status');
    } finally {
      setUnfavoritingIds((prev) => {
        const next = new Set(prev);
        next.delete(qId);
        return next;
      });
    }
  };

  const navigateTo = (path: string) => {
    closeDrawer();
    router.push(path);
  };

  // Filter items by client search query
  const filteredQuestions = questions.filter(
    (q) =>
      !searchQuery.trim() ||
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.category?.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredComments = comments.filter(
    (c) =>
      !searchQuery.trim() ||
      c.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.question_title?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredAnswers = answers.filter(
    (a) =>
      !searchQuery.trim() ||
      a.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.question_title?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredCollections = collections.filter(
    (c) =>
      !searchQuery.trim() ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className='flex flex-col h-full bg-panel text-ink-primary select-none overflow-hidden'>
      {/* Header */}
      <div className='header'>
        <div className='flex items-center gap-3'>
          <div>
            <h2 className='text-lg font-bold tracking-tight flex items-center gap-2'>
              Favorites & Bookmarks
              {counts && (
                <span className='text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20'>
                  {counts.total}
                </span>
              )}
            </h2>
            <p className='text-xs text-ink-secondary mt-0.5'>
              Your favorited questions, discussions, answers, and collections
            </p>
          </div>
        </div>
        <button
          onClick={closeDrawer}
          className='p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-background-secondary transition-colors'
        >
          <X className='size-5' />
        </button>
      </div>
      <div className='body'>
        {/* Search Input */}
        <div className=''>
          <div className='relative'>
            <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-secondary' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search favorited items...'
              className='w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-background-secondary/50 border border-primary/50 focus:outline-hidden focus:border-primary/50 transition-all placeholder:text-ink-secondary/60'
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-secondary hover:text-ink-primary'
              >
                <X className='size-3.5' />
              </button>
            )}
          </div>
        </div>

        {/* Primary Tabs */}
        <div className='flex border-b border-primary/40 gap-2 pt-2  overflow-x-auto no-scrollbar'>
          {[
            {
              id: 'questions',
              label: 'Questions',
              count: counts?.favorited_questions || 0,
              icon: Star,
            },
            {
              id: 'comments',
              label: 'Comments',
              count: (counts?.my_comments || 0) + (counts?.liked_comments || 0),
              icon: MessageSquare,
            },
            {
              id: 'answers',
              label: 'Answers',
              count: counts?.saved_answers || 0,
              icon: Bookmark,
            },
            {
              id: 'collections',
              label: 'Collections',
              count: counts?.saved_collections || 0,
              icon: Layers,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all relative whitespace-nowrap cursor-pointer',
                  isActive ?
                    'border-primary text-primary'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary',
                )}
              >
                <Icon className='size-3.5' />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                      isActive ?
                        'bg-primary/15 text-primary'
                      : 'bg-background-secondary text-ink-secondary',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-Filter for Comments */}
        {activeTab === 'comments' && (
          <div className='flex items-center gap-2 pt-3 pb-1 bg-background-secondary/5 border-b border-primary/20 text-xs'>
            {[
              { id: 'liked', label: 'Saved Comments' },
              { id: 'mine', label: 'My Comments' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setCommentFilter(sub.id as CommentSubFilter)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer',
                  commentFilter === sub.id ?
                    'bg-primary/15 text-primary'
                  : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Container with Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className='flex-1 overflow-y-auto custom-scrollbar-primary space-y-3'
        >
          {loading ?
            /* Skeleton Loader (Minimum 0.5s Delay for visual stability) */
            <div className='space-y-3 animate-text-shimmer-primary animate-text-shimmer'>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className='p-4 rounded-xl border border-primary/40 bg-background-secondary/30 space-y-2'
                >
                  <div className='flex items-center justify-between'>
                    <div className='h-3 bg-border/60 rounded-md w-24' />
                    <div className='h-3 bg-border/60 rounded-md w-12' />
                  </div>
                  <div className='h-4 bg-border/60 rounded-md w-3/4' />
                  <div className='h-3 bg-border/40 rounded-md w-1/2' />
                </div>
              ))}
            </div>
          : <AnimatePresence mode='wait'>
              {/* TAB: Questions */}
              {activeTab === 'questions' && (
                <motion.div
                  key='questions-tab'
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className='space-y-3'
                >
                  {filteredQuestions.length === 0 ?
                    <EmptyPlaceHolder
                      icon={Star}
                      title='No favorited questions'
                      description='Click the star icon on any question in practice or library to save it here.'
                      className='border-dashed py-12'
                    />
                  : filteredQuestions.map((q) => (
                      <div
                        key={q.id}
                        onClick={() =>
                          navigateTo(
                            `/interview-prep/practice/${q.display_number || q.id}`,
                          )
                        }
                        className='group relative p-4 rounded-xl border border-primary/40 bg-background-secondary/30 hover:bg-background-secondary/70 hover:border-primary/40 transition-all cursor-pointer shadow-2xs hover:shadow-md'
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div className='space-y-1.5 flex-1 min-w-0'>
                            {q.category?.name && (
                              <span className='inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/15'>
                                {q.category.name}
                              </span>
                            )}
                            <h4 className='text-xs font-bold leading-relaxed group-hover:text-primary transition-colors line-clamp-2'>
                              {q.title}
                            </h4>
                          </div>
                          <button
                            onClick={(e) =>
                              handleToggleFavoriteQuestion(e, q.id)
                            }
                            disabled={unfavoritingIds.has(q.id)}
                            title='Remove favorite'
                            className='p-1.5 rounded-lg text-amber-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0'
                          >
                            {unfavoritingIds.has(q.id) ?
                              <Loader2 className='size-4 animate-spin text-ink-secondary' />
                            : <Star className='size-4 fill-amber-400' />}
                          </button>
                        </div>

                        <div className='flex items-center justify-between pt-3 mt-2 border-t border-primary/20 text-[11px] text-ink-secondary'>
                          <div className='flex items-center gap-2 overflow-hidden'>
                            {q.tags && q.tags.length > 0 && (
                              <span className='text-[10px] text-ink-secondary/70 truncate'>
                                #{q.tags.map((t) => t.name).join(' #')}
                              </span>
                            )}
                          </div>
                          <span className='flex items-center gap-1 text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
                            Practice <ChevronRight className='size-3' />
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </motion.div>
              )}

              {/* TAB: Comments */}
              {activeTab === 'comments' && (
                <motion.div
                  key='comments-tab'
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className='space-y-3'
                >
                  {filteredComments.length === 0 ?
                    <EmptyPlaceHolder
                      icon={MessageSquare}
                      title='No comment activity found'
                      description='Comments you post or like across question discussions will appear here.'
                      className='border-dashed py-12'
                    />
                  : filteredComments.map((c) => (
                      <div
                        key={c.id}
                        onClick={() =>
                          navigateTo(
                            `/interview-prep/practice/${c.question_id}?mode=free&tab=comment`,
                          )
                        }
                        className='group p-4 rounded-xl border border-primary/40 bg-background-secondary/30 hover:bg-background-secondary/70 hover:border-primary/40 transition-all cursor-pointer space-y-2 shadow-2xs'
                      >
                        {' '}
                        <span className='font-semibold text-xs text-primary/90 flex items-center gap-1.5 truncate'>
                          <MessageSquare className='size-3 shrink-0 ' />
                          {c.question_title}
                        </span>
                        <p className='border-l-4 border-l-primary/20 p-3'>
                          “{c.body}”
                        </p>
                        <div className='flex items-center justify-between text-[10px] text-ink-secondary pt-1'>
                          <div className='flex items-center justify-between text-[11px] text-ink-secondary'>
                            <span className='text-[10px] shrink-0 font-medium px-2 py-0.5 rounded-full bg-background-secondary'>
                              {c.is_author ?
                                'My Comment'
                              : `Liked: ${c.author_name}`}
                            </span>
                          </div>
                          <span className='flex items-center gap-1 font-semibold group-hover:text-primary transition-colors'>
                            View Thread <ChevronRight className='size-3' />
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </motion.div>
              )}

              {/* TAB: Saved Answers */}
              {activeTab === 'answers' && (
                <motion.div
                  key='answers-tab'
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className='space-y-3'
                >
                  {filteredAnswers.length === 0 ?
                    <EmptyPlaceHolder
                      icon={Bookmark}
                      title='No saved answers'
                      description='Save reference or community answers during practice to access them here.'
                      className='border-dashed py-12'
                    />
                  : filteredAnswers.map((a) => (
                      <div
                        key={a.id}
                        onClick={() =>
                          navigateTo(
                            `/interview-prep/practice/${a.question_id}`,
                          )
                        }
                        className='group p-4 rounded-xl border border-primary/40 bg-background-secondary/30 hover:bg-background-secondary/70 hover:border-primary/40 transition-all cursor-pointer space-y-2 shadow-2xs'
                      >
                        <div className='flex items-center justify-between text-[11px]'>
                          <span className='font-semibold text-primary truncate max-w-[220px]'>
                            {a.question_title}
                          </span>
                          <span className='text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold shrink-0'>
                            {a.author_name}
                          </span>
                        </div>
                        {a.title && (
                          <h5 className='text-xs font-bold text-ink-primary'>
                            {a.title}
                          </h5>
                        )}
                        <p className='text-xs text-ink-secondary leading-relaxed line-clamp-3 bg-background/30 p-2.5 rounded-lg border border-primary/20'>
                          {a.body}
                        </p>
                      </div>
                    ))
                  }
                </motion.div>
              )}

              {/* TAB: Collections */}
              {activeTab === 'collections' && (
                <motion.div
                  key='collections-tab'
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className='space-y-3'
                >
                  {filteredCollections.length === 0 ?
                    <EmptyPlaceHolder
                      icon={Layers}
                      title='No saved collections'
                      description='Purchased or added interview packs will be listed here.'
                      className='border-dashed py-12'
                    />
                  : filteredCollections.map((c) => (
                      <div
                        key={c.id}
                        onClick={() =>
                          navigateTo('/interview-prep/collections')
                        }
                        className='group p-4 rounded-xl border border-primary/40 bg-background-secondary/30 hover:bg-background-secondary/70 hover:border-primary/40 transition-all cursor-pointer flex items-center gap-3 shadow-2xs'
                      >
                        <div className='size-12 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-lg shrink-0 border border-primary/20'>
                          <BookOpen className='size-6' />
                        </div>
                        <div className='flex-1 min-w-0 space-y-1'>
                          <h4 className='text-xs font-bold truncate group-hover:text-primary transition-colors'>
                            {c.title}
                          </h4>
                          {c.description && (
                            <p className='text-[11px] text-ink-secondary line-clamp-1'>
                              {c.description}
                            </p>
                          )}
                          <div className='flex items-center gap-2 text-[10px] text-ink-secondary/80'>
                            <span className='font-semibold text-emerald-500 dark:text-emerald-400'>
                              {c.is_purchased ? 'Unlocked' : 'Favorited'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className='size-4 text-ink-secondary group-hover:text-primary shrink-0' />
                      </div>
                    ))
                  }
                </motion.div>
              )}
            </AnimatePresence>
          }

          {/* Infinite Scroll Loading Indicator */}
          {loadingMore && (
            <div className='flex items-center justify-center py-4 text-xs text-ink-secondary gap-2'>
              <Loader2 className='size-4 animate-spin text-primary' />
              <span>Loading more...</span>
            </div>
          )}
        </div>
      </div>
      {/* Footer */}
      <div className='footer text-[11px]! text-ink-secondary!'>
        <span>Manage your learning assets</span>
        <button
          onClick={() => navigateTo('/interview-prep/library')}
          className='text-primary font-semibold hover:underline flex items-center gap-1'
        >
          Explore Library <ExternalLink className='size-3' />
        </button>
      </div>
    </div>
  );
}
