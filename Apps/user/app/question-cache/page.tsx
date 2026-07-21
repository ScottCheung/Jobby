/** @format */

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
import { Stagger, ScrollLayout } from '@/components/animation';
import { Input } from '@/components/UI/input';

const springTransition = {
  duration: 1,
  ease: [0.22, 1, 0.36, 1] as const,
};

type QuestionListItem =
  | { type: 'row'; id: string; data: QuestionCacheEntry }
  | { type: 'skeleton'; id: string };

const PAGE_SIZE = 20;
const ROW_HEIGHT = 88;

function matchesSearch(entry: QuestionCacheEntry, searchText: string) {
  const query = searchText.trim().toLowerCase();
  if (!query) return true;

  return [entry.original_label, entry.answer].some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(query),
  );
}

export default function QuestionsPage() {
  const { questions, saveQuestion, deleteQuestion } = useConsole();

  const [items, setItems] = useState<QuestionCacheEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  const setContainerRef = React.useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollContainer(el);
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
        .map(
          (item) =>
            questions.find((question) => question.id === item.id) ?? item,
        )
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
    <div className='flex flex-col h-[calc(100vh-66px)] min-h-[500px] overflow-hidden'>
      <div className='pb-4 select-none shrink-0'>
        <ScrollLayout
          key={scrollContainer ? 'scrolling' : 'static'}
          scrollContainerRef={scrollContainerRef}
          progressRange={[0, 100]}
          heightRange={[130, 65]}
        >
          <ScrollLayout.TopToLeft>
            <div className='flex items-center gap-2 text-ink-primary font-bold shrink-0'>
              {/* <MessageSquareCode className="w-5 h-5 text-emerald-500 shrink-0" /> */}
              <h2 className='title-section shrink-0'>
                Question Cache
              </h2>
            </div>
          </ScrollLayout.TopToLeft>

          <ScrollLayout.BtmToRight>
            <Input
              icon={Search}
              placeholder='Search question text or answer...'
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className='w-full'
            />
          </ScrollLayout.BtmToRight>
        </ScrollLayout>
      </div>

      {items.length === 0 && !isLoading ?
        <div className='p-8 text-center text-ink-primary0 dark:text-zinc-400 flex-1 flex items-center justify-center'>
          No saved answers yet.
        </div>
      : <motion.div
          layout
          transition={springTransition}
          className='flex-1 overflow-hidden relative border border-border/40 rounded-xl bg-panel'
        >
          <motion.div
            layout
            transition={springTransition}
            className='grid grid-cols-[minmax(0,4fr)_minmax(0,1.5fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-0 border-b border-border/40 text-[11px] font-bold text-zinc-400 dark:text-ink-primary0 uppercase tracking-wider px-4 py-3 shrink-0'
          >
            <div className='pr-4'>Question</div>
            <div className='px-4'>Type</div>
            <div className='px-4'>Answer</div>
            <div className='px-4'>Used</div>
            <div className='pl-4 text-right'></div>
          </motion.div>

          <VirtualList
            outerRef={setContainerRef}
            className='custom-scrollbar-primary'
            items={listItems}
            rowHeight={ROW_HEIGHT}
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
                    className='grid grid-cols-[minmax(0,4fr)_minmax(0,1.5fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center px-4 animate-pulse border-b border-border/40/50'
                  >
                    <div className='pr-4'>
                      <div className='h-4 bg-background-secondary dark:bg-panel rounded w-3/4 mb-1'></div>
                      <div className='h-3 bg-zinc-200 dark:bg-zinc-850 rounded w-1/4'></div>
                    </div>
                    <div className='px-4'>
                      <div className='h-4 bg-background-secondary dark:bg-panel rounded w-16'></div>
                    </div>
                    <div className='px-4'>
                      <div className='h-8 bg-background-secondary dark:bg-panel rounded w-full'></div>
                    </div>
                    <div className='px-4'>
                      <div className='h-4 bg-background-secondary dark:bg-panel rounded w-8'></div>
                    </div>
                    <div className='pl-4'>
                      <div className='h-6 bg-background-secondary dark:bg-panel rounded w-12 ml-auto'></div>
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
                    'body-md grid grid-cols-[minmax(0,4fr)_minmax(0,1.5fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center px-4 border-b border-border/40/50 bg-panel',
                    index === listItems.length - 1 && 'border-b-0',
                  )}
                >
                  <div className='pr-4 min-w-0'>
                    <h2
                      className='text-ink-primary block truncate'
                      title={entry.original_label}
                    >
                      {entry.original_label}
                    </h2>
                    <p
                      className='text-meta dark:text-ink-primary0 mt-0.5 truncate'
                      title={entry.companies?.join(', ')}
                    >
                      {entry.companies?.slice(0, 3).join(', ')}
                    </p>
                  </div>
                  <div className='body-sm px-4 whitespace-nowrap text-ink-primary0 font-mono'>
                    {entry.field_type}
                  </div>
                  <div className='px-4 min-w-0'>
                    <input
                      defaultValue={entry.answer ?? ''}
                      className='body-md w-full rounded-lg border border-border bg-background-secondary/30 px-3 py-1.5 focus:bg-panel focus:border-primary/50 dark:border-border dark:bg-panel/60 dark:focus:bg-panel dark:focus:border-primary/50 focus:outline-none transition-all text-ink-primary'
                      onBlur={(event) => {
                        if (event.target.value !== (entry.answer ?? '')) {
                          void saveQuestion(entry, event.target.value);
                        }
                      }}
                    />
                  </div>
                  <div className='px-4 whitespace-nowrap text-ink-primary0'>
                    {entry.times_used}
                  </div>
                  <div className='pl-4 text-right'>
                    <button
                      className='label-sm px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-955/20 transition-all cursor-pointer'
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
