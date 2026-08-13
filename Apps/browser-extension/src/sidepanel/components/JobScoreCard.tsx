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
  const score = decision?.score ?? candidate?.priority_score ?? candidate?.match_score;
  const action = decision?.action;
  const explanation = decision?.explanation;

  const hasScore = typeof score === 'number' && !isNaN(score);
  const percentage = hasScore ? Math.round(score * 100) : 0;

  const matchLabel =
    !hasScore ? 'Calculating Score...'
    : percentage >= 75 ? 'Highly Recommended'
    : percentage >= 50 ? 'Recommended'
    : 'Not Recommended';

  const scoreDetails = (candidate?.match_score != null && candidate?.recency_factor != null)
    ? `Match ${Math.round(candidate.match_score * 100)}% × Recency ${candidate.recency_factor}`
    : `Skills, Title, Exp & Recency`;

  const displayExplanation = explanation 
    ? `${explanation} (${scoreDetails})`
    : hasScore 
      ? `Evaluation complete. (${scoreDetails})`
      : 'Analyzing job skills and requirements...';

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
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
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

          <p className='text-[11px] leading-relaxed text-muted-foreground line-clamp-2' title={displayExplanation}>
            {displayExplanation}
          </p>
        </div>
      </div>
    </div>
  );
}
