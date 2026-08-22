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
    (
      latestForm?.kind === 'application_form' ||
      latestForm?.kind === 'page_input_fields'
    ) ?
      latestForm
    : null;
  const filledCount = form ? form.fields.filter((f) => f.filled).length : 0;
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
            <div className='review-details-grid flex flex-col gap-2.5'>
              {form ?
                <>
                  <div className='flex items-center justify-between border-b border-primary/50 pb-2'>
                    <span>
                      <strong>Total Fields:</strong> {form.fields.length}
                    </span>
                    <span className='rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary'>
                      {filledCount} / {form.fields.length} Filled
                    </span>
                  </div>

                  {unfilledRequired.length > 0 && (
                    <div className='flex flex-col gap-1.5 p-2 bg-destructive/10 border border-destructive/20 rounded-lg'>
                      <span className='text-[10px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1'>
                        ⚠️ Missing Required Fields ({unfilledRequired.length})
                      </span>
                      <div className='flex flex-wrap gap-1'>
                        {unfilledRequired.map((field, idx) => (
                          <span
                            key={idx}
                            className='inline-flex items-center rounded bg-destructive/15 text-destructive border border-destructive/30 px-1.5 py-0.5 text-[10px] font-semibold'
                          >
                            {field.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className='grid gap-1 mt-1'>
                    <span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
                      Field Details
                    </span>
                    <div className='flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1'>
                      {form.fields.map((field, idx) => {
                        const isMissing = field.required && !field.filled;
                        const badgeClass =
                          field.filled ?
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : isMissing ?
                            'bg-destructive/10 text-destructive border border-destructive/20 font-bold'
                          : 'bg-muted/30 text-muted-foreground border border-primary/40';

                        const statusLabel =
                          field.filled ? 'Filled'
                          : isMissing ? 'Required'
                          : 'Optional';

                        return (
                          <div
                            key={idx}
                            className='flex items-center justify-between text-[11px] py-1 border-b border-primary/30 last:border-b-0'
                          >
                            <span
                              className={`truncate max-w-[220px] ${isMissing ? 'text-destructive font-semibold' : ''}`}
                            >
                              {field.label}
                              {field.required && (
                                <span className='text-destructive'> *</span>
                              )}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] leading-none ${badgeClass}`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
