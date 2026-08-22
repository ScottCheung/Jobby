/** @format */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Coins, Sparkles, X } from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { Input } from '@jobby/ui/components/UI/input';
import { Textarea } from '@jobby/ui/components/UI/textarea';
import type { DocType } from '../shared/contracts/tailored-resume';
import { AuthCard } from './components/AuthCard';
import { AuthGuardBanner } from './components/AuthGuardBanner';
import { BottomNav, type TabType } from './components/BottomNav';
import { DebugDrawer } from './components/DebugDrawer';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { HeaderQuickActions } from './components/HeaderQuickActions';
import { JobScoreCard } from './components/JobScoreCard';
import { PageClassBanner } from './components/PageClassBanner';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ReviewModal } from './components/ReviewModal';
import { WorkflowSection } from './components/WorkflowSection';
import { useApplicationPlan } from './hooks/useApplicationPlan';
import { useAuth } from './hooks/useAuth';
import { useDiagnostics } from './hooks/useDiagnostics';
import { useInspection } from './hooks/useInspection';
import { useTailoredResumeStudio } from './hooks/useTailoredResumeStudio';
import { useThemeSync } from './hooks/useThemeSync';
import { getActiveTab } from './services/messaging';
import { IPEmotion } from '@jobby/ui/components/UI/IPEmotion';
import { Toaster } from '@jobby/ui/components/UI/toast/toaster';
import { cn } from '@jobby/ui/lib/utils';

const PAGE_READY_DELAY_MS = 150;
const TailorStudioCard = lazy(() =>
  import('./components/TailorStudioCard').then((module) => ({
    default: module.TailorStudioCard,
  })),
);

export function App() {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [generationDraft, setGenerationDraft] = useState<{
    type: DocType;
    jobTitle: string;
    company: string;
    jobDescription: string;
  } | null>(null);

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

  const {
    latestPlan,
    planError,
    retryPlan,
    loadingButton,
    createPlan,
    applyPlanAction,
    autofillForm,
    fillAndNext,
    openLinkedIn,
    moveNext,
    movePrevious,
    submitApplication,
    recordApplication,
    autoRunLinkedIn,
    activeProfile,
    claimSkill,
    unclaimSkill,
  } = useApplicationPlan(
    latestInspection,
    latestForm,
    inspectPage,
    inspectForm,
    setInspectionError,
    applyAutofillResults,
    authStatus?.connected,
    signIn,
  );

  const handleReDetectPage = async () => {
    await inspectPage();
    void inspectForm(true);
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
    const inspectCurrentPage = (showLoading: boolean) => {
      void autoInspectActivePage(false, showLoading).then((isJob) => {
        if (isJob) {
          void inspectForm(true);
        }
      });
    };
    let scheduledInspection: number | undefined;
    const scheduleInspection = (showLoading: boolean) => {
      if (scheduledInspection !== undefined) {
        window.clearTimeout(scheduledInspection);
      }
      scheduledInspection = window.setTimeout(() => {
        scheduledInspection = undefined;
        inspectCurrentPage(showLoading);
      }, PAGE_READY_DELAY_MS);
    };

    inspectCurrentPage(true);

    const onTabActivated = () => scheduleInspection(true);
    const onTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      if (!changeInfo.url && changeInfo.status !== 'complete') return;
      void getActiveTab().then((tab) => {
        if (tab?.id === tabId) scheduleInspection(true);
      });
    };

    const onRuntimeMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === 'content.page-changed'
      ) {
        scheduleInspection(false);
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

  const handleConfirmSubmit = async () => {
    setIsReviewOpen(false);
    await submitApplication();
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
          <div className='px-4 pt-3 pb-1'>
            <AuthGuardBanner onSignIn={signIn} isSigningIn={isSigningIn} />
          </div>
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
                    <div className='relative rounded-2xl overflow-hidden min-h-[340px] flex flex-col gap-2 transition-all duration-200  p-1 bg-primary/30'>
                      {/* Overlay Mask */}
                      <div className='absolute inset-0 z-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md p-4 rounded-2xl '>
                        <div className='bg-background-50  w-full h-full justify-center items-center flex flex-col'>
                          <IPEmotion
                            emotionId={1}
                            className={cn('w-40 h-40 mx-auto -mt-10 ')}
                          />

                          <p
                            className={cn(
                              'text-xs mt-60 font-bold text-foreground max-w-[400px] uppercase tracking-wider',
                            )}
                          >
                            Insufficient Content
                          </p>

                          <p
                            className={cn(
                              'text-[11px] mt-3 leading-relaxed text-muted-foreground max-w-[220px]',
                            )}
                          >
                            Unable to extract job info
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    <JobScoreCard
                      latestInspection={latestInspection}
                      latestPlan={latestPlan}
                      isInspecting={isInspectingPage}
                      onTailor={openGenerationConfirmation}
                      authConnected={authStatus?.connected}
                      onSignIn={signIn}
                    />
                    <PageClassBanner
                      latestInspection={latestInspection}
                      latestPlan={latestPlan}
                      isInspecting={isInspectingPage}
                      error={planError}
                      onRetryPlan={retryPlan}
                      onClaimSkill={claimSkill}
                      onUnclaimSkill={unclaimSkill}
                      activeProfile={activeProfile}
                      onReDetect={handleReDetectPage}
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
                latestInspection={latestInspection}
                latestForm={latestForm}
                latestPlan={latestPlan}
                loadingButton={loadingButton}
                isClearingForm={isClearingForm}
                onAutofill={autofillForm}
                onClearAll={clearAllFormFields}
                onAutoApply={autoRunLinkedIn}
                onOpenLinkedIn={openLinkedIn}
                onMovePrevious={movePrevious}
                onMoveNext={moveNext}
                onFillAndNext={fillAndNext}
                onOpenReviewModal={() => setIsReviewOpen(true)}
                onRecordApplication={recordApplication}
                hideAutofill
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
              className={`sticky-autofill ${
                navVisible ? 'top-[44px]' : 'top-0'
              }`}
              aria-label='Form autofill'
            >
              <WorkflowSection
                latestInspection={latestInspection}
                latestForm={latestForm}
                latestPlan={latestPlan}
                loadingButton={loadingButton}
                isClearingForm={isClearingForm}
                onAutofill={autofillForm}
                onClearAll={clearAllFormFields}
                onAutoApply={autoRunLinkedIn}
                onOpenLinkedIn={openLinkedIn}
                onMovePrevious={movePrevious}
                onMoveNext={moveNext}
                onFillAndNext={fillAndNext}
                onOpenReviewModal={() => setIsReviewOpen(true)}
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
              latestInspection={latestInspection}
              latestForm={latestForm}
              latestPlan={latestPlan}
              loadingButton={loadingButton}
              onInspectPage={inspectPage}
              onInspectForm={inspectForm}
              onCreatePlan={createPlan}
              onApplyPlanAction={applyPlanAction}
              onMoveNext={moveNext}
              onMovePrevious={movePrevious}
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

      <ReviewModal
        isOpen={isReviewOpen}
        latestInspection={latestInspection}
        latestPlan={latestPlan}
        latestForm={latestForm}
        loadingButton={loadingButton}
        onClose={() => setIsReviewOpen(false)}
        onConfirmSubmit={handleConfirmSubmit}
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

      <Toaster />
    </main>
  );
}
