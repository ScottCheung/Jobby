/** @format */

import React from 'react';
import { Mic, Square, RotateCcw, Save, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import { AudioVisualizer } from './AudioVisualizer';
import { InteractiveTranscript } from './InteractiveTranscript';
import { div } from 'framer-motion/client';

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
  onUpdateTranscriptSegment?: (index: number, newText: string) => void;
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
  onUpdateTranscriptSegment,
}: PracticeWorkspaceProps) {
  return (
    <div className=' col overflow-hidden'>
      <div className='body relative h-full! flex flex-col gap-4 '>
        {/* Audio Recording Controls */}
        <div className='group flex flex-col items-center justify-center gap-3  '>
          <div className='absolute flex  items-center justify-center'>
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

          {audioUrl && !isRecording && (
            <div className='w-full flex flex-col gap-2'>
              <div className='flex items-center gap-2'>
                <audio
                  ref={draftAudioRef}
                  src={audioUrl}
                  controls
                  className='flex-1 focus:outline-none'
                />
              </div>
            </div>
          )}

          {/* Integrated Transcript Section */}
          <div className='ml-6 flex flex-col gap-1.5 mt-2 pt-4 z-50'>
            <div className='body-md w-full flex flex-wrap gap-1.5 items-start overflow-y-auto'>
              {transcriptSegments.length === 0 && !interimText ? null : (
                <InteractiveTranscript
                  segments={transcriptSegments}
                  draftAudioRef={draftAudioRef}
                  interimText={interimText}
                  onEditSegment={onUpdateTranscriptSegment}
                />
              )}
            </div>
          </div>
        </div>
        <div className='col  h-full'>
          {/* Consolidated Audio Practice & Answer Card */}

          <div className=' col '>
            {/* Confidence Rating & Feedback Notes (Hidden by default, shown after recording/training is done) */}
            {(confidenceScore !== null || audioUrl !== null) && (
              <div className=' col gap-8!'>
                {/* Star-based Confidence Score */}
                <div>
                  <label className='label-overline block mb-2'>
                    Self-Rated Score ( Optional )
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
                <div className='flex flex-col gap-1.5'>
                  <label className='label-overline'>
                    Practice Notes ( Optional )
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder='e.g. Speak slower, refine framework story next time...'
                    className='textarea '
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Submitting Actions */}
      <div className='footer  z-50'>
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
