/** @format */

import { useEffect, useState } from 'react';
import type {
  JobSnapshot,
  PageInspection,
} from '../../shared/contracts/page-inspection';
import type { DocType } from '../../shared/contracts/tailored-resume';
import { JobScoreCard } from './JobScoreCard';
import { PageClassBanner } from './PageClassBanner';
import { PlatformQuickSearchCard } from './PlatformQuickSearchCard';
import { useAuth } from '../hooks/useAuth';
import { useInspection } from '../hooks/useInspection';
import { useJobMatch } from '../hooks/useJobMatch';
import { useTailoredResumeStudio } from '../hooks/useTailoredResumeStudio';
import { useThemeSync } from '../hooks/useThemeSync';
import { getActiveTab } from '../services/messaging';
import {
  createPageInspectionQueue,
  pageChangeInspectionRequest,
} from '../services/page-change-inspection';
import { Toaster } from '@jobby/ui/components/UI/toast/toaster';
import { cn } from '@jobby/ui/lib/utils';

const PAGE_READY_DELAY_MS = 150;

export function FloatingJobCardDialog() {
  const { authStatus, refreshAuth, signIn } = useAuth();
  useThemeSync(authStatus);

  const [ballPosition, setBallPosition] = useState<{
    edge: 'left' | 'right';
    pos: 'top' | 'middle' | 'bottom';
  }>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      edge: (params.get('edge') as 'left' | 'right') || 'right',
      pos: (params.get('pos') as 'top' | 'middle' | 'bottom') || 'middle',
    };
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.data?.source === 'jobby-ball' &&
        event.data?.type === 'jobby.ball-position'
      ) {
        setBallPosition({
          edge: event.data.edge || 'right',
          pos: event.data.pos || 'middle',
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const {
    latestInspection,
    setLatestInspection,
    inspectionError,
    isInspectingPage,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
  } = useInspection();

  const jobMatch = useJobMatch(latestInspection, authStatus?.connected, signIn);
  const isMatchPending = Boolean(
    authStatus?.connected &&
    latestInspection?.kind === 'job' &&
    !jobMatch.evaluation &&
    !jobMatch.error,
  );

  const isInspecting = isInspectingPage || !latestInspection;
  const isEvaluatingMatch =
    latestInspection?.kind === 'job' &&
    authStatus?.connected &&
    !jobMatch.evaluation &&
    !jobMatch.error;
  const isLoading = isInspecting || isEvaluatingMatch;

  const handleReDetectPage = async () => {
    await inspectPage();
    void inspectForm(true);
  };

  const handleUpdateJobSnapshot = (updates: Partial<JobSnapshot>) => {
    setLatestInspection((prev) => {
      if (!prev || prev.kind !== 'job') return prev;
      const updatedInspection: PageInspection = {
        ...prev,
        originalSnapshot: prev.snapshot,
        snapshot: {
          ...prev.snapshot,
          ...updates,
        } as JobSnapshot,
      };
      return updatedInspection;
    });
  };

  const tailorStudio = useTailoredResumeStudio(
    latestInspection,
    authStatus?.connected,
    true,
    handleReDetectPage,
    signIn,
  );

  const handleTailor = (docType: DocType) => {
    try {
      window.parent?.postMessage(
        { source: 'jobby-dialog', type: 'jobby.dialog-trigger-tailor', docType },
        '*',
      );
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime
          .sendMessage({
            type: 'sidepanel.trigger-tailor',
            docType,
          })
          .catch(() => undefined);
      }
    } catch {}
  };

  const activeTailorGeneration =
    tailorStudio.generationTasks[tailorStudio.generationTasks.length - 1] ||
    null;

  useEffect(() => {
    document.documentElement.classList.add('is-floating-dialog');
    document.body.classList.add('is-floating-dialog');
    return () => {
      document.documentElement.classList.remove('is-floating-dialog');
      document.body.classList.remove('is-floating-dialog');
    };
  }, []);

  // Synchronize size mode with parent container (compact bubble vs expanded cards)
  useEffect(() => {
    try {
      window.parent?.postMessage(
        {
          source: 'jobby-dialog',
          type: 'jobby.dialog-resize',
          mode: isLoading ? 'compact' : 'expanded',
        },
        '*',
      );
    } catch {}
  }, [isLoading]);

  useEffect(() => {
    refreshAuth();
    const inspectCurrentPage = createPageInspectionQueue(
      async ({ showLoading, force }) => {
        const isJob = await autoInspectActivePage(force, showLoading);
        if (isJob) {
          await inspectForm(true);
        }
      },
    );
    let scheduledInspection: number | undefined;
    const scheduleInspection = (showLoading: boolean, force = false) => {
      // Immediately clear previous result to dismiss stale job card instantly
      setLatestInspection(null);
      if (scheduledInspection !== undefined) {
        window.clearTimeout(scheduledInspection);
      }
      scheduledInspection = window.setTimeout(() => {
        scheduledInspection = undefined;
        inspectCurrentPage({ showLoading, force });
      }, PAGE_READY_DELAY_MS);
    };

    inspectCurrentPage({ showLoading: true, force: false });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleInspection(true, true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onTabActivated = () => scheduleInspection(true, true);
    const onTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      if (!changeInfo.url && changeInfo.status !== 'complete') return;
      void getActiveTab().then((tab) => {
        if (tab?.id === tabId) scheduleInspection(true, true);
      });
    };

    const onRuntimeMessage = (message: unknown) => {
      const request = pageChangeInspectionRequest(message);
      if (request) {
        scheduleInspection(request.showLoading, request.force);
      }
    };

    if(
      typeof chrome !== 'undefined' &&
      chrome.tabs?.onActivated &&
      chrome.tabs?.onUpdated
    ) {
      chrome.tabs.onActivated.addListener(onTabActivated);
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }

    return () => {
      if (scheduledInspection !== undefined)
        window.clearTimeout(scheduledInspection);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (
        typeof chrome !== 'undefined' &&
        chrome.tabs?.onActivated &&
        chrome.tabs?.onUpdated
      ) {
        chrome.tabs.onActivated.removeListener(onTabActivated);
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      }
    };
  }, [autoInspectActivePage, inspectForm, refreshAuth]);

  const isJobPage = latestInspection?.kind === 'job';
  const showNotJobOverlay =
    !isLoading &&
    !isJobPage &&
    (latestInspection !== null || Boolean(inspectionError));

  const isAlignRight = ballPosition.edge === 'right';
  const isAlignBottom = ballPosition.pos === 'bottom';
  const isAlignTop = ballPosition.pos === 'top';

  const bubblePositionClass = cn(
    'flex w-full h-full p-2',
    isAlignRight ? 'justify-end' : 'justify-start',
    isAlignTop ? 'items-start'
    : isAlignBottom ? 'items-end'
    : 'items-center',
  );

  return (
    <div className='h-screen w-full bg-transparent text-foreground overflow-hidden font-sans select-text box-border'>
      {isLoading ? (
        <div className={cn(bubblePositionClass, 'animate-in fade-in duration-100')}>
          <div className='flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-background-primary border border-primary/40  backdrop-blur-md text-foreground'>
            <span className='relative flex h-2 w-2 shrink-0'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75'></span>
              <span className='relative inline-flex rounded-full h-2 w-2 bg-primary'></span>
            </span>
            <span className='text-[11.5px] font-bold tracking-tight animate-text-shimmer animate-text-shimmer-primary whitespace-nowrap'>
              Recognition...
            </span>
            <div className='w-7 h-1.5 rounded-full overflow-hidden bg-primary/10 shrink-0'>
              <div className='w-full h-full animate-skeleton-shimmer'></div>
            </div>
          </div>
        </div>
      ) : showNotJobOverlay ? (
        <div className='flex flex-col h-full max-h-screen w-full '>
          <div className='flex flex-col w-full h-full max-h-full bg-background-primary rounded-2xl p-1 border border-primary/20 overflow-hidden box-border'>
            <div className='flex flex-col gap-2.5 w-full h-full overflow-y-auto overscroll-contain p-0.5 custom-scrollbar'>
              <PlatformQuickSearchCard
                activeProfile={jobMatch.activeProfile}
                onReDetect={handleReDetectPage}
                isInspecting={isInspectingPage}
              />
            </div>
          </div>
        </div>
      ) : isJobPage ? (
        <div className='flex flex-col h-full max-h-screen w-full '>
          <div className='flex flex-col w-full h-full max-h-full bg-background-primary rounded-tl-[4rem] rounded-tr-2xl rounded-bl-2xl rounded-br-2xl p-2  border border-primary/20 overflow-hidden box-border'>
            <div className='flex flex-col gap-2.5 w-full h-full overflow-y-auto overscroll-contain p-0.5 custom-scrollbar'>
              <JobScoreCard
                latestInspection={latestInspection}
                latestMatch={jobMatch.evaluation}
                isMatchLoading={jobMatch.isEvaluating || isMatchPending}
                isInspecting={isInspectingPage}
                onTailor={handleTailor}
                activeGeneration={activeTailorGeneration}
                authConnected={authStatus?.connected}
                onSignIn={signIn}
              />

              <PageClassBanner
                latestInspection={latestInspection}
                latestMatch={jobMatch.evaluation}
                isInspecting={isInspectingPage}
                error={inspectionError}
                onReDetect={handleReDetectPage}
                onUpdateJobSnapshot={handleUpdateJobSnapshot}
                authConnected={authStatus?.connected}
                onSignIn={signIn}
                onClaimSkill={jobMatch.claimSkill}
                onUnclaimSkill={jobMatch.unclaimSkill}
                activeProfile={jobMatch.activeProfile}
              />
            </div>
          </div>
        </div>
      ) : null}

      <Toaster />
    </div>
  );
}
