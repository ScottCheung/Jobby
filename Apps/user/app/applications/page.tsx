/** @format */

'use client';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ApplicationDetails } from './_components/ApplicationDetails';
import { TailoredResumeModal } from './_components/TailoredResumeModal';
import { useConsole } from '@/components/ConsoleContext';
import { ScrollLayout } from '@/components/animation';
import { api } from '@/lib/api';
import { formatRelativeDate } from '@/components/ConsoleUtils';
import { withMinimumLoadingTime } from '@/lib/loading';
import { useLayoutStore } from '@/lib/store/layout-store';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { WaterfallLayout } from '@/components/layout/waterfallLayout';
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
import { type ApplicationCardViewModel } from './_components/ApplicationCard';
import { ApplicationCard } from './_components/ApplicationCard';

const PAGE_SIZE = 20;

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
    applicationPlanAction,
    deleteApplication,
  } = useConsole();

  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<JobApplication[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [activeResumeModal, setActiveResumeModal] = useState<{
    id: string;
    title: string;
    company: string;
  } | null>(null);

  const deferredSearchText = useDeferredValue(searchText);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const offsetRef = React.useRef(0);
  const lastScrollTopRef = React.useRef(0);
  const isFetchingRef = React.useRef(false);
  const requestVersionRef = React.useRef(0);
  const applicationsById = useMemo(
    () =>
      new Map(applications.map((application) => [application.id, application])),
    [applications],
  );
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const isDrawerOpen = useLayoutStore((state) => state.isDrawerOpen);
  const drawerOpenId = useLayoutStore((state) => state.drawerConfig.id);
  const confirm = useConfirmStore((state) => state.confirm);

  const setContainerRef = React.useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollContainer(el);
  }, []);

  const fetchMore = React.useCallback(async (reset = false) => {
    if (isFetchingRef.current && !reset) return;

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    isFetchingRef.current = true;
    setIsLoading(true);

    if (reset) {
      setItems([]);
      offsetRef.current = 0;
      setHasMore(true);
      setCanLoadMore(false);
      lastScrollTopRef.current = 0;
    }

    const currentOffset = reset ? 0 : offsetRef.current;
    try {
      const data = await withMinimumLoadingTime(
        api.applications(
          statusFilter,
          PAGE_SIZE,
          currentOffset,
          deferredSearchText,
        ),
        800,
      );

      // Ignore a response for an older filter/search request.
      if (requestVersion !== requestVersionRef.current) return;

      if (reset) {
        setItems(data);
        offsetRef.current = data.length;
        setHasMore(data.length === PAGE_SIZE);
        return;
      }

      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const nextItems = data.filter((item) => !existingIds.has(item.id));
        return [...prev, ...nextItems];
      });
      offsetRef.current = currentOffset + data.length;
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      if (requestVersion === requestVersionRef.current) {
        console.error('Failed to fetch applications', err);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [deferredSearchText, statusFilter]);

  const handleDeleteApplication = React.useCallback(
    async (applicationId: string, title?: string, company?: string) => {
      const roleText = title ? ` for "${title}"` : '';
      const companyText = company ? ` at "${company}"` : '';
      const isConfirmed = await confirm({
        title: 'Delete Application',
        message: `Are you sure you want to delete this job application${roleText}${companyText}? This action cannot be undone.`,
        confirmLabel: 'Delete Application',
        cancelLabel: 'Cancel',
        type: 'delete',
      });

      if (!isConfirmed) return;

      setItems((prev) => prev.filter((item) => item.id !== applicationId));

      try {
        await deleteApplication(applicationId);
      } catch (err) {
        console.error('Failed to delete application:', err);
        void fetchMore(true);
      }
    },
    [confirm, deleteApplication, fetchMore],
  );

  useEffect(() => {
    void fetchMore(true);
  }, [fetchMore]);

  useEffect(() => {
    if (isLoading) return;
    setItems((prevItems) => {
      const syncedItems = prevItems
        .map((item) => applicationsById.get(item.id) ?? item)
        .filter((item) =>
          matchesApplication(item, statusFilter, deferredSearchText),
        );
      return syncedItems;
    });
  }, [applicationsById, deferredSearchText, statusFilter, isLoading]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!scrollContainer || !sentinel || !canLoadMore || !hasMore || isLoading) return;

    let isVisible = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const clearLoadTimer = () => {
      if (loadTimer !== undefined) {
        clearTimeout(loadTimer);
        loadTimer = undefined;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        clearLoadTimer();

        if (isVisible) {
          // Avoid loading while the user only briefly passes the list footer.
          loadTimer = setTimeout(() => {
            if (isVisible) void fetchMore();
          }, 600);
        }
      },
      { root: scrollContainer, threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => {
      clearLoadTimer();
      observer.disconnect();
    };
  }, [canLoadMore, fetchMore, hasMore, isLoading, scrollContainer]);

  const handleCardScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const currentScrollTop = event.currentTarget.scrollTop;
      if (currentScrollTop > lastScrollTopRef.current) {
        setCanLoadMore(true);
      }
      lastScrollTopRef.current = currentScrollTop;
    },
    [],
  );

  const rowItems = useMemo<ApplicationCardViewModel[]>(
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
          jobLink: item.job_link || item.external_job_link,
          hasTailoredResume: Boolean(
            item.has_tailored_resume || item.job_description,
          ),
          datePosted: item.date_posted || null,
          displayDatePosted:
            item.date_posted ? formatRelativeDate(item.date_posted) : null,
          jobDescription: item.job_description || null,
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
            onPlanAction={applicationPlanAction}
          />
        ),
      });
    },
    [applicationsById, openDrawer, saveApplicationPatch],
  );

  return (
    <div className='flex h-full min-h-[500px] flex-col overflow-hidden'>
      <div className='app-drag pb-4 select-none shrink-0'>
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
            <div className='flex items-center gap-3 w-full'>
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
      :
        <div
          ref={setContainerRef}
          onScroll={handleCardScroll}
          className='flex-1 overflow-y-auto custom-scrollbar-primary p-2 relative'
        >
          {isLoading && items.length === 0 ?
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-2'>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className='h-64 rounded-2xl border border-border/40 bg-panel/40 animate-pulse'
                />
              ))}
            </div>
          : <>
              <WaterfallLayout
              minColumnWidth={340}
              gap={20}
              virtualize
              scrollContainerRef={scrollContainerRef}
            >
              {rowItems.map((item) => (
                <ApplicationCard
                  key={item.id}
                  entry={item}
                  isSyncing={syncingApplicationId === item.id}
                  isSelected={isDrawerOpen && drawerOpenId === item.id}
                  onOpenDetails={openApplicationDetails}
                  onAsync={asyncApplication}
                  onDelete={handleDeleteApplication}
                  onOpenResume={(id, title, company) =>
                    setActiveResumeModal({ id, title, company })
                  }
                />
              ))}
              </WaterfallLayout>
              {hasMore && (
                <div
                  ref={loadMoreSentinelRef}
                  className='mt-5 h-64 rounded-2xl border border-border/40 bg-panel/40 animate-pulse'
                  aria-hidden='true'
                />
              )}
            </>
          }
        </div>
      }

      {activeResumeModal && (
        <TailoredResumeModal
          applicationId={activeResumeModal.id}
          title={activeResumeModal.title}
          company={activeResumeModal.company}
          onClose={() => setActiveResumeModal(null)}
        />
      )}
    </div>
  );
}
