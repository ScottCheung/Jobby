/** @format */

import { CircularProgress } from '@jobby/ui/components/UI/Progress/CircularProgress';
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
  const score = decision?.score ?? candidate?.match_score;
  const action = decision?.action;
  const explanation = decision?.explanation;

  const hasScore = typeof score === 'number' && !isNaN(score);
  const percentage = hasScore ? Math.round(score * 100) : 0;

  const matchLabel =
    !hasScore ? 'Calculating Score...'
    : percentage >= 75 ? 'High Match'
    : percentage >= 50 ? 'Medium Match'
    : 'Low Match';

  return (
    <div className='rounded-xl border border-primary/20 bg-card/90 p-3 shadow-xs backdrop-blur-sm transition-all'>
      <div className='flex items-center gap-3.5'>
        {/* Circular Progress Gauge */}
        <div className='relative flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-xs'>
          <CircularProgress
            value={hasScore ? percentage : 0}
            size='sm'
            variant='solid'
            color='white'
            showValue={false}
            isIndeterminate={!hasScore}
            thickness={3}
          />
          <div className='absolute inset-0 flex items-center justify-center font-bold text-xs text-primary-foreground'>
            {hasScore ? `${percentage}%` : '...'}
          </div>
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
                  action === 'apply'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : action === 'review'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-destructive/15 text-destructive border border-destructive/30'
                }`}
              >
                {action}
              </span>
            )}
          </div>

          <p className='text-[11px] leading-relaxed text-muted-foreground line-clamp-2'>
            {explanation || (hasScore ? 'Match evaluation completed.' : 'Analyzing job skills and requirements...')}
          </p>
        </div>
      </div>
    </div>
  );
}
