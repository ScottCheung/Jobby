/** @format */

'use client';

import React from 'react';
import { AlertTriangle, Check, Edit3 } from 'lucide-react';
import { EmptyPlaceHolder } from '@/components/UI/EmptyPlaceHolder';
import { cn } from '@/lib/utils';
import { FormTextarea } from './FormControls';

interface NotesAndQAProps {
  notes?: string | null;
  status?: string | null;
  skipReason?: string | null;
  questions?: any;
  isEditingNotes: boolean;
  setIsEditingNotes: (val: boolean) => void;
  onChangeNotes: (notes: string) => void;
}

export function NotesAndQA({
  notes,
  status,
  skipReason,
  questions,
  isEditingNotes,
  setIsEditingNotes,
  onChangeNotes,
}: NotesAndQAProps) {
  const renderQuestions = () => {
    if (!questions) return null;

    let QAList: Array<{ question: string; answer: string }> = [];

    if (Array.isArray(questions)) {
      QAList = questions
        .map((item: any) => ({
          question: item.question || item.label || item.original_label || '',
          answer: item.answer || '',
        }))
        .filter((item) => item.question);
    } else if (typeof questions === 'object' && questions !== null) {
      QAList = Object.entries(questions).map(([q, a]) => ({
        question: q,
        answer: String(a),
      }));
    }

    if (QAList.length === 0) {
      return (
        <div className='text-ink-secondary mt-6'>
          <h3 className='display-panel-header'>AI Auto-Apply Questions</h3>
          <EmptyPlaceHolder message='No Q&A recorded for this application.' />
        </div>
      );
    }

    return (
      <div className='space-y-4 mt-6'>
        <h3 className='text-xs font-bold text-ink-secondary uppercase tracking-wider mb-3'>
          AI Auto-Apply Questions
        </h3>
        <div className='space-y-3'>
          {QAList.map((qa, index) => (
            <div key={index} className='display-panel'>
              <div className='flex items-start gap-2.5'>
                <span className='px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5 shrink-0'>
                  Q
                </span>
                <p className='text-sm font-semibold text-ink-primary'>
                  {qa.question}
                </p>
              </div>
              <div className='flex items-start gap-2.5 mt-2'>
                <span className='px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold uppercase tracking-wider mt-0.5 shrink-0'>
                  A
                </span>
                <p className='text-sm text-ink-secondary font-medium'>
                  {qa.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className='space-y-6 animate-in fade-in duration-200'>
      {/* Custom Notes Card */}
      <div>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='display-panel-header'>Application Insights / Notes</h3>
          <button
            onClick={() => setIsEditingNotes(!isEditingNotes)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer',
              isEditingNotes ?
                'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20'
              : 'text-primary hover:bg-primary/10 border-primary/20',
            )}
          >
            {isEditingNotes ?
              <>
                <Check className='w-3 h-3' />
                Done
              </>
            : <>
                <Edit3 className='w-3 h-3' />
                Edit
              </>
            }
          </button>
        </div>

        {isEditingNotes ?
          <FormTextarea
            label=''
            value={notes}
            onChange={onChangeNotes}
            placeholder='Write your comments, timeline tracker, or details here...'
            rows={5}
          />
        : notes ?
          <div className='whitespace-pre-wrap display-panel'>{notes}</div>
        : <EmptyPlaceHolder message='No Insights/Notes recorded for this application.' />
        }
      </div>

      {status === 'skipped' && skipReason && (
        <div className='mt-6'>
          <h3 className='text-xs font-bold text-ink-secondary uppercase tracking-wider flex items-center gap-1.5 mb-2'>
            Auto Apply Skip Reason
          </h3>
          <div className='whitespace-pre-wrap display-panel'>{skipReason}</div>
        </div>
      )}

      {/* Questions list */}
      {renderQuestions()}
    </div>
  );
}
