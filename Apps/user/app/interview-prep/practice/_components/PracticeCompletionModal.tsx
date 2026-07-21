'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, ChevronRight, RotateCcw, Star } from 'lucide-react';
import { Modal } from '@/components/layout/modal';
import { api } from '@/lib/api';
import type { GamificationUpdate } from '@/lib/types';
import { cn } from '@/lib/utils';
import { showGlobalToast } from '@/lib/toast';
import { isQuickRatingLocked, lockQuickRating } from '../quick-rating-state';

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Low', helper: 'Nice-to-have' },
  { value: 2, label: 'Medium', helper: 'Useful' },
  { value: 3, label: 'High', helper: 'Must-know' },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Easy', helper: 'Smooth' },
  { value: 2, label: 'Medium', helper: 'Took effort' },
  { value: 3, label: 'Hard', helper: 'Challenging' },
] as const;

export function PracticeCompletionModal({
  isOpen,
  questionId,
  reward,
  onRedo,
  onReview,
  onNext,
}: {
  isOpen: boolean;
  questionId: string;
  reward?: GamificationUpdate | null;
  onRedo: () => void;
  onReview: () => void;
  onNext: () => void;
}) {
  const surveyLocked = useMemo(
    () => isOpen && isQuickRatingLocked(questionId),
    [isOpen, questionId],
  );
  const [importance, setImportance] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveRequestRef = useRef(0);
  const pendingSaveCountRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setImportance(null);
      setDifficulty(null);
    }
  }, [isOpen, questionId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        handleRedo();
      }
      if (event.key === 'Escape') handleReview();
      if (event.key === 'Enter') handleNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onNext, onRedo, onReview]);

  const saveRating = async (
    nextImportance: number | null,
    nextDifficulty: number | null,
  ) => {
    if (!nextImportance && !nextDifficulty) return;
    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    pendingSaveCountRef.current += 1;
    setIsSaving(true);
    try {
      const result = await api.updateQuestionCommunityRating(questionId, {
        importance_rating: nextImportance,
        difficulty_rating: nextDifficulty,
      });
      if (saveRequestRef.current === requestId) {
        setImportance(result.user_importance_rating ?? nextImportance);
        setDifficulty(result.user_difficulty_rating ?? nextDifficulty);
        if (result.survey_bonus_xp || result.survey_bonus_coins) {
          showGlobalToast(
            `+${result.survey_bonus_xp} XP, +${result.survey_bonus_coins} coins`,
          );
        }
      }
    } catch {
      if (saveRequestRef.current === requestId) {
        showGlobalToast('Could not save rating.');
      }
    } finally {
      pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
      if (pendingSaveCountRef.current === 0) {
        setIsSaving(false);
      }
    }
  };

  const handlePriorityPick = (value: number) => {
    const nextImportance = value;
    setImportance(nextImportance);
    void saveRating(nextImportance, difficulty);
  };

  const handleDifficultyPick = (value: number) => {
    const nextDifficulty = value;
    setDifficulty(nextDifficulty);
    void saveRating(importance, nextDifficulty);
  };

  const handleDismiss = () => {
    lockQuickRating(questionId);
    onReview();
  };

  const handleRedo = () => {
    lockQuickRating(questionId);
    onRedo();
  };

  const handleReview = () => {
    lockQuickRating(questionId);
    onReview();
  };

  const handleNext = () => {
    lockQuickRating(questionId);
    onNext();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      className='w-[92vw] max-w-lg'
    >
      <div className='p-6'>
        <div className='flex items-start gap-3'>
          <div className='rounded-full bg-primary/10 p-3 text-primary'>
            <Award className='h-6 w-6' />
          </div>
          <div>
            <h2 className='title-card'>Practice complete</h2>
            <p className='body-sm mt-1 text-ink-secondary'>
              Your work has been saved.
            </p>
          </div>
        </div>

        <div className='mt-5 flex gap-3 rounded-xl bg-primary/8 p-4 text-sm'>
          <span>
            <b>+{reward?.xp_gained || 0}</b> XP
          </span>
          <span>
            <b>+{reward?.coins_gained || 0}</b> coins
          </span>
        </div>

        {!surveyLocked && (
          <div className='mt-5 border-t border-border/60 pt-5'>
            <div className='flex items-center justify-between'>
              <p className='text-sm font-semibold text-ink-primary'>
                Quick rating
              </p>
              <span className='text-[10px] font-semibold text-primary'>
                Auto-saves
              </span>
            </div>
            <p className='mt-1 text-xs text-ink-secondary'>
              Tap to save instantly. Finish both to unlock the bonus.
            </p>

            <div className='mt-4 space-y-4'>
              <div>
                <p className='text-xs font-semibold text-ink-secondary'>
                  Practice priority
                </p>
                <div className='mt-2 grid grid-cols-3 gap-2'>
                  {PRIORITY_OPTIONS.map((option) => {
                    const active = importance === option.value;
                    return (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => handlePriorityPick(option.value)}
                        className={cn(
                          'flex cursor-pointer flex-col items-center rounded-2xl border p-3 text-center transition-all',
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background-secondary/40 text-ink-secondary hover:border-primary/30 hover:text-ink-primary',
                        )}
                      >
                        <div className='flex items-center gap-0.5'>
                          {Array.from({ length: 3 }).map((_, index) => (
                            <Star
                              key={index}
                              className={cn(
                                'h-4 w-4 transition-colors',
                                index < option.value
                                  ? active
                                    ? 'fill-primary text-primary'
                                    : 'fill-amber-400 text-amber-400'
                                  : 'text-border',
                              )}
                            />
                          ))}
                        </div>
                        <span className='mt-2 text-sm font-semibold'>
                          {option.label}
                        </span>
                        <span className='mt-0.5 text-[10px]'>
                          {option.helper}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className='text-xs font-semibold text-ink-secondary'>
                  Question difficulty
                </p>
                <div className='mt-2 grid grid-cols-3 gap-2'>
                  {DIFFICULTY_OPTIONS.map((option) => {
                    const active = difficulty === option.value;
                    return (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => handleDifficultyPick(option.value)}
                        className={cn(
                          'rounded-2xl border p-3 text-left transition-all',
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background-secondary/40 text-ink-secondary hover:border-primary/30 hover:text-ink-primary',
                        )}
                      >
                        <p className='text-sm font-semibold'>{option.label}</p>
                        <p className='mt-1 text-[10px]'>{option.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <p className='mt-3 text-[11px] text-ink-secondary'>
              Closing this panel locks the current quick rating for this
              question.
            </p>
          </div>
        )}

        <div className='mt-6 grid grid-cols-3 gap-2'>
          <button
            type='button'
            onClick={handleRedo}
            className='flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-border p-3 text-xs font-semibold text-ink-secondary hover:text-primary'
          >
            <RotateCcw className='h-4 w-4' />
            Redo
            <span className='text-[9px] font-normal'>Space</span>
          </button>
          <button
            type='button'
            onClick={handleReview}
            className='cursor-pointer rounded-xl border border-border p-3 text-xs font-semibold text-ink-secondary hover:text-primary'
          >
            Review
            <span className='mt-1 block text-[9px] font-normal'>Esc</span>
          </button>
          <button
            type='button'
            onClick={handleNext}
            className='flex cursor-pointer flex-col items-center gap-1 rounded-xl bg-primary p-3 text-xs font-semibold text-primary-foreground'
          >
            <ChevronRight className='h-4 w-4' />
            Next
            <span className='text-[9px] font-normal'>Enter</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
