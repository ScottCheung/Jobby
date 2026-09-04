/** @format */

import { JobMatchSummary } from '../JobMatchSummary';
import { Check, Eye, FileText, Layers, Loader2, Sparkles } from '@jobby/ui/components/icons';
import { parseAndFormatJobDate } from '../../../lib/date-formatter';
import { cn } from '../../../lib/utils';
import type {
  JobAnalysisDocType,
  JobAnalysisEvaluation,
  JobAnalysisGeneration,
  JobAnalysisInspection,
} from './types';

export interface JobScoreCardProps {
  latestInspection: JobAnalysisInspection | null;
  latestMatch: JobAnalysisEvaluation | null;
  isMatchLoading?: boolean;
  isInspecting?: boolean;
  onTailor?: (type: JobAnalysisDocType) => void;
  onPreview?: (type: 'resume' | 'cover_letter') => void;
  existingDocuments?: {
    resume?: boolean;
    cover_letter?: boolean;
  };
  activeGeneration?: JobAnalysisGeneration | null;
  authConnected?: boolean;
  onSignIn?: () => void;
  onRecordApplication?: () => void;
  canRecordApplication?: boolean;
  isApplicationRecorded?: boolean;
  isRecordingApplication?: boolean;
  className?: string;
}

export function jobMatchLabel(
  authConnected: boolean,
  isMatchLoading: boolean,
  percentage: number | null,
): string {
  if (!authConnected) return 'Sign In for Match Score';
  if (isMatchLoading) return 'Calculating Score...';
  if (percentage === null) return 'Score unavailable';
  if (percentage >= 70) return 'Highly Recommended';
  if (percentage >= 45) return 'Recommended';
  return 'Not Recommended';
}

