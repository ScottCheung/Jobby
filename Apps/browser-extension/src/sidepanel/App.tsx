/** @format */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { Input } from '@jobby/ui/components/UI/input';
import { Textarea } from '@jobby/ui/components/UI/textarea';
import type {
  JobSnapshot,
  PageInspection,
} from '../shared/contracts/page-inspection';
import type { DocType } from '../shared/contracts/tailored-resume';
import { AuthCard } from './components/AuthCard';
import { AuthGuardBanner } from './components/AuthGuardBanner';
import { BottomNav, type TabType } from './components/BottomNav';
import { DebugDrawer } from './components/DebugDrawer';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { HeaderQuickActions } from './components/HeaderQuickActions';
import { JobScoreCard } from './components/JobScoreCard';
import { PageClassBanner } from './components/PageClassBanner';
import { PlatformQuickSearchCard } from './components/PlatformQuickSearchCard';
import { ResultsDisplay } from './components/ResultsDisplay';
import { WorkflowSection } from './components/WorkflowSection';
import { useApplicationTools } from './hooks/useApplicationTools';
import { useAuth } from './hooks/useAuth';
import { useDiagnostics } from './hooks/useDiagnostics';
import { useInspection } from './hooks/useInspection';
import { useJobMatch } from './hooks/useJobMatch';
import { useTailoredResumeStudio } from './hooks/useTailoredResumeStudio';
import { useThemeSync } from './hooks/useThemeSync';
import { getActiveTab } from './services/messaging';
import {
  createPageInspectionQueue,
  pageChangeInspectionRequest,
} from './services/page-change-inspection';
import { Toaster } from '@jobby/ui/components/UI/toast/toaster';

