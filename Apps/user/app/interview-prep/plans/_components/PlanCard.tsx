/** @format */

import React from 'react';
import { Clock, Target } from 'lucide-react';
import type { PracticePlan } from '@/lib/types';
import { formatRelativeDate } from '@/components/ConsoleUtils';

interface PlanCardProps {
  plan: PracticePlan;
  onClick?: () => void;
}

export function PlanCard({ plan, onClick }: PlanCardProps) {
  return (
    <div
      onClick={onClick}
      className='p-5 rounded-2xl bg-panel border border-primary/40 flex flex-col gap-4 shadow-sm hover:border-primary/30 transition-colors cursor-pointer group'
    >
      <div className='flex justify-between items-start'>
        <h3 className='title-card line-clamp-2'>{plan.name}</h3>
        <span className='label-sm px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0'>
          Active
        </span>
      </div>

      <div className='grid grid-cols-2 gap-3 mt-2'>
        <div className='body-md flex items-center gap-2 text-ink-secondary'>
          <Clock className='w-4 h-4 text-ink-secondary opacity-70' />
          <span>{plan.target_days} Days</span>
        </div>
        <div className='body-md flex items-center gap-2 text-ink-secondary'>
          <Target className='w-4 h-4 text-ink-secondary opacity-70' />
          <span>{plan.daily_questions_count} Qs/Day</span>
        </div>
      </div>

      <div className='mt-2 pt-4 border-t border-primary/40 flex justify-between items-center'>
        <span className='body-sm text-ink-secondary'>
          Created {formatRelativeDate(plan.created_at)}
        </span>
        <span className='label text-primary opacity-0 group-hover:opacity-100 transition-opacity'>
          View Tasks &rarr;
        </span>
      </div>
    </div>
  );
}
