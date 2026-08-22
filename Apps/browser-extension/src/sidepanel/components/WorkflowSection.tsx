/** @format */

import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { FormInspection } from '../../shared/contracts/form-inspection';
import type { PageInspection } from '../../shared/contracts/page-inspection';
// Import the component directly. In Vite dev mode, importing the UI package's
// barrel file evaluates every re-export, including web-app-only modules that
// are not available to the extension.
import { Button } from '@jobby/ui/components/UI/Button';

interface WorkflowSectionProps {
  latestInspection: PageInspection | null;
  latestForm: FormInspection | null;
  latestPlan: ValidatedApplicationPlanResponse | null;
  loadingButton: string | null;
  isClearingForm: boolean;
  onAutofill: () => void;
  onClearAll: () => void;
  onAutoApply: () => void;
  onOpenLinkedIn: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  onFillAndNext: () => void;
  onOpenReviewModal: () => void;
  onRecordApplication?: () => void;
  hideAutofill?: boolean;
  autofillOnly?: boolean;
  authConnected?: boolean;
  onSignIn?: () => void;
}

export function WorkflowSection({
  latestInspection,
  latestForm,
  latestPlan,
  loadingButton,
  isClearingForm,
  onAutofill,
  onClearAll,
  onAutoApply,
  onOpenLinkedIn,
  onMovePrevious,
  onMoveNext,
  onFillAndNext,
  onOpenReviewModal,
  onRecordApplication,
  hideAutofill = false,
  autofillOnly = false,
  authConnected = true,
  onSignIn,
}: WorkflowSectionProps) {
  const handleAction = (action: () => void) => {
    if (!authConnected && onSignIn) {
      onSignIn();
      return;
    }
    action();
  };

  const isLinkedInJob =
    latestInspection?.kind === 'job' &&
    latestInspection.snapshot.platform === 'linkedin';
  const isLinkedInForm =
    latestForm?.kind === 'application_form' &&
    latestForm.platform === 'linkedin';
  const appForm = latestForm?.kind === 'application_form' ? latestForm : null;
  const isActionableForm =
    latestForm?.kind === 'application_form' ||
    latestForm?.kind === 'page_input_fields';
  const isFillableForm = isActionableForm;
  const isSubmitStep =
    isActionableForm &&
    (appForm?.action === 'submit' ||
      Boolean(appForm?.hasSubmitAction) ||
      appForm?.action === undefined);
  const isSubmitting = latestPlan?.plan.state === 'submitting';
  const isAlreadyRecorded = latestPlan?.plan.state === 'submitted';
  const planIsTerminal = Boolean(
    latestPlan &&
    ['submitted', 'failed', 'rejected', 'skipped'].includes(
      latestPlan.plan.state,
    ),
  );
  const isJobPage = latestInspection?.kind === 'job';

  // The displayed form state can briefly be stale after LinkedIn removes a
  // modal. Let the content script resolve the live state when Open is clicked;
  // it safely returns "already open" when the modal is actually present.
  const disableOpen =
    (!isJobPage && !isActionableForm) ||
    (isLinkedInJob &&
      !latestInspection.snapshot.easyApply &&
      !isActionableForm);
  // Keep LinkedIn Back available while its step transition settles; the
  // content script performs the final live availability check on click.
  const disablePrevious =
    !isActionableForm ||
    (!appForm?.canGoBack && latestForm?.platform !== 'linkedin');
  const disableNext =
    !isActionableForm ||
    appForm?.action === 'submit' ||
    Boolean(appForm?.hasSubmitAction);
  const disableFillAndNext = !(
    latestPlan?.plan.state === 'preparing' && isActionableForm
  );
  // Reaching the final submit step is the source of truth for whether the
  // page can submit. A manually-debugged flow may not have advanced Jobby's
  // application-plan state yet; the confirmation flow reconciles it.
  const disableSubmit = !isActionableForm || !isSubmitStep || isSubmitting;
  const disableRecord = isAlreadyRecorded || (!isJobPage && !isActionableForm);
  const disableAutofill = loadingButton !== null || isClearingForm;
  const disableAutoApply = planIsTerminal || (!isJobPage && !isLinkedInForm);
  const autofillFields = isFillableForm ? latestForm?.fields || [] : [];
  const requiredAutofillFields = autofillFields.filter(
    (field) => field.required,
  );
  const autofillTotal = requiredAutofillFields.length;
  const autofillCompleted = requiredAutofillFields.filter(
    (field) => field.filled,
  ).length;
  const autofillPercentage =
    autofillTotal ? Math.round((autofillCompleted / autofillTotal) * 100) : 0;

  const autofillAction = (
    <div className='autofill-actions'>
      <Button
        type='button'
        // variant={'secondary'}
        className='w-full'
        disabled={disableAutofill}
        onClick={() => handleAction(onAutofill)}
      >
        {loadingButton === 'autofill' ?
          isFillableForm && autofillTotal > 0 ?
            `Autofilling... ${autofillCompleted}/${autofillTotal} (${autofillPercentage}%)`
          : 'Autofilling...'
        : isFillableForm && autofillTotal > 0 ?
          `Autofill Form ${autofillCompleted}/${autofillTotal} (${autofillPercentage}%)`
        : 'Autofill Form'}
      </Button>
      <Button
        type='button'
        variant={'outline'}
        className='clear-all-btn-compact'
        disabled={!isFillableForm || disableAutofill}
        onClick={onClearAll}
        isLoading={isClearingForm}
      >
        {isClearingForm ? 'Clearing...' : 'Clear All'}
      </Button>
    </div>
  );

  if (autofillOnly) return autofillAction;

  return (
    <div className='workflow-controls'>
      {!hideAutofill && autofillAction}

      <div className='action-group'>
        <p className='action-group-label'>Application Flow</p>
        <button
          type='button'
          className={`hero-button ${loadingButton === 'autoRun' ? 'is-loading' : ''}`}
          disabled={disableAutoApply || loadingButton !== null}
          onClick={() => handleAction(onAutoApply)}
        >
          {loadingButton === 'autoRun' ? 'Applying...' : 'One-Click Auto Apply'}
        </button>
        <div
          className='step-debug-controls'
          aria-label='Application step controls'
        >
          <button
            type='button'
            className={`step-debug-button previous ${loadingButton === 'previous' ? 'is-loading' : ''}`}
            disabled={disablePrevious || loadingButton !== null}
            onClick={onMovePrevious}
          >
            {loadingButton === 'previous' ? 'Backing...' : 'Previous'}
          </button>
          <button
            type='button'
            className={`step-debug-button next ${loadingButton === 'next' ? 'is-loading' : ''}`}
            disabled={disableNext || loadingButton !== null}
            onClick={onMoveNext}
          >
            {loadingButton === 'next' ? 'Loading...' : 'Next'}
          </button>
        </div>
      </div>

      <div className='action-group action-group--secondary'>
        <p className='action-group-label'>Current Application</p>
        <div className='flex flex-col gap-2'>
          <div className='grid grid-cols-3 gap-1.5'>
            <button
              type='button'
              className={`text-[10px] font-bold px-1 py-2 rounded-full bg-panel hover:bg-muted/30 truncate ${
                loadingButton === 'open' ? 'is-loading' : ''
              }`}
              disabled={disableOpen || loadingButton !== null}
              onClick={onOpenLinkedIn}
              title='Open Application'
            >
              {loadingButton === 'open' ? 'Opening...' : 'Open App'}
            </button>

            <button
              type='button'
              className={`text-[10px] font-bold px-1 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 truncate ${
                loadingButton === 'fillAndNext' ? 'is-loading' : ''
              }`}
              disabled={disableFillAndNext || loadingButton !== null}
              onClick={() => handleAction(onFillAndNext)}
              title='Fill & Next'
            >
              {loadingButton === 'fillAndNext' ? 'Filling...' : 'Fill & Next'}
            </button>

            <button
              type='button'
              className={`text-[10px] font-bold px-1 py-2 rounded-full bg-panel hover:bg-muted/30 truncate ${
                loadingButton === 'record' ? 'is-loading' : ''
              }`}
              disabled={disableRecord || loadingButton !== null}
              onClick={() => handleAction(onRecordApplication || (() => {}))}
              title={isAlreadyRecorded ? 'Recorded' : 'Record Application'}
            >
              {loadingButton === 'record' ?
                'Recording...'
              : isAlreadyRecorded ?
                'Recorded'
              : 'Record App'}
            </button>
          </div>

          <button
            type='button'
            className={`w-full min-h-[38px] primary font-bold text-xs uppercase tracking-wider ${
              loadingButton === 'submit' ? 'is-loading' : ''
            }`}
            disabled={disableSubmit || loadingButton !== null}
            onClick={() => handleAction(onOpenReviewModal)}
          >
            Submit Application
          </button>
        </div>
      </div>
    </div>
  );
}
