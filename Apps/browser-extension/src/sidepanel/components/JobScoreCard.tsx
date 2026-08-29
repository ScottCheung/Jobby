/** @format */

import { CircularProgress } from '@jobby/ui/components/UI/Progress/CircularProgress';
import { Number } from '@jobby/ui/components/UI/Number/Number';
import { FileText, Layers, Loader2, Sparkles } from 'lucide-react';
import type { DocType } from '../../shared/contracts/tailored-resume';
import type { JobMatchEvaluation } from '../../shared/contracts/job-match';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import { parseAndFormatJobDate } from '../../shared/utils/date-formatter';
import { cn } from '@jobby/ui/lib/utils';

interface JobScoreCardProps {
  latestInspection: PageInspection | null;
  latestMatch: JobMatchEvaluation | null;
  isMatchLoading?: boolean;
  isInspecting?: boolean;
  onTailor?: (type: DocType) => void;
  activeGeneration?: {
    docType: DocType;
    jobTitle: string;
    company: string;
  } | null;
  authConnected?: boolean;
  onSignIn?: () => void;
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
}: JobScoreCardProps) {
  const isJob = latestInspection?.kind === 'job';
  const isGenerating = Boolean(activeGeneration);
  const resumeGenerating = activeGeneration?.docType === 'resume';
  const coverLetterGenerating = activeGeneration?.docType === 'cover_letter';
  const bothGenerating = activeGeneration?.docType === 'both';
  const generationLabel =
    coverLetterGenerating ? 'cover letter'
    : bothGenerating ? 'CV and cover letter'
    : 'CV';

  const decision = latestMatch?.decision;
  const candidate = latestMatch?.candidate;

  // Prefer the backend's current scoring result; derive freshness locally only
  // when the response cannot provide it.
  const snapshot =
    latestInspection?.kind === 'job' ? latestInspection.snapshot : null;
  const derivedRecency = (() => {
    if (candidate?.recency_factor != null) return candidate.recency_factor;
    if (snapshot?.lastPostedAt) {
      const info = parseAndFormatJobDate(snapshot.lastPostedAt);
      if (info.ageInDays != null) {
        const d = Math.max(0, info.ageInDays);
        if (d <= 4.0) return Math.round((1.0 - 0.04 * d) * 10000) / 10000;
        return (
          Math.round(0.84 * Math.pow(2.0, -(d - 4.0) / 5.0) * 10000) / 10000
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

  const explanation = decision?.explanation;

  const hasScore =
    authConnected &&
    isJob &&
    typeof overallScore === 'number' &&
    !isNaN(overallScore);
  const percentage = hasScore ? Math.round(overallScore * 100) : 0;

  const matchLabel = jobMatchLabel(
    authConnected,
    isMatchLoading,
    hasScore ? percentage : null,
  );

  const skillPct = Math.min(
    100,
    Math.max(
      0,
      candidate?.skill_score != null ? Math.round(candidate.skill_score * 100)
      : candidate?.match_score != null ? Math.round(candidate.match_score * 100)
      : percentage,
    ),
  );
  const titlePct = Math.min(
    100,
    Math.max(
      0,
      candidate?.title_score != null ? Math.round(candidate.title_score * 100)
      : candidate?.match_score != null ? Math.round(candidate.match_score * 100)
      : percentage,
    ),
  );
  const expPct = Math.min(
    100,
    Math.max(
      0,
      candidate?.exp_score != null ? Math.round(candidate.exp_score * 100)
      : candidate?.match_score != null ? Math.round(candidate.match_score * 100)
      : 85,
    ),
  );
  const recencyPct = Math.min(
    100,
    Math.max(0, Math.round(derivedRecency * 100)),
  );

  return (
    <div className='rounded-tl-[4em]! rounded-br-[4em]! page-class-banner--job rounded-xl bg-background-primary p-3 shadow-xs transition-all'>
      <div className='flex items-start gap-3.5'>
        {/* Circular Progress Gauge */}
        <div className='relative flex-shrink-0 flex items-center justify-center w-18 h-18 rounded-full bg-primary/10 shadow-xs'>
          <CircularProgress
            value={hasScore ? percentage : 0}
            size='sm'
            variant='gradient'
            color={
              !authConnected ? 'primary'
              : !hasScore ?
                'primary'
              : percentage >= 75 ?
                'primary'
              : percentage >= 50 ?
                'warning'
              : 'danger'
            }
            showValue={false}
            isIndeterminate={authConnected && isMatchLoading}
            thickness={8}
          />

          <Number
            className='absolute inset-0 flex items-center justify-center font-extrabold text-xl text-foreground'
            value={
              hasScore ? percentage
              : !authConnected ?
                '--'
              : isMatchLoading ?
                '..'
              : '--'
            }
          />
        </div>

        {/* Info & Details */}
        <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
          <div className='flex items-center justify-between gap-2'>
            <span
              className={cn(
                'font-bold text-xs text-foreground truncate',
                hasScore || !authConnected || !isMatchLoading ?
                  ''
                : 'animate-text-shimmer-primary animate-text-shimmer',
              )}
            >
              {matchLabel}
            </span>
            {hasScore ?
              null
            : !authConnected && onSignIn ?
              <button
                type='button'
                onClick={onSignIn}
                className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide transition-all select-none shrink-0 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 cursor-pointer active:scale-95'
                title='Sign in to calculate match score'
              >
                <Sparkles className='w-2.5 h-2.5 shrink-0 text-primary' />
                <span>Sign In</span>
              </button>
            : null}
          </div>

          {/* Sub-score Mini Bars */}
          {hasScore ?
            <div
              className='grid grid-cols-2 mr-4 gap-x-3 gap-y-1 mt-0.5 text-[10px] select-none'
              title={explanation || 'Score breakdown'}
            >
              {/* Skill Bar */}
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Skill
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-background-secondary overflow-hidden relative'>
                  <div
                    className='h-full bg-emerald-500 rounded-full transition-all duration-500'
                    style={{
                      width: `${Math.min(100, Math.max(0, skillPct))}%`,
                    }}
                  />
                </div>
                <Number
                  className='shrink-0 text-right font-mono font-semibold text-foreground/80'
                  value={skillPct}
                />
              </div>

              {/* Title Bar */}
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Title
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-background-secondary overflow-hidden relative'>
                  <div
                    className='h-full bg-sky-500 rounded-full transition-all duration-500'
                    style={{
                      width: `${Math.min(100, Math.max(0, titlePct))}%`,
                    }}
                  />
                </div>
                <Number
                  className='shrink-0 text-right font-mono font-semibold text-foreground/80'
                  value={titlePct}
                />
              </div>

              {/* Exp Bar */}
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Exp
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-background-secondary overflow-hidden relative'>
                  <div
                    className='h-full bg-indigo-500 rounded-full transition-all duration-500'
                    style={{ width: `${Math.min(100, Math.max(0, expPct))}%` }}
                  />
                </div>
                <Number
                  className='shrink-0 text-right font-mono font-semibold text-foreground/80'
                  value={expPct}
                />
              </div>

              {/* Recency / Freshness Bar */}
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Fresh
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-background-secondary overflow-hidden relative'>
                  <div
                    className='h-full bg-amber-500 rounded-full transition-all duration-500'
                    style={{
                      width: `${Math.min(100, Math.max(0, recencyPct))}%`,
                    }}
                  />
                </div>
                <Number
                  className='shrink-0 text-right font-mono font-semibold text-foreground/80'
                  value={recencyPct}
                />
              </div>
            </div>
          : !authConnected ?
            <div className='grid grid-cols-2 mr-4 gap-x-3 gap-y-1 mt-0.5 text-[10px] select-none text-muted-foreground/70'>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Skill
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden' />
                <span className='shrink-0 font-mono text-[9px]'>--</span>
              </div>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Title
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden' />
                <span className='shrink-0 font-mono text-[9px]'>--</span>
              </div>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Exp
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden' />
                <span className='shrink-0 font-mono text-[9px]'>--</span>
              </div>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Fresh
                </span>
                <div className='h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden' />
                <span className='shrink-0 font-mono text-[9px]'>--</span>
              </div>
            </div>
          : isMatchLoading ?
            <div className='grid grid-cols-2 mr-4 gap-x-3 gap-y-1.5 mt-0.5 text-[10px] select-none'>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Skill
                </span>
                <div className='h-1.5 flex-1 rounded-full overflow-hidden animate-skeleton-shimmer' />
              </div>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Title
                </span>
                <div className='h-1.5 flex-1 rounded-full overflow-hidden animate-skeleton-shimmer' />
              </div>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Exp
                </span>
                <div className='h-1.5 flex-1 rounded-full overflow-hidden animate-skeleton-shimmer' />
              </div>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='w-7 shrink-0 text-muted-foreground font-medium truncate'>
                  Fresh
                </span>
                <div className='h-1.5 flex-1 rounded-full overflow-hidden animate-skeleton-shimmer' />
              </div>
            </div>
          : <p className='mt-1 text-[10px] leading-relaxed text-muted-foreground'>
              Add a resume profile to calculate Skill, Title, Experience, and
              Freshness scores.
            </p>
          }
        </div>
      </div>
      {isJob && authConnected && onTailor && (
        <div className='mt-3 border-t border-primary/15 pt-2.5'>
          {activeGeneration && (
            <div
              role='status'
              aria-live='polite'
              className='mb-2 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2'
            >
              <Loader2 className='mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary' />
              <p className='text-[9px] leading-relaxed text-muted-foreground'>
                Generating {generationLabel} for{' '}
                <span className='font-bold text-foreground'>
                  {activeGeneration.jobTitle || 'this role'}
                  {activeGeneration.company ?
                    ` at ${activeGeneration.company}`
                  : ''}
                </span>
                . You can switch pages; progress will remain available.
              </p>
            </div>
          )}
          <div className='grid grid-cols-3 gap-1.5 pr-1'>
            <button
              type='button'
              onClick={() => onTailor('resume')}
              disabled={isGenerating}
              aria-busy={resumeGenerating || undefined}
              className='inline-flex items-center justify-center gap-1 rounded-lg bg-primary-gradient px-2 py-2 text-[10px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55'
            >
              {resumeGenerating ?
                <Loader2 className='h-3 w-3 animate-spin' />
              : <Sparkles className='h-3 w-3' />}
              {resumeGenerating ? 'Generating...' : 'Tailor CV'}
            </button>
            <button
              type='button'
              onClick={() => onTailor('cover_letter')}
              disabled={isGenerating}
              aria-busy={coverLetterGenerating || undefined}
              className='inline-flex items-center justify-center gap-1 rounded-lg border border-primary/25 bg-primary/8 px-2 py-2 text-[10px] font-bold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-45'
            >
              {coverLetterGenerating ?
                <Loader2 className='h-3 w-3 animate-spin' />
              : <FileText className='h-3 w-3' />}
              {coverLetterGenerating ? 'Generating...' : 'Generate CL'}
            </button>
            <button
              type='button'
              onClick={() => onTailor('both')}
              disabled={isGenerating}
              aria-busy={bothGenerating || undefined}
              className='inline-flex items-center rounded-l-xl rounded-tr-lg rounded-br-[5em] justify-center gap-1 border border-primary/25 bg-primary/8 px-2 py-2 text-[10px] font-bold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-45'
            >
              {bothGenerating ?
                <Loader2 className='h-3 w-3 animate-spin' />
              : <Layers className='h-3 w-3' />}
              {bothGenerating ? 'Generating...' : 'Get Both'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
