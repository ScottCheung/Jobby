/** @format */

import React from 'react';
import { Award, CheckCircle, Trash2 } from 'lucide-react';
import type { PracticeRecord } from '@/lib/types';
import { formatRelativeDate } from '@/components/ConsoleUtils';
import { InteractiveTranscript } from './InteractiveTranscript';

interface PracticeHistoryProps {
  attempts: PracticeRecord[];
  apiBaseUrl: string;
  onDeleteAttempt: (id: string) => void;
  onUpdateAttempt?: (
    id: string,
    updatedRecord: Partial<PracticeRecord>,
  ) => void;
}

export function PracticeHistory({
  attempts,
  apiBaseUrl,
  onDeleteAttempt,
  onUpdateAttempt,
}: PracticeHistoryProps) {
  if (attempts.length === 0) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center text-center p-6 text-ink-secondary opacity-65 h-full min-h-[300px]'>
        <Award className='w-10 h-10 mb-3 text-zinc-400' />
        <p className='body-md'>No practice records for this question yet.</p>
        <p className='body-sm mt-1'>
          Submit your response in the Workspace tab to create your first history
          record.
        </p>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col gap-4'>
      {attempts.map((attempt) => (
        <div
          key={attempt.id}
          className='p-4 rounded-t-3xl rounded-b-2xl bg-linear-to-b from-primary/30  to-transparent flex flex-col gap-3 relative group'
        >
          {attempt.audio_records && attempt.audio_records.length > 0 && (
            <div className=''>
              <audio
                id={`audio-player-${attempt.id}`}
                src={`${apiBaseUrl}${attempt.audio_records[0].url_path}`}
                controls
                className='body-sm w-full focus:outline-none'
              />
            </div>
          )}
          <div className='ml-6 mb-4'>
            <div className='flex justify-between'>
              <div className='flex items-center gap-4'>
                <span className='label-sm'>
                  {formatRelativeDate(attempt.date || attempt.created_at)}
                </span>
                {attempt.confidence_score && (
                  <div className='flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[12px] font-bold'>
                    <CheckCircle className='w-3 h-3' />
                    Score: {attempt.confidence_score}/5
                  </div>
                )}
              </div>
              {/* Delete Attempt Trigger */}
              <button
                onClick={() => onDeleteAttempt(attempt.id)}
                className='p-2 text-ink-secondary hover:text-red-500 rounded-lg hover:bg-background-secondary transition-colors'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            </div>

            {/* Clickable transcript segments with timestamp jump */}
            {attempt.my_answer && (
              <div className=''>
                {(() => {
                  try {
                    if (attempt.my_answer.startsWith('[')) {
                      const parsed = JSON.parse(attempt.my_answer);
                      return (
                        <InteractiveTranscript
                          segments={parsed}
                          attemptId={attempt.id}
                          onEditSegment={(index, newText) => {
                            if (!onUpdateAttempt) return;
                            const updatedSegments = [...parsed];
                            updatedSegments[index].text = newText;
                            onUpdateAttempt(attempt.id, {
                              my_answer: JSON.stringify(updatedSegments),
                            });
                          }}
                        />
                      );
                    }
                  } catch (e) {}
                  return (
                    <span className='whitespace-pre-wrap '>
                      {attempt.my_answer}
                    </span>
                  );
                })()}
              </div>
            )}

            {attempt.notes && (
              <div className='body-sm text-ink-secondary bg-amber-500/5 p-2 rounded border border-amber-500/10 flex flex-col gap-0.5 mt-2'>
                <span className='font-bold text-[10px] uppercase text-amber-600 dark:text-amber-400'>
                  Notes
                </span>
                <p>{attempt.notes}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
