/** @format */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { History, X } from 'lucide-react';
import type { JobAnalysisSnapshot } from '@jobby/ui';
import { api, type TailoredResume } from '@/lib/api';
import { inspectJobLink } from '@/lib/job-link-inspection';
import { showGlobalToast } from '@/lib/toast';
import { formatRelativeTime } from '@/lib/use-relative-time';
import type { CareerProfile, UserSkill } from '@/lib/types';
import { TailorQuickEntry } from './TailorQuickEntry';
import { TailoredResumeStudio } from './tailored-resume-studio';
import { documentTypeLabel } from './RecentTailorCarousel';
import type {
  RecognizedTailorJob,
  TailorConversationMessage,
} from './TailorConversation';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error('Match calculation took too long. You can retry it.')),
      timeoutMs,
    );
    promise.then(resolve, reject).finally(() => window.clearTimeout(timeoutId));
  });
}

export function AiStudioContent({ targetId: initialTargetId }: { targetId?: string } = {}) {
  const [activeTailorId, setActiveTailorId] = useState<string | undefined>(initialTargetId);
  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [jobInput, setJobInput] = useState('');
  const [mockMode, setMockMode] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [latestResume, setLatestResume] = useState<TailoredResume | null>(null);
  const [conversationMessages, setConversationMessages] = useState<
    TailorConversationMessage[]
  >([]);
  const [activeProfile, setActiveProfile] = useState<CareerProfile | null>(null);
  const [profileSkills, setProfileSkills] = useState<UserSkill[]>([]);
  const heroEntryRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTargetId) {
      setActiveTailorId(initialTargetId);
      requestAnimationFrame(() => {
        setTimeout(() => {
          studioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    }
  }, [initialTargetId]);

  useEffect(() => {
    let isCancelled = false;
    async function loadResumes() {
      try {
        const list = await api.tailoredResumes(50);
        if (!isCancelled) {
          setTailoredResumes(list);
        }
      } catch {
        // ignore
      }
    }
    void loadResumes();
    return () => {
      isCancelled = true;
    };
  }, []);

  const refreshProfileData = useCallback(async () => {
    const [profiles, skills] = await Promise.all([
      api.careerProfiles(),
      api.userSkills(),
    ]);
    setActiveProfile(
      profiles.find((profile) => profile.id === selectedProfileId) ||
        profiles.find((profile) => profile.is_default) ||
        profiles[0] ||
        null,
    );
    setProfileSkills(skills);
  }, [selectedProfileId]);

  useEffect(() => {
    void refreshProfileData().catch(() => undefined);
  }, [refreshProfileData]);

  const evaluateRecognizedJob = useCallback(
    async (messageId: string, job: RecognizedTailorJob) => {
      setConversationMessages((messages) =>
        messages.map((message) =>
          message.id === messageId ?
            {
              ...message,
              job,
              evaluation: undefined,
              isEvaluating: true,
              evaluationError: undefined,
            }
          : message,
        ),
      );

      try {
        const evaluation = await withTimeout(
          api.evaluateJobMatch({
            platform: job.platform,
            external_id: job.externalId,
            title: job.title,
            company: job.company,
            description: job.jobDescription,
            easy_apply: job.easyApply,
            last_posted_at: job.postedAt,
            technologies: job.technologies,
          }),
          8_000,
        );
        const score =
          evaluation.candidate.priority_score ??
          evaluation.decision.score ??
          evaluation.candidate.match_score;
        setConversationMessages((messages) =>
          messages.map((message) =>
            message.id === messageId ?
              {
                ...message,
                job,
                content: `Job identified${typeof score === 'number' ? ` with a ${Math.round(score * 100)}% match` : ''}.`,
                evaluation,
                isEvaluating: false,
                evaluationError: undefined,
              }
            : message,
          ),
        );
      } catch (error) {
        setConversationMessages((messages) =>
          messages.map((message) =>
            message.id === messageId ?
              {
                ...message,
                job,
                isEvaluating: false,
                evaluationError:
                  error instanceof Error ?
                    error.message
                  : 'Could not calculate the match score.',
              }
            : message,
          ),
        );
      }
    },
    [],
  );

  const handleInspectionStart = useCallback(
    (requestId: string, input: string) => {
      setConversationMessages((messages) => [
        ...messages,
        {
          id: `user-${requestId}`,
          role: 'user',
          kind: 'text',
          content: input,
        },
        {
          id: `assistant-${requestId}`,
          role: 'assistant',
          kind: 'status',
          state: 'loading',
          content: /^https?:\/\//i.test(input.trim()) ?
              'Opening the job page...'
            : 'Reading the job description...',
        },
      ]);
    },
    [],
  );

  const handleInspectionStatus = useCallback(
    (requestId: string, status: string) => {
      setConversationMessages((messages) =>
        messages.map((message) =>
          message.id === `assistant-${requestId}` && message.kind === 'status' ?
            { ...message, content: status }
          : message,
        ),
      );
    },
    [],
  );

  const handleInspectionSuccess = useCallback((job: RecognizedTailorJob) => {
    const messageId = `assistant-${job.requestId}`;
    setConversationMessages((messages) =>
      messages.map((message) =>
        message.id === messageId ?
          {
            ...message,
            kind: 'job',
            state: 'complete',
            content: `Job identified: ${job.title || 'Untitled role'}${job.company ? ` at ${job.company}` : ''}.`,
            job,
            isEvaluating: true,
          }
        : message,
      ),
    );

    void evaluateRecognizedJob(messageId, job);
  }, [evaluateRecognizedJob]);

  const handleInspectionError = useCallback(
    (requestId: string, message: string) => {
      setConversationMessages((messages) =>
        messages.map((item) =>
          item.id === `assistant-${requestId}` ?
            {
              ...item,
              kind: 'status',
              state: 'error',
              content: message,
            }
          : item,
        ),
      );
    },
    [],
  );

  const handleRetryEvaluation = useCallback(
    (messageId: string, job: RecognizedTailorJob) => {
      void evaluateRecognizedJob(messageId, job);
    },
    [evaluateRecognizedJob],
  );

  const handleClaimSkill = useCallback(
    async (messageId: string, job: RecognizedTailorJob, skill: string) => {
      try {
        await api.addUserSkill(skill);
        await refreshProfileData();
        await evaluateRecognizedJob(messageId, job);
        showGlobalToast(`Added "${skill}" to your profile skills.`);
      } catch (error) {
        showGlobalToast(
          error instanceof Error ? error.message : `Could not add "${skill}".`,
        );
      }
    },
    [evaluateRecognizedJob, refreshProfileData],
  );

  const handleUnclaimSkill = useCallback(
    async (messageId: string, job: RecognizedTailorJob, skill: string) => {
      try {
        await api.deleteUserSkill(skill);
        await refreshProfileData();
        await evaluateRecognizedJob(messageId, job);
        showGlobalToast(`Removed "${skill}" from your profile skills.`);
      } catch (error) {
        showGlobalToast(
          error instanceof Error ?
            error.message
          : `Could not remove "${skill}".`,
        );
      }
    },
    [evaluateRecognizedJob, refreshProfileData],
  );

  const handleUpdateJob = useCallback(
    (
      messageId: string,
      job: RecognizedTailorJob,
      updates: Partial<JobAnalysisSnapshot>,
    ) => {
      const updatedJob: RecognizedTailorJob = {
        ...job,
        platform: updates.platform ?? job.platform,
        externalId: updates.externalId ?? job.externalId,
        url: updates.url ?? job.url,
        title: updates.title ?? job.title,
        company: updates.company ?? job.company,
        location: updates.location ?? job.location,
        postedAt:
          updates.lastPostedAt ?? updates.firstPostedAt ?? job.postedAt,
        jobDescription: updates.description ?? job.jobDescription,
        technologies: updates.technologies ?? job.technologies,
        easyApply: updates.easyApply ?? job.easyApply,
      };
      void evaluateRecognizedJob(messageId, updatedJob);
    },
    [evaluateRecognizedJob],
  );

  const handleReDetect = useCallback(
    (messageId: string, job: RecognizedTailorJob) => {
      if (!job.url) {
        void evaluateRecognizedJob(messageId, job);
        return;
      }

      setConversationMessages((messages) =>
        messages.map((message) =>
          message.id === messageId ? { ...message, isEvaluating: true } : message,
        ),
      );
      void inspectJobLink(job.url)
        .then((inspected) =>
          evaluateRecognizedJob(messageId, {
            ...job,
            url: inspected.url || job.url,
            platform: inspected.platform || job.platform,
            externalId: inspected.external_id || job.externalId,
            title: inspected.title || job.title,
            company: inspected.company || job.company,
            location: inspected.location,
            postedAt:
              inspected.last_posted_at ||
              inspected.first_posted_at ||
              job.postedAt,
            jobDescription: inspected.job_description || job.jobDescription,
            technologies: inspected.technologies || [],
            easyApply: inspected.easy_apply,
          }),
        )
        .catch((error) => {
          setConversationMessages((messages) =>
            messages.map((message) =>
              message.id === messageId ?
                {
                  ...message,
                  isEvaluating: false,
                  evaluationError:
                    error instanceof Error ?
                      error.message
                    : 'Could not re-detect this job.',
                }
              : message,
            ),
          );
        });
    },
    [evaluateRecognizedJob],
  );

  const handleStartGeneration = async (params: {
    docType: 'resume' | 'cover_letter' | 'both';
    jobTitle: string;
    company: string;
    jobDescription: string;
    lastPostedAt?: string;
    mock?: boolean;
    careerProfileId?: string;
  }) => {
    const requestId = Date.now().toString();
    const roleLabel =
      [params.jobTitle, params.company].filter(Boolean).join(' at ') ||
      'the pasted job description';
    setConversationMessages((messages) =>
      [
        ...messages,
        {
          id: `user-${requestId}`,
          role: 'user' as const,
          kind: 'text' as const,
          content: `Tailor ${params.docType === 'both' ? 'my CV and cover letter' : params.docType === 'resume' ? 'my CV' : 'my cover letter'} for ${roleLabel}.`,
        },
        {
          id: `assistant-${requestId}`,
          role: 'assistant' as const,
          kind: 'status' as const,
          state: 'loading' as const,
          content: 'Tailoring your documents now...',
        },
      ],
    );
    setIsGenerating(true);

    try {
      const result = await api.reviewJob({
        job_description: params.jobDescription,
        title: params.jobTitle || undefined,
        company: params.company || undefined,
        last_posted_at: params.lastPostedAt || undefined,
        doc_type: params.docType,
        mock: params.mock,
        career_profile_id: params.careerProfileId,
      });

      const generatedResume = result.tailored_resume;
      if (generatedResume) {
        showGlobalToast('Tailored documents generated successfully!');
        const targetDocHash = params.docType === 'cover_letter' ? '#cl' : '#cv';
        setLatestResume(generatedResume);
        setActiveTailorId(generatedResume.id);
        setTailoredResumes((prev) => [
          generatedResume,
          ...prev.filter((i) => i.id !== generatedResume.id),
        ]);
        setConversationMessages((messages) =>
          messages.map((message) =>
            message.id === `assistant-${requestId}` ?
              {
                ...message,
                state: 'complete',
                content: 'Done — your tailored documents are ready below.',
              }
            : message,
          ),
        );
        window.history.replaceState(
          null,
          '',
          `/ai-studio/tailor/${generatedResume.id}${targetDocHash}`,
        );
        requestAnimationFrame(() => {
          setTimeout(() => {
            studioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        });
      } else {
        setConversationMessages((messages) =>
          messages.map((message) =>
            message.id === `assistant-${requestId}` ?
              {
                ...message,
                state: 'complete',
                content: 'Generation started. Your result will appear below when it is ready.',
              }
            : message,
          ),
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Generation failed, please try again.';
      setConversationMessages((messages) =>
        messages.map((item) =>
          item.id === `assistant-${requestId}` ?
            { ...item, state: 'error', content: message }
          : item,
        ),
      );
      showGlobalToast(
        message,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectRecentCard = (item: TailoredResume) => {
    setActiveTailorId(item.id);
    window.history.replaceState(null, '', `/ai-studio/tailor/${item.id}#cv`);
    requestAnimationFrame(() => {
      setTimeout(() => {
        studioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    });
  };

  return (
    <div className='w-full space-y-8'>
      {/* ── 1. Hero Section: GPT-style Centered Dialog with 5 Recent Cards Below ── */}
      <div
        ref={heroEntryRef}
        className='flex min-h-[85vh] w-full flex-col items-center justify-center py-6'
      >
        <div className='w-full max-w-3xl space-y-6'>
          <TailorQuickEntry
            onGenerationStart={handleStartGeneration}
            isGenerating={isGenerating}
            value={jobInput}
            onValueChange={setJobInput}
            mockMode={mockMode}
            onMockModeChange={setMockMode}
            selectedProfileId={selectedProfileId}
            onProfileChange={setSelectedProfileId}
            conversationMessages={conversationMessages}
            onInspectionStart={handleInspectionStart}
            onInspectionStatus={handleInspectionStatus}
            onInspectionSuccess={handleInspectionSuccess}
            onInspectionError={handleInspectionError}
            onRetryEvaluation={handleRetryEvaluation}
            onClaimSkill={handleClaimSkill}
            onUnclaimSkill={handleUnclaimSkill}
            onUpdateJob={handleUpdateJob}
            onReDetect={handleReDetect}
            activeProfile={activeProfile}
            profileSkills={profileSkills}
          />

          {tailoredResumes.length > 0 && (
            <div className='space-y-2.5 pt-2'>
              <div className='flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-secondary'>
                <History className='h-3.5 w-3.5 text-primary' />
                <span>Recent Tailors</span>
              </div>
              <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'>
                {tailoredResumes.slice(0, 5).map((item) => {
                  const docLabels = documentTypeLabel(item);
                  const isProcessing = item.status === 'processing';
                  const timeAgo = isProcessing ? 'Generating' : formatRelativeTime(item.created_at);

                  return (
                    <button
                      key={item.id}
                      type='button'
                      onClick={() => handleSelectRecentCard(item)}
                      className='group relative flex min-h-[92px] flex-col justify-between rounded-2xl border border-primary/15 bg-popover dark:bg-zinc-900 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xs cursor-pointer select-none'
                    >
                      <div className='w-full min-w-0 space-y-0.5'>
                        <p className='truncate text-[10px] font-bold text-primary'>
                          {item.job_title || 'Tailored Role'}
                        </p>
                        <p className='truncate text-xs font-bold text-ink-primary'>
                          {item.company || 'Job Application'}
                        </p>
                      </div>
                      <div className='flex items-center gap-1.5 pt-2'>
                        {isProcessing ? (
                          <span className='text-[8px] text-primary font-bold animate-pulse'>
                            Working...
                          </span>
                        ) : (
                          docLabels.map((type, idx) => (
                            <span
                              key={idx}
                              className='rounded-md bg-primary px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white shadow-2xs'
                            >
                              {type}
                            </span>
                          ))
                        )}
                        <span className='ml-auto text-[9px] font-medium text-ink-secondary'>
                          {timeAgo}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div ref={studioRef} className='scroll-mt-0'>
        <TailoredResumeStudio
          targetId={activeTailorId}
          latestResume={latestResume}
          compactEntry={
            <TailorQuickEntry
              compact
              onGenerationStart={handleStartGeneration}
              isGenerating={isGenerating}
              value={jobInput}
              onValueChange={setJobInput}
              mockMode={mockMode}
              onMockModeChange={setMockMode}
              selectedProfileId={selectedProfileId}
              onProfileChange={setSelectedProfileId}
              conversationMessages={conversationMessages}
              onInspectionStart={handleInspectionStart}
              onInspectionStatus={handleInspectionStatus}
              onInspectionSuccess={handleInspectionSuccess}
              onInspectionError={handleInspectionError}
              onRetryEvaluation={handleRetryEvaluation}
              onClaimSkill={handleClaimSkill}
              onUnclaimSkill={handleUnclaimSkill}
              onUpdateJob={handleUpdateJob}
              onReDetect={handleReDetect}
              activeProfile={activeProfile}
              profileSkills={profileSkills}
              onOpenFullscreen={() => setIsChatFullscreen(true)}
            />
          }
        />
      </div>

      {/* Full-Screen Chat Overlay */}
      {isChatFullscreen && (
        <div className='fixed inset-0 z-50 flex flex-col bg-background-primary/95 backdrop-blur-xl animate-in fade-in duration-200'>
          {/* Top Bar with Title and Exit Button */}
          <div className='flex items-center justify-between border-b border-border/40 px-6 py-4'>
            <div className='flex items-center gap-2.5'>
              <Image
                src="/favicon.svg"
                alt="Jobby Logo"
                width={24}
                height={24}
                className="size-6 object-contain"
              />
              <div>
                <h2 className='text-sm font-bold text-ink-primary'>AI Tailor Chat</h2>
                <p className='text-[11px] text-ink-secondary'>Paste JD or URL to tailor resume & cover letter</p>
              </div>
            </div>

            <button
              type='button'
              onClick={() => setIsChatFullscreen(false)}
              className='flex items-center gap-1.5 rounded-full border border-border/70 bg-panel px-3.5 py-1.5 text-xs font-bold text-ink-primary hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer shadow-xs'
              aria-label='Exit full-screen chat'
            >
              <X className='size-4' />
              <span>Exit</span>
            </button>
          </div>

          {/* Scrollable Conversation Body & Bottom Input */}
          <div className='flex-1 overflow-y-auto px-4 py-6'>
            <div className='mx-auto max-w-3xl space-y-6'>
              <TailorQuickEntry
                onGenerationStart={(params) => {
                  void handleStartGeneration(params);
                }}
                isGenerating={isGenerating}
                value={jobInput}
                onValueChange={setJobInput}
                mockMode={mockMode}
                onMockModeChange={setMockMode}
                selectedProfileId={selectedProfileId}
                onProfileChange={setSelectedProfileId}
                conversationMessages={conversationMessages}
                onInspectionStart={handleInspectionStart}
                onInspectionStatus={handleInspectionStatus}
                onInspectionSuccess={handleInspectionSuccess}
                onInspectionError={handleInspectionError}
                onRetryEvaluation={handleRetryEvaluation}
                onClaimSkill={handleClaimSkill}
                onUnclaimSkill={handleUnclaimSkill}
                onUpdateJob={handleUpdateJob}
                onReDetect={handleReDetect}
                activeProfile={activeProfile}
                profileSkills={profileSkills}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
