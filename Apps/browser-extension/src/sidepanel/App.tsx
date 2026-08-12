/** @format */

import { useEffect, useRef, useState } from 'react';
import { AuthCard } from './components/AuthCard';
import { DebugDrawer } from './components/DebugDrawer';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { JobScoreCard } from './components/JobScoreCard';
import { PageClassBanner } from './components/PageClassBanner';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ReviewModal } from './components/ReviewModal';
import { StatusBanner } from './components/StatusBanner';
import { WorkflowSection } from './components/WorkflowSection';
import { useApplicationPlan } from './hooks/useApplicationPlan';
import { useAuth } from './hooks/useAuth';
import { useDiagnostics } from './hooks/useDiagnostics';
import { useInspection } from './hooks/useInspection';
import { useThemeSync } from './hooks/useThemeSync';
import { getActiveTab } from './services/messaging';

const PAGE_READY_DELAY_MS = 150;
const LINKEDIN_CARD_RECOVERY_MS = 10_000;

export function App() {
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const { diagnostics, errorMessage, refresh, clearLogs } = useDiagnostics();
  const { authStatus, authError, refreshAuth, signIn, disconnect } = useAuth();
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

  const {
    latestPlan,
    status,
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

  const handleConfirmSubmit = async () => {
    setIsReviewOpen(false);
    await submitApplication();
  };

  return (
    <main className='sidepanel-shell'>
      <header className='sidepanel-header'>
        <div className='sidepanel-brand'>
          <img
            src='./favicon.svg'
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
        />
      </header>

      <nav className='panel-nav' aria-label='Side panel sections'>
        <button
          type='button'
          onClick={() =>
            document
              .getElementById('panel-page')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          Recognize
        </button>
        <button
          type='button'
          onClick={() =>
            document
              .getElementById('panel-actions')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          Autofill
        </button>
        <button
          type='button'
          onClick={() =>
            document
              .getElementById('panel-fields')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          Form
        </button>
        <button
          type='button'
          onClick={() =>
            document
              .getElementById('panel-tools')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          Tools
        </button>
      </nav>

      <div className='sidepanel-content'>
        <section
          id='panel-page'
          className='sidebar-menu panel-section'
          aria-label='Current page'
        >
          <p className='menu-label'>Current Page</p>
          <JobScoreCard
            latestInspection={latestInspection}
            latestPlan={latestPlan}
          />
          <PageClassBanner
            latestInspection={latestInspection}
            latestPlan={latestPlan}
            isInspecting={isInspectingPage}
            error={inspectionError}
          />
        </section>

        <section
          id='panel-actions'
          className='sidebar-menu sidebar-menu--actions panel-section'
          aria-label='Application actions'
        >
          <p className='menu-label'>Actions</p>
          <StatusBanner status={status} />
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
      </div>

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
