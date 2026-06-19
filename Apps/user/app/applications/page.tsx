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
import { Stagger } from '@/components/animation';
import {
  CollapsibleHeader,
  springTransition,
} from '@/components/UI/CollapsibleHeader';

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

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const deferredSearchText = useDeferredValue(searchText);
  const lastScrollTop = useRef(0);
  const collapseFrameRef = useRef<number | null>(null);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (collapseFrameRef.current !== null) {
      cancelAnimationFrame(collapseFrameRef.current);
    }
    collapseFrameRef.current = requestAnimationFrame(() => {
      if (scrollTop <= 10) {
        setIsHeaderCollapsed(false);
      } else if (scrollTop > lastScrollTop.current && scrollTop > 50) {
        setIsHeaderCollapsed(true);
      } else if (scrollTop < lastScrollTop.current) {
        setIsHeaderCollapsed(false);
      }
      lastScrollTop.current = scrollTop;
      collapseFrameRef.current = null;
    });
  };

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

  useEffect(() => {
    return () => {
      if (collapseFrameRef.current !== null) {
        cancelAnimationFrame(collapseFrameRef.current);
      }
    };
  }, []);

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
        { type: 'skeleton', id: 'application-skeleton-6' },
        { type: 'skeleton', id: 'application-skeleton-7' },
        { type: 'skeleton', id: 'application-skeleton-8' },
        { type: 'skeleton', id: 'application-skeleton-9' },
        { type: 'skeleton', id: 'application-skeleton-10' },
      );
    }

    return nextItems;
  }, [expandedApplicationId, hasMore, isLoading, items]);

  return (
    <div className='flex flex-col h-[calc(100vh-64px)] min-h-[500px] overflow-hidden '>
      <CollapsibleHeader
        title='Application History'
        icon={
          <Briefcase
            className={cn(
              'transition-transform',
              isHeaderCollapsed ? 'w-4 h-4' : 'w-5 h-5',
            )}
          />
        }
        isCollapsed={isHeaderCollapsed}
        actions={
          <>
            <motion.div
              layout
              transition={springTransition}
              className={cn(
                'flex items-center gap-3',
                isHeaderCollapsed ?
                  'flex-1 justify-end max-w-xl'
                : 'flex-1 flex-wrap',
              )}
            >
              <motion.div
                layout
                transition={springTransition}
                className={cn(
                  'relative',
                  isHeaderCollapsed ? 'w-44' : 'flex-1 min-w-[200px] max-w-md',
                )}
              >
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
                <input
                  placeholder={
                    isHeaderCollapsed ? 'Search...' : (
                      'Search title, company, job id...'
                    )
                  }
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className='input bg-glass pl-9 pr-3 py-1.5 text-sm w-full'
                />
              </motion.div>
              <motion.select
                layout
                transition={springTransition}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={cn(
                  'rounded-xl bg-panel focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 text-zinc-900 dark:text-zinc-100 cursor-pointer text-sm border border-transparent',
                  isHeaderCollapsed ? 'px-2.5 py-1.5' : 'px-3 py-2',
                )}
              >
                <option value=''>All statuses</option>
                <option value='submitted'>Submitted</option>
                <option value='interrupted'>Needs review</option>
                <option value='skipped'>Skipped</option>
                <option value='cancelled'>Cancelled</option>
              </motion.select>
            </motion.div>
            <motion.button
              layout
              transition={springTransition}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl text-zinc-900 font-semibold dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-sm shrink-0 border border-transparent',
                isHeaderCollapsed ? 'px-3 py-1.5' : 'px-4 py-2',
              )}
              onClick={() => void batchAsyncApplications()}
              disabled={batchSyncing}
            >
              <RefreshCw
                className={cn('w-4 h-4', batchSyncing && 'animate-spin')}
              />
              <span
                className={cn(
                  'transition-all duration-300',
                  isHeaderCollapsed ? 'hidden sm:inline text-xs' : 'inline',
                )}
              >
                {batchSyncing ? 'Syncing...' : 'Sync from links'}
              </span>
            </motion.button>
          </>
        }
      />

      {items.length === 0 && !isLoading ?
        <div className='p-8 text-center text-zinc-500 dark:text-zinc-400 flex-1 flex items-center justify-center'>
          No applications match this view.
        </div>
      : <div className='flex-1 overflow-hidden relative bg-panel rounded-xl'>
          <div className='w-full h-full overflow-x-auto custom-scrollbar-primary'>
            <div className='min-w-[950px] h-full flex flex-col'>
              <div className='grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] text-ink-secondary/50 font-bold uppercase tracking-wider px-4 py-3 shrink-0 border-b border-zinc-100/10'>
                <div className='pr-4'>Role & Info</div>
                <div className='px-4'>Company</div>
                <div className='px-4'>Status</div>
                <div className='pl-4 text-right'>Actions</div>
              </div>

              <div className='flex-1 min-h-0 relative'>
                <VirtualList
                  className='custom-scrollbar-primary'
                  items={listItems}
                  rowHeight={() => ROW_HEIGHT}
                  onScroll={handleListScroll}
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
        </div>
      }
    </div>
  );
}
