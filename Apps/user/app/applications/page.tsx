/** @format */

'use client';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ApplicationDetails } from './_components/ApplicationDetails';
import { TailoredResumeModal } from './_components/TailoredResumeModal';
import { useConsole } from '@/components/ConsoleContext';
import { ScrollLayout, WaterfallLayout } from '@jobby/ui';
import { api } from '@/lib/api';
import { formatRelativeDate } from '@/components/ConsoleUtils';
import { withMinimumLoadingTime } from '@/lib/loading';
import { useLayoutStore } from '@/lib/store/layout-store';
import { useConfirmStore } from '@/lib/store/confirm-store';
import {
  getCurrentApplicationStageTimestamp,
  getDisplayApplicationStatus,
  getStatusBadgeClasses,
  isProcessingApplication,
  isStaleProcessingApplication,
  type JobApplication,
} from '@/lib/types';
import { type ApplicationCardViewModel } from './_components/ApplicationCard';
import { ApplicationCard } from './_components/ApplicationCard';

const PAGE_SIZE = 20;

function matchesApplication(
  application: JobApplication,
  searchText: string,
) {
  const effectiveStatus =
    getDisplayApplicationStatus(application).toLowerCase();

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

const SKELETON_HEIGHTS = [340, 420, 280, 380, 320, 400, 460, 290];

export default function ApplicationsPage() {
  const {
    applications,
    saveApplicationPatch,
    deleteApplication,
  } = useConsole();

  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<JobApplication[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
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
  const offsetRef = React.useRef(0);
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

  const fetchMore = React.useCallback(
    async (reset = false) => {
      if (isFetchingRef.current && !reset) return;

      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      isFetchingRef.current = true;
      setIsLoading(true);

      if (reset) {
        setItems([]);
        offsetRef.current = 0;
        setHasMore(true);
      }

      const currentOffset = reset ? 0 : offsetRef.current;
      try {
        const data = await withMinimumLoadingTime(
          api.applications(
            undefined,
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
    },
    [deferredSearchText],
  );

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
          matchesApplication(item, deferredSearchText),
        );
      return syncedItems;
    });
  }, [applicationsById, deferredSearchText, isLoading]);

  const handleCardScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isLoading || !hasMore) return;

      const target = event.currentTarget;
      const distanceToBottom =
        target.scrollHeight - (target.scrollTop + target.clientHeight);
      if (distanceToBottom < 160) {
        void fetchMore();
      }
    },
    [fetchMore, hasMore, isLoading],
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
          jobLink: item.job_link || item.external_job_link,
          hasTailoredResume: Boolean(
            item.has_tailored_resume || item.job_description,
          ),
          firstPostedAt: item.first_posted_at || null,
          lastPostedAt: item.last_posted_at || null,
          displayFirstPostedAt:
            item.first_posted_at ? formatRelativeDate(item.first_posted_at) : null,
          displayLastPostedAt:
            item.last_posted_at ? formatRelativeDate(item.last_posted_at) : null,
          isReposted: Boolean(item.is_reposted),
          jobDescription: item.job_description || null,
        };
      }),
    [items],
  );

  const updateUrlParams = React.useCallback(
    (appId?: string | null, tab?: string | null, replace = false) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (appId) {
        url.searchParams.set('appId', appId);
        if (tab) {
          url.searchParams.set('tab', tab);
        } else {
          url.searchParams.delete('tab');
        }
      } else {
        url.searchParams.delete('appId');
        url.searchParams.delete('tab');
      }

      const newUrl = url.pathname + (url.search ? url.search : '');
      if (window.location.pathname + window.location.search !== newUrl) {
        if (replace) {
          window.history.replaceState(window.history.state, '', newUrl);
        } else {
          window.history.pushState({ appId, tab }, '', newUrl);
        }
      }
    },
    [],
  );

  const openApplicationDetails = React.useCallback(
    (
      applicationId: string,
      initialTab: 'overview' | 'qa' | 'description' = 'overview',
      updateUrl = true,
      replaceUrl = false,
    ) => {
      const application = applicationsById.get(applicationId);
      if (!application) {
        return;
      }

      if (updateUrl) {
        updateUrlParams(applicationId, initialTab, replaceUrl);
      }

      openDrawer({
        width: 640,
        id: applicationId,
        content: (
          <ApplicationDetails
            application={application}
            initialTab={initialTab}
            onTabChange={(tab) => {
              updateUrlParams(applicationId, tab, true);
            }}
            onSave={saveApplicationPatch}
          />
        ),
      });
    },
    [
      applicationsById,
      openDrawer,
      saveApplicationPatch,
      updateUrlParams,
    ],
  );

  // Sync URL when drawer is closed via close button / backdrop click / ESC
  const prevIsDrawerOpenRef = React.useRef(isDrawerOpen);
  useEffect(() => {
    if (prevIsDrawerOpenRef.current && !isDrawerOpen) {
      updateUrlParams(null, null, true);
    }
    prevIsDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen, updateUrlParams]);

  // Handle browser Back / Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const appId = params.get('appId');
      const tab =
        (params.get('tab') as 'overview' | 'qa' | 'description') || 'overview';

      if (appId) {
        if (applicationsById.has(appId)) {
          openApplicationDetails(appId, tab, false);
        }
      } else if (useLayoutStore.getState().isDrawerOpen) {
        useLayoutStore.getState().actions.closeDrawer();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applicationsById, openApplicationDetails]);

  // Deep-link auto open drawer on initial load
  const hasInitialOpenedRef = React.useRef(false);
  useEffect(() => {
    if (hasInitialOpenedRef.current || isLoading || items.length === 0) return;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const appId = params.get('appId');
      const tab =
        (params.get('tab') as 'overview' | 'qa' | 'description') || 'overview';

      if (appId && applicationsById.has(appId)) {
        hasInitialOpenedRef.current = true;
        openApplicationDetails(appId, tab, false, true);
      }
    }
  }, [applicationsById, isLoading, items.length, openApplicationDetails]);

  return (
    <div className='flex h-full min-h-[500px] flex-col overflow-hidden'>
      <div className='app-drag px-page select-none shrink-0'>
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
                  className='body-md pl-9 pr-4 py-1.5 w-full rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-955 dark:border-primary focus:outline-none focus:border-primary/50 dark:focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:focus:ring-zinc-750 text-ink-primary'
                />
              </div>
            </div>
          </ScrollLayout.BtmToRight>
        </ScrollLayout>
      </div>

      {items.length === 0 && !isLoading ?
        <div className='p-8 text-center text-ink-primary0 dark:text-zinc-400 flex-1 flex items-center justify-center'>
          No applications match this view.
        </div>
      : <div
          ref={setContainerRef}
          onScroll={handleCardScroll}
          className='flex-1 body overflow-y-auto custom-scrollbar-primary p-page relative'
        >
          <WaterfallLayout minColumnWidth={340} gap={20}>
            {isLoading &&
              items.length === 0 &&
              [1, 2, 3, 4, 5, 6].map((n, index) => (
                <div
                  key={n}
                  style={{
                    height: `${SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length]}px`,
                  }}
                  className='rounded-2xl rounded-tl-3xl! border border-primary/40 bg-background-secondary animate-pulse'
                />
              ))}
            {rowItems.map((item) => (
              <ApplicationCard
                key={item.id}
                entry={item}
                isSelected={isDrawerOpen && drawerOpenId === item.id}
                onOpenDetails={openApplicationDetails}
                onDelete={handleDeleteApplication}
                onOpenResume={(id, title, company) =>
                  setActiveResumeModal({ id, title, company })
                }
              />
            ))}
            {isLoading &&
              hasMore &&
              items.length > 0 &&
              [1, 2, 3, 4, 5, 6].map((n, index) => (
                <div
                  key={`card-skeleton-bottom-${n}`}
                  style={{
                    height: `${SKELETON_HEIGHTS[(index + 3) % SKELETON_HEIGHTS.length]}px`,
                  }}
                  className='rounded-2xl rounded-tl-3xl! border border-primary/40 bg-background-secondary animate-pulse'
                />
              ))}
          </WaterfallLayout>
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
