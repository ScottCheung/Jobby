/** @format */

import { Button } from '@jobby/ui/components/UI/Button';

import type { FormInspection } from '../../shared/contracts/form-inspection';

interface WorkflowSectionProps {
  latestForm: FormInspection | null;
  loadingButton: string | null;
  isClearingForm: boolean;
  canRecordApplication?: boolean;
  isApplicationRecorded?: boolean;
  onAutofill: () => void;
  onCancelAutofill: () => void;
  isCancellingAutofill?: boolean;
  onClearAll: () => void;
  onRecordApplication?: () => void;
  autofillOnly?: boolean;
  authConnected?: boolean;
  onSignIn?: () => void;
}

export function WorkflowSection({
  latestForm,
  loadingButton,
  isClearingForm,
  canRecordApplication = false,
  isApplicationRecorded = false,
  onAutofill,
  onCancelAutofill,
  isCancellingAutofill = false,
  onClearAll,
  onRecordApplication,
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

  const isFillableForm =
    latestForm?.kind === 'application_form' ||
    latestForm?.kind === 'page_input_fields';
  const fields = isFillableForm ? latestForm.fields : [];
  const completed = fields.filter((field) => field.filled).length;
  const total = fields.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const autofillDisabled = loadingButton !== null || isClearingForm;

  const autofillActions = (
    <div className='autofill-actions'>
      <Button
        type='button'
        size='md'
        className='flex-1'
        disabled={isClearingForm || (loadingButton !== null && loadingButton !== 'autofill') || isCancellingAutofill}
        onClick={() => loadingButton === 'autofill' ? onCancelAutofill() : handleAction(onAutofill)}
      >
        {loadingButton === 'autofill' ?
          isCancellingAutofill ? 'Cancelling...'
          : total > 0 ?
            `Cancel Autofill · ${completed}/${total} (${percentage}%)`
          : 'Cancel Autofill'
        : total > 0 ?
          `Autofill Form ${completed}/${total} (${percentage}%)`
        : 'Autofill Form'}
      </Button>
      <Button
        type='button'
        size='md'
        variant='custom'
        className='clear-all-btn-compact'
        disabled={!isFillableForm || autofillDisabled}
        onClick={onClearAll}
        isLoading={isClearingForm}
      >
        {isClearingForm ? 'Clearing...' : 'Clear All'}
      </Button>
    </div>
  );

  if (autofillOnly) return autofillActions;

  return (
    <div className='workflow-controls'>
      <div className='action-group action-group--secondary'>
        <p className='action-group-label'>Application</p>
        <Button
          type='button'
          size='md'
          className='w-full'
          disabled={
            !canRecordApplication ||
            isApplicationRecorded ||
            loadingButton !== null
          }
          onClick={() => handleAction(onRecordApplication || (() => {}))}
          isLoading={loadingButton === 'record'}
        >
          {isApplicationRecorded ? 'Application Recorded' : 'Record as Applied'}
        </Button>
        <p className='mt-2 text-[10px] leading-relaxed text-muted-foreground'>
          Record only after you have submitted the application.
        </p>
      </div>
    </div>
  );
}
