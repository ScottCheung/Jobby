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
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  JobAnalysisDocType,
  JobAnalysisSnapshot,
} from '@jobby/ui/components/UI/job-analysis';
import {
  Button,
  EmptyPlaceHolder,
  InputField,
  Modal,
  StructuredJobDescription,
  Textarea,
} from '@jobby/ui';
import { api, type TailoredResume } from '@/lib/api';
import { inspectJobLink } from '@/lib/job-link-inspection';
import { showGlobalToast } from '@/lib/toast';
import { formatRelativeTime } from '@/lib/use-relative-time';
import type { CareerProfile, UserSkill } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { useConsole } from '@/components/ConsoleContext';
import { TailorQuickEntry } from './TailorQuickEntry';
import { documentTypeLabel } from './RecentTailorCarousel';
import { TailoredResumeSearchModal } from './TailoredResumeSearchModal';
import { PlatformAtsShowcase } from './PlatformAtsShowcase';
import positiveQuotes from './positive-quotes.json';
import {
  TailorConversation,
  type RecognizedTailorJob,
  type TailorConversationMessage,
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

function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * positiveQuotes.length);
  return positiveQuotes[randomIndex];
}

export function AiStudioContent() {
  const router = useRouter();
  const confirm = useConfirmStore((state) => state.confirm);
  const { user, profile, jobHuntingProfile } = useConsole();

  const [greeting, setGreeting] = useState('Good day');
  const [quote, setQuote] = useState(positiveQuotes[0]);

  const displayName = useMemo(() => {
    if (profile?.preferred_name?.trim()) return profile.preferred_name.trim();
    if (profile?.first_name?.trim()) return profile.first_name.trim();
    if (user?.display_name && !user.display_name.includes('@')) {
      return user.display_name;
    }
    return user?.email?.split('@')[0] || '';
  }, [profile, user]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting('Good morning');
    else if (hour >= 12 && hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    setQuote(getRandomQuote());
  }, []);

  const handleRefreshQuote = () => {
    setQuote(getRandomQuote());
  };

  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [jobInput, setJobInput] = useState('');
  const [mockMode, setMockMode] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationMessages, setConversationMessages] = useState<
    TailorConversationMessage[]
  >([]);
  const [activeProfile, setActiveProfile] = useState<CareerProfile | null>(null);
  const [profileSkills, setProfileSkills] = useState<UserSkill[]>([]);

  const { searchTitle, searchLocation } = useMemo(() => {
    const resumeBasics = (activeProfile as any)?.resume_data?.basics;
    const headline = resumeBasics?.headline?.trim();
    const latestExpTitle = (activeProfile as any)?.resume_data?.experience?.[0]?.title?.trim();
    const rawProfileName = activeProfile?.name?.trim() || '';
    const isGenericProfileName =
      !rawProfileName ||
      /^default(?:\s+profile)?$/i.test(rawProfileName) ||
      /^master(?:\s+resume)?$/i.test(rawProfileName);

    const title =
      headline ||
      latestExpTitle ||
      (!isGenericProfileName ? rawProfileName : '') ||
      jobHuntingProfile?.search_terms?.[0] ||
      profile?.title ||
      '';

    const locObj = resumeBasics?.location;
    const locParts = [locObj?.city, locObj?.state, locObj?.country]
      .filter(Boolean)
      .map((s) => String(s).trim());
    const locFromProfile = locParts.length > 0 ? locParts.join(', ') : locObj?.address?.trim() || '';

    const location =
      locFromProfile ||
      jobHuntingProfile?.search_location ||
      [profile?.current_city, profile?.state, profile?.country].filter(Boolean).join(', ') ||
      '';

    return { searchTitle: title, searchLocation: location };
  }, [activeProfile, jobHuntingProfile, profile]);

  // Job Confirmation Modal State
  const [confirmJob, setConfirmJob] = useState<{
    job: RecognizedTailorJob;
    docType: JobAnalysisDocType;
  } | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmCompany, setConfirmCompany] = useState('');
  const [confirmPostedAt, setConfirmPostedAt] = useState('');
  const [confirmJobDescription, setConfirmJobDescription] = useState('');
  const [confirmDocType, setConfirmDocType] = useState<JobAnalysisDocType>('both');
  const [isEditingJobDescription, setIsEditingJobDescription] = useState(false);

  const handleOpenConfirmation = (
    job: RecognizedTailorJob,
    selectedDocType: JobAnalysisDocType,
  ) => {
    setConfirmJob({ job, docType: selectedDocType });
    setConfirmTitle(job.title || '');
    setConfirmCompany(job.company || '');
    setConfirmPostedAt((job.postedAt || '').slice(0, 10));
    setConfirmJobDescription(job.jobDescription || '');
    setConfirmDocType(selectedDocType);
    setIsEditingJobDescription(false);
  };

  const handleConfirmGeneration = () => {
    if (!confirmJob) return;
    setConfirmJob(null);
    void handleStartGeneration({
      docType: confirmDocType,
      jobTitle: confirmTitle.trim(),
      company: confirmCompany.trim(),
      jobDescription: confirmJobDescription || jobInput.trim(),
      lastPostedAt: confirmPostedAt || undefined,
      mock: mockMode,
      careerProfileId: selectedProfileId || activeProfile?.id || undefined,
    });
  };

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

  const handleDeleteApplication = async (item: TailoredResume, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const hasMessages = conversationMessages.length > 0;

  return (
    <div className='h-full flex flex-col min-h-0 w-full max-w-5xl mx-auto px-2 sm:px-4'>
      {/* ── 1. Top Header ── */}
      <header className='shrink-0 z-10 flex items-center justify-between pb-2.5 pt-1 border-b border-border/40'>
        <div className='flex items-center gap-2 min-w-0'>
          <h1 className='text-sm sm:text-base font-bold text-ink-primary truncate'>
            {hasMessages ? 'AI Tailor Conversation' : 'AI Tailor Studio'}
          </h1>
        </div>

        <div className='flex items-center gap-2 shrink-0'>
          {hasMessages && (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => {
                setConversationMessages([]);
                setJobInput('');
              }}
              className='flex items-center gap-1.5 rounded-full text-xs font-semibold'
            >
              <Plus className='size-3.5 text-primary' />
              <span>New Tailor</span>
            </Button>
          )}

          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={() => setIsHistoryModalOpen(true)}
            className='flex items-center gap-1.5 rounded-full text-xs font-semibold'
          >
            <History className='size-3.5 text-primary' />
            <span>History</span>
            {tailoredResumes.length > 0 && (
              <span className='rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-extrabold text-primary'>
                {tailoredResumes.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* ── 2. Middle Content (Scrollable Conversation or Centered Hero) ── */}
      <main className='body'>
        <AnimatePresence mode='wait'>
          {hasMessages ? (
            /* ── State B: Active Conversation Stream ── */
            <motion.div
              key='conversation-view'
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className='flex-1 min-h-0 pb-4'
            >
              <TailorConversation
                messages={conversationMessages}
                onTailor={handleOpenConfirmation}
                onRetryEvaluation={handleRetryEvaluation}
                onClaimSkill={handleClaimSkill}
                onUnclaimSkill={handleUnclaimSkill}
                onUpdateJob={handleUpdateJob}
                onReDetect={handleReDetect}
                activeProfile={activeProfile}
                profileSkills={profileSkills}
                activeGeneration={
                  isGenerating ?
                    {
                      docType: confirmDocType,
                      jobTitle: confirmTitle,
                      company: confirmCompany,
                    }
                  : null
                }
              />
            </motion.div>
          ) : (
            /* ── State A: Initial Screen - Centered Hero View ── */
            <motion.div
              key='hero-view'
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className='flex-1 min-h-0 flex flex-col justify-between items-center py-4 sm:py-6 gap-6 w-full'
            >
              {/* Center Hero Section with Scattered Background Logos */}
              <div className='relative w-full max-w-4xl flex-1 flex flex-col items-center justify-center my-auto min-h-[380px] sm:min-h-[420px] px-2'>
                {/* Background Watermark Logos (Floating in background layer behind input area) */}
                <PlatformAtsShowcase
                  searchTitle={searchTitle}
                  searchLocation={searchLocation}
                />

                {/* Foreground Hero Content */}
                <div className='relative z-10 w-full max-w-3xl flex flex-col items-center gap-6 text-center'>
                  {/* Greeting & Motivational Quote & Guidance */}
                  <div className='space-y-2 max-w-xl mx-auto'>
              <h2 className='text-2xl sm:text-3xl font-extrabold text-ink-primary tracking-tight'>
  {greeting}
  {displayName && (
    <>
      , <span className='font-black  bg-primary-gradient text-transparent bg-clip-text'>{displayName} :)</span>
    </>
  )}
</h2>

                    <div className='flex items-center justify-center gap-2'>
                      <p className='text-sm sm:text-base text-nowrap font-medium text-ink-secondary'>
                        {quote}     <span

                        onClick={handleRefreshQuote}
                        aria-label='Show another quote'
                        title='Show another quote'
                        className='group inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-secondary/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                      >
                        <RefreshCw className='size-3.5 transition-transform duration-300 ease-out group-active:rotate-180' />
                      </span>
                      </p>
                 
                    </div>


                  </div>

                  {/* Centered Large Chat Input */}
                  <motion.div
                    layoutId='tailor-quick-entry-container'
                    className='w-full'
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  >
                    <TailorQuickEntry
                      isHero
                      onInspectionStart={handleInspectionStart}
                      onInspectionStatus={handleInspectionStatus}
                      onInspectionSuccess={handleInspectionSuccess}
                      onInspectionError={handleInspectionError}
                      value={jobInput}
                      onValueChange={setJobInput}
                      isGenerating={isGenerating}
                    />
                  </motion.div>
                </div>
              </div>

              {/* Bottom: Recent Tailored Applications Strip */}
              {tailoredResumes.length > 0 && (
                <div className='w-full max-w-4xl border-t border-border/40 pt-4'>
                  <div className='flex items-center justify-between pb-2'>
                    <div className='flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-secondary'>
                      <History className='size-3.5 text-primary' />
                      <span>Recent Tailored Applications</span>
                      <span className='rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-extrabold text-primary'>
                        {tailoredResumes.length}
                      </span>
                    </div>

                    <button
                      type='button'
                      onClick={() => setIsHistoryModalOpen(true)}
                      className='text-[11px] font-semibold text-primary hover:underline cursor-pointer'
                    >
                      View all history →
                    </button>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                    {tailoredResumes.slice(0, 3).map((item) => {
                      const docLabels = documentTypeLabel(item);
                      const isProcessing = item.status === 'processing';
                      const timeAgo = isProcessing
                        ? 'Generating...'
                        : formatRelativeTime(item.created_at);

                      return (
                        <div
                          key={item.id}
                          onClick={() => router.push(`/ai-studio/tailor/${item.id}#cv`)}
                          className='group relative flex flex-col justify-between rounded-xl border border-border/70 bg-panel/70 p-3 transition-all duration-150 hover:border-primary/50 hover:bg-panel hover:shadow-xs cursor-pointer select-none'
                        >
                          <div className='min-w-0 space-y-1'>
                            <div className='flex items-center justify-between gap-1'>
                              <div className='flex items-center gap-1 text-[11px] font-bold text-ink-primary truncate'>
                                <Building2 className='size-3 text-primary shrink-0' />
                                <span className='truncate'>{item.company || 'Job Application'}</span>
                              </div>
                              <button
                                type='button'
                                onClick={(e) => void handleDeleteApplication(item, e)}
                                className='opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-secondary hover:text-destructive transition-all cursor-pointer'
                                title='Delete record'
                              >
                                <Trash2 className='size-3' />
                              </button>
                            </div>
                            <h3 className='text-xs font-extrabold text-ink-primary truncate group-hover:text-primary transition-colors'>
                              {item.job_title || 'Tailored Role'}
                            </h3>
                          </div>

                          <div className='flex items-center justify-between border-t border-border/30 pt-2 mt-2 text-[10px] text-ink-secondary'>
                            <div className='flex items-center gap-1'>
                              {docLabels.map((lbl, idx) => (
                                <span
                                  key={idx}
                                  className='rounded bg-primary/15 px-1 py-0.2 text-[8px] font-extrabold text-primary uppercase'
                                >
                                  {lbl}
                                </span>
                              ))}
                            </div>
                            <span>{timeAgo}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── 4. Bottom Footer (Fixed Docked Input when in conversation) ── */}
      {hasMessages && (
        <footer className='shrink-0 z-10 w-full pt-2 pb-12 bg-gradient-to-r from-background-primary via-background-primary/95 to-transparent'>
          <motion.div
            layoutId='tailor-quick-entry-container'
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          >
            <TailorQuickEntry
              onInspectionStart={handleInspectionStart}
              onInspectionStatus={handleInspectionStatus}
              onInspectionSuccess={handleInspectionSuccess}
              onInspectionError={handleInspectionError}
              value={jobInput}
              onValueChange={setJobInput}
              isGenerating={isGenerating}
            />
          </motion.div>
        </footer>
      )}

      {/* ── 5. Job Details Confirmation Modal ── */}
      <Modal
        isOpen={Boolean(confirmJob)}
        onClose={() => setConfirmJob(null)}
        className='h-[78vh] w-[94vw] max-w-6xl text-ink-primary p-6'
      >
        <h2 className='text-base font-semibold'>Confirm job details</h2>

        <div className='grid min-h-0 flex-1 gap-4 body md:grid-cols-[320px_minmax(0,1fr)]'>
          <div className='space-y-4 overflow-y-auto'>
            <InputField
              label='Job title'
              value={confirmTitle}
              onChange={(event) => setConfirmTitle(event.target.value)}
            />
            <InputField
              label='Company'
              value={confirmCompany}
              onChange={(event) => setConfirmCompany(event.target.value)}
            />
            <InputField
              label='Posted'
              type='date'
              value={confirmPostedAt}
              onChange={(event) => setConfirmPostedAt(event.target.value)}
            />
          </div>

          <div className='flex min-h-0 flex-col'>
            <div className='flex items-center justify-between pb-2'>
              <h3 className='text-sm font-semibold'>Job description</h3>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant={isEditingJobDescription ? 'ghost' : 'secondary'}
                  onClick={() => setIsEditingJobDescription(false)}
                >
                  Preview
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={isEditingJobDescription ? 'secondary' : 'ghost'}
                  onClick={() => setIsEditingJobDescription(true)}
                >
                  Edit
                </Button>
              </div>
            </div>
            <div className='flex-1 min-h-0 overflow-y-auto'>
              {isEditingJobDescription ? (
                <Textarea
                  value={confirmJobDescription}
                  onChange={(event) =>
                    setConfirmJobDescription(event.target.value)
                  }
                  minHeight='100%'
                  showCharCount={false}
                  showClearButton={false}
                  className='h-full min-h-0'
                  containerClassName='h-full [&>div]:h-full'
                  aria-label='Edit job description'
                />
              ) : (
                <StructuredJobDescription content={confirmJobDescription} />
              )}
            </div>
          </div>
        </div>

        <div className='footer justify-between w-full pt-4 border-t border-border/40'>
          <div className='flex flex-wrap items-center gap-2'>
            {(
              [
                ['resume', 'Resume'],
                ['cover_letter', 'Cover letter'],
                ['both', 'Resume + Cover letter'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type='button'
                variant={confirmDocType === value ? undefined : 'secondary'}
                onClick={() => setConfirmDocType(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className='flex gap-2 flex-1 justify-end'>
            <Button variant='outline' onClick={() => setConfirmJob(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGeneration}>Generate</Button>
          </div>
        </div>
      </Modal>

      {/* ── 6. Full-Screen Chat Overlay ── */}
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

            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => setIsHistoryModalOpen(true)}
                className='flex items-center gap-1.5 rounded-full border border-border/70 bg-panel px-3.5 py-1.5 text-xs font-bold text-ink-primary hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer shadow-xs'
              >
                <History className='size-3.5 text-primary' />
                <span>History ({tailoredResumes.length})</span>
              </button>

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
          </div>

          <div className='flex-1 overflow-y-auto px-4 py-6'>
            <div className='mx-auto max-w-3xl space-y-6'>
              <TailorConversation
                messages={conversationMessages}
                onTailor={handleOpenConfirmation}
                onRetryEvaluation={handleRetryEvaluation}
                onClaimSkill={handleClaimSkill}
                onUnclaimSkill={handleUnclaimSkill}
                onUpdateJob={handleUpdateJob}
                onReDetect={handleReDetect}
                activeProfile={activeProfile}
                profileSkills={profileSkills}
                activeGeneration={
                  isGenerating ?
                    {
                      docType: confirmDocType,
                      jobTitle: confirmTitle,
                      company: confirmCompany,
                    }
                  : null
                }
              />
            </div>
          </div>

          <div className='shrink-0 z-10 border-t border-border/40 p-4 bg-background-primary/80'>
            <div className='mx-auto max-w-3xl'>
              <TailorQuickEntry
                onInspectionStart={handleInspectionStart}
                onInspectionStatus={handleInspectionStatus}
                onInspectionSuccess={handleInspectionSuccess}
                onInspectionError={handleInspectionError}
                value={jobInput}
                onValueChange={setJobInput}
                isGenerating={isGenerating}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Tailored Resumes History Search & Switch Modal ── */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        className='h-[82vh] w-[94vw] max-w-3xl p-6 text-ink-primary'
      >
        <TailoredResumeSearchModal
          items={tailoredResumes}
          onSelect={(item) => {
            router.push(`/ai-studio/tailor/${item.id}#cv`);
            setIsHistoryModalOpen(false);
          }}
          onDelete={(item) => void handleDeleteApplication(item)}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
