/** @format */

import React from 'react';
import { Mic, Square, RotateCcw, Save, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import {
  Tooltip as TooltipContent,
  Kbd as KeyboardHint,
} from '@/components/UI/tooltip';
import { AudioVisualizer } from './AudioVisualizer';
import { InteractiveTranscript } from './InteractiveTranscript';
import { div } from 'framer-motion/client';

const normalizePlayback = (audio: HTMLAudioElement) => {
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  const pitchSafeAudio = audio as HTMLAudioElement & {
    preservePitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  pitchSafeAudio.preservePitch = true;
  pitchSafeAudio.mozPreservesPitch = true;
  pitchSafeAudio.webkitPreservesPitch = true;
};

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
    <div className=' col h-full'>
      <div className='body '>
        <div className='col'>
          {/* Audio Recording Controls */}
          <div className='  w-full h-full col  '>
            <div className='relative z-0'>
              <div className='absolute top-1/2 z-20 left-1/2 -translate-x-1/2 -translate-y-1/2 flex  items-center justify-center'>
                <TooltipContent
                  content={
                    <span className='inline-flex items-center'>
                      {isRecording ? 'Stop Recording' : 'Start Recording'}{' '}
                      <KeyboardHint>Space</KeyboardHint>
                    </span>
                  }
                  side='top'
                >
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      'relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all cursor-pointer',
                      isRecording ?
                        'bg-primary-foreground/50  text-primary-foreground'
                      : 'bg-linear-to-br from-primary/80  shadow-brand to-primary/100 text-primary-foreground',
                    )}
                  >
                    {isRecording ?
                      <Square className='w-10 h-10 fill-primary-foreground ' />
                    : <Mic className='w-12 h-12 ' />}
                  </button>
                </TooltipContent>
              </div>
              <AudioVisualizer
                stream={activeStream}
                isRecording={isRecording}
              />
            </div>

            {audioUrl && !isRecording && (
              <div className='ml-6 flex flex-col gap-1.5 mt-2 pt-4 z-50'>
                <div className='flex items-center gap-2'>
                  <audio
                    ref={draftAudioRef}
                    src={audioUrl}
                    controls
                    onLoadedMetadata={(e) => normalizePlayback(e.currentTarget)}
                    onPlay={(e) => normalizePlayback(e.currentTarget)}
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
              {/* Confidence Rating & Feedback Notes temporarily hidden per UX decision */}
            </div>
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
