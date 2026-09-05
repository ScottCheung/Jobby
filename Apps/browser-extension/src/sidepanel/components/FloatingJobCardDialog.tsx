/** @format */

import { useDeferredValue, useEffect, useState } from 'react';
import type {
  JobSnapshot,
  PageInspection,
} from '../../shared/contracts/page-inspection';
import type { DocType } from '../../shared/contracts/tailored-resume';
import {
  JobAnalysisPanel,
  type JobAnalysisSnapshot,
  type JobDescriptionOpenPayload,
} from '@jobby/ui/components/UI/job-analysis';
import { useAuth } from '../hooks/useAuth';
import { useInspection } from '../hooks/useInspection';
import { useJobMatch } from '../hooks/useJobMatch';
import { useTailoredResumeStudio } from '../hooks/useTailoredResumeStudio';
import { useThemeSync } from '../hooks/useThemeSync';
import {
  getActiveTab,
  sendContentCommandToActiveTab,
} from '../services/messaging';
import {
  createPageInspectionQueue,
  createPageInspectionScheduler,
  pageChangeInspectionRequest,
} from '../services/page-change-inspection';
import { Toaster } from '@jobby/ui/components/UI/toast/toaster';
import { cn } from '@jobby/ui/lib/utils';
import jobRecognitionDescriptions from '@jobby/ui/constants/job-recognition-descriptions.json';

const { inspectingDescriptions, matchingDescriptions } = jobRecognitionDescriptions;

const PAGE_READY_DELAY_MS = 150;

