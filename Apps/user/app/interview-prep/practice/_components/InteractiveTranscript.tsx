/** @format */

import React, { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';

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
  onEditSegment?: (index: number, newText: string) => void;
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
  onEditSegment,
}: InteractiveTranscriptProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  if (!Array.isArray(segments)) return null;

  return (
    <div className='body-md text-ink-secondary pl-6 border-l-4 border-primary p-2 my-2'>
      {segments.map((seg, segIdx) => {
        if (!seg || typeof seg.text !== 'string') return null;

        if (editingIndex === segIdx) {
          return (
            <div key={segIdx} className='my-1 flex items-center gap-2'>
              <input
                autoFocus
                type='text'
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onEditSegment) {
                    onEditSegment(segIdx, editValue);
                    setEditingIndex(null);
                  } else if (e.key === 'Escape') {
                    setEditingIndex(null);
                  }
                }}
                className='body-md flex-1 bg-background border border-ink-secondary/30 rounded px-2 py-1 focus:outline-none focus:border-primary text-ink-primary'
              />
              <button
                onClick={() => {
                  if (onEditSegment) onEditSegment(segIdx, editValue);
                  setEditingIndex(null);
                }}
                className='p-1 text-emerald-600 hover:bg-emerald-600/10 rounded transition-colors'
              >
                <Check className='w-4 h-4' />
              </button>
              <button
                onClick={() => setEditingIndex(null)}
                className='p-1 text-rose-600 hover:bg-rose-600/10 rounded transition-colors'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          );
        }

        const words = seg.text.split(/\s+/).filter(Boolean);
        const start = typeof seg.start === 'number' ? seg.start : 0;
        const end = typeof seg.end === 'number' ? seg.end : start;
        const duration = Math.max(0, end - start);
        const totalChars = words.reduce((acc, w) => acc + w.length, 0);
        let charOffset = 0;

        const prevEnd =
          segIdx > 0 ?
            typeof segments[segIdx - 1].end === 'number' ?
              segments[segIdx - 1].end
            : 0
          : 0;
        const pauseDuration = start - prevEnd;

        return (
          <React.Fragment key={segIdx}>
            {pauseDuration >= 1.0 && (
              <span
                onClick={() => {
                  const jumpTime = Math.max(0, prevEnd - 0.2);
                  if (attemptId) {
                    const audioEl = document.getElementById(
                      `audio-player-${attemptId}`,
                    ) as HTMLAudioElement;
                    if (audioEl) {
                      audioEl.currentTime = jumpTime;
                      audioEl.play().catch(() => {});
                    }
                  } else if (draftAudioRef?.current) {
                    draftAudioRef.current.currentTime = jumpTime;
                    draftAudioRef.current.play().catch(() => {});
                  }
                }}
                className='body-sm inline-flex items-center justify-center bg-amber-500/10 text-amber-600/80 dark:text-amber-500/80 px-1.5 py-0.5 rounded mx-1.5 border border-amber-500/20 select-none cursor-pointer hover:bg-amber-500/20 transition-colors'
                title={`Jump to pause at ${formatTime(Math.round(prevEnd))}`}
              >
                ( Stop {pauseDuration.toFixed(1)}s )
              </span>
            )}
            <span className='group relative mr-2 inline-flex flex-wrap items-center hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors'>
              {words.map((word, wordIdx) => {
                const wordTime =
                  start +
                  (totalChars > 0 ? (charOffset / totalChars) * duration : 0);
                charOffset += word.length;

                const cleanWord = word.replace(/[.,!?，。！？]/g, '');
                const isFiller =
                  /^(um|uh|ah|hmm|like|basically|actually|so|嗯|啊|哎|呃|就是|那个|然后|这个|那个什么)$/i.test(
                    cleanWord,
                  );

                return (
                  <span
                    key={wordIdx}
                    onClick={() => {
                      const jumpTime = Math.max(0, wordTime - 0.2);
                      if (attemptId) {
                        const audioEl = document.getElementById(
                          `audio-player-${attemptId}`,
                        ) as HTMLAudioElement;
                        if (audioEl) {
                          audioEl.currentTime = jumpTime;
                          audioEl.play().catch(() => {});
                        }
                      } else if (draftAudioRef?.current) {
                        draftAudioRef.current.currentTime = jumpTime;
                        draftAudioRef.current.play().catch(() => {});
                      }
                    }}
                    className={
                      isFiller ?
                        'hover:text-primary hover:bg-primary/10 cursor-pointer px-0.5 rounded transition-all mr-1 border-b border-dashed border-ink-secondary/30 text-ink-secondary/50 select-none'
                      : 'hover:text-primary hover:bg-primary/10 cursor-pointer px-0.5 rounded transition-all mr-1 border-b-2 border-dashed border-ink-secondary/50 text-ink-primary select-none font-medium'
                    }
                    title={`Jump to ${formatTime(Math.round(wordTime))}`}
                  >
                    {word}
                  </span>
                );
              })}
              {onEditSegment && (
                <button
                  onClick={() => {
                    setEditingIndex(segIdx);
                    setEditValue(seg.text);
                  }}
                  className='ml-1 opacity-0 group-hover:opacity-100 p-0.5 text-ink-secondary hover:text-primary transition-opacity'
                  title='Edit segment'
                >
                  <Edit2 className='w-3 h-3' />
                </button>
              )}
            </span>
          </React.Fragment>
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
