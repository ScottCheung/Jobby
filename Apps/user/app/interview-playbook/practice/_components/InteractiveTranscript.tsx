/** @format */

import React from 'react';

interface Segment {
  text: string;
  start: number;
  end: number;
}

interface InteractiveTranscriptProps {
  segments: Segment[];
  attemptId?: string;
  draftAudioRef?: React.RefObject<HTMLAudioElement | null>;
  interimText?: string;
}

const formatTime = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function InteractiveTranscript({
  segments,
  attemptId,
  draftAudioRef,
  interimText,
}: InteractiveTranscriptProps) {
  return (
    <div className='text-sm text-ink-primary leading-relaxed pl-6 border-l-4 border-primary dark:border-zinc-700 bg-zinc-50/10 dark:bg-zinc-900/10 p-2 my-2'>
      {segments.map((seg, segIdx) => {
        const words = seg.text.split(/\s+/).filter(Boolean);
        const duration = seg.end - seg.start;

        return (
          <span key={segIdx} className='mr-2 inline-flex flex-wrap'>
            {words.map((word, wordIdx) => {
              const wordTime = seg.start + (wordIdx / words.length) * duration;

              return (
                <span
                  key={wordIdx}
                  onClick={() => {
                    if (attemptId) {
                      const audioEl = document.getElementById(
                        `audio-player-${attemptId}`,
                      ) as HTMLAudioElement;
                      if (audioEl) {
                        audioEl.currentTime = wordTime;
                        audioEl.play().catch(() => {});
                      }
                    } else if (draftAudioRef?.current) {
                      draftAudioRef.current.currentTime = wordTime;
                      draftAudioRef.current.play().catch(() => {});
                    }
                  }}
                  className='hover:text-primary hover:bg-primary/10 cursor-pointer px-0.5 rounded transition-all mr-1 border-b border-dashed border-zinc-300 dark:border-zinc-700/80 text-ink-primary select-none font-medium'
                  title={`Jump to ${formatTime(Math.round(wordTime))}`}
                >
                  {word}
                </span>
              );
            })}
          </span>
        );
      })}
      {interimText && (
        <span className='text-zinc-400 italic bg-amber-500/5 px-1'>
          {interimText}
        </span>
      )}
    </div>
  );
}
