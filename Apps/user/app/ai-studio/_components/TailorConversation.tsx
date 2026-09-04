/** @format */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  JobAnalysisPanel,
  type JobAnalysisCareerProfile,
  type JobAnalysisDocType,
  type JobAnalysisGeneration,
  type JobAnalysisSnapshot,
  type JobAnalysisUserSkill,
  type JobDescriptionOpenPayload,
} from '@jobby/ui/components/UI/job-analysis';
import { Modal, StructuredJobDescription } from '@jobby/ui';
import { cn } from '@/lib/utils';
import type { JobMatchEvaluation } from '@/lib/api';

export interface RecognizedTailorJob {
  requestId: string;
  input: string;
  url?: string;
  platform: string;
  externalId: string;
  title: string;
  company: string;
  location?: string;
  postedAt?: string;
  jobDescription: string;
  technologies: string[];
  easyApply?: boolean;
}

export interface TailorConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'status' | 'job';
  content: string;
  state?: 'loading' | 'error' | 'complete';
  job?: RecognizedTailorJob;
  evaluation?: JobMatchEvaluation;
  isEvaluating?: boolean;
  evaluationError?: string;
}

interface TailorConversationProps {
  messages: TailorConversationMessage[];
  onTailor: (job: RecognizedTailorJob, type: JobAnalysisDocType) => void;
  onRetryEvaluation: (messageId: string, job: RecognizedTailorJob) => void;
  onClaimSkill: (messageId: string, job: RecognizedTailorJob, skill: string) => Promise<void>;
  onUnclaimSkill: (messageId: string, job: RecognizedTailorJob, skill: string) => Promise<void>;
  onUpdateJob: (
    messageId: string,
    job: RecognizedTailorJob,
    updates: Partial<JobAnalysisSnapshot>,
  ) => void;
  onReDetect: (messageId: string, job: RecognizedTailorJob) => void;
  activeProfile?: JobAnalysisCareerProfile | null;
  profileSkills?: JobAnalysisUserSkill[];
  activeGeneration?: JobAnalysisGeneration | null;
}

function JobResultBubble({
  message,
  onTailor,
  onRetryEvaluation,
  onClaimSkill,
  onUnclaimSkill,
  onUpdateJob,
  onReDetect,
  onOpenJobDescription,
  activeProfile,
  profileSkills,
  activeGeneration,
}: {
  message: TailorConversationMessage;
  onTailor: TailorConversationProps['onTailor'];
  onRetryEvaluation: TailorConversationProps['onRetryEvaluation'];
  onClaimSkill: TailorConversationProps['onClaimSkill'];
  onUnclaimSkill: TailorConversationProps['onUnclaimSkill'];
  onUpdateJob: TailorConversationProps['onUpdateJob'];
  onReDetect: TailorConversationProps['onReDetect'];
  onOpenJobDescription: (payload: JobDescriptionOpenPayload) => void;
  activeProfile?: JobAnalysisCareerProfile | null;
  profileSkills?: JobAnalysisUserSkill[];
  activeGeneration?: JobAnalysisGeneration | null;
}) {
  const job = message.job;
  if (!job) return null;

  const snapshot: JobAnalysisSnapshot = {
    platform: job.platform,
    externalId: job.externalId,
    url: job.url || job.input,
    title: job.title,
    company: job.company,
    location: job.location,
    firstPostedAt: job.postedAt,
    lastPostedAt: job.postedAt,
    description: job.jobDescription,
    technologies: job.technologies,
    easyApply: job.easyApply,
  };

  return (
    <div
      data-testid='tailor-result-card'
      className='mr-auto flex w-full max-w-2xl shrink-0 flex-col gap-4 overflow-hidden rounded-score-card bg-primary/10 dark:bg-primary/20 p-4'
    >
      <JobAnalysisPanel
      hasBackground = {false}
        latestInspection={{ kind: 'job', snapshot }}
        latestMatch={message.evaluation || null}
        isMatchLoading={message.isEvaluating}
        isInspecting={false}
        error={message.evaluationError}
        onRetryMatch={() => onRetryEvaluation(message.id, job)}
        onTailor={(type) => onTailor(job, type)}
        activeGeneration={activeGeneration}
        activeProfile={activeProfile}
        profileSkills={profileSkills}
        onClaimSkill={(skill) => onClaimSkill(message.id, job, skill)}
        onUnclaimSkill={(skill) => onUnclaimSkill(message.id, job, skill)}
        onUpdateJobSnapshot={(updates) =>
          onUpdateJob(message.id, job, updates)
        }
        onReDetect={() => onReDetect(message.id, job)}
        onOpenJobDescription={onOpenJobDescription}
        initialDescriptionExpanded
      />
    </div>
  );
}

export function TailorConversation({
  messages,
  onTailor,
  onRetryEvaluation,
  onClaimSkill,
  onUnclaimSkill,
  onUpdateJob,
  onReDetect,
  activeProfile,
  profileSkills,
  activeGeneration,
}: TailorConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [jobDescriptionPreview, setJobDescriptionPreview] =
    useState<JobDescriptionOpenPayload | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div
      aria-live='polite'
      className='mx-auto flex w-full max-w-3xl flex-col gap-3 py-2'
    >
      {messages.map((message) => {
        if (message.kind === 'job') {
          return (
            <JobResultBubble
              key={message.id}
              message={message}
              onTailor={onTailor}
              onRetryEvaluation={onRetryEvaluation}
              onClaimSkill={onClaimSkill}
              onUnclaimSkill={onUnclaimSkill}
              onUpdateJob={onUpdateJob}
              onReDetect={onReDetect}
              onOpenJobDescription={setJobDescriptionPreview}
              activeProfile={activeProfile}
              profileSkills={profileSkills}
              activeGeneration={activeGeneration}
            />
          );
        }

        return (
          <div
            key={message.id}
            className={cn(
              'max-w-[78%] shrink-0  whitespace-pre-wrap break-words [overflow-wrap:anywhere] px-3.5 py-2.5 text-xs leading-relaxed shadow-xs',
              message.role === 'user' ?
                'ml-auto rounded-2xl rounded-br-xs bg-primary text-primary-foreground font-medium'
              : message.state === 'error' ?
                'mr-auto rounded-2xl rounded-bl-xs border border-destructive/30 bg-destructive/10 text-destructive'
              : 'mr-auto rounded-2xl rounded-bl-xs border border-primary/20 bg-panel text-ink-primary',
            )}
          >
            <span className='flex min-w-0 items-center gap-2'>
              {message.state === 'loading' && (
                <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin text-primary' />
              )}
              <span
                className={cn(
                  message.state === 'loading' &&
                    'animate-text-shimmer animate-text-shimmer-primary',
                  'min-w-0 [overflow-wrap:anywhere]',
                )}
              >
                {message.content}
              </span>
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
      <Modal
        isOpen={Boolean(jobDescriptionPreview)}
        onClose={() => setJobDescriptionPreview(null)}
        className='h-[78vh] w-[94vw] max-w-5xl text-ink-primary'
      >
        <div className='px-6 py-5'>
          <h2 className='text-base font-semibold'>
            {jobDescriptionPreview?.title || 'Job Description'}
          </h2>
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto px-6 pb-6'>
          <StructuredJobDescription
            content={jobDescriptionPreview?.description || ''}
          />
        </div>
      </Modal>
    </div>
  );
}
