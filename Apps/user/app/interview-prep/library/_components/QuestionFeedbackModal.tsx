'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Send, X } from 'lucide-react';
import type { InterviewQuestion } from '@/lib/types';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { Textarea } from '@/components/UI/textarea';

interface QuestionFeedbackModalProps {
  isOpen?: boolean;
  onClose: () => void;
  question: InterviewQuestion;
}

const ISSUE_TYPES = [
  'Answer Error',
  'Typo / Formatting',
  'Outdated Info',
  'Incorrect Category',
  'Other Issues',
];

export function QuestionFeedbackModal({
  isOpen = true,
  onClose,
  question,
}: QuestionFeedbackModalProps) {
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  useEffect(() => {
    if (isOpen) {
      openModal({
        layoutId: 'question-feedback-modal',
        content: (
          <QuestionFeedbackFormContent
            question={question}
            onClose={() => {
              closeModal();
              onClose();
            }}
          />
        ),
        className: 'w-[92vw] max-w-lg rounded-2xl overflow-hidden',
        onClose: () => {
          closeModal();
          onClose();
        },
      });
      return () => {
        closeModal();
      };
    } else {
      closeModal();
    }
  }, [isOpen, question, openModal, closeModal, onClose]);

  return null;
}

export function QuestionFeedbackFormContent({
  question,
  onClose,
}: {
  question: InterviewQuestion;
  onClose: () => void;
}) {
  const [selectedIssueType, setSelectedIssueType] = useState<string>('Answer Error');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      showGlobalToast('Please provide details regarding the issue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullBody = `[${selectedIssueType}] ${feedbackText.trim()}`;
      await api.createQuestionComment(question.id, {
        kind: 'feedback',
        body: fullBody,
      });

      showGlobalToast('Feedback submitted successfully! The author has been notified.');
      window.dispatchEvent(
        new CustomEvent('jobby:notification-event', {
          detail: { user_id: question.submitted_by_user_id },
        }),
      );
      setFeedbackText('');
      onClose();
    } catch (err) {
      console.error('Failed to submit question feedback:', err);
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to submit feedback. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='flex flex-col w-full text-ink-primary'>
      {/* Modal Header */}
      <div className='flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background-secondary/30'>
        <div className='flex items-center gap-2 text-ink-primary font-bold text-base'>
          <AlertCircle className='w-5 h-5 text-amber-500' />
          <span>Report Issue / Feedback</span>
        </div>
        <button
          onClick={onClose}
          type='button'
          className='p-1.5 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-background-secondary transition-colors cursor-pointer'
        >
          <X className='w-4 h-4' />
        </button>
      </div>

      {/* Modal Body */}
      <form onSubmit={handleSubmit} className='p-6 space-y-4 flex-1'>
        {/* Question Title Target */}
        <div className='p-3 rounded-xl bg-background-secondary/50 border border-border/50 text-xs text-ink-secondary space-y-1'>
          <div className='font-medium text-ink-secondary/70 uppercase tracking-wider text-[10px]'>
            Target Question
          </div>
          <div className='font-semibold text-ink-primary text-sm line-clamp-2'>
            {question.title}
          </div>
        </div>

        {/* Issue Type Chips */}
        <div>
          <label className='block text-xs font-semibold text-ink-secondary mb-2'>
            Select Issue Type
          </label>
          <div className='flex flex-wrap gap-2'>
            {ISSUE_TYPES.map((type) => {
              const isSelected = selectedIssueType === type;
              return (
                <button
                  key={type}
                  type='button'
                  onClick={() => setSelectedIssueType(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isSelected ?
                      'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-background-secondary text-ink-secondary hover:text-ink-primary hover:bg-background-secondary/80 border border-border/50'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Textarea */}
        <Textarea
          label='Details'
          required
          rows={4}
          minHeight={96}
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder='Please describe the error or suggestion in detail (e.g. incorrect answer, typo, code bug) so the author can update it...'
        />

        {/* Modal Footer */}
        <div className='flex items-center justify-end gap-3 pt-3 border-t border-border/40'>
          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='px-4 py-2 text-xs font-semibold text-ink-secondary hover:text-ink-primary bg-background-secondary hover:bg-background-secondary/80 rounded-xl transition-colors cursor-pointer disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={isSubmitting || !feedbackText.trim()}
            className='flex items-center gap-2 px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer'
          >
            {isSubmitting ?
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                <span>Submitting...</span>
              </>
            : <>
                <Send className='w-3.5 h-3.5' />
                <span>Submit Feedback</span>
              </>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

