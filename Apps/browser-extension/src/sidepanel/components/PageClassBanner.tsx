/** @format */

import { useState } from 'react';
import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import { parseAndFormatJobDate } from '../../shared/utils/date-formatter';

interface PageClassBannerProps {
  latestInspection: PageInspection | null;
  latestPlan?: ValidatedApplicationPlanResponse | null;
  isInspecting: boolean;
  error?: string;
}

/**
 * Diagnostic & details banner shown at the top of the side panel.
 * Displays all extracted details for identified job listing pages in English.
 */
export function PageClassBanner({
  latestInspection,
  latestPlan,
  isInspecting,
  error,
}: PageClassBannerProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  if (isInspecting) {
    return (
      <div
        className='page-class-banner page-class-banner--checking'
        role='status'
        aria-live='polite'
      >
        <span className='page-class-banner__icon'>⟳</span>
        <span className='page-class-banner__label'>
          Inspecting page type...
        </span>
      </div>
    );
  }

  if (!latestInspection) {
    if (error) {
      return (
        <div
          className='page-class-banner page-class-banner--error'
          role='alert'
        >
          <span className='page-class-banner__icon'>!</span>
          <span className='page-class-banner__label'>
            <strong>Page Inspection Failed</strong>
            <span className='page-class-banner__sub'>{error}</span>
          </span>
        </div>
      );
    }
    return (
      <div className='page-class-banner page-class-banner--idle' role='status'>
        <span className='page-class-banner__icon'>○</span>
        <span className='page-class-banner__label'>Awaiting inspection...</span>
      </div>
    );
  }

  if (latestInspection.kind === 'job') {
    const {
      platform,
      title,
      company,
      location,
      datePosted,
      description,
      technologies,
      easyApply,
      externalId,
    } = latestInspection.snapshot;

    const matchedTerms = latestPlan?.plan?.decision?.matched_terms || [];
    const matchedSet = new Set(matchedTerms.map((t) => t.toLowerCase()));

    return (
      <div
        className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5'
        role='status'
      >
        <div className='flex items-center justify-between gap-2 border-b border-primary/20 pb-2'>
          <div className='flex items-center gap-1.5'>
            <span className='page-class-banner__icon text-primary font-bold'>
              ✓
            </span>
            <strong className='text-xs font-bold text-foreground'>
              Job Page Identified
            </strong>
          </div>
          <span className='rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary capitalize'>
            {platform}
          </span>
        </div>

        {/* Full Identified Information */}
        <div className='grid gap-1.5 text-xs text-foreground/90'>
          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Job Title:
            </span>
            <span className='font-semibold text-foreground'>{title}</span>
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Company:
            </span>
            <span className='font-semibold text-foreground'>{company}</span>
          </div>

          {location && (
            <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
              <span className='text-muted-foreground text-[11px] font-medium'>
                Location:
              </span>
              <span>{location}</span>
            </div>
          )}

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Posted:
            </span>
            {datePosted ?
              (() => {
                const formatted = parseAndFormatJobDate(datePosted);
                return (
                  <div className='flex items-center gap-1.5 flex-wrap'>
                    <span>{formatted.displayText}</span>
                    {formatted.isNotFresh && (
                      <span className='inline-flex items-center rounded-md bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 px-1.5 py-0.5 text-[10px] font-semibold leading-none'>
                        Not Fresh
                      </span>
                    )}
                  </div>
                );
              })()
            : <span className='text-muted-foreground/70 italic text-[11px]'>
                Unknown
              </span>
            }
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Easy Apply:
            </span>
            <div>
              <div
                className={
                  easyApply ?
                    'font-semibold text-success border border-success inline-flex items-center justify-center rounded-full px-1 '
                  : 'text-muted-foreground text-xs'
                }
              >
                {easyApply ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              External ID:
            </span>
            <span className='font-mono text-[11px] text-muted-foreground truncate'>
              {externalId}
            </span>
          </div>

          {technologies && technologies.length > 0 && (
            <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-start'>
              <span className='text-muted-foreground text-[11px] font-medium pt-0.5'>
                Technologies:
              </span>
              <div className='flex flex-wrap gap-1'>
                {technologies.map((tech) => {
                  const techLower = tech.toLowerCase();
                  const isMatched =
                    matchedSet.has(techLower) ||
                    techLower
                      .split(/[\s/\-+.]+/)
                      .some((token) => token && matchedSet.has(token));

                  return (
                    <span
                      key={tech}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-0.5 border ${
                        isMatched ?
                          'bg-success/15 text-success border-success/30'
                        : 'bg-success/15 text-warning border-warning/30'
                      }`}
                    >
                      {tech}
                      {isMatched ? ' ✓ ' : ' ! '}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {description && (
            <div className='mt-1 pt-2 border-t border-border/60 grid gap-1'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-[11px] font-semibold uppercase tracking-wider'>
                  Job Description
                </span>
                <button
                  type='button'
                  className='text-[11px] font-medium text-primary hover:underline cursor-pointer bg-transparent border-0 p-0'
                  onClick={() => setIsDescExpanded((prev) => !prev)}
                >
                  {isDescExpanded ? 'Show Less ▲' : 'Show More ▼'}
                </button>
              </div>
              <div
                className={`text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap ${
                  isDescExpanded ? '' : 'job-desc-collapsed'
                }`}
              >
                {description}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // not_job_page or unsupported_page
  const reason =
    (
      latestInspection.kind === 'not_job_page' ||
      latestInspection.kind === 'unsupported_page'
    ) ?
      latestInspection.reason
    : 'Unknown reason';

  const isClassifierRejection =
    reason.includes('没有任何求职信号') || reason.includes('置信度不足');

  return (
    <details
      className={`page-class-banner page-class-banner--no-job${isClassifierRejection ? ' page-class-banner--skip' : ''}`}
    >
      <summary className='page-class-banner__summary' role='status'>
        <span className='page-class-banner__icon'>
          {isClassifierRejection ? '✗' : '!'}
        </span>
        <span className='page-class-banner__label'>
          {isClassifierRejection ?
            <>
              <strong>Non-Job Page</strong>
              <span className='page-class-banner__sub'>Parsing skipped</span>
            </>
          : <>
              <strong>Insufficient Content</strong>
              <span className='page-class-banner__sub'>
                Unable to extract job info
              </span>
            </>
          }
        </span>
        <span className='page-class-banner__expand-hint'>▾ Show Reason</span>
      </summary>
      <p className='page-class-banner__reason'>{reason}</p>
    </details>
  );
}
