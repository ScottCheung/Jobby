/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Clock, X } from 'lucide-react';
import { Button } from '@jobby/ui';

export const AI_TAILOR_STATUS_MESSAGES: string[] = [
  'Analyzing job requirements...',
  'Matching key qualifications...',
  'Tailoring summary & highlights...',
  'Optimizing experience bullets...',
  'Aligning technical skills...',
  'Refining tone & action verbs...',
  'Verifying ATS layout...',
  'Assembling tailored resume...',
];

export const AI_COVER_LETTER_STATUS_MESSAGES: string[] = [
  'Analyzing company & role...',
  'Framing opening narrative...',
  'Highlighting key achievements...',
  'Connecting role requirements...',
  'Polishing persuasive tone...',
  'Assembling cover letter...',
];

interface GeneratingCardProps {
  startedAt?: number;
  onCancel?: () => void;
}

export function GeneratingResumeCard({
  startedAt,
  onCancel,
}: GeneratingCardProps) {
  const messages = AI_TAILOR_STATUS_MESSAGES;
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0,
  );

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        setIsFading(false);
      }, 250);
    }, 4500);
    return () => clearInterval(messageTimer);
  }, [messages.length]);

  useEffect(() => {
    const updateElapsed = () => {
      if (startedAt) {
        setElapsedSeconds(
          Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        );
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    };
    updateElapsed();
    const countTimer = setInterval(updateElapsed, 1000);
    return () => clearInterval(countTimer);
  }, [startedAt]);

  return (
    <div className='flex flex-col rounded-2xl border border-primary/20 bg-panel/70 p-5 backdrop-blur-md'>
      {/* Header */}
      <div className='flex items-center justify-between border-b border-primary/20 pb-3'>
        <div className='flex items-center gap-2'>
          <Sparkles className='h-4 w-4 text-primary animate-pulse' />
          <strong className='text-sm font-bold text-ink-primary'>
            Resume (CV)
          </strong>
        </div>

        <div className='flex items-center gap-2'>
          <span className='flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-mono font-medium text-ink-secondary'>
            <Clock className='h-3.5 w-3.5' />
            {elapsedSeconds}s
          </span>

          {onCancel && (
            <Button
              size='sm'
              variant='outline'
              Icon={X}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Preview Skeleton */}
      <div className='pt-4'>
        <div className='group relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-background/50 p-4 select-none'>
          <div className='relative flex flex-col w-[200px] h-[250px] bg-panel border border-primary/20 rounded-sm shadow-md p-3 overflow-hidden'>
            {/* Header Block Skeleton */}
            <div className='flex flex-col items-center gap-1 border-b border-primary/15 pb-2'>
              <div className='h-2 w-24 rounded-full bg-primary/40 animate-pulse' />
              <div className='h-1.5 w-16 rounded-full bg-ink-secondary/20' />
            </div>

            {/* Content Sections */}
            <div className='flex flex-col gap-2 pt-2.5'>
              <div className='flex flex-col gap-1'>
                <div className='h-1.5 w-12 rounded-full bg-primary/40' />
                <div className='h-1 w-full rounded-full bg-ink-secondary/20' />
                <div className='h-1 w-[85%] rounded-full bg-ink-secondary/20' />
              </div>

              <div className='flex flex-col gap-1'>
                <div className='h-1.5 w-16 rounded-full bg-primary/40' />
                <div className='flex flex-wrap gap-1'>
                  <div className='h-2 w-8 rounded-xs bg-primary/20' />
                  <div className='h-2 w-10 rounded-xs bg-primary/20' />
                  <div className='h-2 w-7 rounded-xs bg-primary/20' />
                </div>
              </div>

              <div className='flex flex-col gap-1'>
                <div className='h-1.5 w-14 rounded-full bg-primary/40' />
                <div className='h-1 w-[90%] rounded-full bg-ink-secondary/20' />
                <div className='h-1 w-[75%] rounded-full bg-ink-secondary/20' />
              </div>
            </div>
          </div>

          {/* Floating AI Progress Pill */}
          <div className='absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-panel px-3 py-1.5 text-xs font-semibold text-primary shadow-md border border-primary/20 max-w-[90%]'>
            <Sparkles className='h-3.5 w-3.5 text-primary shrink-0 animate-pulse' />
            <p className={`truncate transition-opacity duration-200 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
              {messages[index]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GeneratingCoverLetterCard({
  startedAt,
  onCancel,
}: GeneratingCardProps) {
  const messages = AI_COVER_LETTER_STATUS_MESSAGES;
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0,
  );

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        setIsFading(false);
      }, 250);
    }, 4500);
    return () => clearInterval(messageTimer);
  }, [messages.length]);

  useEffect(() => {
    const updateElapsed = () => {
      if (startedAt) {
        setElapsedSeconds(
          Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        );
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    };
    updateElapsed();
    const countTimer = setInterval(updateElapsed, 1000);
    return () => clearInterval(countTimer);
  }, [startedAt]);

  return (
    <div className='flex flex-col rounded-2xl border border-primary/20 bg-panel/70 p-5 backdrop-blur-md'>
      {/* Header */}
      <div className='flex items-center justify-between border-b border-primary/20 pb-3'>
        <div className='flex items-center gap-2'>
          <Sparkles className='h-4 w-4 text-primary animate-pulse' />
          <strong className='text-sm font-bold text-ink-primary'>
            Cover Letter (CL)
          </strong>
        </div>

        <div className='flex items-center gap-2'>
          <span className='flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-mono font-medium text-ink-secondary'>
            <Clock className='h-3.5 w-3.5' />
            {elapsedSeconds}s
          </span>

          {onCancel && (
            <Button
              size='sm'
              variant='outline'
              Icon={X}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Preview Skeleton */}
      <div className='pt-4'>
        <div className='group relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-background/50 p-4 select-none'>
          <div className='relative flex flex-col w-[200px] h-[250px] bg-panel border border-primary/20 rounded-sm shadow-md p-3 overflow-hidden'>
            {/* Letterhead Top */}
            <div className='flex flex-col gap-1 border-b border-primary/15 pb-2'>
              <div className='h-2 w-20 rounded-full bg-primary/40 animate-pulse' />
              <div className='h-1 w-24 rounded-full bg-ink-secondary/20' />
            </div>

            {/* Salutation & Paragraphs */}
            <div className='flex flex-col gap-2 pt-2'>
              <div className='h-1.5 w-16 rounded-full bg-ink-primary/30' />
              <div className='flex flex-col gap-1'>
                <div className='h-1 w-full rounded-full bg-ink-secondary/20' />
                <div className='h-1 w-[95%] rounded-full bg-ink-secondary/20' />
                <div className='h-1 w-[90%] rounded-full bg-ink-secondary/20' />
                <div className='h-1 w-[70%] rounded-full bg-ink-secondary/20' />
              </div>
              <div className='flex flex-col gap-1 pt-1'>
                <div className='h-1 w-full rounded-full bg-ink-secondary/20' />
                <div className='h-1 w-[92%] rounded-full bg-ink-secondary/20' />
                <div className='h-1 w-[60%] rounded-full bg-ink-secondary/20' />
              </div>
              {/* Signoff */}
              <div className='mt-2 h-2 w-14 rounded-full bg-primary/30' />
            </div>
          </div>

          {/* Floating AI Progress Pill */}
          <div className='absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-panel px-3 py-1.5 text-xs font-semibold text-primary shadow-md border border-primary/20 max-w-[90%]'>
            <Sparkles className='h-3.5 w-3.5 text-primary shrink-0 animate-pulse' />
            <p className={`truncate transition-opacity duration-200 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
              {messages[index]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
