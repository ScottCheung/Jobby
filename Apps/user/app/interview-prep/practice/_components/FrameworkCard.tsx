/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InterviewQuestion } from '@/lib/types';
import { FrameworkDetails } from './FrameworkDetails';

interface FrameworkCardProps {
  currentQuestion: InterviewQuestion | null;
  isEditingFramework: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveFramework: (type: string, customText: string) => Promise<void>;
  isSavingFramework: boolean;
}

const frameworkOptions = [
  {
    id: 'STAR',
    label: 'STAR',
    desc: 'Situation, Task, Action, Result',
    selectedClass:
      'border-blue-500 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent text-blue-600 dark:text-blue-400',
    hoverClass:
      'hover:border-blue-300 dark:hover:border-blue-800/80 hover:bg-blue-50/30 dark:hover:bg-blue-900/10',
    checkBg: 'bg-blue-500',
  },
  {
    id: 'STARE',
    label: 'STARE',
    desc: 'STAR + Evaluation / Learning',
    selectedClass:
      'border-teal-500 bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent text-teal-600 dark:text-teal-400',
    hoverClass:
      'hover:border-teal-300 dark:hover:border-teal-800/80 hover:bg-teal-50/30 dark:hover:bg-teal-900/10',
    checkBg: 'bg-teal-500',
  },
  {
    id: 'PAR',
    label: 'PAR',
    desc: 'Problem, Action, Result',
    selectedClass:
      'border-amber-500 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent text-amber-600 dark:text-amber-400',
    hoverClass:
      'hover:border-amber-300 dark:hover:border-amber-800/80 hover:bg-amber-50/30 dark:hover:bg-amber-900/10',
    checkBg: 'bg-amber-500',
  },
  {
    id: 'CAR',
    label: 'CAR',
    desc: 'Context, Action, Result',
    selectedClass:
      'border-emerald-500 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-600 dark:text-emerald-400',
    hoverClass:
      'hover:border-emerald-300 dark:hover:border-emerald-800/80 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10',
    checkBg: 'bg-emerald-500',
  },
  {
    id: 'SOAR',
    label: 'SOAR',
    desc: 'Situation, Obstacle, Action, Result',
    selectedClass:
      'border-rose-500 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent text-rose-600 dark:text-rose-400',
    hoverClass:
      'hover:border-rose-300 dark:hover:border-rose-800/80 hover:bg-rose-50/30 dark:hover:bg-rose-900/10',
    checkBg: 'bg-rose-500',
  },
  {
    id: '5W2H',
    label: '5W2H',
    desc: 'What, Why, Who, When, Where, How, How much',
    selectedClass:
      'border-violet-500 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent text-violet-600 dark:text-violet-400',
    hoverClass:
      'hover:border-violet-300 dark:hover:border-violet-800/80 hover:bg-violet-50/30 dark:hover:bg-violet-900/10',
    checkBg: 'bg-violet-500',
  },
  {
    id: 'XYZ',
    label: 'XYZ',
    desc: 'Accomplished X, as measured by Y, by Z',
    selectedClass:
      'border-sky-500 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent text-sky-600 dark:text-sky-400',
    hoverClass:
      'hover:border-sky-300 dark:hover:border-sky-800/80 hover:bg-sky-50/30 dark:hover:bg-sky-900/10',
    checkBg: 'bg-sky-500',
  },
  {
    id: 'custom',
    label: 'Custom',
    desc: 'Define your own framework details',
    selectedClass:
      'border-zinc-500 bg-gradient-to-br from-zinc-500/10 via-zinc-500/5 to-transparent text-zinc-700 dark:text-zinc-300',
    hoverClass:
      'hover:border-zinc-300 dark:hover:border-zinc-750 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/15',
    checkBg: 'bg-zinc-550',
  },
];

