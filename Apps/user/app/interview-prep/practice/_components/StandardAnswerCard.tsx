/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InterviewQuestion } from '@/lib/types';

interface StandardAnswerCardProps {
  currentQuestion: InterviewQuestion | null;
  shouldShowAnswer: boolean;
  onShowAnswerToggle: () => void;
  isEditingAnswer: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveAnswer: (editedText: string) => Promise<void>;
  isSavingAnswer: boolean;
}

export function StandardAnswerCard({
  currentQuestion,
  shouldShowAnswer,
  onShowAnswerToggle,
  isEditingAnswer,
  onStartEditing,
  onCancelEditing,
  onSaveAnswer,
  isSavingAnswer,
}: StandardAnswerCardProps) {
  const [editedText, setEditedText] = useState('');

  // Sync edited text on editor load
  useEffect(() => {
    if (isEditingAnswer && currentQuestion) {
      setEditedText(currentQuestion.answer_objective || '');
    }
  }, [isEditingAnswer, currentQuestion]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onSaveAnswer(editedText);
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEditing();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancelEditing();
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    if (isEditingAnswer) return;
    onShowAnswerToggle();
  };

  if (!currentQuestion) return null;

  return (
    <div
      onClick={handleToggleClick}
      className={cn('panel-lg select-none transition-all duration-200 ')}
    >
      {/* Title / Action Header bar */}
      <div
        onClick={(e) => {
          if (shouldShowAnswer && !isEditingAnswer) {
            e.stopPropagation();
            onShowAnswerToggle();
          }
        }}
        className={cn(
          'flex justify-between items-center pb-2 mb-2 ',
          shouldShowAnswer &&
            !isEditingAnswer &&
            'cursor-pointer hover:opacity-80 transition-opacity',
        )}
      >
        <span className='text-xs font-bold text-ink-primary flex items-center gap-1.5'>
          <Target className='w-3.5 h-3.5 text-blue-500 shrink-0' />
          Your Answer
        </span>
        <div className='flex items-center gap-3 shrink-0'>
          {shouldShowAnswer && !isEditingAnswer && (
            <button
              onClick={handleStart}
              className='text-xs text-primary font-bold hover:underline transition-colors active:scale-95'
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {shouldShowAnswer ?
        isEditingAnswer ?
          <div
            className='flex flex-col gap-2 pt-1'
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder='Modify your personal standard answer here...'
              className='w-full h-32 p-3 text-sm rounded-lg  bg-panel focus:outline-none text-ink-primary resize-none leading-relaxed transition-all focus:border-primary/40'
            />
            <div className='flex justify-end gap-2 text-xs'>
              <button
                onClick={handleCancel}
                disabled={isSavingAnswer}
                className='px-3 py-1.5 rounded-lg border border-border text-ink-secondary font-bold hover:bg-background-secondary transition-colors active:scale-95'
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSavingAnswer}
                className='px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50 transition-all duration-200 active:scale-95'
              >
                {isSavingAnswer ? 'Saving...' : 'Save Answer'}
              </button>
            </div>
          </div>
        : currentQuestion.answer_objective?.trim() ?
          <div className='text-sm text-ink-secondary leading-relaxed flex flex-col gap-2.5 max-h-[300px] overflow-y-auto custom-scrollbar-primary pr-1'>
            {currentQuestion.answer_objective
              .split('\n')
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        : <p className='text-sm text-ink-secondary italic leading-relaxed'>
            No standard answer provided. Click &quot;Edit&quot; to define your
            answer.
          </p>

      : <p className='text-xs text-ink-secondary italic leading-relaxed py-1'>
          Standard answer is hidden. Click anywhere on this card or toggle the
          eye button in the top-right toolbar to view it.
        </p>
      }
    </div>
  );
}
