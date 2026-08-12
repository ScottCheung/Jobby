/** @format */

'use client';

import React from 'react';
import { Calendar, Sliders, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import AnimatedIcon from '@/components/UI/SVGanimation/StatusSVG';
import type { InterviewQuestion } from '@/lib/types';
import { Button } from '@jobby/ui';
import { motion } from 'framer-motion';

type PresetType = 'sprint' | 'tactical' | 'master';

interface PresetTemplate {
  id: PresetType;
  durationLabel: string;
  title: string;
  description: string;
  strategyLabel: string;
  activeBorderClass: string;
  activeBgClass: string;
  activeBadgeClass: string;
  activeTextClass: string;
  bgClass: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'sprint',
    durationLabel: '7 Days',
    title: '7-Day Sprint Prep',
    description:
      'Designed for upcoming interviews. Focuses exclusively on core high-frequency and high-importance (4+ stars) questions, incorporating automatic Spaced Repetition reviews.',
    strategyLabel: 'Sprint + Review',
    activeBorderClass:
      'border-orange-500/80 dark:border-orange-500/60 ring-1 ring-orange-500/20',
    activeBgClass: 'bg-orange-500/[0.04] dark:bg-orange-500/[0.02]',
    activeBadgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    activeTextClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-500',
  },
  {
    id: 'tactical',
    durationLabel: '14 Days',
    title: '14-Day Tactical Booster',
    description:
      'A comprehensive, balanced strategy. Focuses on system design, technical frameworks, behavioral narratives, and general job fit, with Spaced Repetition reviews.',
    strategyLabel: 'Balanced + Review',
    activeBorderClass:
      'border-blue-500/80 dark:border-blue-500/60 ring-1 ring-blue-500/20',
    activeBgClass: 'bg-blue-500/[0.04] dark:bg-blue-500/[0.02]',
    activeBadgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    activeTextClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-500',
  },
  {
    id: 'master',
    durationLabel: '30 Days',
    title: '30-Day Interview Master',
    description:
      'The ultimate preparation route. Guides you systematically through all categories in your library, scheduling spaced repetition reviews at +1, +3, +7, and +14 days intervals.',
    strategyLabel: 'Full + Review',
    activeBorderClass:
      'border-purple-500/80 dark:border-purple-500/60 ring-1 ring-purple-500/20',
    activeBgClass: 'bg-purple-500/[0.04] dark:bg-purple-500/[0.02]',
    activeBadgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    activeTextClass: 'text-purple-600 dark:text-purple-400',
    bgClass: 'bg-purple-500',
  },
];

interface PlanSetupSectionProps {
  questions: InterviewQuestion[];
  selectedPreset: PresetType;
  setSelectedPreset: (preset: PresetType) => void;
  setIsCustomizeOpen: (open: boolean) => void;
  handleCreatePlan: () => Promise<void> | void;
  isCreatingPlan: boolean;
}

