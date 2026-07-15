/** @format */

import React from 'react';
import { Mic, Square, RotateCcw, Save, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import { AudioVisualizer } from './AudioVisualizer';
import { InteractiveTranscript } from './InteractiveTranscript';

interface Segment {
  text: string;
  start: number;
  end: number;
}

interface PracticeWorkspaceProps {
  isRecording: boolean;
  activeStream: MediaStream | null;
  audioUrl: string | null;
  draftAudioRef: React.RefObject<HTMLAudioElement | null>;
  transcriptSegments: Segment[];
  interimText: string;
  confidenceScore: number | null;
  setConfidenceScore: (score: number | null) => void;
  notes: string;
  setNotes: (notes: string) => void;
  isSubmitting: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
  handleSubmit: () => void;
  resetWorkspace: () => void;
  audioBlob: Blob | null;
}

export function PracticeWorkspace({
  isRecording,
  activeStream,
  audioUrl,
  draftAudioRef,
  transcriptSegments,
  interimText,
  confidenceScore,
  setConfidenceScore,
  notes,
  setNotes,
  isSubmitting,
  startRecording,
  stopRecording,
  resetRecording,
  handleSubmit,
  resetWorkspace,
  audioBlob,
}: PracticeWorkspaceProps) {
  return (
    <div className='flex-1 flex flex-col h-full'>
      {/* Consolidated Audio Practice & Answer Card */}
      <div className='mb-6  flex flex-col gap-4 shrink-0'>
        {/* Audio Recording Controls */}
        <div className='group flex flex-col items-center justify-center gap-3  '>
          <div className='absolute flex items-center justify-center'>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                'relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all cursor-pointer',
                isRecording ?
                  'bg-primary-foreground/50  text-primary-foreground'
                : 'bg-primary text-primary-foreground',
              )}
            >
              {isRecording ?
                <Square className='w-10 h-10 fill-primary-foreground ' />
              : <Mic className='w-12 h-12 ' />}
            </button>
          </div>
          <AudioVisualizer stream={activeStream} isRecording={isRecording} />
        </div>

        {audioUrl && !isRecording && (
          <div className='w-full flex flex-col gap-2 border-zinc-200 dark:border-zinc-800'>
            <div className='flex items-center gap-2'>
              <audio
                ref={draftAudioRef}
                src={audioUrl}
                controls
                className='flex-1 focus:outline-none'
              />
              <Button variant='ghost' size='sm' onClick={resetRecording}>
                Reset
              </Button>
            </div>
          </div>
        )}

        {/* Integrated Transcript Section */}
        <div className='ml-6 flex flex-col gap-1.5 mt-2 pt-4 z-50'>
          <div className='w-full  text-ink-primary text-sm leading-relaxed flex flex-wrap gap-1.5 items-start overflow-y-auto'>
            {transcriptSegments.length === 0 && !interimText ? null : (
              <InteractiveTranscript
                segments={transcriptSegments}
                draftAudioRef={draftAudioRef}
                interimText={interimText}
              />
            )}
          </div>
        </div>
      </div>

      {/* Confidence Rating & Feedback Notes (Hidden by default, shown after recording/training is done) */}
      {(confidenceScore !== null ||
        audioUrl !== null ||
        transcriptSegments.length > 0) && (
        <div className='space-y-6 animate-fadeIn transition-all duration-300 z-40'>
          {/* Star-based Confidence Score */}
          <div>
            <label className='block text-xs font-bold text-ink-secondary uppercase tracking-wider mb-2'>
              Self-Rated Score
            </label>
            <div className='flex items-center gap-1.5'>
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type='button'
                  onClick={() => setConfidenceScore(score)}
                  className='p-1 hover:scale-115 active:scale-95 transition-all focus:outline-none'
                  title={`Score: ${score}/5`}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      score <= (confidenceScore || 0) ?
                        'fill-amber-500 text-amber-500'
                      : 'text-zinc-300 dark:text-zinc-700 hover:text-amber-400',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className='mb-6 flex flex-col gap-1.5'>
            <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
              Self Feedback & Improvement Notes
            </label>
            <input
              type='text'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='e.g. Speak slower, refine framework story next time...'
              className='w-full px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 focus:outline-none text-ink-primary'
            />
          </div>
        </div>
      )}

      {/* Submitting Actions */}
      <div className=' flex gap-4 border-zinc-100 dark:border-zinc-800/60 shrink-0'>
        <Button variant='ghost' Icon={RotateCcw} onClick={resetWorkspace}>
          Reset
        </Button>

        <Button
          Icon={Save}
          onClick={handleSubmit}
          disabled={
            (transcriptSegments.length === 0 && !audioBlob) || isSubmitting
          }
          className='w-full'
        >
          {isSubmitting ? 'Saving Attempt...' : 'Save Practice Run'}
        </Button>
      </div>
    </div>
  );
}
