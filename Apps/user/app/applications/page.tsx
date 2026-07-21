/** @format */

'use client';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ApplicationDetails } from './_components/ApplicationDetails';
import { useConsole } from '@/components/ConsoleContext';
import { ScrollLayout } from '@/components/animation';
import { api } from '@/lib/api';
import { VirtualList } from '@/components/UI/VirtualList';
import { formatRelativeDate } from '@/components/ConsoleUtils';
import { withMinimumLoadingTime } from '@/lib/loading';
import { useLayoutStore } from '@/lib/store/layout-store';
import {
  getCurrentApplicationStageTimestamp,
  getDisplayApplicationStatus,
  getStatusBadgeClasses,
  isProcessingApplication,
  isStaleProcessingApplication,
  isStatusSubmitted,
  shouldShowApplicationSkipReason,
  type JobApplication,
} from '@/lib/types';
import {
  ApplicationRow,
  type ApplicationRowViewModel,
} from './_components/ApplicationRow';
import { ApplicationSkeleton } from './_components/ApplicationSkeleton';

type ApplicationListItem =
  | { type: 'row'; id: string; data: ApplicationRowViewModel }
  | { type: 'skeleton'; id: string };

const PAGE_SIZE = 20;
const ROW_HEIGHT = 92;

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
    syncingApplicationId,
    asyncApplication,
    saveApplicationPatch,
    deleteApplication,
  } = useConsole();

  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<JobApplication[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );

  const deferredSearchText = useDeferredValue(searchText);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const applicationsById = useMemo(
    () =>
      new Map(applications.map((application) => [application.id, application])),
    [applications],
  );
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const isDrawerOpen = useLayoutStore((state) => state.isDrawerOpen);
  const drawerOpenId = useLayoutStore((state) => state.drawerConfig.id);

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
        const existingIds = new Set(prev.map((item) => item.id));
        const nextItems = data.filter((item) => !existingIds.has(item.id));
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
      const syncedItems = prevItems
        .map((item) => applicationsById.get(item.id) ?? item)
        .filter((item) =>
          matchesApplication(item, statusFilter, deferredSearchText),
        );
      return syncedItems;
    });
  }, [applicationsById, deferredSearchText, statusFilter]);

  const rowItems = useMemo<ApplicationRowViewModel[]>(
    () =>
      items.map((item) => {
        const displayStatus = getDisplayApplicationStatus(item);
        const isLiveProcessing =
          isProcessingApplication(item) && !isStaleProcessingApplication(item);
        const stageTimestamp = getCurrentApplicationStageTimestamp(item);

        return {
          id: item.id,
          title: item.title || 'Untitled role',
          company: item.company || 'Unknown',
          jobId: item.job_id || 'Unknown',
          platform: item.platform,
          workStyle: item.work_style,
          workLocation: item.work_location || 'Location not recorded',
          displayStatus,
          statusBadgeClassName: getStatusBadgeClasses(displayStatus),
          isLiveProcessing,
          stageTimestamp,
          displayStageTime: formatRelativeDate(stageTimestamp),
          skipReason: item.skip_reason,
          shouldShowSkipReason: shouldShowApplicationSkipReason(item),
          jobLink: item.job_link,
        };
      }),
    [items],
  );

  const openApplicationDetails = React.useCallback(
    (applicationId: string) => {
      const application = applicationsById.get(applicationId);
      if (!application) {
        return;
      }

      openDrawer({
        width: 640,
        id: applicationId,
        content: (
          <ApplicationDetails
            application={application}
            onSave={saveApplicationPatch}
          />
        ),
      });
    },
    [applicationsById, openDrawer, saveApplicationPatch],
  );

  const listItems = React.useMemo<ApplicationListItem[]>(() => {
    const nextItems: ApplicationListItem[] = rowItems.map((item) => ({
      type: 'row',
      id: `${item.id}-row`,
      data: item,
    }));

    if (isLoading && hasMore) {
      nextItems.push(
        { type: 'skeleton', id: 'application-skeleton-1' },
        { type: 'skeleton', id: 'application-skeleton-2' },
        { type: 'skeleton', id: 'application-skeleton-3' },
        { type: 'skeleton', id: 'application-skeleton-4' },
      );
    }

    return nextItems;
  }, [hasMore, isLoading, rowItems]);

  const renderRow = React.useCallback(
    (item: ApplicationListItem, index: number, style: React.CSSProperties) => {
      if (item.type === 'skeleton') {
        return <ApplicationSkeleton key={item.id} style={style} />;
      }

      return (
        <ApplicationRow
          key={item.id}
          entry={item.data}
          style={style}
          isLast={index === listItems.length - 1}
          isSyncing={syncingApplicationId === item.data.id}
          isSelected={isDrawerOpen && drawerOpenId === item.data.id}
          onOpenDetails={openApplicationDetails}
          onAsync={asyncApplication}
          onDelete={deleteApplication}
        />
      );
    },
    [
      asyncApplication,
      deleteApplication,
      drawerOpenId,
      isDrawerOpen,
      listItems.length,
      openApplicationDetails,
      syncingApplicationId,
    ],
  );

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
            <div className='flex items-center gap-2 font-bold shrink-0'>
              <h2 className='title-page bg-primary-gradient bg-clip-text text-transparent shrink-0'>
                Application History
              </h2>
            </div>
          </ScrollLayout.TopToLeft>

          <ScrollLayout.BtmToRight>
            <div className='flex items-center gap-4 w-full'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
                <input
                  placeholder='Search title, company, job id...'
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className='body-md pl-9 pr-4 py-1.5 w-full rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-955 dark:border-border focus:outline-none focus:border-primary/50 dark:focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:focus:ring-zinc-750 text-ink-primary'
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className='body-md h-9 rounded-xl border border-zinc-200 bg-panel px-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:border-border dark:bg-zinc-955 dark:focus:border-primary/50 dark:focus:ring-zinc-750'
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
        <div className='p-8 text-center text-ink-primary0 dark:text-zinc-400 flex-1 flex items-center justify-center'>
          No applications match this view.
        </div>
      : <div className='flex-1 overflow-hidden relative border border-border/40 rounded-xl bg-panel'>
          <div className='w-full h-full overflow-x-auto custom-scrollbar-primary'>
            <div className='min-w-[950px] h-full flex flex-col'>
              <div className='grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] text-[11px] font-bold text-zinc-400 dark:text-ink-primary0 uppercase tracking-wider px-4 py-3 shrink-0 border-b border-border/40'>
                <div className=' flex items-center justify-start'>
                  Role & Info
                </div>
                <div className=' flex items-center justify-start'>Company</div>
                <div className=' flex items-center justify-center'>Status</div>
                <div className=' flex items-center justify-center'>Time</div>
                <div className=' text-right flex items-center justify-end'>
                  Actions
                </div>
              </div>

              <div className='flex-1 min-h-0 relative'>
                <VirtualList
                  outerRef={setContainerRef}
                  className='custom-scrollbar-primary'
                  items={listItems}
                  rowHeight={() => ROW_HEIGHT}
                  overscanCount={3}
                  onEndReached={() => {
                    if (hasMore && !isLoading) {
                      void fetchMore();
                    }
                  }}
                  renderRow={renderRow}
                />
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  );
}
