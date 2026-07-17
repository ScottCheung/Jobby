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
  if (!Array.isArray(segments)) return null;

  return (
    <div className='text-sm text-ink-secondary leading-relaxed pl-6 border-l-4 border-primary p-2 my-2'>
      {segments.map((seg, segIdx) => {
        if (!seg || typeof seg.text !== 'string') return null;

        const words = seg.text.split(/\s+/).filter(Boolean);
        const start = typeof seg.start === 'number' ? seg.start : 0;
        const end = typeof seg.end === 'number' ? seg.end : start;
        const duration = Math.max(0, end - start);

        return (
          <span key={segIdx} className='mr-2 inline-flex flex-wrap'>
            {words.map((word, wordIdx) => {
              const wordTime =
                start + (wordIdx / Math.max(1, words.length)) * duration;

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
                  className='hover:text-primary hover:bg-primary/10 cursor-pointer px-0.5 rounded transition-all mr-1 border-b-2 border-dashed border-ink-secondary/50 text-ink-primary select-none font-medium'
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
