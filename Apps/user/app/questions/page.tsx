'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquareCode, Search } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import { VirtualList } from '@/components/UI/VirtualList';
import { api } from '@/lib/api';
import { withMinimumLoadingTime } from '@/lib/loading';
import type { QuestionCacheEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CollapsibleHeader, springTransition } from '@/components/UI/CollapsibleHeader';

type QuestionListItem =
  | { type: 'row'; id: string; data: QuestionCacheEntry }
  | { type: 'skeleton'; id: string };

const PAGE_SIZE = 20;
const ROW_HEIGHT = 88;

function matchesSearch(entry: QuestionCacheEntry, searchText: string) {
  const query = searchText.trim().toLowerCase();
  if (!query) return true;

  return [entry.original_label, entry.answer]
    .some((value) => String(value ?? '').toLowerCase().includes(query));
}

export default function QuestionsPage() {
  const { questions, saveQuestion, deleteQuestion } = useConsole();

  const [items, setItems] = useState<QuestionCacheEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const lastScrollTop = React.useRef(0);

  const handleListScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (scrollTop <= 10) {
      setIsHeaderCollapsed(false);
    } else if (scrollTop > lastScrollTop.current && scrollTop > 50) {
      setIsHeaderCollapsed(true);
    } else if (scrollTop < lastScrollTop.current) {
      setIsHeaderCollapsed(false);
    }
    lastScrollTop.current = scrollTop;
  }, []);

  const fetchMore = async (reset = false) => {
    if (isLoading) return;
    setIsLoading(true);

    const currentOffset = reset ? 0 : offset;
    try {
      const data = await withMinimumLoadingTime(
        api.questionCache(PAGE_SIZE, currentOffset, searchText),
      );

      if (reset) {
        setItems(data);
        setOffset(data.length);
        setHasMore(data.length === PAGE_SIZE);
        return;
      }

      setItems((prev) => {
        const nextItems = data.filter(
          (item) => !prev.some((prevItem) => prevItem.id === item.id),
        );
        return [...prev, ...nextItems];
      });
      setOffset((prev) => prev + data.length);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch questions', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    void fetchMore(true);
  }, [searchText]);

  useEffect(() => {
    setItems((prevItems) => {
      const syncedItems = prevItems
        .map((item) => questions.find((question) => question.id === item.id) ?? item)
        .filter((item) => questions.some((question) => question.id === item.id))
        .filter((item) => matchesSearch(item, searchText));

      const newItems = questions.filter((question) => {
        if (!matchesSearch(question, searchText)) return false;
        return !prevItems.some((item) => item.id === question.id);
      });

      return [...newItems, ...syncedItems];
    });
  }, [questions, searchText]);

  const listItems = React.useMemo<QuestionListItem[]>(() => {
    const nextItems: QuestionListItem[] = items.map((item) => ({
      type: 'row',
      id: item.id,
      data: item,
    }));

    if (isLoading && hasMore) {
      nextItems.push(
        { type: 'skeleton', id: 'question-skeleton-1' },
        { type: 'skeleton', id: 'question-skeleton-2' },
        { type: 'skeleton', id: 'question-skeleton-3' },
      );
    }

    return nextItems;
  }, [hasMore, isLoading, items]);

  return (
    <div className='bg-panel rounded-2xl p-6 shadow-xs flex flex-col h-[calc(100vh-140px)] min-h-[500px] overflow-hidden'>
      <CollapsibleHeader
        title="Question Cache"
        icon={<MessageSquareCode className={cn('transition-transform', isHeaderCollapsed ? 'w-4 h-4' : 'w-5 h-5')} />}
        isCollapsed={isHeaderCollapsed}
        actions={
          <motion.div
            layout
            transition={springTransition}
            className={cn(
              'flex items-center gap-4 transition-all duration-350 ease-in-out',
              isHeaderCollapsed
                ? 'p-0 bg-transparent border-transparent mb-0 flex-1 justify-end max-w-md'
                : 'bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/60 mb-2 w-full'
            )}
          >
            <motion.div
              layout
              transition={springTransition}
              className={cn(
                'relative',
                isHeaderCollapsed ? 'w-48' : 'flex-1 max-w-md'
              )}
            >
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
              <input
                placeholder={isHeaderCollapsed ? 'Search...' : 'Search question text or answer...'}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className='pl-9 pr-4 py-1.5 w-full text-sm rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-955 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-750 text-zinc-900 dark:text-zinc-100'
              />
            </motion.div>
          </motion.div>
        }
      />

      {items.length === 0 && !isLoading ?
        <div className='p-8 text-center text-zinc-500 dark:text-zinc-400 flex-1 flex items-center justify-center'>
          No saved answers yet.
        </div>
      : <motion.div
          layout
          transition={springTransition}
          className='flex-1 overflow-hidden relative border border-zinc-100 dark:border-zinc-800/60 rounded-xl bg-panel'
        >
          <motion.div
            layout
            transition={springTransition}
            className='grid grid-cols-[minmax(0,4fr)_minmax(0,1.5fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-0 border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-4 py-3 shrink-0'
          >
            <div className='pr-4'>Question</div>
            <div className='px-4'>Type</div>
            <div className='px-4'>Answer</div>
            <div className='px-4'>Used</div>
            <div className='pl-4 text-right'></div>
          </motion.div>

          <VirtualList
            className='custom-scrollbar-primary'
            items={listItems}
            rowHeight={ROW_HEIGHT}
            onScroll={handleListScroll}
            onEndReached={() => {
              if (hasMore && !isLoading) {
                void fetchMore();
              }
            }}
            renderRow={(item, index, style) => {
              if (item.type === 'skeleton') {
                return (
                  <div
                    key={item.id}
                    style={style}
                    className='grid grid-cols-[minmax(0,4fr)_minmax(0,1.5fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center px-4 animate-pulse border-b border-zinc-100 dark:border-zinc-800/50'
                  >
                    <div className='pr-4'>
                      <div className='h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-1'></div>
                      <div className='h-3 bg-zinc-200 dark:bg-zinc-850 rounded w-1/4'></div>
                    </div>
                    <div className='px-4'>
                      <div className='h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16'></div>
                    </div>
                    <div className='px-4'>
                      <div className='h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-full'></div>
                    </div>
                    <div className='px-4'>
                      <div className='h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-8'></div>
                    </div>
                    <div className='pl-4'>
                      <div className='h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-12 ml-auto'></div>
                    </div>
                  </div>
                );
              }

              const entry = item.data;
              return (
                <div
                  key={item.id}
                  style={style}
                  className={cn(
                    'grid grid-cols-[minmax(0,4fr)_minmax(0,1.5fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center px-4 border-b border-zinc-100 dark:border-zinc-800/50 text-sm text-zinc-700 dark:text-zinc-300 bg-panel',
                    index === listItems.length - 1 && 'border-b-0',
                  )}
                >
                  <div className='pr-4 min-w-0'>
                    <strong className='text-zinc-900 dark:text-zinc-100 block truncate' title={entry.original_label}>
                      {entry.original_label}
                    </strong>
                    <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate' title={entry.companies?.join(', ')}>
                      {entry.companies?.slice(0, 3).join(', ')}
                    </p>
                  </div>
                  <div className='px-4 whitespace-nowrap text-xs text-zinc-500 font-mono'>
                    {entry.field_type}
                  </div>
                  <div className='px-4 min-w-0'>
                    <input
                      defaultValue={entry.answer ?? ''}
                      className='w-full text-sm rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 focus:bg-panel focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus:bg-zinc-900 dark:focus:border-zinc-750 focus:outline-none transition-all text-zinc-900 dark:text-zinc-100'
                      onBlur={(event) => {
                        if (event.target.value !== (entry.answer ?? '')) {
                          void saveQuestion(entry, event.target.value);
                        }
                      }}
                    />
                  </div>
                  <div className='px-4 whitespace-nowrap text-zinc-500'>
                    {entry.times_used}
                  </div>
                  <div className='pl-4 text-right'>
                    <button
                      className='px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-955/20 transition-all cursor-pointer'
                      onClick={() => void deleteQuestion(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            }}
          />
        </motion.div>
      }
    </div>
  );
}
