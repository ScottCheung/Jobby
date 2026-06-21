/** @format */

'use client';
import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Briefcase, RefreshCw, Search } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { VirtualList } from '@/components/UI/VirtualList';
import { withMinimumLoadingTime } from '@/lib/loading';
import {
  getDisplayApplicationStatus,
  isProcessingApplication,
  isStaleProcessingApplication,
  isStatusSubmitted,
  type JobApplication,
} from '@/lib/types';
import { ApplicationRow } from './_components/ApplicationRow';
import { ApplicationSkeleton } from './_components/ApplicationSkeleton';
import { motion } from 'framer-motion';
import { Stagger, ScrollLayout } from '@/components/animation';

const springTransition = {
  duration: 1,
  ease: [0.22, 1, 0.36, 1] as const,
};

type ApplicationListItem =
  | { type: 'row'; id: string; data: JobApplication }
  | { type: 'details'; id: string; data: JobApplication }
  | { type: 'skeleton'; id: string };

const PAGE_SIZE = 20;
const ROW_HEIGHT = 92;
const DETAILS_HEIGHT = 560;

function matchesApplication(
  application: JobApplication,
  statusFilter: string,
  searchText: string,
) {
  const effectiveStatus =
    getDisplayApplicationStatus(application).toLowerCase();

  if (statusFilter) {
    const filterLower = statusFilter.toLowerCase();
    if (filterLower === 'submitted') {
      if (!isStatusSubmitted(effectiveStatus)) {
        return false;
      }
    } else if (filterLower === 'interrupted') {
      if (
        application.status !== 'interrupted' &&
        !isStaleProcessingApplication(application)
      ) {
        return false;
      }
    } else {
      if (effectiveStatus !== filterLower) {
        return false;
      }
    }
  }

  const query = searchText.trim().toLowerCase();
  if (!query) return true;

  return [
    application.title,
    application.company,
    application.job_id,
    effectiveStatus,
  ].some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(query),
  );
}

export default function ApplicationsPage() {
  const {
    applications,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    batchSyncing,
    batchAsyncApplications,
    syncingApplicationId,
    asyncApplication,
    expandedApplicationId,
    setExpandedApplicationId,
    saveApplicationPatch,
    deleteApplication,
  } = useConsole();

  const [items, setItems] = useState<JobApplication[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const deferredSearchText = useDeferredValue(searchText);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
        api.applications(
          statusFilter,
          PAGE_SIZE,
          currentOffset,
          deferredSearchText,
        ),
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
      console.error('Failed to fetch applications', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    void fetchMore(true);
  }, [statusFilter, deferredSearchText]);

  useEffect(() => {
    setItems((prevItems) => {
      const filteredApplications = applications.filter((application) => {
        if (
          !matchesApplication(application, statusFilter, deferredSearchText)
        ) {
          return false;
        }
        return true;
      });

      const pinnedProcessingItems = filteredApplications.filter(
        (item) =>
          isProcessingApplication(item) && !isStaleProcessingApplication(item),
      );
      const regularItems = filteredApplications.filter(
        (item) =>
          !(
            isProcessingApplication(item) && !isStaleProcessingApplication(item)
          ),
      );

      return [...pinnedProcessingItems, ...regularItems];
    });
  }, [applications, deferredSearchText, statusFilter]);

  const listItems = React.useMemo<ApplicationListItem[]>(() => {
    const nextItems: ApplicationListItem[] = [];

    items.forEach((item) => {
      nextItems.push({ type: 'row', id: `${item.id}-row`, data: item });
    });

    if (isLoading && hasMore) {
      nextItems.push(
        { type: 'skeleton', id: 'application-skeleton-1' },
        { type: 'skeleton', id: 'application-skeleton-2' },
        { type: 'skeleton', id: 'application-skeleton-3' },
        { type: 'skeleton', id: 'application-skeleton-4' },
        { type: 'skeleton', id: 'application-skeleton-5' },
      );
    }

    return nextItems;
  }, [hasMore, isLoading, items]);

  return (
    <motion.div
      layout
      transition={springTransition}
      className='flex flex-col h-[calc(100vh-64px)] min-h-[500px] overflow-hidden '
    >
      <div className='pb-4 select-none shrink-0'>
        <ScrollLayout
          key={scrollContainer ? 'scrolling' : 'static'}
          scrollContainerRef={scrollContainerRef}
          progressRange={[0, 100]}
          heightRange={[110, 50]}
        >
          <ScrollLayout.TopToLeft>
            <div className='flex items-center gap-2 text-zinc-900 dark:text-zinc-50 font-bold shrink-0'>
              <h2 className='text-xl tracking-tight shrink-0'>
                Application History
              </h2>
            </div>
          </ScrollLayout.TopToLeft>

          <ScrollLayout.BtmToRight>
            <div className='flex items-center gap-3 w-full'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
                <input
                  placeholder='Search title, company, job id...'
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className='input bg-glass pl-9 pr-3 py-1.5 text-sm w-full'
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className='rounded-xl bg-panel focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 text-zinc-900 dark:text-zinc-100 cursor-pointer text-sm border border-transparent px-3 py-2'
              >
                <option value=''>All statuses</option>
                <option value='submitted'>Submitted</option>
                <option value='interrupted'>Needs review</option>
                <option value='skipped'>Skipped</option>
                <option value='cancelled'>Cancelled</option>
              </select>
            </div>
          </ScrollLayout.BtmToRight>
        </ScrollLayout>
      </div>

      {items.length === 0 && !isLoading ?
        <motion.div
          layout
          transition={springTransition}
          className='p-8 text-center text-zinc-500 dark:text-zinc-400 flex-1 flex items-center justify-center'
        >
          No applications match this view.
        </motion.div>
      : <motion.div
          layout
          transition={springTransition}
          className='flex-1 overflow-hidden relative bg-panel rounded-xl'
        >
          <div className='w-full h-full overflow-x-auto custom-scrollbar-primary'>
            <div className='min-w-[950px] h-full flex flex-col'>
              <motion.div
                layout
                transition={springTransition}
                className='grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] text-ink-secondary/50 font-bold uppercase tracking-wider px-4 py-3 shrink-0 border-b border-zinc-100/10'
              >
                <div className='pr-4'>Role & Info</div>
                <div className='px-4'>Company</div>
                <div className='px-4'>Status</div>
                <div className='pl-4 text-right'>Actions</div>
              </motion.div>

              <div className='flex-1 min-h-0 relative'>
                <VirtualList
                  outerRef={setContainerRef}
                  className='custom-scrollbar-primary'
                  items={listItems}
                  rowHeight={() => ROW_HEIGHT}
                  onEndReached={() => {
                    if (hasMore && !isLoading) {
                      void fetchMore();
                    }
                  }}
                  renderRow={(item, index, style) => {
                    if (item.type === 'skeleton') {
                      return (
                        <ApplicationSkeleton key={item.id} style={style} />
                      );
                    }

                    return (
                      <ApplicationRow
                        key={item.id}
                        entry={item.data}
                        style={style}
                        isLast={index === listItems.length - 1}
                        syncingApplicationId={syncingApplicationId}
                        asyncApplication={asyncApplication}
                        deleteApplication={deleteApplication}
                      />
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      }
    </motion.div>
  );
}
