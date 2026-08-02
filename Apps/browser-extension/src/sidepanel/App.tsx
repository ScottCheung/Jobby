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

export function App() {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const linkedInJobProbeTick = useRef(0);
  // How many consecutive polling cycles returned a non-job result for a
  // LinkedIn URL. Capped at MAX_LI_MISS to stop hammering the page when the
  // job card hasn't rendered yet and avoids the visible flash loop.
  const linkedInMissCount = useRef(0);
  const MAX_LI_MISS = 8;

  const { diagnostics, errorMessage, refresh, clearLogs } = useDiagnostics();
  const { authStatus, authError, refreshAuth, signIn, disconnect } = useAuth();
  const {
    latestInspection,
    latestForm,
    isInspectingPage,
    isInspectingForm,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    focusFormField,
    uploadDefaultResume,
    editFormField,
  } = useInspection();

  const {
    latestPlan,
    status,
    fillResults,
    unansweredFields,
    loadingButton,
    createPlan,
    applyPlanAction,
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

  // Inspection results are intentionally kept out of the polling effect's
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
    void autoInspectActivePage(true).then(() => inspectForm());

    const interval = setInterval(() => {
      refresh();
      // LinkedIn often paints its job content after the extension side panel
      // has mounted. Retry only until a job is identified; afterwards this
      // stays idle unless the tab or URL changes. Its job-list view can swap
      // cards without updating the browser tab URL, so lightly recheck that
      // page every two seconds while no application modal is open.
      const currentInspection = latestInspectionRef.current;
      const currentForm = latestFormRef.current;
      const inspectionUrl =
        currentInspection?.kind === "job" ?
          currentInspection.snapshot.url
        : currentInspection?.url || "";
      const isSupportedJobHost = /(?:^|\.)(?:linkedin\.com|seek\.com(?:\.au)?)(?:\/|$)/i.test(
        inspectionUrl.replace(/^https?:\/\//i, ""),
      );

      // Unsupported websites get their initial generic form inspection, then
      // rely on the scoped content observer. Re-reading them every second was
      // needless and caused visible flicker on some dynamic sites.
      //
      // For LinkedIn / Seek: retry only while we have never seen a job on
      // this URL (null inspection or first N misses). Once we have a stable
      // non-job result stop forcing — wait for a URL change instead.
      const hasNeverInspected = currentInspection === null;
      const isNonJobOnSupportedHost =
        isSupportedJobHost && currentInspection !== null && currentInspection.kind !== "job";

      if (isNonJobOnSupportedHost) {
        linkedInMissCount.current += 1;
      } else if (currentInspection?.kind === "job") {
        linkedInMissCount.current = 0;
      }

      // Allow retries on supported hosts only for the first MAX_LI_MISS ticks
      // after a URL change. After that, stop forcing and rely on URL-change
      // detection in autoInspectActivePage (force=false path).
      const needsInitialJobRead =
        hasNeverInspected ||
        (isNonJobOnSupportedHost && linkedInMissCount.current <= MAX_LI_MISS);

      const isLinkedInJobPage =
        currentInspection?.kind === "job" &&
        currentInspection.snapshot.platform === "linkedin";
      const shouldProbeLinkedInCard =
        isLinkedInJobPage &&
        currentForm?.kind !== "application_form" &&
        (linkedInJobProbeTick.current = (linkedInJobProbeTick.current + 1) % 2) === 0;
      void autoInspectActivePage(needsInitialJobRead || shouldProbeLinkedInCard).then((pageChanged) => {
        if (pageChanged) {
          linkedInMissCount.current = 0;
          void inspectForm();
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [refresh, refreshAuth, autoInspectActivePage, inspectForm]);

  const handleConfirmSubmit = async () => {
    setIsReviewOpen(false);
    await submitApplication();
  };

  return (
    <main className='panel hidden'>
      {/* Page-type classifier debug banner — always shown first */}
      <PageClassBanner
        latestInspection={latestInspection}
        isInspecting={isInspectingPage}
      />

      {/* <Header phase={snapshot.phase} /> */}

      <AuthCard
        authStatus={authStatus}
        authError={authError}
        onSignIn={signIn}
        onDisconnect={disconnect}
      />

      <ResultsDisplay
        latestInspection={latestInspection}
        latestPlan={latestPlan}
        latestForm={latestForm}
        isInspectingPage={isInspectingPage}
        isInspectingForm={isInspectingForm}
        fillResults={fillResults}
        unansweredFields={unansweredFields}
        onFocusField={focusFormField}
        onUploadDefaultResume={uploadDefaultResume}
        onEditField={editFormField}
      />

      <section className='inspection' aria-label='Current page inspection'>
        <div className='section-heading'>
          <h2>Application Workflow (投递控制)</h2>
        </div>

        <StatusBanner status={status} />

        <WorkflowSection
          latestInspection={latestInspection}
          latestForm={latestForm}
          latestPlan={latestPlan}
          loadingButton={loadingButton}
          onAutoApply={autoRunLinkedIn}
          onOpenLinkedIn={openLinkedIn}
          onMovePrevious={movePrevious}
          onMoveNext={moveNext}
          onFillAndNext={fillAndNext}
          onOpenReviewModal={() => setIsReviewOpen(true)}
        />

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
      </section>

      <DiagnosticsCard
        diagnostics={diagnostics}
        errorMessage={errorMessage}
        onClearLogs={clearLogs}
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