export function FloatingJobCardDialog() {
  const { authStatus, refreshAuth, signIn, isCheckingAuth } = useAuth();
  useThemeSync(authStatus);

  const [ballPosition, setBallPosition] = useState<{
    edge: 'left' | 'right';
    pos: 'top' | 'bottom';
  }>(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('pos');
    return {
      edge: (params.get('edge') as 'left' | 'right') || 'right',
      pos: p === 'top' ? 'top' : 'bottom',
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
          pos: event.data.pos === 'top' ? 'top' : 'bottom',
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const [minLoadingDone, setMinLoadingDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingDone(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const {
    latestInspection,
    setLatestInspection,
    inspectionError,
    isInspectingPage,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    highlightJobRequirement,
  } = useInspection();

  const isJobPage = latestInspection?.kind === 'job';
  const jobMatch = useJobMatch(latestInspection, authStatus?.connected, signIn);
  const isMatchPending = Boolean(
    isJobPage &&
    (isCheckingAuth ||
      (authStatus?.connected &&
        (jobMatch.isEvaluating || (!jobMatch.evaluation && !jobMatch.error)))),
  );

  const isInspecting =
    isInspectingPage || (!latestInspection && !inspectionError);
  const isEvaluatingMatch = isMatchPending;
  const isConfirmedNonJob = Boolean(
    latestInspection && !isJobPage && !isInspectingPage,
  );
  const isLoading =
    !isConfirmedNonJob &&
    (isInspecting || isEvaluatingMatch || !minLoadingDone);
  const deferredIsLoading = useDeferredValue(isLoading);
  const isShowingLoading = isLoading || deferredIsLoading;

  const activeDescriptions = isEvaluatingMatch
    ? matchingDescriptions
    : inspectingDescriptions;
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * inspectingDescriptions.length),
  );

  useEffect(() => {
    if (!isShowingLoading) return;

    setMessageIndex((prev) => {
      const total = activeDescriptions.length;
      if (total <= 1) return 0;
      let next = Math.floor(Math.random() * total);
      if (next === prev) {
        next = (next + 1) % total;
      }
      return next;
    });

    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        const total = activeDescriptions.length;
        if (total <= 1) return 0;
        let next = Math.floor(Math.random() * total);
        if (next === prev) {
          next = (next + 1) % total;
        }
        return next;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [isShowingLoading, isEvaluatingMatch, activeDescriptions]);

  const currentLoadingMessage =
    activeDescriptions[messageIndex % activeDescriptions.length] ||
    'Analyzing...';

  const handleReDetectPage = async () => {
    await inspectPage();
    void inspectForm(true);
  };

  const handleUpdateJobSnapshot = (updates: Partial<JobAnalysisSnapshot>) => {
    setLatestInspection((prev) => {
      if (!prev || prev.kind !== 'job') return prev;
      const updatedInspection: PageInspection = {
        ...prev,
        originalSnapshot: prev.originalSnapshot || prev.snapshot,
        snapshot: {
          ...prev.snapshot,
          ...updates,
        } as JobSnapshot,
      };
      return updatedInspection;
    });
  };

  const handleOpenJobDescription = async (
    payload: JobDescriptionOpenPayload,
  ) => {
    await sendContentCommandToActiveTab({
      type: 'content.show-job-description',
      ...payload,
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
      const job =
        latestInspection?.kind === 'job' ? latestInspection.snapshot : null;
      const draft = {
        jobTitle:
          job?.title ||
          tailorStudio.jobTitle ||
          tailorStudio.detectedJob?.title ||
          '',
        company:
          job?.company ||
          tailorStudio.company ||
          tailorStudio.detectedJob?.company ||
          '',
        jobDescription:
          (job && ('description' in job && job.description ? job.description : 'jobDescription' in job && (job as { jobDescription?: string }).jobDescription ? (job as { jobDescription?: string }).jobDescription : '')) ||
          tailorStudio.jobDescription ||
          tailorStudio.detectedJob?.jobDescription ||
          '',
      };
      window.parent?.postMessage(
        {
          source: 'jobby-dialog',
          type: 'jobby.dialog-trigger-tailor',
          docType,
          draft,
        },
        '*',
      );
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime
          .sendMessage({
            type: 'sidepanel.trigger-tailor',
            docType,
            draft,
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
  // or dismiss if not a job page
  useEffect(() => {
    try {
      if (isShowingLoading) {
        window.parent?.postMessage(
          {
            source: 'jobby-dialog',
            type: 'jobby.dialog-resize',
            mode: 'compact',
          },
          '*',
        );
      } else if (isJobPage) {
        window.parent?.postMessage(
          {
            source: 'jobby-dialog',
            type: 'jobby.dialog-resize',
            mode: 'expanded',
          },
          '*',
        );
      } else {
        window.parent?.postMessage(
          {
            source: 'jobby-dialog',
            type: 'jobby.dialog-close',
          },
          '*',
        );
      }
    } catch {}
  }, [isShowingLoading, isJobPage]);

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
    const inspectionScheduler = createPageInspectionScheduler(
      inspectCurrentPage,
      PAGE_READY_DELAY_MS,
    );
    const scheduleInspection = (showLoading: boolean, force = false) => {
      // Immediately clear previous result to dismiss stale job card instantly
      setLatestInspection(null);
      inspectionScheduler.schedule({ showLoading, force });
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
      inspectionScheduler.cancel();
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

  const isAlignRight = ballPosition.edge === 'right';
  const isAlignTop = ballPosition.pos === 'top';

  return (
    <div className='relative h-full w-full bg-transparent text-foreground overflow-hidden font-sans select-text box-border pointer-events-none'>
      <div
        className={cn(
          'flex h-full w-full p-1 box-border',
          isAlignRight ? 'justify-end' : 'justify-start',
          isAlignTop ? 'items-start' : 'items-end',
        )}
      >
        {isShowingLoading ? (
          <div className='pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-background-primary border border-primary/40 text-foreground shadow-md'>
            <span
              key={currentLoadingMessage}
              className='text-[11.5px] font-bold tracking-tight animate-text-shimmer animate-text-shimmer-primary whitespace-nowrap'
            >
              {currentLoadingMessage}
            </span>
          </div>
        ) : isJobPage ? (
          <div
            className='pointer-events-auto flex flex-col w-full h-full max-h-screen bg-background-primary p-2 border border-primary/20 overflow-hidden box-border shadow-xl'
            style={{
              contain: 'layout paint',
              borderRadius:
                'var(--score-card-radius-shell-accent) var(--score-card-radius-shell-base) var(--score-card-radius-shell-base) var(--score-card-radius-shell-base)',
              clipPath:
                'inset(0 round var(--score-card-radius-shell-accent) var(--score-card-radius-shell-base) var(--score-card-radius-shell-base) var(--score-card-radius-shell-base))',
              WebkitClipPath:
                'inset(0 round var(--score-card-radius-shell-accent) var(--score-card-radius-shell-base) var(--score-card-radius-shell-base) var(--score-card-radius-shell-base))',
            }}
          >
            <div
              className='flex flex-col gap-2.5 w-full h-full overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar'
              style={{
                borderRadius:
                  'var(--score-card-radius-accent) var(--score-card-radius-base) var(--score-card-radius-base) var(--score-card-radius-base)',
                clipPath:
                  'inset(0 round var(--score-card-radius-accent) var(--score-card-radius-base) var(--score-card-radius-base) var(--score-card-radius-base))',
                WebkitClipPath:
                  'inset(0 round var(--score-card-radius-accent) var(--score-card-radius-base) var(--score-card-radius-base) var(--score-card-radius-base))',
              }}
            >
              <JobAnalysisPanel
                latestInspection={latestInspection}
                latestMatch={jobMatch.evaluation}
                isMatchLoading={jobMatch.isEvaluating || isMatchPending}
                isInspecting={isInspectingPage}
                onTailor={handleTailor}
                activeGeneration={activeTailorGeneration}
                authConnected={authStatus?.connected}
                onSignIn={signIn}
                error={jobMatch.error || inspectionError}
                onRetryMatch={() => void jobMatch.retry()}
                onClaimSkill={jobMatch.claimSkill}
                onUnclaimSkill={jobMatch.unclaimSkill}
                activeProfile={jobMatch.activeProfile}
                profileSkills={jobMatch.profileSkills}
                onReDetect={handleReDetectPage}
                onUpdateJobSnapshot={handleUpdateJobSnapshot}
                onHighlightJobRequirement={highlightJobRequirement}
                onOpenJobDescription={handleOpenJobDescription}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Toaster />
    </div>
  );
}