export function JobScoreCard({
  latestInspection,
  latestMatch,
  isMatchLoading = false,
  isInspecting: _isInspecting = false,
  onTailor,
  onPreview,
  existingDocuments,
  activeGeneration = null,
  authConnected = true,
  onSignIn,
  onRecordApplication,
  canRecordApplication = false,
  isApplicationRecorded = false,
  isRecordingApplication = false,
  className,
}: JobScoreCardProps) {
  const isJob = latestInspection?.kind === 'job';
  const snapshot = isJob ? latestInspection.snapshot : null;

  const isCurrentJob = Boolean(
    activeGeneration &&
      snapshot &&
      ((activeGeneration.jobTitle &&
        snapshot.title &&
        activeGeneration.jobTitle.trim().toLowerCase() ===
          snapshot.title.trim().toLowerCase() &&
        (!activeGeneration.company ||
          !snapshot.company ||
          activeGeneration.company.trim().toLowerCase() ===
            snapshot.company.trim().toLowerCase())) ||
        (!snapshot.title && !activeGeneration.jobTitle)),
  );

  const resumeGenerating =
    isCurrentJob && activeGeneration?.docType === 'resume';
  const coverLetterGenerating =
    isCurrentJob && activeGeneration?.docType === 'cover_letter';
  const bothGenerating = isCurrentJob && activeGeneration?.docType === 'both';
  const isCurrentJobGenerating =
    resumeGenerating || coverLetterGenerating || bothGenerating;

  const generationLabel =
    activeGeneration?.docType === 'cover_letter' ? 'cover letter'
    : activeGeneration?.docType === 'both' ? 'CV and cover letter'
    : 'CV';

  const decision = latestMatch?.decision;
  const candidate = latestMatch?.candidate;
  const derivedRecency = (() => {
    if (candidate?.recency_factor != null) return candidate.recency_factor;
    if (snapshot?.lastPostedAt) {
      const info = parseAndFormatJobDate(snapshot.lastPostedAt);
      if (info.ageInDays != null) {
        const days = Math.max(0, info.ageInDays);
        if (days <= 4) {
          return Math.round((1 - 0.04 * days) * 10000) / 10000;
        }
        return (
          Math.round(0.84 * Math.pow(2, -(days - 4) / 5) * 10000) / 10000
        );
      }
    }
    return 0.5;
  })();

  const overallScore =
    candidate?.priority_score ??
    decision?.score ??
    candidate?.match_score ??
    null;
  const hasScore =
    authConnected &&
    isJob &&
    typeof overallScore === 'number' &&
    !Number.isNaN(overallScore);
  const percentage = hasScore ? Math.round(overallScore * 100) : 0;
  const matchLabel = jobMatchLabel(
    authConnected,
    isMatchLoading,
    hasScore ? percentage : null,
  );
  const toPercent = (value: number | null | undefined, fallback: number) =>
    Math.min(100, Math.max(0, Math.round((value ?? fallback) * 100)));

  const hasResume = Boolean(existingDocuments?.resume);
  const hasCoverLetter = Boolean(existingDocuments?.cover_letter);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <JobMatchSummary
        score={hasScore ? percentage : null}
        label={matchLabel}
        breakdown={[
          {
            label: 'Skill',
            value:
              hasScore ?
                toPercent(
                  candidate?.skill_score ?? candidate?.match_score,
                  overallScore || 0,
                )
              : null,
            colorClassName: 'bg-emerald-500',
          },
          {
            label: 'Title',
            value:
              hasScore ?
                toPercent(
                  candidate?.title_score ?? candidate?.match_score,
                  overallScore || 0,
                )
              : null,
            colorClassName: 'bg-sky-500',
          },
          {
            label: 'Exp',
            value:
              hasScore ?
                toPercent(
                  candidate?.exp_score ?? candidate?.match_score,
                  0.85,
                )
              : null,
            colorClassName: 'bg-indigo-500',
          },
          {
            label: 'Fresh',
            value: hasScore ? toPercent(derivedRecency, 0.5) : null,
            colorClassName: 'bg-amber-500',
          },
        ]}
        isLoading={authConnected && isMatchLoading}
        isUnavailable={!authConnected || (!hasScore && !isMatchLoading)}
        explanation={decision?.explanation}
        action={
          !hasScore && !authConnected && onSignIn ? (
            <button
              type='button'
              onClick={onSignIn}
              className='inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary transition-all hover:bg-primary/25 active:scale-95'
              title='Sign in to calculate match score'
            >
              <Sparkles className='size-2.5' />
              Sign In
            </button>
          ) : authConnected && isJob && onRecordApplication ? (
            isApplicationRecorded ? (
              <button
                type='button'
                disabled
                className='inline-flex shrink-0 cursor-default items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 dark:text-emerald-400'
                title='Application recorded in Jobby'
              >
                <Check className='size-2.5' />
                Applied
              </button>
            ) : (
              <button
                type='button'
                disabled={!canRecordApplication || isRecordingApplication}
                onClick={onRecordApplication}
                className={cn(
                  'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary transition-all hover:bg-primary/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
                  isRecordingApplication && 'opacity-70',
                )}
                title='Mark as applied in Jobby'
              >
                {isRecordingApplication ? (
                  <Loader2 className='size-2.5 animate-spin' />
                ) : (
                  <Check className='size-2.5' />
                )}
                {isRecordingApplication ? 'Recording...' : 'Record'}
              </button>
            )
          ) : undefined
        }
      />

      {isJob && authConnected && (onTailor || onPreview) && !isMatchLoading && (
        <div className='border-t border-primary/20 pt-3'>
          {activeGeneration && (
            <div
              role='status'
              aria-live='polite'
              className='mb-2.5 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-2'
            >
              <p className='text-[10px] leading-relaxed text-foreground/80'>
                {isCurrentJob ? (
                  <>
                    Generating {generationLabel} for{' '}
                    <span className='font-bold text-foreground'>
                      {activeGeneration.jobTitle || 'this role'}
                      {activeGeneration.company ?
                        ` at ${activeGeneration.company}`
                      : ''}
                    </span>
                    . You can switch pages; progress will remain available.
                  </>
                ) : (
                  <>
                    Background task: Generating {generationLabel} for{' '}
                    <span className='font-bold text-foreground'>
                      {activeGeneration.jobTitle || 'another role'}
                      {activeGeneration.company ?
                        ` at ${activeGeneration.company}`
                      : ''}
                    </span>
                    . You can tailor documents for this page concurrently.
                  </>
                )}
              </p>
            </div>
          )}
          <div
            className={cn(
              'grid gap-2',
              hasResume || hasCoverLetter ? 'grid-cols-2' : 'grid-cols-3',
            )}
          >
            <button
              type='button'
              onClick={() =>
                hasResume ? onPreview?.('resume') : onTailor?.('resume')
              }
              disabled={isCurrentJobGenerating}
              aria-busy={resumeGenerating}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] transition-all',
                isCurrentJobGenerating ?
                  resumeGenerating ?
                    'bg-primary-gradient text-primary-foreground font-bold shadow-xs disabled:opacity-100 cursor-not-allowed'
                  : 'border border-primary/20 bg-primary/5 text-primary/40 disabled:opacity-40 cursor-not-allowed'
                : hasResume ?
                  'border border-primary/30 bg-primary/15 text-primary font-bold hover:bg-primary/25 active:scale-95 shadow-xs cursor-pointer'
                : 'bg-primary-gradient text-primary-foreground font-bold hover:opacity-90 active:scale-95 shadow-xs cursor-pointer',
              )}
            >
              {hasResume ? (
                <Eye className='h-3 w-3 shrink-0' />
              ) : (
                <Sparkles className='h-3 w-3 shrink-0' />
              )}
              <span>
                {resumeGenerating ? 'Tailoring...'
                : hasResume ? 'Preview CV'
                : 'Tailor CV'}
              </span>
            </button>
            <button
              type='button'
              onClick={() =>
                hasCoverLetter ?
                  onPreview?.('cover_letter')
                : onTailor?.('cover_letter')
              }
              disabled={isCurrentJobGenerating}
              aria-busy={coverLetterGenerating}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] transition-all',
                isCurrentJobGenerating ?
                  coverLetterGenerating ?
                    'bg-primary-gradient text-primary-foreground font-bold shadow-xs disabled:opacity-100 cursor-not-allowed'
                  : 'border border-primary/20 bg-primary/5 text-primary/40 disabled:opacity-40 cursor-not-allowed'
                : hasCoverLetter ?
                  'border border-primary/30 bg-primary/15 text-primary font-bold hover:bg-primary/25 active:scale-95 shadow-xs cursor-pointer'
                : 'border border-primary/25 bg-primary/8 text-primary font-bold hover:bg-primary/20 active:scale-95 cursor-pointer',
              )}
            >
              {hasCoverLetter ? (
                <Eye className='h-3 w-3 shrink-0' />
              ) : (
                <FileText className='h-3 w-3 shrink-0' />
              )}
              <span>
                {coverLetterGenerating ? 'Tailoring...'
                : hasCoverLetter ? 'Preview CL'
                : 'Tailor CL'}
              </span>
            </button>
            {!hasResume && !hasCoverLetter && (
              <button
                type='button'
                onClick={() => onTailor?.('both')}
                disabled={isCurrentJobGenerating}
                aria-busy={bothGenerating}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] transition-all',
                  isCurrentJobGenerating ?
                    bothGenerating ?
                      'bg-primary-gradient text-primary-foreground font-bold shadow-xs disabled:opacity-100 cursor-not-allowed'
                    : 'border border-primary/20 bg-primary/5 text-primary/40 disabled:opacity-40 cursor-not-allowed'
                  : 'border border-primary/25 bg-primary/8 text-primary font-bold hover:bg-primary/20 active:scale-95 cursor-pointer',
                )}
              >
                <Layers className='h-3 w-3 shrink-0' />
                <span>{bothGenerating ? 'Tailoring...' : 'Tailor Both'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
