/** @format */

import { useEffect, useRef, useState } from 'react';
import { AuthCard } from './components/AuthCard';
import { DebugDrawer } from './components/DebugDrawer';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { PageClassBanner } from './components/PageClassBanner';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ReviewModal } from './components/ReviewModal';
import { StatusBanner } from './components/StatusBanner';
import { WorkflowSection } from './components/WorkflowSection';
import { useApplicationPlan } from './hooks/useApplicationPlan';
import { useAuth } from './hooks/useAuth';
import { useDiagnostics } from './hooks/useDiagnostics';
import { useInspection } from './hooks/useInspection';
import { getActiveTab } from './services/messaging';

const PAGE_READY_DELAY_MS = 150;
const LINKEDIN_CARD_RECOVERY_MS = 10_000;

export function App() {
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const { diagnostics, errorMessage, refresh, clearLogs } = useDiagnostics();
  const { authStatus, authError, refreshAuth, signIn, disconnect } = useAuth();
  const {
    latestInspection,
    latestForm,
    inspectionError,
    isInspectingPage,
    isInspectingForm,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    focusFormField,
    uploadDefaultResume,
    editFormField,
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
      void autoInspectActivePage(true, showLoading).then((isJobPage) => {
        if (isJobPage) void inspectForm();
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

    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

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
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
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
        <div>
          <p className='sidepanel-eyebrow'>JOBBY</p>
          <h1>Application assistant</h1>
        </div>
        <AuthCard
          authStatus={authStatus}
          authError={authError}
          onSignIn={signIn}
          onDisconnect={disconnect}
        />
      </header>

      <div className='sidepanel-content'>
        <section className='sidebar-menu' aria-label='Current page'>
          <p className='menu-label'>当前页面</p>
          <PageClassBanner
            latestInspection={latestInspection}
            isInspecting={isInspectingPage}
            error={inspectionError}
          />
        </section>

        <section className='sidebar-menu sidebar-menu--fields' aria-label='Detected form fields'>
          <p className='menu-label'>表单字段</p>
          <ResultsDisplay
            latestForm={latestForm}
            isInspectingForm={isInspectingForm}
            onFocusField={focusFormField}
            onUploadDefaultResume={uploadDefaultResume}
            onEditField={editFormField}
            uploadStates={uploadStates}
          />
        </section>

        <section className='sidebar-menu' aria-label='Application actions'>
          <p className='menu-label'>操作</p>
          <StatusBanner status={status} />
          <WorkflowSection
            latestInspection={latestInspection}
            latestForm={latestForm}
            latestPlan={latestPlan}
            loadingButton={loadingButton}
            onAutofill={autofillForm}
            onAutoApply={autoRunLinkedIn}
            onOpenLinkedIn={openLinkedIn}
            onMovePrevious={movePrevious}
            onMoveNext={moveNext}
            onFillAndNext={fillAndNext}
            onOpenReviewModal={() => setIsReviewOpen(true)}
          />
        </section>

        <section className='sidebar-menu sidebar-menu--tools' aria-label='Advanced tools'>
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
