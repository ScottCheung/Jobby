/** @format */

import { CircularProgress } from '@jobby/ui/components/UI/Progress/CircularProgress';
import { Number } from '@jobby/ui/components/UI/Number/Number';
import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { PageInspection } from '../../shared/contracts/page-inspection';

interface JobScoreCardProps {
  latestInspection: PageInspection | null;
  latestPlan: ValidatedApplicationPlanResponse | null;
}

export function JobScoreCard({
  latestInspection,
  latestPlan,
}: JobScoreCardProps) {
  if (latestInspection?.kind !== 'job') {
    return null;
  }

  const decision = latestPlan?.plan?.decision;
  const candidate = latestPlan?.plan?.candidate;
  const score =
    decision?.score ?? candidate?.priority_score ?? candidate?.match_score;
  const action = decision?.action;
  const explanation = decision?.explanation;

  const hasScore = typeof score === 'number' && !isNaN(score);
  const percentage = hasScore ? Math.round(score * 100) : 0;

  const matchLabel =
    !hasScore ? 'Calculating Score...'
    : percentage >= 75 ? 'Highly Recommended'
    : percentage >= 50 ? 'Recommended'
    : 'Not Recommended';

  const derivedRecency =
    candidate?.recency_factor ??
    ((
      candidate?.priority_score != null &&
      candidate?.match_score != null &&
      candidate.match_score > 0
    ) ?
      candidate.priority_score / candidate.match_score
    : hasScore && candidate?.match_score != null && candidate.match_score > 0 ?
      score / candidate.match_score
    : 1.0);

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
      : percentage,
    ),
  );
  const recencyPct = Math.min(
    100,
    Math.max(0, Math.round(derivedRecency * 100)),
  );

  return (
    <div className='rounded-tl-[4em]! rounded-br-[4em]!  page-class-banner--job  rounded-xl  bg-background-primary p-3 shadow-xs  transition-all'>
      <div className='flex items-start gap-3.5'>
        {/* Circular Progress Gauge */}
        <div className='relative flex-shrink-0 flex items-center justify-center w-18 h-18 rounded-full bg-primary/10  shadow-xs'>
          <CircularProgress
            value={hasScore ? percentage : 0}
            size='sm'
            variant='gradient'
            color={
              !hasScore ? 'primary'
              : percentage >= 75 ?
                'primary'
              : percentage >= 50 ?
                'warning'
              : 'danger'
            }
            showValue={false}
            isIndeterminate={!hasScore}
            thickness={8}
          />

          <Number
            className='absolute inset-0 flex items-center justify-center font-extrabold text-xl text-foreground'
            value={hasScore ? percentage : '..'}
          />
        </div>

        {/* Info & Details */}
        <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
          <div className='flex items-center justify-between gap-2'>
            <span className='font-bold text-xs text-foreground truncate'>
              {matchLabel}
            </span>
            {action && (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  action === 'apply' ?
                    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : action === 'review' ?
                    'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-destructive/15 text-destructive border border-destructive/30'
                }`}
              >
                {action}
              </span>
            )}
          </div>

          {/* Sub-score Mini Bars */}
          {hasScore ?
            <div
              className='grid grid-cols-2 gap-x-3 gap-y-1 mt-0.5 text-[10px] select-none'
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
                <span className='w-6 shrink-0 text-right font-mono font-semibold text-foreground/80'>
                  {skillPct}%
                </span>
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
                <span className='w-6 shrink-0 text-right font-mono font-semibold text-foreground/80'>
                  {titlePct}%
                </span>
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
                <span className='w-6 shrink-0 text-right font-mono font-semibold text-foreground/80'>
                  {expPct}%
                </span>
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
                <span className='w-6 shrink-0 text-right font-mono font-semibold text-foreground/80'>
                  {recencyPct}%
                </span>
              </div>
            </div>
          : <p className='text-[11px] leading-relaxed text-muted-foreground'>
              Analyzing job skills and requirements...
            </p>
          }
        </div>
      </div>
    </div>
  );
}
