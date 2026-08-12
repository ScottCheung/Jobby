/** @format */

import { Button } from '@jobby/ui/components/UI/Button';
import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { FormInspection } from '../../shared/contracts/form-inspection';
import type { PageInspection } from '../../shared/contracts/page-inspection';

interface ReviewModalProps {
  isOpen: boolean;
  latestInspection: PageInspection | null;
  latestPlan: ValidatedApplicationPlanResponse | null;
  latestForm: FormInspection | null;
  loadingButton: string | null;
  onClose: () => void;
  onConfirmSubmit: () => void;
}

export function ReviewModal({
  isOpen,
  latestInspection,
  latestPlan,
  latestForm,
  loadingButton,
  onClose,
  onConfirmSubmit,
}: ReviewModalProps) {
  if (!isOpen) return null;

  const job =
    latestInspection?.kind === 'job' ? latestInspection.snapshot : null;
  const form =
    latestForm?.kind === 'application_form' ||
    latestForm?.kind === 'page_input_fields'
      ? latestForm
      : null;
  const filledCount = form ? form.fields.filter((f) => f.filled).length : 0;
  const requiredCount = form ? form.fields.filter((f) => f.required).length : 0;
  const unfilledRequired =
    form ? form.fields.filter((f) => f.required && !f.filled) : [];

  return (
    <div className='modal-backdrop'>
      <div
        className='modal-card'
        role='dialog'
        aria-modal='true'
        aria-labelledby='review-modal-title'
      >
        <div className='modal-header'>
          <div>
            <span className='modal-badge'>Submission Review</span>
            <h2 id='review-modal-title'>Application Review</h2>
          </div>
          <button
            type='button'
            className='close-btn'
            aria-label='Close'
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className='modal-body'>
          <section className='review-section'>
            <h3>Job Details</h3>
            <div className='review-details-grid'>
              {job ?
                <>
                  <p>
                    <strong>Platform:</strong> {job.platform}
                  </p>
                  <p>
                    <strong>Job Title:</strong> {job.title}
                  </p>
                  <p>
                    <strong>Company:</strong> {job.company}
                  </p>
                  <p>
                    <strong>Location:</strong> {job.location || '-'}
                  </p>
                </>
              : <p>No job details available.</p>}
            </div>
          </section>

          <section className='review-section'>
            <h3>Plan & Decision</h3>
            <div className='review-details-grid'>
              {latestPlan ?
                <>
                  <p>
                    <strong>Plan ID:</strong> {latestPlan.application_id}
                  </p>
                  <p>
                    <strong>State:</strong> {latestPlan.plan.state}
                  </p>
                  <p>
                    <strong>Decision:</strong> {latestPlan.plan.decision.action}
                  </p>
                  <p>
                    <strong>Reason:</strong>{' '}
                    {latestPlan.plan.decision.explanation}
                  </p>
                </>
              : <p>No application plan created.</p>}
            </div>
          </section>

          <section className='review-section'>
            <h3>Form Summary</h3>
            <div className='review-details-grid'>
              {form ?
                <>
                  <p>
                    <strong>Total Fields:</strong> {form.fields.length}
                  </p>
                  <p>
                    <strong>Status Summary:</strong>{' '}
                    {`${filledCount} filled / ${requiredCount} required`}
                  </p>
                  {form.fields.slice(0, 15).map((field, idx) => (
                    <p key={idx}>
                      <strong>{field.label}:</strong>{' '}
                      {`${field.type} (${field.required ? 'Required' : 'Optional'}, ${field.filled ? 'Filled' : 'Empty'})`}
                    </p>
                  ))}
                </>
              : <p>No active form fields detected.</p>}
            </div>
          </section>

          {unfilledRequired.length > 0 && (
            <div className='review-warnings'>
              {`Warning: ${unfilledRequired.length} required field(s) remain unfilled. Please review before proceeding with submission.`}
            </div>
          )}
        </div>

        <div className='modal-footer'>
          <Button type='button' onClick={onClose}>
            Back to Edit
          </Button>
          <Button
            type='button'
            isLoading={loadingButton === 'submit'}
            disabled={loadingButton !== null}
            onClick={onConfirmSubmit}
          >
            {loadingButton === 'submit' ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
