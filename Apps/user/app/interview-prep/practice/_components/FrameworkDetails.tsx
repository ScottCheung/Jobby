/** @format */

import React from 'react';

interface FrameworkDetailsProps {
  framework: string | null | undefined;
}

export function FrameworkDetails({ framework }: FrameworkDetailsProps) {
  if (!framework) {
    return (
      <p className='body-md text-ink-secondary italic'>
        No answering framework configured.
      </p>
    );
  }

  if (framework === 'STAR') {
    return (
      <div className='body-sm grid grid-cols-2 gap-3 mt-1'>
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

  if (framework === 'STARE') {
    return (
      <div className='body-sm grid grid-cols-2 md:grid-cols-2 gap-3 mt-1'>
        <div className='p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl'>
          <span className='font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide block mb-1'>
            S - Situation
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Background context.
          </span>
        </div>
        <div className='p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl'>
          <span className='font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide block mb-1'>
            T - Task
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Challenge/Goals.
          </span>
        </div>
        <div className='p-3 bg-green-500/5 border border-green-500/10 rounded-xl'>
          <span className='font-bold text-green-600 dark:text-green-400 uppercase tracking-wide block mb-1'>
            A - Action
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Your execution.
          </span>
        </div>
        <div className='p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl'>
          <span className='font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide block mb-1'>
            R - Result
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Outcome/Metrics.
          </span>
        </div>
        <div className='p-3 bg-teal-500/5 border border-teal-500/10 rounded-xl col-span-2 sm:col-span-1'>
          <span className='font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide block mb-1'>
            E - Evaluation
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Reflections & lessons.
          </span>
        </div>
      </div>
    );
  }

  if (framework === 'SOAR') {
    return (
      <div className='body-sm grid grid-cols-1 md:grid-cols-2 gap-3 mt-1'>
        <div className='p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl'>
          <span className='font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide block mb-1'>
            S - Situation
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Background context.
          </span>
        </div>
        <div className='p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl'>
          <span className='font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide block mb-1'>
            O - Obstacle
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Direct blocker/challenges.
          </span>
        </div>
        <div className='p-3 bg-green-500/5 border border-green-500/10 rounded-xl'>
          <span className='font-bold text-green-600 dark:text-green-400 uppercase tracking-wide block mb-1'>
            A - Action
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Your execution path.
          </span>
        </div>
        <div className='p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl'>
          <span className='font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide block mb-1'>
            R - Result
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Metrics, outcome & impact.
          </span>
        </div>
      </div>
    );
  }

  if (framework === 'XYZ') {
    return (
      <div className='body-sm grid grid-cols-3 gap-3 mt-1'>
        <div className='p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl'>
          <span className='font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide block mb-1'>
            X - Accomplished
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            What did you accomplish or deliver?
          </span>
        </div>
        <div className='p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl'>
          <span className='font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide block mb-1'>
            Y - Measured
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Quantifiable impact or metrics.
          </span>
        </div>
        <div className='p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl'>
          <span className='font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block mb-1'>
            Z - Actions
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Specific techniques or methods used.
          </span>
        </div>
      </div>
    );
  }

  if (framework === 'PAR') {
    return (
      <div className='body-sm grid grid-cols-3 gap-3 mt-1'>
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
      <div className='body-sm grid grid-cols-3 gap-3 mt-1'>
        <div className='p-3 bg-background-secondary/5 border border-border/10 rounded-xl'>
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
      <div className='body-sm grid grid-cols-2 md:grid-cols-3 gap-3 mt-1'>
        <div className='p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl'>
          <span className='font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide block mb-1'>
            What
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Describe the project core.
          </span>
        </div>
        <div className='p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl'>
          <span className='font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide block mb-1'>
            Why
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Justify business demand / reasons.
          </span>
        </div>
        <div className='p-3 bg-green-500/5 border border-green-500/10 rounded-xl'>
          <span className='font-bold text-green-600 dark:text-green-400 uppercase tracking-wide block mb-1'>
            Who
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Who was involved.
          </span>
        </div>
        <div className='p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl'>
          <span className='font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide block mb-1'>
            When
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Time frames and schedules.
          </span>
        </div>
        <div className='p-3 bg-teal-500/5 border border-teal-500/10 rounded-xl'>
          <span className='font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide block mb-1'>
            Where
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Scopes or platform.
          </span>
        </div>
        <div className='p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl'>
          <span className='font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide block mb-1'>
            How
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Methodologies and steps.
          </span>
        </div>
        <div className='p-3 bg-violet-500/5 border border-violet-500/10 rounded-xl col-span-2 md:col-span-3'>
          <span className='font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide block mb-1'>
            How much
          </span>
          <span className='text-ink-secondary leading-relaxed'>
            Quantifiable resources or gains.
          </span>
        </div>
      </div>
    );
  }

  return (
    <p className='body-md text-ink-secondary whitespace-pre-wrap mt-1'>
      {framework}
    </p>
  );
}