const PAGE_READY_DELAY_MS = 150;
const TailorStudioCard = lazy(() =>
  import('./components/TailorStudioCard').then((module) => ({
    default: module.TailorStudioCard,
  })),
);

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [generationDraft, setGenerationDraft] = useState<{
    type: DocType;
    jobTitle: string;
    company: string;
    jobDescription: string;
  } | null>(null);
  const [pendingFormAction, setPendingFormAction] = useState<{
    tabId: number;
    pendingCount: number;
  } | null>(null);
  const [isFinalizingFormAction, setIsFinalizingFormAction] = useState(false);
  const [formActionError, setFormActionError] = useState<string | null>(null);

  const { diagnostics, errorMessage, refresh, clearLogs } = useDiagnostics();
  const {
    authStatus,
    authError,
    refreshAuth,
    signIn,
    disconnect,
    isSigningIn,
  } = useAuth();
  const { themeColor, themeMode, toggleThemeColor, toggleThemeMode } =
    useThemeSync(authStatus);
  const {
    latestInspection,
    setLatestInspection,
    latestForm,
    inspectionError,
    setInspectionError,
    applyAutofillResults,
    isInspectingPage,
    isInspectingForm,
    isClearingForm,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    focusFormField,
    highlightJobRequirement,
    autofillSingleField,
    uploadTailoredResume,
    editFormField,
    clearAllFormFields,
    uploadStates,
  } = useInspection();

  useEffect(() => {
    if (activeTab === 'form') {
      void inspectForm(true);
    }
  }, [activeTab, inspectForm]);

  useEffect(() => {
    const isIframe =
      typeof window !== 'undefined' && window.self !== window.top;
    if (!isIframe && typeof chrome !== 'undefined' && chrome.runtime?.connect) {
      const port = chrome.runtime.connect({ name: 'jobby-sidepanel' });

      const registerWindow = async () => {
        try {
          // getCurrent inside the sidepanel page context always returns the window hosting the sidepanel
          const win = await chrome.windows.getCurrent();
          if (win && win.id !== undefined) {
            port.postMessage({ type: 'sidepanel.init', windowId: win.id });
          }
        } catch {}
      };

      void registerWindow();

      const closePanel = (message: unknown) => {
        if (
          typeof message === 'object' &&
          message !== null &&
          (message as { type?: unknown }).type === 'sidepanel.close'
        ) {
          window.close();
        }
      };
      port.onMessage.addListener(closePanel);

      return () => {
        port.onMessage.removeListener(closePanel);
        port.disconnect();
      };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPendingFormAction = async () => {
      const tab = await getActiveTab();
      if (cancelled) return;
      if (tab?.id === undefined) {
        setPendingFormAction(null);
        return;
      }
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'sidepanel.form-action-get-pending',
          tabId: tab.id,
        })) as {
          ok?: boolean;
          pending?: { tabId: number; pendingCount: number } | null;
        };
        if (!cancelled && response?.ok) {
          setPendingFormAction(response.pending || null);
          setFormActionError(null);
        }
      } catch {
        // The side panel can mount before the service worker is ready.
      }
    };

    const onRuntimeMessage = (message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      const candidate = message as {
        type?: unknown;
        tabId?: unknown;
        pendingCount?: unknown;
      };
      if (
        candidate.type === 'sidepanel.form-action-pending' &&
        typeof candidate.tabId === 'number' &&
        typeof candidate.pendingCount === 'number'
      ) {
        void getActiveTab().then((tab) => {
          if (!cancelled && tab?.id === candidate.tabId) {
            setPendingFormAction({
              tabId: candidate.tabId as number,
              pendingCount: candidate.pendingCount as number,
            });
            setFormActionError(null);
          }
        });
      } else if (
        candidate.type === 'sidepanel.form-action-resolved' &&
        typeof candidate.tabId === 'number'
      ) {
        setPendingFormAction((current) =>
          current?.tabId === candidate.tabId ? null : current,
        );
      }
    };

    void loadPendingFormAction();
    chrome.tabs?.onActivated?.addListener(loadPendingFormAction);
    chrome.runtime?.onMessage?.addListener(onRuntimeMessage);
    return () => {
      cancelled = true;
      chrome.tabs?.onActivated?.removeListener(loadPendingFormAction);
      chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
    };
  }, []);

  const {
    loadingButton,
    autofillForm,
    recordApplication,
    canRecordApplication,
    isApplicationRecorded,
  } = useApplicationTools(
    latestInspection,
    latestForm,
    inspectForm,
    setInspectionError,
    applyAutofillResults,
    authStatus?.connected,
    signIn,
  );

  const jobMatch = useJobMatch(latestInspection, authStatus?.connected, signIn);
  const isMatchPending = Boolean(
    authStatus?.connected &&
    latestInspection?.kind === 'job' &&
    !jobMatch.evaluation &&
    !jobMatch.error,
  );

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

  const openGenerationConfirmation = (type: DocType) => {
    setGenerationDraft({
      type,
      jobTitle: tailorStudio.jobTitle || tailorStudio.detectedJob?.title || '',
      company: tailorStudio.company || tailorStudio.detectedJob?.company || '',
      jobDescription:
        tailorStudio.jobDescription ||
        tailorStudio.detectedJob?.jobDescription ||
        '',
    });
  };

  const confirmGeneration = () => {
    if (!generationDraft) return;
    const draft = generationDraft;
    setGenerationDraft(null);
    void tailorStudio.generateTailoredResume(draft.type, draft);
  };

  const generationCoinCost = generationDraft?.type === 'both' ? 18 : 10;
  const activeTailorGeneration =
    tailorStudio.generationTasks[tailorStudio.generationTasks.length - 1] ||
    null;

  useEffect(() => {
    const handleActionMessage = (message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      const candidate = message as {
        type?: unknown;
        docType?: DocType;
        tab?: TabType;
      };
      if (candidate.type === 'sidepanel.open-tab' && candidate.tab) {
        setActiveTab(candidate.tab);
      } else if (
        candidate.type === 'sidepanel.trigger-tailor' &&
        candidate.docType
      ) {
        setActiveTab('home');
        openGenerationConfirmation(candidate.docType);
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleActionMessage);
      return () => {
        chrome.runtime.onMessage.removeListener(handleActionMessage);
      };
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'studio') tailorStudio.markDocumentsSeen();
  }, [activeTab, tailorStudio.markDocumentsSeen]);
  // dependencies. Including them there created a loop: inspect → state update
  // → effect restart → forced inspect, which made the panel and some dynamic
  // pages visibly jump.
  const latestInspectionRef = useRef(latestInspection);
  const latestFormRef = useRef(latestForm);
  useEffect(() => {
    latestInspectionRef.current = latestInspection;
    latestFormRef.current = latestForm;
  }, [latestInspection, latestForm]);

  useEffect(() => {
    refresh();
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
      if (scheduledInspection !== undefined) {
        window.clearTimeout(scheduledInspection);
      }
      scheduledInspection = window.setTimeout(() => {
        scheduledInspection = undefined;
        inspectCurrentPage({ showLoading, force });
      }, PAGE_READY_DELAY_MS);
    };

    inspectCurrentPage({ showLoading: true, force: false });

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
        // Job-board split views can select a different card without changing
        // either the active tab or its URL.
        scheduleInspection(request.showLoading, request.force);
      }
    };

    if (
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
  }, [refresh, refreshAuth, autoInspectActivePage, inspectForm]);

  const [navVisible, setNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const lastTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    setNavVisible(true);
  }, [activeTab]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target;
      let currentY = 0;

      if (target === document || target === window) {
        currentY = window.scrollY || document.documentElement?.scrollTop || 0;
      } else if (target instanceof HTMLElement) {
        currentY = target.scrollTop;
      } else {
        return;
      }

      if (lastTargetRef.current !== target) {
        lastTargetRef.current = target;
        lastScrollYRef.current = currentY;
        return;
      }

      const diff = currentY - lastScrollYRef.current;

      if (currentY <= 10) {
        setNavVisible(true);
      } else if (diff > 6) {
        setNavVisible(false);
      } else if (diff < -6) {
        setNavVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  const finalizePendingFormAction = async (save: boolean) => {
    if (!pendingFormAction || isFinalizingFormAction) return;
    setIsFinalizingFormAction(true);
    setFormActionError(null);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'sidepanel.form-action-finalize',
        tabId: pendingFormAction.tabId,
        save,
      })) as { ok?: boolean; error?: string };
      if (!response?.ok) {
        setFormActionError(
          response?.error || 'Could not update your saved form answers.',
        );
        return;
      }
      setPendingFormAction(null);
    } catch (error) {
      setFormActionError(
        error instanceof Error ?
          error.message
        : 'Could not update your saved form answers.',
      );
    } finally {
      setIsFinalizingFormAction(false);
    }
  };

  return (
    <main className='sidepanel-shell'>
      <header
        className={`sidepanel-header ${
          navVisible ? 'translate-y-0 ' : (
            '-translate-y-full  pointer-events-none'
          )
        }`}
      >
        <div className='sidepanel-brand'>
          <img
            src={
              typeof chrome !== 'undefined' && chrome.runtime?.getURL ?
                chrome.runtime.getURL('favicon.svg')
              : '/favicon.svg'
            }
            className='sidepanel-logo'
            alt='Jobby logo'
          />
          <span className='sidepanel-title'>Jobby</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <HeaderQuickActions
            themeColor={themeColor}
            themeMode={themeMode}
            onToggleThemeColor={toggleThemeColor}
            onToggleThemeMode={toggleThemeMode}
          />
          <AuthCard
            authStatus={authStatus}
            authError={authError}
            onSignIn={signIn}
            onDisconnect={disconnect}
            isSigningIn={isSigningIn}
          />
        </div>
      </header>

      <div className='sidepanel-content'>
        {!authStatus?.connected && (
          <AuthGuardBanner onSignIn={signIn} isSigningIn={isSigningIn} />
        )}

        {activeTab === 'home' && (
          <>
            <section
              id='panel-page'
              className='sidebar-menu panel-section'
              aria-label='Current page'
            >
              <p className='menu-label'>Current Page</p>
              {(() => {
                const isJobPage = latestInspection?.kind === 'job';
                const showNotJobOverlay =
                  !isInspectingPage &&
                  !isJobPage &&
                  (latestInspection !== null || Boolean(inspectionError));

                if (showNotJobOverlay) {
                  return (
                    <PlatformQuickSearchCard
                      activeProfile={jobMatch.activeProfile}
                      onReDetect={handleReDetectPage}
                      isInspecting={isInspectingPage}
                    />
                  );
                }

                return (
                  <>
                    <JobScoreCard
                      latestInspection={latestInspection}
                      latestMatch={jobMatch.evaluation}
                      isMatchLoading={jobMatch.isEvaluating || isMatchPending}
                      isInspecting={isInspectingPage}
                      onTailor={openGenerationConfirmation}
                      activeGeneration={activeTailorGeneration}
                      authConnected={authStatus?.connected}
                      onSignIn={signIn}
                    />
                    <PageClassBanner
                      latestInspection={latestInspection}
                      latestMatch={jobMatch.evaluation}
                      isMatchLoading={jobMatch.isEvaluating || isMatchPending}
                      isInspecting={isInspectingPage}
                      error={jobMatch.error}
                      onRetryMatch={() => void jobMatch.retry()}
                      onClaimSkill={jobMatch.claimSkill}
                      onUnclaimSkill={jobMatch.unclaimSkill}
                      activeProfile={jobMatch.activeProfile}
                      profileSkills={jobMatch.profileSkills}
                      onReDetect={handleReDetectPage}
                      onUpdateJobSnapshot={handleUpdateJobSnapshot}
                      onHighlightJobRequirement={highlightJobRequirement}
                      authConnected={authStatus?.connected}
                      onSignIn={signIn}
                    />
                  </>
                );
              })()}
            </section>

            <section
              id='panel-actions'
              className='sidebar-menu sidebar-menu--actions panel-section'
              aria-label='Application actions'
            >
              <p className='menu-label'>Actions</p>
              <WorkflowSection
                latestForm={latestForm}
                loadingButton={loadingButton}
                isClearingForm={isClearingForm}
                canRecordApplication={canRecordApplication}
                isApplicationRecorded={isApplicationRecorded}
                onAutofill={autofillForm}
                onClearAll={clearAllFormFields}
                onRecordApplication={recordApplication}
                authConnected={authStatus?.connected}
                onSignIn={signIn}
              />
            </section>
          </>
        )}

        {activeTab === 'studio' && (
          <section
            id='panel-studio'
            className='sidebar-menu sidebar-menu--studio panel-section w-full min-w-0 max-w-full overflow-hidden'
            aria-label='Resume & Document Studio'
          >
            <Suspense fallback={null}>
              <TailorStudioCard
                studio={tailorStudio}
                latestInspection={latestInspection}
                managementOnly
                authConnected={authStatus?.connected}
                onSignIn={signIn}
              />
            </Suspense>
          </section>
        )}

        {activeTab === 'form' && (
          <div className='panel-form-area'>
            <div
              className={`sticky-autofill  ${navVisible ? 'top-[44px]' : 'top-0'}`}
              aria-label='Form autofill'
            >
              <WorkflowSection
                latestForm={latestForm}
                loadingButton={loadingButton}
                isClearingForm={isClearingForm}
                onAutofill={autofillForm}
                onClearAll={clearAllFormFields}
                autofillOnly
                authConnected={authStatus?.connected}
                onSignIn={signIn}
              />
            </div>

            <section
              id='panel-fields'
              className='sidebar-menu sidebar-menu--fields panel-section'
              aria-label='Detected form fields'
            >
              <ResultsDisplay
                latestForm={latestForm}
                isInspectingForm={isInspectingForm}
                onFocusField={focusFormField}
                onFillSingleField={autofillSingleField}
                onUploadTailoredResume={uploadTailoredResume}
                onEditField={editFormField}
                uploadStates={uploadStates}
                tailoredResumes={tailorStudio.savedResumes}
                isAutofilling={loadingButton === 'autofill'}
              />
            </section>
          </div>
        )}

        {activeTab === 'tools' && (
          <section
            id='panel-tools'
            className='sidebar-menu sidebar-menu--tools'
            aria-label='Advanced tools'
          >
            <DebugDrawer
              onInspectPage={inspectPage}
              onInspectForm={inspectForm}
            />
            <DiagnosticsCard
              diagnostics={diagnostics}
              errorMessage={errorMessage}
              onClearLogs={clearLogs}
            />
          </section>
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        visible={navVisible}
        hasNewDocuments={tailorStudio.hasNewDocuments}
      />

      {generationDraft && (
        <div
          className='modal-backdrop'
          onClick={() => setGenerationDraft(null)}
        >
          <div
            className='modal-card max-w-[520px] !border-0'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='modal-header !border-0'>
              <span className='modal-badge bg-primary text-primary-foreground'>
                {generationDraft.type === 'both' ?
                  'Resume + Cover Letter'
                : generationDraft.type === 'cover_letter' ?
                  'Generate Cover Letter'
                : 'Tailor Resume'}
              </span>
            </div>
            <div className='modal-body flex flex-col gap-3'>
              <p className='text-[11px] text-muted-foreground'>
                Review or edit the job details before the background task
                starts.
              </p>
              <Input
                value={generationDraft.jobTitle}
                onChange={(event) =>
                  setGenerationDraft({
                    ...generationDraft,
                    jobTitle: event.target.value,
                  })
                }
                placeholder='Job title'
                aria-label='Job title'
                className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
              />
              <Input
                value={generationDraft.company}
                onChange={(event) =>
                  setGenerationDraft({
                    ...generationDraft,
                    company: event.target.value,
                  })
                }
                placeholder='Company'
                aria-label='Company'
                className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
              />
              <Textarea
                value={generationDraft.jobDescription}
                onChange={(event) =>
                  setGenerationDraft({
                    ...generationDraft,
                    jobDescription: event.target.value,
                  })
                }
                placeholder='Job description'
                aria-label='Job description'
                minHeight={176}
                showClearButton={false}
                className='!min-h-44 !rounded-xl !border-0 !bg-muted/50 !p-3 text-xs leading-relaxed focus:!ring-0'
              />
            </div>
            <div className='modal-footer !border-0'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setGenerationDraft(null)}
              >
                Cancel
              </Button>
              <Button
                size='sm'
                Icon={Sparkles}
                className='w-full'
                onClick={confirmGeneration}
                disabled={!generationDraft.jobDescription.trim()}
              >
                Confirm & start · {generationCoinCost}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingFormAction && (
        <div className='modal-backdrop'>
          <div
            className='modal-card max-w-[420px] !border-0'
            role='dialog'
            aria-modal='true'
            aria-labelledby='form-action-title'
          >
            <div className='modal-header !border-0'>
              <div>
                <span className='modal-badge bg-primary text-primary-foreground'>
                  Form answers
                </span>
                <h2
                  id='form-action-title'
                  className='mt-2 text-sm font-semibold text-foreground'
                >
                  Save your form changes?
                </h2>
              </div>
            </div>
            <div className='modal-body flex flex-col gap-3'>
              <p className='text-xs leading-relaxed text-muted-foreground'>
                Your application has continued. Save the{' '}
                {pendingFormAction.pendingCount}{' '}
                {pendingFormAction.pendingCount === 1 ? 'answer' : 'answers'}{' '}
                you entered so Jobby can reuse them next time.
              </p>
              {formActionError && (
                <p className='rounded-xl bg-destructive/10 p-3 text-xs text-destructive'>
                  {formActionError}
                </p>
              )}
            </div>
            <div className='modal-footer !border-0'>
              <Button
                variant='ghost'
                size='sm'
                disabled={isFinalizingFormAction}
                onClick={() => void finalizePendingFormAction(false)}
              >
                Don&apos;t save
              </Button>
              <Button
                size='sm'
                className='w-full'
                disabled={isFinalizingFormAction}
                onClick={() => void finalizePendingFormAction(true)}
              >
                {isFinalizingFormAction ? 'Updating…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </main>
  );
}
