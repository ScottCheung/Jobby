import React from 'react';

interface FrameworkDetailsProps {
  framework: string | null | undefined;
}

export function FrameworkDetails({ framework }: FrameworkDetailsProps) {
  if (!framework) {
    return (
      <p className='text-sm text-ink-secondary italic'>
        No answering framework configured.
      </p>
    );
  }

  if (framework === 'STAR') {
    return (
      <div className='grid grid-cols-2 gap-3 text-xs mt-1'>
        <div className='p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl'>
          <span className='font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide block mb-1'>
            S - Situation
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Background context: when, where, who.
          </span>
        </div>
        <div className='p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl'>
          <span className='font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide block mb-1'>
            T - Task
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            The specific challenge or requirements.
          </span>
        </div>
        <div className='p-3 bg-green-500/5 border border-green-500/10 rounded-xl'>
          <span className='font-bold text-green-600 dark:text-green-400 uppercase tracking-wide block mb-1'>
            A - Action
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Your actions: execution, tools, decisions.
          </span>
        </div>
        <div className='p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl'>
          <span className='font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide block mb-1'>
            R - Result
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Metrics, outcome, feedback, takeaways.
          </span>
        </div>
      </div>
    );
  }

  if (framework === 'PAR') {
    return (
      <div className='grid grid-cols-3 gap-3 text-xs mt-1'>
        <div className='p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl'>
          <span className='font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide block mb-1'>
            P - Problem
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Problem statement.
          </span>
        </div>
        <div className='p-3 bg-green-500/5 border border-green-500/10 rounded-xl'>
          <span className='font-bold text-green-600 dark:text-green-400 uppercase tracking-wide block mb-1'>
            A - Action
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Action taken.
          </span>
        </div>
        <div className='p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl'>
          <span className='font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide block mb-1'>
            R - Result
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Resolution/outcome.
          </span>
        </div>
      </div>
    );
  }

  if (framework === 'CAR') {
    return (
      <div className='grid grid-cols-3 gap-3 text-xs mt-1'>
        <div className='p-3 bg-zinc-50/5 border border-zinc-50/10 rounded-xl'>
          <span className='font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide block mb-1'>
            C - Context
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Scenario setup.
          </span>
        </div>
        <div className='p-3 bg-green-500/5 border border-green-500/10 rounded-xl'>
          <span className='font-bold text-green-600 dark:text-green-400 uppercase tracking-wide block mb-1'>
            A - Action
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Execution detail.
          </span>
        </div>
        <div className='p-3 bg-primary/5 border border-primary/10 rounded-xl'>
          <span className='font-bold text-primary uppercase tracking-wide block mb-1'>
            R - Result
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Success details.
          </span>
        </div>
      </div>
    );
  }

  if (framework === '5W2H') {
    return (
      <div className='p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs flex flex-col gap-2 mt-1'>
        <div>
          <span className='font-bold text-ink-primary'>What:</span> Describe
          the project core.
        </div>
        <div>
          <span className='font-bold text-ink-primary'>Why:</span> Justify
          business demand / reasons.
        </div>
        <div>
          <span className='font-bold text-ink-primary'>Who:</span> Who was
          involved.
        </div>
        <div>
          <span className='font-bold text-ink-primary'>When:</span> Time
          frames and schedules.
        </div>
        <div>
          <span className='font-bold text-ink-primary'>Where:</span> Scopes or
          platform.
        </div>
        <div>
          <span className='font-bold text-ink-primary'>How:</span>{' '}
          Methodologies and steps.
        </div>
        <div>
          <span className='font-bold text-ink-primary'>How much:</span>{' '}
          Quantifiable resources or gains.
        </div>
      </div>
    );
  }

  return (
    <p className='text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed mt-1'>
      {framework}
    </p>
  );
}
