/** @format */

import { useEffect, useState } from 'react';
import { Sparkles, Clock, X } from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { ShimmerText } from '@jobby/ui/components/ShimmerText';
import type { DocType } from '../../shared/contracts/tailored-resume';
import {
  AI_TAILOR_STATUS_MESSAGES,
  AI_COVER_LETTER_STATUS_MESSAGES,
} from '../constants/ai-status-messages';
import { Number } from '@jobby/ui/components/UI/Number/Number';

interface BaseGeneratingCardProps {
  jobTitle?: string | null;
  company?: string | null;
  startedAt?: number;
  onCancel?: () => void;
}

export function GeneratingResumeCard({
  startedAt,
  onCancel,
}: BaseGeneratingCardProps) {
  const messages = AI_TAILOR_STATUS_MESSAGES;
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0,
  );

  // Status message rotation (gentle 5.5s interval)
  useEffect(() => {
    const messageTimer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        setIsFading(false);
      }, 250);
    }, 5500);

    return () => clearInterval(messageTimer);
  }, [messages.length]);

  // Persistent timer based on absolute startedAt timestamp
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
    <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5 !p-3.5 w-full min-w-0 max-w-full box-border'>
      {/* Header - Matches real Resume showcase header 1:1 */}
      <div className='flex items-center justify-between gap-2 border-b border-primary/40 pb-2.5 w-full min-w-0'>
        <div className='min-w-0 flex-1 flex items-center gap-1.5'>
          <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
          <strong className='text-xs font-bold text-foreground truncate'>
            Resume
          </strong>
        </div>

        {/* Action Buttons: Timer (Outline) + Cancel (Default) matching Copy + Download */}
        <div className='flex items-center gap-1.5 shrink-0'>
          <Button
            size='sm'
            variant='outline'
            Icon={Clock}
            className='pointer-events-none select-none !px-2 font-mono text-xs font-medium'
            title={`Generation running for ${elapsedSeconds}s`}
          >
            <Number value={elapsedSeconds} />s
          </Button>

          <Button
            size='sm'
            variant='default'
            Icon={X}
            onClick={onCancel}
            title='Cancel generation'
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Preview Area - Matches ResumePdfPreview container and realistic paper scale */}
      <div className='flex flex-col gap-2 pt-1 w-full min-w-0'>
        <div className='group relative flex h-[150px] w-full items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-muted/40 p-3 shadow-2xs select-none'>
          {/* Compact Document Paper Preview Skeleton */}
          <div className='relative flex flex-col w-[145px] h-[180px] bg-card border border-primary/20 rounded-xs shadow-md p-2.5 overflow-hidden scale-75'>
            {/* Header Block Skeleton */}
            <div className='flex flex-col items-center gap-0.5 border-b border-primary/15 pb-1.5'>
              <div className='h-1.5 w-16 rounded-full bg-primary/35 animate-pulse' />
              <div className='h-1 w-10 rounded-full bg-muted-foreground/30' />
              <div className='flex items-center gap-0.5 mt-0.5'>
                <div className='h-0.5 w-5 rounded-full bg-muted-foreground/20' />
                <span className='text-[5px] text-muted-foreground/30'>•</span>
                <div className='h-0.5 w-5 rounded-full bg-muted-foreground/20' />
                <span className='text-[5px] text-muted-foreground/30'>•</span>
                <div className='h-0.5 w-5 rounded-full bg-muted-foreground/20' />
              </div>
            </div>

            {/* Resume Content Sections Skeleton */}
            <div className='flex flex-col gap-1.5 pt-1.5'>
              {/* Executive Summary */}
              <div className='flex flex-col gap-0.5'>
                <div className='h-1 w-8 rounded-full bg-primary/35' />
                <div className='flex flex-col gap-0.5'>
                  <div className='h-0.5 w-full rounded-full bg-muted-foreground/20' />
                  <div className='h-0.5 w-[90%] rounded-full bg-muted-foreground/20' />
                  <div className='h-0.5 w-[75%] rounded-full bg-muted-foreground/20' />
                </div>
              </div>

              {/* Core Competencies Tag Chips */}
              <div className='flex flex-col gap-0.5'>
                <div className='h-1 w-10 rounded-full bg-primary/35' />
                <div className='flex flex-wrap gap-0.5'>
                  <div className='h-1.5 w-5 rounded-xs bg-primary/15' />
                  <div className='h-1.5 w-6 rounded-xs bg-primary/15' />
                  <div className='h-1.5 w-4 rounded-xs bg-primary/15' />
                  <div className='h-1.5 w-5 rounded-xs bg-primary/15' />
                </div>
              </div>

              {/* Work Experience */}
              <div className='flex flex-col gap-0.5'>
                <div className='h-1 w-8 rounded-full bg-primary/35' />
                <div className='flex justify-between items-center'>
                  <div className='h-0.5 w-10 rounded-full bg-foreground/30' />
                  <div className='h-0.5 w-5 rounded-full bg-muted-foreground/20' />
                </div>
                <div className='flex flex-col gap-0.5 pl-0.5 border-l border-primary/20'>
                  <div className='h-0.5 w-[92%] rounded-full bg-muted-foreground/20' />
                  <div className='h-0.5 w-[85%] rounded-full bg-muted-foreground/20' />
                  <div className='h-0.5 w-[70%] rounded-full bg-muted-foreground/20' />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-left AI Status Badge - Exactly replacing normal document pill */}
          <div className='absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-md bg-panel backdrop-blur-xs px-2 py-1 text-[11px] font-medium text-primary shadow-xs max-w-[88%] transition-all'>
            <Sparkles className='h-3 w-3 text-primary shrink-0' />
            <p
              className={`truncate transition-opacity duration-200 ${
                isFading ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <ShimmerText>{messages[index]}</ShimmerText>
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
}: BaseGeneratingCardProps) {
  const messages = AI_COVER_LETTER_STATUS_MESSAGES;
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0,
  );

  // Status message rotation (gentle 5.5s interval)
  useEffect(() => {
    const messageTimer = setInterval(
      () => {
        setIsFading(true);
        setTimeout(() => {
          setIndex((prev) => (prev + 1) % messages.length);
          setIsFading(false);
        }, 250);
      },
      Math.random() * (5500 - 3000) + 3000,
    );

    return () => clearInterval(messageTimer);
  }, [messages.length]);

  // Persistent timer based on absolute startedAt timestamp
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
    <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5 !p-3.5 w-full min-w-0 max-w-full box-border'>
      {/* Header - Matches real Cover Letter showcase header 1:1 */}
      <div className='flex items-center justify-between gap-2 border-b border-primary/40 pb-2.5 w-full min-w-0'>
        <div className='min-w-0 flex-1 flex items-center gap-1.5'>
          <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
          <strong className='text-xs font-bold text-foreground truncate'>
            Cover Letter
          </strong>
        </div>

        {/* Action Buttons: Timer (Outline) + Cancel (Default) matching Copy + Download */}
        <div className='flex items-center gap-1.5 shrink-0'>
          <Button
            size='sm'
            variant='outline'
            Icon={Clock}
            className='pointer-events-none select-none !px-2 font-mono text-xs font-medium'
            title={`Generation running for ${elapsedSeconds}s`}
          >
            <Number value={elapsedSeconds} />s
          </Button>

          <Button
            size='sm'
            variant='default'
            Icon={X}
            onClick={onCancel}
            title='Cancel generation'
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Preview Area - Matches CoverLetterPdfPreview container and realistic paper scale */}
      <div className='flex flex-col gap-2 pt-1 w-full min-w-0'>
        <div className='group relative flex h-[150px] w-full items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-muted/40 p-3 shadow-2xs select-none'>
          {/* Compact Cover Letter Paper Preview Skeleton */}
          <div className='relative flex flex-col w-[145px] h-[180px] bg-card border border-primary/20 rounded-xs shadow-md p-2.5 overflow-hidden scale-75'>
            {/* Letterhead Top */}
            <div className='flex flex-col gap-0.5 border-b border-primary/15 pb-1.5'>
              <div className='h-1.5 w-14 rounded-full bg-primary/35 animate-pulse' />
              <div className='h-0.5 w-16 rounded-full bg-muted-foreground/25' />
            </div>

            {/* Recipient & Salutation */}
            <div className='flex flex-col gap-0.5 pt-1.5'>
              <div className='h-0.5 w-8 rounded-full bg-muted-foreground/20' />
              <div className='h-1 w-12 rounded-full bg-foreground/30' />
              <div className='h-0.5 w-10 rounded-full bg-muted-foreground/30 mt-0.5' />
            </div>

            {/* Paragraphs */}
            <div className='flex flex-col gap-1.5 pt-1'>
              <div className='flex flex-col gap-0.5'>
                <div className='h-0.5 w-full rounded-full bg-muted-foreground/20' />
                <div className='h-0.5 w-[96%] rounded-full bg-muted-foreground/20' />
                <div className='h-0.5 w-[92%] rounded-full bg-muted-foreground/20' />
                <div className='h-0.5 w-[70%] rounded-full bg-muted-foreground/20' />
              </div>
              <div className='flex flex-col gap-0.5'>
                <div className='h-0.5 w-full rounded-full bg-muted-foreground/20' />
                <div className='h-0.5 w-[94%] rounded-full bg-muted-foreground/20' />
                <div className='h-0.5 w-[88%] rounded-full bg-muted-foreground/20' />
                <div className='h-0.5 w-[60%] rounded-full bg-muted-foreground/20' />
              </div>
            </div>

            {/* Sign-off Signature */}
            <div className='flex flex-col gap-0.5 mt-1.5'>
              <div className='h-0.5 w-6 rounded-full bg-muted-foreground/20' />
              <div className='h-1 w-10 rounded-full bg-primary/30 mt-0.5' />
            </div>
          </div>

          {/* Bottom-left AI Status Badge - Exactly replacing normal document pill */}
          <div className='absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-md bg-panel backdrop-blur-xs px-2 py-1 text-[11px] font-medium text-primary shadow-xs max-w-[88%] transition-all'>
            <Sparkles className='h-3 w-3 text-primary shrink-0' />
            <p
              className={`truncate transition-opacity duration-200 ${
                isFading ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <ShimmerText>{messages[index]}</ShimmerText>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AiGeneratingCardProps {
  jobTitle?: string | null;
  company?: string | null;
  docType?: DocType | null;
  startedAt?: number;
  onCancel?: () => void;
}

export function AiGeneratingCard({
  jobTitle,
  company,
  docType = 'resume',
  startedAt,
  onCancel,
}: AiGeneratingCardProps) {
  if (docType === 'cover_letter') {
    return (
      <GeneratingCoverLetterCard
        jobTitle={jobTitle}
        company={company}
        startedAt={startedAt}
        onCancel={onCancel}
      />
    );
  }

  if (docType === 'both') {
    return (
      <div className='flex flex-col gap-3 w-full min-w-0'>
        <GeneratingResumeCard
          jobTitle={jobTitle}
          company={company}
          startedAt={startedAt}
          onCancel={onCancel}
        />
        <GeneratingCoverLetterCard
          jobTitle={jobTitle}
          company={company}
          startedAt={startedAt}
          onCancel={onCancel}
        />
      </div>
    );
  }

  return (
    <GeneratingResumeCard
      jobTitle={jobTitle}
      company={company}
      startedAt={startedAt}
      onCancel={onCancel}
    />
  );
}