export function FrameworkCard({
  currentQuestion,
  isEditingFramework,
  onStartEditing,
  onCancelEditing,
  onSaveFramework,
  isSavingFramework,
}: FrameworkCardProps) {
  const [editedFrameworkType, setEditedFrameworkType] = useState('STAR');
  const [customFrameworkText, setCustomFrameworkText] = useState('');

  // Sync edits on load
  useEffect(() => {
    if (isEditingFramework && currentQuestion) {
      const fw = currentQuestion.answer_framework || 'STAR';
      const isDefault = [
        'STAR',
        'PAR',
        'CAR',
        '5W2H',
        'STARE',
        'SOAR',
        'XYZ',
      ].includes(fw);
      if (isDefault) {
        setEditedFrameworkType(fw);
        setCustomFrameworkText('');
      } else {
        setEditedFrameworkType('custom');
        setCustomFrameworkText(fw);
      }
    }
  }, [isEditingFramework, currentQuestion]);

  const handleSave = async () => {
    await onSaveFramework(editedFrameworkType, customFrameworkText);
  };

  if (!currentQuestion) return null;

  return (
    <div className='module-panel  '>
      <div className='flex justify-between items-center pb-2 mb-2 '>
        <span className='text-xs font-bold text-ink-primary flex items-center gap-1.5'>
          <Lightbulb className='w-3.5 h-3.5 text-amber-500 shrink-0' />
          Answer Framework
        </span>
        {!isEditingFramework && (
          <button
            onClick={onStartEditing}
            className='text-xs text-primary font-bold hover:underline shrink-0 transition-colors active:scale-95'
          >
            Switch
          </button>
        )}
      </div>

      {isEditingFramework ?
        <div className='flex flex-col gap-3 pt-1'>
          <div className='grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar-primary pr-1'>
            {frameworkOptions.map((fw) => {
              const isSelected = editedFrameworkType === fw.id;
              return (
                <button
                  key={fw.id}
                  type='button'
                  onClick={() => setEditedFrameworkType(fw.id)}
                  className={cn(
                    'group relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer overflow-hidden active:scale-95',
                    isSelected ?
                      fw.selectedClass
                    : cn(
                        'border-zinc-200 dark:border-zinc-800/80 bg-panel hover:-translate-y-0.5 hover:shadow-md dark:hover:bg-zinc-900/50',
                        fw.hoverClass,
                      ),
                  )}
                >
                  {isSelected && (
                    <div
                      className={cn(
                        'absolute right-2 top-2 h-4 w-4 rounded-full flex items-center justify-center',
                        fw.checkBg,
                      )}
                    >
                      <Check className='h-2.5 w-2.5 text-primary-foreground' />
                    </div>
                  )}
                  <span
                    className={cn(
                      'text-xs font-bold uppercase tracking-wide',
                      !isSelected && 'text-ink-primary',
                    )}
                  >
                    {fw.label}
                  </span>
                  <span className='text-[10px] text-ink-secondary leading-tight mt-1 truncate w-full'>
                    {fw.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {editedFrameworkType === 'custom' && (
            <textarea
              value={customFrameworkText}
              onChange={(e) => setCustomFrameworkText(e.target.value)}
              placeholder='Define your custom answering framework details here...'
              className='w-full h-24 p-3 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 focus:outline-none text-ink-primary resize-none leading-relaxed mt-1 focus:border-primary/40 transition-all'
            />
          )}

          <div className='flex justify-end gap-2 text-xs pt-1 border-t border-zinc-150 dark:border-zinc-850'>
            <button
              onClick={onCancelEditing}
              disabled={isSavingFramework}
              className='px-3 py-1.5 rounded-lg border border-zinc-250 dark:border-zinc-800 text-ink-secondary font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors active:scale-95'
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSavingFramework}
              className='px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50 transition-all duration-200 active:scale-95'
            >
              {isSavingFramework ? 'Saving...' : 'Save Framework'}
            </button>
          </div>
        </div>
      : <FrameworkDetails framework={currentQuestion.answer_framework} />}
    </div>
  );
}
