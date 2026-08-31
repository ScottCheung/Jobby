'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  FileText,
  History,
  Mail,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { JobAnalysisSnapshot } from '@jobby/ui';
import { Button, EmptyPlaceHolder } from '@jobby/ui';
import { api, type TailoredResume } from '@/lib/api';
import { inspectJobLink } from '@/lib/job-link-inspection';
import { showGlobalToast } from '@/lib/toast';
import { formatRelativeTime } from '@/lib/use-relative-time';
import type { CareerProfile, UserSkill } from '@/lib/types';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { TailorQuickEntry } from './TailorQuickEntry';
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

export function AiStudioContent() {
  const router = useRouter();
  const confirm = useConfirmStore((state) => state.confirm);

  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [jobInput, setJobInput] = useState('');
  const [mockMode, setMockMode] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationMessages, setConversationMessages] = useState<
    TailorConversationMessage[]
  >([]);
  const [activeProfile, setActiveProfile] = useState<CareerProfile | null>(null);
  const [profileSkills, setProfileSkills] = useState<UserSkill[]>([]);

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
        router.push(`/ai-studio/tailor/${generatedResume.id}${targetDocHash}`);
      } else {
        setConversationMessages((messages) =>
          messages.map((message) =>
            message.id === `assistant-${requestId}` ?
              {
                ...message,
                state: 'complete',
                content: 'Generation started. Your result will appear in the workspace.',
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
      showGlobalToast(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteApplication = async (item: TailoredResume, e: React.MouseEvent) => {
    e.stopPropagation();
    const roleName =
      [item.job_title, item.company].filter(Boolean).join(' at ') ||
      'this tailored record';

    const confirmed = await confirm({
      title: 'Delete Application',
      message: `Are you sure you want to delete "${roleName}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      type: 'delete',
    });

    if (!confirmed) return;

    try {
      await api.deleteTailoredResume(item.id);
      setTailoredResumes((prev) => prev.filter((i) => i.id !== item.id));
      showGlobalToast('Tailored application deleted');
    } catch {
      showGlobalToast('Failed to delete application');
    }
  };

  const filteredResumes = useMemo(() => {
    if (!searchQuery.trim()) return tailoredResumes;
    const q = searchQuery.toLowerCase();
    return tailoredResumes.filter(
      (item) =>
        (item.job_title && item.job_title.toLowerCase().includes(q)) ||
        (item.company && item.company.toLowerCase().includes(q)),
    );
  }, [searchQuery, tailoredResumes]);

  return (
    <div className='w-full max-w-5xl mx-auto space-y-8 py-2 sm:py-6 pb-20'>
      {/* ── 1. Creation Entry & Conversation ── */}
      <section className='flex flex-col items-center justify-center pt-2'>
        <div className='w-full max-w-3xl'>
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
        </div>
      </section>

      {/* ── 2. Recent Applications Workspace Hub ── */}
      {conversationMessages.length === 0 && (
        <section className='space-y-5 pt-4 border-t border-border/50'>
          {/* Header & Search */}
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <History className='size-4 text-primary' />
              <h2 className='text-sm font-bold uppercase tracking-wider text-ink-primary'>
                Recent Tailored Applications
              </h2>
              <span className='rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary'>
                {tailoredResumes.length}
              </span>
            </div>

            {tailoredResumes.length > 0 && (
              <div className='relative w-full sm:w-64'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-ink-secondary/70' />
                <input
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search by role or company...'
                  className='w-full rounded-xl border border-border/70 bg-panel pl-8.5 pr-3 py-1.5 text-xs text-ink-primary placeholder:text-ink-secondary/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all'
                />
                {searchQuery && (
                  <button
                    type='button'
                    onClick={() => setSearchQuery('')}
                    className='absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-primary'
                  >
                    <X className='size-3.5' />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card Grid */}
          {filteredResumes.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {filteredResumes.map((item) => {
                const docLabels = documentTypeLabel(item);
                const isProcessing = item.status === 'processing';
                const timeAgo = isProcessing ? 'Generating...' : formatRelativeTime(item.created_at);

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/ai-studio/tailor/${item.id}#cv`)}
                    className='group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-panel/80 p-4.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md cursor-pointer select-none'
                  >
                    <div className='space-y-2 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0 space-y-0.5'>
                          <div className='flex items-center gap-1.5 text-xs font-bold text-ink-primary truncate'>
                            <Building2 className='size-3.5 text-primary shrink-0' />
                            <span className='truncate'>{item.company || 'Job Application'}</span>
                          </div>
                          <h3 className='text-sm font-extrabold text-ink-primary truncate group-hover:text-primary transition-colors'>
                            {item.job_title || 'Tailored Role'}
                          </h3>
                        </div>

                        {/* Delete Button */}
                        <button
                          type='button'
                          onClick={(e) => void handleDeleteApplication(item, e)}
                          className='opacity-0 group-hover:opacity-100 p-1 rounded-lg text-ink-secondary hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer'
                          title='Delete application record'
                        >
                          <Trash2 className='size-3.5' />
                        </button>
                      </div>

                      {/* Snippet / Description Preview */}
                      {item.job_description && (
                        <p className='text-[11px] text-ink-secondary line-clamp-2 leading-relaxed'>
                          {item.job_description.slice(0, 140)}...
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata & Badges */}
                    <div className='flex items-center justify-between border-t border-border/40 pt-3 mt-4'>
                      <div className='flex items-center gap-1.5'>
                        {isProcessing ? (
                          <span className='text-[9px] text-primary font-bold animate-pulse'>
                            AI Generating...
                          </span>
                        ) : (
                          docLabels.map((type, idx) => (
                            <span
                              key={idx}
                              className='rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-primary'
                            >
                              {type}
                            </span>
                          ))
                        )}
                      </div>

                      <div className='flex items-center gap-1 text-[10px] font-medium text-ink-secondary group-hover:text-primary transition-colors'>
                        <span>{timeAgo}</span>
                        <ArrowRight className='size-3 group-hover:translate-x-0.5 transition-transform' />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='rounded-2xl border border-dashed border-border p-10 text-center space-y-2'>
              <Briefcase className='size-8 text-ink-secondary/50 mx-auto' />
              <p className='text-xs font-semibold text-ink-secondary'>
                {searchQuery ? 'No tailored applications matching your search.' : 'No tailored applications created yet.'}
              </p>
              <p className='text-[11px] text-ink-secondary/70'>
                Paste a job posting URL or description above to generate your first tailored document.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Full-Screen Chat Overlay */}
      {isChatFullscreen && (
        <div className='fixed inset-0 z-50 flex flex-col bg-background-primary/95 backdrop-blur-xl animate-in fade-in duration-200'>
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
