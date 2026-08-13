/** @format */

import { useEffect, useRef, useState } from 'react';
import { AuthCard } from './components/AuthCard';
import { BottomNav, type TabType } from './components/BottomNav';
import { DebugDrawer } from './components/DebugDrawer';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { JobScoreCard } from './components/JobScoreCard';
import { PageClassBanner } from './components/PageClassBanner';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ReviewModal } from './components/ReviewModal';
import { WorkflowSection } from './components/WorkflowSection';
import { useApplicationPlan } from './hooks/useApplicationPlan';
import { useAuth } from './hooks/useAuth';
import { useDiagnostics } from './hooks/useDiagnostics';
import { useInspection } from './hooks/useInspection';
import { useThemeSync } from './hooks/useThemeSync';
import { EmptyPlaceHolder } from '@jobby/ui/components/UI/EmptyPlaceHolder';
import { getActiveTab } from './services/messaging';

const PAGE_READY_DELAY_MS = 150;
const LINKEDIN_CARD_RECOVERY_MS = 10_000;

export function App() {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');

  const { diagnostics, errorMessage, refresh, clearLogs } = useDiagnostics();
  const {
    authStatus,
    authError,
    refreshAuth,
    signIn,
    disconnect,
    isSigningIn,
  } = useAuth();
  useThemeSync(authStatus);
  const {
    latestInspection,
    latestForm,
    inspectionError,
    isInspectingPage,
    isInspectingForm,
    isClearingForm,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    focusFormField,
    autofillSingleField,
    uploadDefaultResume,
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

      return () => {
        port.disconnect();
      };
    }
  }, []);

  const {
    latestPlan,
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
  } = useApplicationPlan(
    latestInspection,
    latestForm,
    inspectPage,
    inspectForm,
  );

  // Inspection results are intentionally kept out of the event effect's
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
      void autoInspectActivePage(true, showLoading).then(() => {
        void inspectForm(true);
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

    if (
      typeof chrome !== 'undefined' &&
      chrome.tabs?.onActivated &&
      chrome.tabs?.onUpdated
    ) {
      chrome.tabs.onActivated.addListener(onTabActivated);
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    }

    // LinkedIn can replace the selected job card without changing its URL.
    // Keep one quiet, low-frequency recovery read for that special case.
    const linkedInRecovery = window.setInterval(() => {
      const inspection = latestInspectionRef.current;
      const form = latestFormRef.current;
      if (inspection === null) {
        inspectCurrentPage(false);
        return;
      }
      if (
        inspection.kind === 'job' &&
        inspection.snapshot.platform === 'linkedin' &&
        form?.kind !== 'application_form'
      ) {
        inspectCurrentPage(false);
      }
    }, LINKEDIN_CARD_RECOVERY_MS);

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
      window.clearInterval(linkedInRecovery);
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
        <AuthCard
          authStatus={authStatus}
          authError={authError}
          onSignIn={signIn}
          onDisconnect={disconnect}
          isSigningIn={isSigningIn}
        />
      </header>

      <div className='sidepanel-content'>
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
                    <div className='relative rounded-2xl overflow-hidden min-h-[340px] flex flex-col gap-2 transition-all duration-200 border border-border/40 p-1 bg-panel/30'>
                      {/* Underlying baseline skeleton to keep height completely unchanged */}
                      <div className='opacity-20 pointer-events-none filter blur-[2px] select-none flex flex-col gap-2'>
                        <JobScoreCard
                          latestInspection={null}
                          latestPlan={null}
                          isInspecting={true}
                        />
                        <PageClassBanner
                          latestInspection={null}
                          latestPlan={null}
                          isInspecting={true}
                        />
                      </div>

                      {/* Overlay Mask */}
                      <div className='absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-xs'>
                        <EmptyPlaceHolder
                          title='Insufficient Content'
                          description='Unable to extract job info'
                          IP={1}
                          className='border-0 bg-transparent p-0 shadow-none'
                          messageClassName='!mt-20 !text-xs font-bold uppercase tracking-wider text-foreground'
                          descriptionClassName='!text-[11px] text-muted-foreground max-w-[240px] text-center'
                        />
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
                    />
                    <PageClassBanner
                      latestInspection={latestInspection}
                      latestPlan={latestPlan}
                      isInspecting={isInspectingPage}
                      error={inspectionError}
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
              />
            </section>
          </>
        )}

        {activeTab === 'form' && (
          <div className='panel-form-area'>
            <div className='sticky-autofill' aria-label='Form autofill'>
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
                onUploadDefaultResume={uploadDefaultResume}
                onEditField={editFormField}
                uploadStates={uploadStates}
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
    </main>
  );
}
