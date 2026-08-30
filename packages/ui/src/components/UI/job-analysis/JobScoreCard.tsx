/** @format */

import { JobMatchSummary } from '../JobMatchSummary';
import { FileText, Layers, Loader2, Sparkles } from 'lucide-react';
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
  activeGeneration?: JobAnalysisGeneration | null;
  authConnected?: boolean;
  onSignIn?: () => void;
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
  activeGeneration = null,
  authConnected = true,
  onSignIn,
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

  return (
    <div
      className='flex flex-col gap-3 '
      
    >
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
          !hasScore && !authConnected && onSignIn ?
            <button
              type='button'
              onClick={onSignIn}
              className='inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary transition-all hover:bg-primary/25 active:scale-95'
              title='Sign in to calculate match score'
            >
              <Sparkles className='size-2.5' />
              Sign In
            </button>
          : undefined
        }
      />

      {isJob && authConnected && onTailor && !isMatchLoading && (
        <div className='border-t border-primary/20 pt-3'>
          {activeGeneration && (
            <div
              role='status'
              aria-live='polite'
              className='mb-2.5 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-2'
            >
              <Loader2 className='mt-0.5 h-3 w-3 shrink-0 animate-pulse text-primary' />
              <p className='text-[9px] leading-relaxed text-muted-foreground'>
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
          <div className='grid grid-cols-3 gap-2'>
            <button
              type='button'
              onClick={() => onTailor('resume')}
              disabled={isCurrentJobGenerating}
              aria-busy={resumeGenerating}
              className='inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-gradient px-2.5 py-2 text-[10px] font-bold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer'
            >
              {resumeGenerating ?
                <Loader2 className='h-3 w-3 animate-pulse' />
              : <Sparkles className='h-3 w-3' />}
              <span>{resumeGenerating ? 'Tailoring...' : 'Tailor CV'}</span>
            </button>
            <button
              type='button'
              onClick={() => onTailor('cover_letter')}
              disabled={isCurrentJobGenerating}
              aria-busy={coverLetterGenerating}
              className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-primary/8 px-2.5 py-2 text-[10px] font-bold text-primary transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer'
            >
              {coverLetterGenerating ?
                <Loader2 className='h-3 w-3 animate-pulse' />
              : <FileText className='h-3 w-3' />}
              <span>{coverLetterGenerating ? 'Tailoring...' : 'Tailor CL'}</span>
            </button>
            <button
              type='button'
              onClick={() => onTailor('both')}
              disabled={isCurrentJobGenerating}
              aria-busy={bothGenerating}
              className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-primary/8 px-2.5 py-2 text-[10px] font-bold text-primary transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer'
              // style={{ borderEndEndRadius: 'var(--score-card-radius-inner)' }}
            >
              {bothGenerating ?
                <Loader2 className='h-3 w-3 animate-pulse' />
              : <Layers className='h-3 w-3' />}
              <span>{bothGenerating ? 'Tailoring...' : 'Tailor Both'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