export function PlanSetupSection({
  questions,
  selectedPreset,
  setSelectedPreset,
  setIsCustomizeOpen,
  handleCreatePlan,
  isCreatingPlan,
}: PlanSetupSectionProps) {
  const InActiveCard = 'border-ink-secondary/50';

  return (
    <div className='col h-full overflow-y-hidden'>
      <div className='header col items-start '>
        <h2 className='title-section flex w-full items-center gap-2'>
          <Calendar className='w-5.5 h-5.5 text-primary' />
          Prepare Your Practice Plan
        </h2>
        <p className='body-md text-ink-secondary'>
          Select one of our high-efficiency official prep modes, or click
          "Customize Strategy" below to fine-tune your scope.
        </p>
      </div>

      {/* Preset templates cards */}
      <div className='max-h-[50vh] body overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2'>
        {PRESET_TEMPLATES.map((template) => {
          const isSelected = selectedPreset === template.id;

          // Calculate dynamic target pace based on matching questions in the library
          let poolSize = questions.length;
          let duration = 14;

          if (template.id === 'sprint') {
            const sprintQuestions = questions.filter(
              (q) => (q.importance_score ?? 0) >= 4 || q.frequency === 'High',
            );
            poolSize = sprintQuestions.length;
            duration = 7;
          } else if (template.id === 'tactical') {
            poolSize = questions.length;
            duration = 14;
          } else if (template.id === 'master') {
            poolSize = questions.length;
            duration = 30;
          }

          const baseQsPerDay = Math.max(1, Math.ceil(poolSize / duration));

          // Ebbinghaus reviews estimation
          let reviewsCount = 0;
          const intervals = [1, 3, 7, 14];
          for (let i = 0; i < poolSize; i++) {
            const baseDayIndex = Math.min(
              Math.floor(i / baseQsPerDay),
              duration - 1,
            );
            for (const interval of intervals) {
              if (baseDayIndex + interval < duration) {
                reviewsCount++;
              }
            }
          }

          const totalTasksCount = poolSize + reviewsCount;
          const avgTotalTasksPerDay = Math.max(
            1,
            Math.ceil(totalTasksCount / duration),
          );

          return (
            <div
              key={template.id}
              onClick={() => setSelectedPreset(template.id)}
              className={cn(
                'p-5 rounded-2xl border h-full  transition-all cursor-pointer flex flex-col gap-4 relative group ',
                isSelected ?
                  cn(template.activeBorderClass, template.activeBgClass)
                : InActiveCard,
              )}
            >
              <div className='flex justify-between items-start'>
                <div
                  className={cn(
                    'label-sm px-3.5 py-1.5 rounded-full uppercase shrink-0 transition-colors',
                    isSelected ?
                      template.activeBadgeClass
                    : 'bg-background-secondary text-ink-primary0 dark:text-zinc-400',
                  )}
                >
                  {template.durationLabel}
                </div>
                <div
                  className={cn(
                    'flex items-center justify-center cursor-pointer w-7 h-7 rounded-full transition-colors',
                    isSelected ?
                      template.bgClass
                    : 'bg-zinc-300 dark:bg-zinc-700',
                  )}
                >
                  {isSelected && (
                    <AnimatedIcon type='check' className='w-4 h-4 text-white' />
                  )}
                </div>
              </div>
              <div className='flex flex-col gap-1.5'>
                <h3
                  className={cn(
                    'title-card transition-colors',
                    isSelected ? 'text-ink-primary' : 'text-ink-primary/90',
                  )}
                >
                  {template.title}
                </h3>
                <p
                  className={cn(
                    'body-sm transition-colors',
                    isSelected ? 'text-ink-secondary' : 'text-ink-secondary/90',
                  )}
                >
                  {template.description}
                </p>
              </div>
              <div className='body-sm mt-auto pt-3 border-t border-border/40 transition-colors flex flex-col gap-1.5'>
                <div className='flex justify-between text-ink-secondary/80'>
                  <span>Daily Base Pace:</span>
                  <span className='font-semibold text-ink-primary'>
                    ~{baseQsPerDay} new Qs / day
                  </span>
                </div>
                <div className='flex justify-between text-ink-secondary/80'>
                  <span>Daily Tasks:</span>
                  <span
                    className={cn(
                      'font-bold',
                      isSelected ?
                        template.activeTextClass
                      : 'text-ink-primary',
                    )}
                  >
                    ~{avgTotalTasksPerDay} Qs / day
                  </span>
                </div>
                <div className='flex justify-between items-center text-[10px] text-ink-secondary/50 pt-1 border-t border-dashed border-border/40 mt-0.5'>
                  <span>{template.strategyLabel}</span>
                  <span>incl. reviews</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className='footer'>
        <Button
          variant='outline'
          Icon={Sliders}
          layoutId='Customize Your Plan'
          className='w-full'
          onClick={() => setIsCustomizeOpen(true)}
        >
          Customize
        </Button>
        <Button
          Icon={Plus}
          className='w-full'
          onClick={() => void handleCreatePlan()}
          disabled={isCreatingPlan}
        >
          {isCreatingPlan ?
            'Formulating Plan Timeline...'
          : 'Activate Practice Plan'}
        </Button>
      </div>
    </div>
  );
}
