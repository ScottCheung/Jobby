/** @format */

import React from 'react';
import { Mic, Square, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@jobby/ui';
import {
  Tooltip as TooltipContent,
  Kbd as KeyboardHint,
} from '@/components/UI/tooltip';
import { AudioVisualizer } from './AudioVisualizer';
import { InteractiveTranscript } from './InteractiveTranscript';
import { AnimatePresence, motion } from 'framer-motion';

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
  words?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

interface PracticeWorkspaceProps {
  isRecording: boolean;
  isRecordingTransitioning: boolean;
  activeStream: MediaStream | null;
  audioUrl: string | null;
  draftAudioRef: React.RefObject<HTMLAudioElement | null>;
  transcriptSegments: Segment[];
  interimText: string;
  transcriptStatus: 'idle' | 'recording' | 'refining' | 'ready' | 'fallback';
  transcriptStatusMessage: string | null;
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
  isRecordingTransitioning,
  activeStream,
  audioUrl,
  draftAudioRef,
  transcriptSegments,
  interimText,
  transcriptStatus,
  transcriptStatusMessage,
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
  const canInteractWithTranscript = transcriptStatus === 'ready';
  const isRecorderBusy =
    isRecordingTransitioning || transcriptStatus === 'refining';
  const canSubmit =
    !isRecording &&
    !isRecorderBusy &&
    transcriptSegments.length > 0 &&
    !isSubmitting;
  const plainTranscriptText = [
    ...transcriptSegments
      .map((segment) => segment.text?.trim())
      .filter(Boolean),
    interimText.trim(),
  ]
    .filter(Boolean)
    .join(' ');
  const shouldShowInteractiveTranscript =
    transcriptStatus === 'ready' && transcriptSegments.length > 0;
  const shouldShowPlainTranscript =
    !shouldShowInteractiveTranscript && plainTranscriptText.length > 0;

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
                    disabled={isRecorderBusy}
                    className={cn(
                      'relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all cursor-pointer',
                      isRecording ?
                        'bg-primary-foreground/50  text-primary-foreground'
                      : isRecorderBusy ?
                        'bg-ink-secondary/20 text-ink-secondary cursor-not-allowed'
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
              <AnimatePresence mode='wait'>
                {transcriptStatus !== 'idle' && (
                  <motion.div
                    key={transcriptStatus}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className='flex items-center flew-wrap  gap-2 text-[10px] uppercase '
                  >
                    <span
                      className={cn(
                        'inline-flex normal-case items-center rounded-full px-2 py-0.5 font-medium',
                        transcriptStatus === 'recording' &&
                          'bg-primary/10 text-primary',
                        transcriptStatus === 'refining' &&
                          'bg-amber-500/12 text-amber-700 ',
                        transcriptStatus === 'ready' &&
                          'bg-emerald-500/12 text-emerald-700',
                        transcriptStatus === 'fallback' &&
                          'bg-zinc-500/12 text-zinc-700',
                      )}
                    >
                      {transcriptStatus === 'recording' && 'Live Transcript'}
                      {transcriptStatus === 'refining' && 'Refining Transcript'}
                      {transcriptStatus === 'ready' && 'Transcript Ready'}
                      {transcriptStatus === 'fallback' &&
                        'Live Transcript Saved'}
                    </span>
                    {transcriptStatusMessage && (
                      <span className='text-ink-secondary normal-case tracking-normal'>
                        {transcriptStatusMessage}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className='body-md w-full flex flex-wrap gap-1.5 items-start overflow-y-auto'>
                {shouldShowInteractiveTranscript ?
                  <InteractiveTranscript
                    segments={transcriptSegments}
                    draftAudioRef={draftAudioRef}
                    onEditSegment={onUpdateTranscriptSegment}
                    isInteractive={canInteractWithTranscript}
                    isDraft={!canInteractWithTranscript}
                  />
                : shouldShowPlainTranscript ?
                  <div
                    className={cn(
                      'body-md w-full  border-l-4 px-6 py-3 text-pretty leading-7 transition-colors duration-300',
                      transcriptStatus === 'refining' ?
                        'border-primary/35 text-ink-secondary/80 animate-text-shimmer animate-text-shimmer-secondary'
                      : transcriptStatus === 'recording' ?
                        'border-primary/30 text-ink-secondary/55 '
                      : 'border-primary/30 text-ink-secondary/50',
                    )}
                  >
                    {plainTranscriptText}
                  </div>
                : null}
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
          disabled={!canSubmit}
          className='w-full'
        >
          {isSubmitting ?
            'Saving Attempt...'
          : transcriptStatus === 'refining' ?
            'Refining Transcript...'
          : 'Save Practice Run'}
        </Button>
      </div>
    </div>
  );
}
