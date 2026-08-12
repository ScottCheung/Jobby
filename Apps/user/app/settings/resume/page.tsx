/** @format */

'use client';
import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  FileUp,
  FileSearch,
  Loader2,
  Pencil,
  RefreshCw,
  User,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  Phone,
  MapPin,
  Mail,
  Briefcase,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import { EmptyPlaceHolder } from '@/components/UI/EmptyPlaceHolder';
import type {
  MasterResume,
  MasterResumeData,
  MasterResumeEvaluation,
  MasterResumeEvaluationHistoryItem,
  MasterResumeVersion,
  CareerProfile,
  ResumeAsset,
  ResumeCertification,
  ResumeCertificationGroup,
  ResumeLink,
  ResumeLocation,
  ResumeOtherItem,
  ResumeSkillGroup,
} from '@/lib/types';
import { useConsole } from '@/components/ConsoleContext';
import { Button } from '@jobby/ui';
import { Input } from '@/components/UI/input';
import { Textarea } from '@/components/UI/textarea';
import { TagInput } from '@/components/UI/tag-input';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { ApplicationSettingsCards } from '@/app/settings/job-profiles/_component/application-settings-cards';
import { ResumeSourceDebugger } from './_component/resume-source-debugger';
import {
  BasicsEditor,
  SummaryEditor,
  ExperienceEditor,
  ProjectsEditor,
  SkillsEditor,
  EducationEditor,
  CertificationsEditor,
  LinksEditor,
  OtherEditor,
} from './_component/career-profile-section-editors';
import {
  ResumePreviewSidebar,
  ResumeScoreSidebar,
  ResumeVersionPreview,
} from './_component/resume-score-panels';

type ResumeBasics = NonNullable<MasterResumeData['basics']>;
type ResumeExperience = NonNullable<MasterResumeData['experience']>[number];
type ResumeEducation = NonNullable<MasterResumeData['education']>[number];
type ResumeProject = NonNullable<MasterResumeData['projects']>[number];
type ResumeOther = ResumeOtherItem;

function careerProfileAsResume(profile: CareerProfile): MasterResume {
  const evaluation = profile.latest_evaluation as MasterResumeEvaluation;
  return {
    id: profile.id,
    original_filename: profile.original_filename || profile.name,
    original_url: profile.original_url || profile.resume_path || '',
    resume_data: profile.resume_data,
    content_version: 1,
    published_version: 1,
    draft_base_version: 1,
    has_draft_changes: false,
    evaluation_is_current: profile.evaluation_is_current,
    published_evaluation: evaluation,
    published_at: null,
    evaluation,
    evaluation_updated_at: profile.evaluation_updated_at || null,
    status: profile.status === 'ready' ? 'confirmed' : profile.status,
    confirmed_at: null,
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
  };
}

function asValue(value: string | null | undefined) {
  return value ?? '';
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: string[]) {
  return value.join(', ');
}

function dateRange(start?: string | null, end?: string | null) {
  return [start, end].filter(Boolean).join(' - ') || 'Date not listed';
}

function TagList({ values }: { values: string[] }) {
  if (!values.length)
    return <span className='body-sm text-ink-secondary'>Not listed</span>;
  return (
    <div className='flex flex-wrap gap-2'>
      {values.map((value) => (
        <span
          key={value}
          className='rounded-md border border-border bg-background-secondary/50 px-1 py-0.5 text-[13px] text-ink-secondary'
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  children,
  action,
  layoutId,
  onClick,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  layoutId?: string;
  onClick?: () => void;
}) {
  return (
    <motion.section
      layoutId={layoutId}
      onClick={onClick}
      transition={{
        type: 'spring',
        duration: 0.7,
        bounce: 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        'border border-border bg-panel group rounded-3xl relative',
        onClick && 'cursor-pointer ',
      )}
    >
      <div className='sticky top-0 z-20 flex items-start justify-between gap-3 pt-5 pb-6 px-6 '>
        <div className='relative '>
          <h2 className='text-xl shadow-text pl-9 font-semibold text-ink-primary! z-10'>
            <div className='z-30 ml-2'>{title}</div>{' '}
            <div className='opacity-100   '>
              <div className='w-4  -z-10 h-full   bg-primary-gradient absolute -translate-x-6 top-1/2 -translate-y-1/2 rounded-br-full rounded-tl-full' />{' '}
            </div>
          </h2>
          <div className='absolute bg-background-primary dark:bg-background-secondary w-full h-full translate-x-6 scale-105  top-0 -z-10 blur-xl'></div>
          {/* <div className='absolute bg-background-primary w-full h-full translate-x-6 scale-150 left-0 top-0 -z-10 blur-xl'></div> */}
        </div>
        {action && (
          <div
            onClick={(e) => e.stopPropagation()}
            className='group-hover:opacity-100 opacity-0 transition-opacity'
          >
            {action}
          </div>
        )}
      </div>
      <div className='-mt-3 pb-8 px-8'>{children}</div>
    </motion.section>
  );
}

export default function ResumePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resumeScrollRef = useRef<HTMLDivElement>(null);
  const detailAsideRef = useRef<HTMLElement>(null);
  const profileAsideRef = useRef<HTMLElement>(null);
  const { setProfile, setJobHuntingProfile, loadData } = useConsole();
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);
  const confirm = useConfirmStore((state) => state.confirm);
  const [resume, setResume] = useState<MasterResume | null>(null);
  const [careerProfiles, setCareerProfiles] = useState<CareerProfile[]>([]);
  const [careerProfile, setCareerProfile] = useState<CareerProfile | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<'resume' | 'scores' | 'settings'>(
    'resume',
  );
  const [scoreHistory, setScoreHistory] = useState<
    import('@/lib/types').CareerProfileScoreHistoryItem[]
  >([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [data, setData] = useState<MasterResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [retryingParse, setRetryingParse] = useState(false);
  const [cancellingParse, setCancellingParse] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab !== 'resume') return;
    const scroller = resumeScrollRef.current;
    if (!scroller) return;

    let frameId: number | null = null;
    const syncSidebars = () => {
      const clientHeight = scroller.clientHeight;
      const scrollableHeight = scroller.scrollHeight - clientHeight;
      const progress =
        scrollableHeight > 0 ? scroller.scrollTop / scrollableHeight : 0;

      const is2xl = window.innerWidth >= 1536;

      const updateSidebarMask = (aside: HTMLElement, isSticky: boolean) => {
        if (!isSticky) {
          aside.style.maskImage = '';
          aside.style.webkitMaskImage = '';
          return;
        }
        const maxScroll = aside.scrollHeight - clientHeight;
        if (maxScroll <= 4) {
          aside.style.maskImage = '';
          aside.style.webkitMaskImage = '';
          return;
        }
        const atStart = aside.scrollTop <= 4;
        const atEnd = aside.scrollTop >= maxScroll - 4;
        const mask =
          atStart && atEnd ? ''
          : atStart ?
            'linear-gradient(to bottom, black 0, black calc(100% - 28px), transparent 100%)'
          : atEnd ?
            'linear-gradient(to bottom, transparent 0, black 28px, black 100%)'
          : 'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 28px), transparent 100%)';

        aside.style.maskImage = mask;
        aside.style.webkitMaskImage = mask;
      };

      if (detailAsideRef.current) {
        if (is2xl) {
          detailAsideRef.current.style.maxHeight = `${clientHeight}px`;
          detailAsideRef.current.scrollTop =
            progress *
            Math.max(0, detailAsideRef.current.scrollHeight - clientHeight);
          updateSidebarMask(detailAsideRef.current, true);
        } else {
          detailAsideRef.current.style.maxHeight = '';
          detailAsideRef.current.scrollTop = 0;
          updateSidebarMask(detailAsideRef.current, false);
        }
      }

      if (profileAsideRef.current) {
        profileAsideRef.current.style.maxHeight = `${clientHeight}px`;
        profileAsideRef.current.scrollTop =
          progress *
          Math.max(0, profileAsideRef.current.scrollHeight - clientHeight);
        updateSidebarMask(profileAsideRef.current, true);
      }
    };

    const scheduleSync = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncSidebars();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(scroller);
    [detailAsideRef.current, profileAsideRef.current].forEach((aside) => {
      if (aside) resizeObserver.observe(aside);
    });

    syncSidebars();
    scroller.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      scroller.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
    };
  }, [activeTab, data]);

  const loadCareerProfile = async (preferredId?: string) => {
    const profiles = await api.careerProfiles();
    setCareerProfiles(profiles);
    const selected =
      profiles.find((profile) => profile.id === preferredId) ??
      profiles.find((profile) => profile.is_default) ??
      profiles[0];
    if (!selected) {
      setResume(null);
      setData(null);
      return null;
    }
    const full = await api.careerProfile(selected.id);
    setCareerProfile(full);
    setResume(careerProfileAsResume(full));
    setData(full.resume_data);
    return full;
  };

  const loadScoreHistory = async () => {
    if (!resume) return;
    setLoadingScores(true);
    try {
      setScoreHistory(await api.careerProfileScoreHistory(resume.id));
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not load score history.',
      );
    } finally {
      setLoadingScores(false);
    }
  };

  const selectTab = (tab: 'resume' | 'scores' | 'settings') => {
    setActiveTab(tab);
    if (tab === 'scores') void loadScoreHistory();
  };

  const saveApplicationSettings = async () => {
    if (!careerProfile) return;
    setSaving(true);
    try {
      const saved = await api.updateCareerProfile(careerProfile.id, {
        search_terms: careerProfile.search_terms,
        search_location: careerProfile.search_location,
        filters: careerProfile.filters,
        blacklist_rules: careerProfile.blacklist_rules,
        whitelist_rules: careerProfile.whitelist_rules,
        years_of_experience: careerProfile.years_of_experience,
        require_visa: careerProfile.require_visa,
        website: careerProfile.website,
        linkedin_url: careerProfile.linkedin_url,
        citizenship: careerProfile.citizenship,
        desired_salary: careerProfile.desired_salary,
        notice_period: careerProfile.notice_period,
        linkedin_headline: careerProfile.linkedin_headline,
        linkedin_summary: careerProfile.linkedin_summary,
        cover_letter: careerProfile.cover_letter,
        user_information_all: careerProfile.user_information_all,
      });
      setCareerProfile(saved);
      setCareerProfiles((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      showGlobalToast('Application settings saved.');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ?
          err.message
        : 'Could not save application settings.',
      );
    } finally {
      setSaving(false);
    }
  };

  const openProfileSwitcher = () => {
    openModal({
      layoutId: 'career-profile-switcher',
      className: 'w-[94vw] max-w-2xl max-h-[86vh] rounded-lg',
      content: (
        <div className='flex max-h-[78vh] flex-col gap-5 p-6'>
          <div>
            <h2 className='title-card text-ink-primary'>
              Switch Resume Profile
            </h2>
            <p className='body-sm mt-1 text-ink-secondary'>
              Each profile owns one resume and its job search settings.
            </p>
          </div>
          <div className='custom-scrollbar-primary min-h-0 space-y-2 overflow-y-auto'>
            {careerProfiles.map((profile) => (
              <div
                key={profile.id}
                className='flex items-center justify-between gap-3 rounded-lg border border-border p-3'
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium text-ink-primary'>
                    {profile.name}
                  </p>
                  <p className='truncate text-xs text-ink-secondary'>
                    {profile.original_filename || 'Processing resume...'}
                  </p>
                </div>
                <div className='flex shrink-0 gap-2'>
                  {profile.is_default && (
                    <span className='rounded bg-primary/10 px-2 py-1 text-xs text-primary'>
                      Primary
                    </span>
                  )}
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() =>
                      void (async () => {
                        await api.setPrimaryCareerProfile(profile.id);
                        await loadCareerProfile(profile.id);
                        await loadData();
                        setEditing(false);
                        closeModal();
                      })()
                    }
                  >
                    Select
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() =>
                      void (async () => {
                        const accepted = await confirm({
                          title: `Delete ${profile.name}?`,
                          message:
                            'This permanently removes this profile, its PDF, current resume data, and score history.',
                          confirmLabel: 'Delete profile',
                          type: 'delete',
                        });
                        if (!accepted) return;
                        await api.deleteCareerProfile(profile.id);
                        await loadCareerProfile();
                        closeModal();
                      })()
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <footer className='footer'>
            <Button variant='secondary' onClick={closeModal}>
              Close
            </Button>
            <Button
              Icon={UploadCloud}
              onClick={() => {
                closeModal();
                inputRef.current?.click();
              }}
            >
              New Resume Profile · 15 Coins
            </Button>
          </footer>
        </div>
      ),
      onClose: closeModal,
    });
  };

  const previewResumeVersion = (item: MasterResumeEvaluationHistoryItem) => {
    if (!item.resume_data) return;
    openModal({
      layoutId: `resume-version-${item.id}`,
      className: 'w-[96vw] max-w-5xl max-h-[92vh] rounded-lg',
      content: <ResumeVersionPreview item={item} onClose={closeModal} />,
      onClose: closeModal,
    });
  };

  const openVersionHistory = async () => {
    if (!resume) return;
    const history = await api.careerProfileScoreHistory(resume.id);
    openModal({
      layoutId: 'career-profile-score-history',
      className: 'w-[94vw] max-w-3xl max-h-[88vh] rounded-lg',
      content: (
        <div className='flex max-h-[78vh] flex-col gap-5 p-6'>
          <div>
            <h2 className='title-card text-ink-primary'>Score history</h2>
            <p className='body-sm mt-1 text-ink-secondary'>
              Each score keeps the resume snapshot that was scored. Snapshots
              are view-only.
            </p>
          </div>
          <div className='custom-scrollbar-primary min-h-0 space-y-2 overflow-y-auto'>
            {history.length ?
              history.map((item) => (
                <button
                  key={item.id}
                  className='flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-background-secondary'
                  onClick={() =>
                    previewResumeVersion({
                      id: item.id,
                      resume_version: 0,
                      evaluation: item.evaluation,
                      resume_data: item.resume_data,
                      created_at: item.created_at,
                    })
                  }
                >
                  <span className='flex items-baseline gap-1'>
                    <span className='text-xl font-medium text-ink-primary'>
                      {item.evaluation.overall_score ?? '—'}
                    </span>
                    <span className='text-xs text-ink-secondary'>/100</span>
                  </span>
                  <span className='text-xs text-ink-secondary'>
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </button>
              ))
            : <p className='body-sm text-ink-secondary'>No scores yet.</p>}
          </div>
          <footer className='footer'>
            <Button variant='secondary' onClick={closeModal}>
              Close
            </Button>
          </footer>
        </div>
      ),
      onClose: closeModal,
    });
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadCareerProfile();
      } catch (err) {
        if (
          !(err instanceof Error) ||
          (!err.message.includes('No master resume') &&
            !err.message.includes('Not Found'))
        ) {
          setError(
            err instanceof Error ?
              err.message
            : 'Could not load your Resume Profiles.',
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (resume?.status !== 'processing') return;

    let refreshing = false;
    const refreshProcessingResume = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const profile = await api.careerProfile(resume.id);
        const nextResume = careerProfileAsResume(profile);
        if (nextResume.status === 'processing') return;
        setResume(nextResume);
        setData(nextResume.resume_data);
        if (nextResume.status === 'confirmed') {
          const nextJobProfile = await api.jobHuntingProfile();
          setJobHuntingProfile(nextJobProfile);
          loadData();
          setEditing(true);
          showGlobalToast(
            'Resume analysis complete. Review the details before confirming.',
          );
        } else if (nextResume.status === 'failed') {
          showGlobalToast(
            'AI resume analysis could not be completed. Please upload the PDF again.',
          );
        }
      } catch {
        // Keep polling; transient API restarts should not strand the loading UI.
      } finally {
        refreshing = false;
      }
    };

    const onResumeProcessed = async (event: Event) => {
      const detail = (
        event as CustomEvent<{
          resume_id?: string;
          profile_id?: string;
          status?: string;
          detail?: string;
        }>
      ).detail;
      if (detail?.profile_id !== resume.id) return;
      if (detail.status === 'failed') {
        setResume((current) =>
          current ? { ...current, status: 'failed' } : current,
        );
        showGlobalToast(
          detail.detail || 'AI resume analysis could not be completed.',
        );
        return;
      }
      if (detail.status !== 'ready') return;
      await refreshProcessingResume();
    };

    window.addEventListener('jobby:career-profile-event', onResumeProcessed);
    const pollTimer = window.setInterval(
      () => void refreshProcessingResume(),
      5_000,
    );
    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener(
        'jobby:career-profile-event',
        onResumeProcessed,
      );
    };
  }, [resume?.id, resume?.status, setJobHuntingProfile]);

  useEffect(() => {
    if (resume?.status !== 'processing') {
      setProcessingSeconds(0);
      return;
    }
    const startedAt = new Date(resume.updated_at).getTime();
    const updateElapsed = () =>
      setProcessingSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [resume?.status, resume?.updated_at]);

  const retryParsing = async () => {
    setRetryingParse(true);
    try {
      const nextResume = await api.retryMasterResumeParsing();
      setResume(nextResume);
      setProcessingSeconds(0);
      showGlobalToast('Resume parsing has been queued again.');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not retry resume parsing.',
      );
    } finally {
      setRetryingParse(false);
    }
  };

  const cancelParsing = async () => {
    setCancellingParse(true);
    try {
      await api.cancelMasterResumeParsing();
      setResume(null);
      setData(null);
      showGlobalToast('Resume parsing cancelled. The 5 Coins were refunded.');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not cancel resume parsing.',
      );
    } finally {
      setCancellingParse(false);
    }
  };

  const updateBasics = (field: keyof ResumeBasics, value: string) => {
    if (!data) return;
    setData({
      ...data,
      basics: { ...(data.basics ?? {}), [field]: value || null },
    });
  };

  const updateLocation = (
    field: keyof NonNullable<ResumeBasics['location']>,
    value: string,
  ) => {
    if (!data) return;
    const current = (data.basics?.location ?? {}) as Partial<ResumeLocation>;
    setData({
      ...data,
      basics: {
        ...(data.basics ?? {}),
        location: { ...current, [field]: value || null } as ResumeLocation,
      },
    });
  };

  const updateArray = <T,>(items: T[] | undefined, index: number, next: T) => {
    const list = [...(items ?? [])];
    list[index] = next;
    return list;
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Upload a PDF resume.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const nextProfile = await api.uploadCareerProfile(file);
      setCareerProfiles((current) => [nextProfile, ...current]);
      setResume(careerProfileAsResume(nextProfile));
      setData(null);
      setEditing(false);
      loadData();
      showGlobalToast('Resume uploaded. AI is analysing your resume...');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not upload the resume.',
      );
    } finally {
      setUploading(false);
    }
  };

  const runRawAi = async (file?: File) => {
    if (!file) throw new Error('Upload a PDF resume.');
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      throw new Error('Upload a PDF resume.');
    }
    return api.debugResumeAi(file);
  };

  const save = async (confirm = false) => {
    if (!data) return;
    setSaving(true);
    setError('');
    try {
      const nextResume = await api.updateCareerProfile(resume?.id || '', {
        resume_data: data,
      });
      setResume(careerProfileAsResume(nextResume));
      setData(nextResume.resume_data);
      setEditing(false);
      const nextJobProfile = await api.jobHuntingProfile();
      setJobHuntingProfile(nextJobProfile);
      loadData();
      showGlobalToast('Resume changes saved.');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not save the resume.',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveResumeData = async (nextData: MasterResumeData) => {
    if (!resume?.id) return;
    setSaving(true);
    setError('');
    try {
      const nextResume = await api.updateCareerProfile(resume.id, {
        resume_data: nextData,
      });
      setResume(careerProfileAsResume(nextResume));
      setData(nextResume.resume_data);
      const nextJobProfile = await api.jobHuntingProfile();
      setJobHuntingProfile(nextJobProfile);
      loadData();
      showGlobalToast('Resume Profile saved.');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not save profile changes.',
      );
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const openSectionModal = (layoutId: string, content: ReactNode) => {
    openModal({
      layoutId,
      className: 'w-[94vw] max-w-4xl max-h-[88vh] rounded-lg',
      content,
      onClose: closeModal,
    });
  };

  const evaluate = async () => {
    setEvaluating(true);
    setError('');
    try {
      if (data) {
        const saved = await api.updateCareerProfile(resume?.id || '', {
          resume_data: data,
        });
        setResume(careerProfileAsResume(saved));
        setData(saved.resume_data);
      }
      const scored = await api.evaluateCareerProfile(resume?.id || '');
      const nextResume = careerProfileAsResume(scored);
      setResume(nextResume);
      setData(scored.resume_data);
      loadData();
      showGlobalToast('Resume evaluation complete.');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not evaluate the resume.',
      );
    } finally {
      setEvaluating(false);
    }
  };

  const updateExperience = (
    index: number,
    field: keyof ResumeExperience,
    value: string,
  ) => {
    if (!data) return;
    const experience = updateArray(data.experience, index, {
      ...(data.experience?.[index] ?? { description: [], technologies: [] }),
      [field]:
        field === 'description' || field === 'technologies' ?
          value
        : value || null,
    } as ResumeExperience);
    if (field === 'description') {
      experience[index].description = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (field === 'technologies') {
      experience[index].technologies = splitList(value);
    }
    setData({ ...data, experience });
  };

  const updateEducation = (
    index: number,
    field: keyof ResumeEducation,
    value: string,
  ) => {
    if (!data) return;
    const education = updateArray(data.education, index, {
      ...(data.education?.[index] ?? { highlights: [] }),
      [field]: field === 'highlights' ? value : value || null,
    } as ResumeEducation);
    if (field === 'highlights') {
      education[index].highlights = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    setData({ ...data, education });
  };

  const updateProject = (
    index: number,
    field: keyof ResumeProject,
    value: string,
  ) => {
    if (!data) return;
    const projects = updateArray(data.projects, index, {
      ...(data.projects?.[index] ?? { description: [], technologies: [] }),
      [field]:
        field === 'description' || field === 'technologies' ?
          value
        : value || null,
    } as ResumeProject);
    if (field === 'description') {
      projects[index].description = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (field === 'technologies') {
      projects[index].technologies = splitList(value);
    }
    setData({ ...data, projects });
  };

  const updateOther = (
    index: number,
    field: keyof ResumeOther,
    value: string,
  ) => {
    if (!data) return;
    const other = updateArray(data.other, index, {
      ...(data.other?.[index] ?? { description: [] }),
      [field]: field === 'description' ? value : value || null,
    } as ResumeOther);
    if (field === 'description') {
      other[index].description = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    setData({ ...data, other });
  };

  const updateLinks = (
    index: number,
    field: keyof ResumeLink,
    value: string,
  ) => {
    if (!data) return;
    const links = updateArray(data.links, index, {
      ...(data.links?.[index] ?? {}),
      [field]: value || null,
    } as ResumeLink);
    setData({ ...data, links });
  };

  const updateSkillGroup = (
    index: number,
    field: keyof ResumeSkillGroup,
    value: string,
  ) => {
    if (!data) return;
    const skills = updateArray(data.skills, index, {
      ...(data.skills?.[index] ?? { skills: [] }),
      [field]: field === 'skills' ? value : value || null,
    } as ResumeSkillGroup);
    if (field === 'skills') {
      skills[index].skills = splitList(value);
    }
    setData({ ...data, skills });
  };

  const updateSkillGroupValues = (index: number, values: string[]) => {
    if (!data) return;
    const skills = updateArray(data.skills, index, {
      ...(data.skills?.[index] ?? { skills: [] }),
      skills: values,
    } as ResumeSkillGroup);
    setData({ ...data, skills });
  };

  const updateCertificationGroup = (
    index: number,
    field: keyof ResumeCertificationGroup,
    value: string,
  ) => {
    if (!data) return;
    const certifications = updateArray(data.certifications, index, {
      ...(data.certifications?.[index] ?? { certifications: [] }),
      [field]: value || null,
    } as ResumeCertificationGroup);
    setData({ ...data, certifications });
  };

  const updateCertification = (
    groupIndex: number,
    certIndex: number,
    field: keyof ResumeCertification,
    value: string,
  ) => {
    if (!data) return;
    const groups = [...(data.certifications ?? [])];
    const group = { ...(groups[groupIndex] ?? { certifications: [] }) };
    const certs = [...(group.certifications ?? [])];
    certs[certIndex] = {
      ...(certs[certIndex] ?? {}),
      [field]: value || null,
    } as ResumeCertification;
    group.certifications = certs;
    groups[groupIndex] = group;
    setData({ ...data, certifications: groups });
  };

  const addItem = (
    key:
      | 'links'
      | 'skills'
      | 'certifications'
      | 'experience'
      | 'education'
      | 'projects'
      | 'other',
  ) => {
    if (!data) return;
    if (key === 'links')
      setData({
        ...data,
        links: [...(data.links ?? []), { type: null, link: null }],
      });
    if (key === 'skills')
      setData({
        ...data,
        skills: [...(data.skills ?? []), { type: 'Other', skills: [] }],
      });
    if (key === 'certifications')
      setData({
        ...data,
        certifications: [
          ...(data.certifications ?? []),
          { type: 'Other', certifications: [] },
        ],
      });
    if (key === 'experience')
      setData({
        ...data,
        experience: [
          ...(data.experience ?? []),
          { description: [], technologies: [] },
        ],
      });
    if (key === 'education')
      setData({
        ...data,
        education: [...(data.education ?? []), { highlights: [] }],
      });
    if (key === 'projects')
      setData({
        ...data,
        projects: [
          ...(data.projects ?? []),
          { description: [], technologies: [] },
        ],
      });
    if (key === 'other')
      setData({
        ...data,
        other: [...(data.other ?? []), { type: 'Other', description: [] }],
      });
  };

  const removeItem = (
    key:
      | 'links'
      | 'skills'
      | 'certifications'
      | 'experience'
      | 'education'
      | 'projects'
      | 'other',
    index: number,
  ) => {
    if (!data) return;
    const next = { ...data };
    next[key] = (next[key] ?? []).filter((_, i) => i !== index) as never;
    setData(next);
  };

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center text-ink-secondary'>
        <Loader2 className='mr-2 size-5 animate-spin' />
        Loading master resume
      </div>
    );
  }

  if (resume?.status === 'processing') {
    return (
      <div className='flex w-full h-full items-center justify-center'>
        <section className='col justify-center '>
          <div className='mx-auto flex size-30 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <FileSearch className='size-14' />
          </div>

          <h1 className='text-3xl mt-4 text-ink-primary  animate-text-shimmer animate-text-shimmer-primary  '>
            AI is analysing your resume
          </h1>
          <p className='body-sm mx-auto  max-w-md text-ink-secondary'>
            Your PDF has been uploaded successfully. You can leave this page and
            return later to review the extracted details.
          </p>
          {/* <p className='mt-2 text-center text-xs text-ink-secondary'>
            {processingSeconds < 60 ?
              `Processing for ${processingSeconds}s`
            : `Still processing after ${Math.floor(processingSeconds / 60)}m ${processingSeconds % 60}s`
            }
          </p> */}
          <div className='mx-auto mt-6 gap-6 col w-full '>
            <div className='flex items-center gap-3 body-sm text-ink-primary'>
              <CheckCircle2 className='size-4 shrink-0 text-emerald-500' />
              Upload complete
            </div>
            <div className='flex items-center gap-3 body-sm text-ink-secondary'>
              <FileSearch className='size-4 shrink-0 text-primary' />
              Extracting experience, education, skills, and projects
            </div>
            {/* <div className='flex items-center gap-3 body-sm text-ink-secondary'>
              <FileSearch className='size-4 shrink-0 text-primary' />
              AI is anaylysing your resume, it usually takes 1-2 minutes for the
              process to complete.
            </div> */}
          </div>
          <div className='mt-7 flex flex-wrap justify-center gap-2'>
            {processingSeconds >= 20 && (
              <Button
                variant='secondary'
                Icon={RefreshCw}
                isLoading={retryingParse}
                disabled={cancellingParse}
                onClick={() => void retryParsing()}
              >
                Retry parsing
              </Button>
            )}
            <Button
              variant='secondary'
              Icon={X}
              isLoading={cancellingParse}
              disabled={retryingParse}
              onClick={() => void cancelParsing()}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Back to dashboard
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (
    !resume ||
    !data ||
    (resume.status === 'failed' && Object.keys(data).length === 0)
  ) {
    return (
      <div className='flex h-full flex-col'>
        <div className='mb-6'>
          <h1 className='title-card text-ink-primary'>Resume Profiles</h1>
          <p className='body-sm mt-1 text-ink-secondary'>
            Upload a resume to create a Resume Profile with its own resume,
            score history, and application settings.
          </p>
        </div>
        <section className='flex col panel-xl justify-center items-center w-full h-full'>
          <div
            onClick={() => inputRef.current?.click()}
            className='flex gap-6 col items-center cursor-pointer border-dashed w-max-xl rounded-2xl  p-12 border-2 border-ink-secondary/30'
          >
            <div className='flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <UploadCloud className='size-7' />
            </div>
            <h2 className='title-sub mt-5 text-ink-primary'>
              Upload your resume
            </h2>
            <p className='body-sm mt-2 text-ink-secondary'>
              We will extract factual details into an editable Resume Profile
              for you to review.
            </p>
            <Button
              className='mt-6'
              Icon={FileUp}
              isLoading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Choose PDF & Score · 15 Coins
            </Button>
            <p className='body-sm mt-3 text-ink-secondary'>
              PDF only, up to 12 MB
            </p>
            {error && <p className='body-sm mt-4 text-red-600'>{error}</p>}
            <input
              ref={inputRef}
              className='hidden'
              type='file'
              accept='application/pdf,.pdf'
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                void upload(event.target.files?.[0])
              }
            />
          </div>
        </section>
        {/* <ResumeSourceDebugger
          onRunAiParse={upload}
          onRunAiRaw={runRawAi}
          parsing={uploading}
        /> */}
      </div>
    );
  }

  const basics = data.basics ?? {};
  const location = (basics.location ?? {}) as Partial<ResumeLocation>;
  const experienceItems = Array.isArray(data.experience) ? data.experience : [];
  const projectItems = Array.isArray(data.projects) ? data.projects : [];
  const educationItems = Array.isArray(data.education) ? data.education : [];
  const skillItems = Array.isArray(data.skills) ? data.skills : [];
  const certificationGroups =
    Array.isArray(data.certifications) ? data.certifications : [];
  const languageItems = Array.isArray(data.languages) ? data.languages : [];
  const otherItems = Array.isArray(data.other) ? data.other : [];
  const hasPersonalInfo = Boolean(
    basics.first_name ||
    basics.middle_name ||
    basics.last_name ||
    basics.email ||
    basics.phone ||
    basics.headline ||
    basics.linkedin_id ||
    location.city ||
    location.state ||
    location.country,
  );
  const otherTypes = [
    ...new Set(
      otherItems
        .map((item) => item.type?.trim())
        .filter((type): type is string => Boolean(type && type !== 'Other')),
    ),
  ];
  const otherSectionTitle =
    otherTypes.length === 1 ? otherTypes[0] : 'Additional information';
  const hasLocalChanges =
    JSON.stringify(data) !== JSON.stringify(resume.resume_data);
  const hasWorkingChanges = resume.has_draft_changes || hasLocalChanges;
  const isConfirmed = resume.published_version > 0 && !hasWorkingChanges;
  const latestEvaluation =
    resume.evaluation && Array.isArray(resume.evaluation.evaluation) ?
      resume.evaluation
    : null;
  // A Resume Profile has no published resume version. Its score is current only
  // when the API confirms it was calculated from the current resume data.
  const sidebarEvaluation = latestEvaluation;
  const sidebarEvaluationIsCurrent =
    !hasLocalChanges && resume.evaluation_is_current;
  return (
    <div className='flex h-full flex-col overflow-hidden'>
      <div className=' flex shrink-0 flex-wrap items-start justify-between gap-4'>
        <div>
          <div className='flex items-center gap-3'>
            <h1 className='title-card text-ink-primary'>
              {resume.original_filename?.replace(/\.pdf$/i, '') ||
                'Resume Profile'}
            </h1>
            <Button size='sm' variant='secondary' onClick={openProfileSwitcher}>
              Switch profiles
            </Button>
          </div>
          <a
            className='body-sm mt-1 inline-flex items-center gap-1 text-primary hover:underline'
            href={resume.original_url}
            target='_blank'
            rel='noreferrer'
          >
            <FileText className='size-4' />
            Source PDF: {resume.original_filename}
          </a>
        </div>
        <div className='flex shrink-0 border-b border-border'>
          {[
            ['resume', 'Resume'],
            ['scores', 'Score History'],
            ['settings', 'Application settings'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === id ? 'border-primary text-primary' : 'border-transparent text-ink-secondary hover:text-ink-primary'}`}
              onClick={() => selectTab(id as 'resume' | 'scores' | 'settings')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className='flex flex-wrap justify-end gap-2'></div>
        <input
          ref={inputRef}
          className='hidden'
          type='file'
          accept='application/pdf,.pdf'
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            void upload(event.target.files?.[0])
          }
        />
      </div>

      {activeTab === 'resume' && (
        <div
          ref={resumeScrollRef}
          className='body custom-scrollbar-primary relative min-h-0 flex-1 overflow-y-auto overscroll-contain'
        >
          {error && (
            <p className='body-sm mb-4 rounded-md bg-red-500/10 p-3 text-red-600'>
              {error}
            </p>
          )}
          <div className='grid min-h-full items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)_340px]'>
            <div className='grid min-w-0 gap-5 2xl:contents'>
              <section className='space-y-5'>
                <SectionCard
                  title='Personal info'
                  layoutId='career-section-basics'
                  onClick={() =>
                    openSectionModal(
                      'career-section-basics',
                      <BasicsEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-basics',
                          <BasicsEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='row flex-wrap gap-5 text-ink-primary'>
                    <h3 className='flex items-center gap-2 text-lg font-semibold text-ink-primary'>
                      <User className='h-5 w-5 text-primary' />
                      {[basics.first_name, basics.last_name]
                        .filter(Boolean)
                        .join(' ') || 'Name not listed'}
                    </h3>

                    {basics.headline && (
                      <p className='mt-1 flex items-center gap-2 text-ink-primary'>
                        <Briefcase className='h-4 w-4 text-primary' />
                        {basics.headline}
                      </p>
                    )}

                    {basics.email && (
                      <div className='flex items-center gap-2'>
                        <Mail className='h-4 w-4 text-primary shrink-0' />
                        <span>{basics.email}</span>
                      </div>
                    )}

                    {basics.phone && (
                      <div className='flex items-center gap-2'>
                        <Phone className='h-4 w-4 text-primary shrink-0' />
                        <span>{basics.phone}</span>
                      </div>
                    )}

                    {[location.city, location.state, location.country]
                      .filter(Boolean)
                      .join(', ') && (
                      <div className='flex items-center gap-2'>
                        <MapPin className='h-4 w-4 text-primary shrink-0' />
                        <span>
                          {[location.city, location.state, location.country]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    {basics.linkedin_id && (
                      <div className='flex items-center gap-2'>
                        <span className='text-xs font-semibold text-primary'>
                          LinkedIn:
                        </span>
                        <span>{basics.linkedin_id}</span>
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title='Summary'
                  layoutId='career-section-summary'
                  onClick={() =>
                    openSectionModal(
                      'career-section-summary',
                      <SummaryEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-summary',
                          <SummaryEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <p className='body-sm whitespace-pre-wrap text-ink-secondary'>
                    {data.summary || 'No summary listed.'}
                  </p>
                </SectionCard>

                <SectionCard
                  title='Experience'
                  layoutId='career-section-experience'
                  onClick={() =>
                    openSectionModal(
                      'career-section-experience',
                      <ExperienceEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-experience',
                          <ExperienceEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='space-y-5'>
                    {experienceItems.length ?
                      experienceItems.map((item, index) => (
                        <article key={`experience-view-${index}`} className=''>
                          <div>
                            <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                              <h3 className='label text-ink-primary'>
                                {item.title || 'Role not listed'}
                              </h3>
                              <span className='body-sm text-ink-secondary'>
                                {dateRange(item.start_date, item.end_date)}
                              </span>
                            </div>

                            <p className='body-sm mt-1 text-ink-secondary'>
                              {[item.company, item.location]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {(item.technologies ?? []).length > 0 && (
                              <div className='mt-3'>
                                <TagList values={item.technologies ?? []} />
                              </div>
                            )}
                            <div className='border-l-2 border-primary/20 ml-2 pl-4'>
                              {(item.description ?? []).length > 0 && (
                                <ul className='body-sm mt-3 list-disc space-y-1 pl-4 text-ink-secondary'>
                                  {(item.description ?? []).map(
                                    (line, lIdx) => (
                                      <li key={`exp-line-${lIdx}`}>{line}</li>
                                    ),
                                  )}
                                </ul>
                              )}
                            </div>
                          </div>
                        </article>
                      ))
                    : <p className='body-sm text-ink-secondary'>Not listed</p>}
                  </div>
                </SectionCard>

                <SectionCard
                  title='Projects'
                  layoutId='career-section-projects'
                  onClick={() =>
                    openSectionModal(
                      'career-section-projects',
                      <ProjectsEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-projects',
                          <ProjectsEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='space-y-5'>
                    {projectItems.length ?
                      projectItems.map((item, index) => (
                        <article key={`project-view-${index}`} className=''>
                          <div>
                            <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                              <h3 className='label text-ink-primary'>
                                {item.name || 'Project not listed'}
                              </h3>
                              <span className='body-sm text-ink-secondary'>
                                {dateRange(item.start_date, item.end_date)}
                              </span>
                            </div>

                            {item.url && (
                              <p className='body-sm mt-1 text-ink-secondary'>
                                <a
                                  href={item.url}
                                  target='_blank'
                                  rel='noreferrer'
                                  className='text-primary hover:underline break-all'
                                >
                                  {item.url}
                                </a>
                              </p>
                            )}
                            {(item.technologies ?? []).length > 0 && (
                              <div className='mt-3'>
                                <TagList values={item.technologies ?? []} />
                              </div>
                            )}
                            <div className='border-l-2 border-primary/20 ml-2 pl-4'>
                              {(item.description ?? []).length > 0 && (
                                <ul className='body-sm mt-3 list-disc space-y-1 pl-4 text-ink-secondary'>
                                  {(item.description ?? []).map(
                                    (line, lineIndex) => (
                                      <li key={`proj-line-${lineIndex}`}>
                                        {line}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              )}
                            </div>
                          </div>
                        </article>
                      ))
                    : <p className='body-sm text-ink-secondary'>Not listed</p>}
                  </div>
                </SectionCard>

                <SectionCard
                  title='Links'
                  layoutId='career-section-links'
                  onClick={() =>
                    openSectionModal(
                      'career-section-links',
                      <LinksEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-links',
                          <LinksEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='space-y-3'>
                    {(data.links ?? []).length ?
                      (data.links ?? []).map((item, index) => (
                        <div
                          key={`link-view-${index}`}
                          className='flex items-center gap-3'
                        >
                          <p className='body-sm font-medium text-ink-primary min-w-28'>
                            {item.type || 'Link'}
                          </p>
                          <a
                            href={item.link || '#'}
                            target='_blank'
                            rel='noreferrer'
                            className='body-sm text-primary hover:underline truncate'
                          >
                            {item.link || 'Not listed'}
                          </a>
                        </div>
                      ))
                    : <p className='body-sm text-ink-secondary'>Not listed</p>}
                  </div>
                </SectionCard>

                <SectionCard
                  title={otherSectionTitle}
                  layoutId='career-section-other'
                  onClick={() =>
                    openSectionModal(
                      'career-section-other',
                      <OtherEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-other',
                          <OtherEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='space-y-4'>
                    {otherItems.length ?
                      otherItems.map((item, index) => (
                        <div key={`other-view-${index}`}>
                          <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                            <p className='label text-ink-primary'>
                              {item.title || item.type || 'Other'}
                            </p>
                            {item.date && (
                              <span className='body-sm text-ink-secondary'>
                                {item.date}
                              </span>
                            )}
                          </div>
                          {[item.organization, item.location]
                            .filter(Boolean)
                            .join(' · ') && (
                            <p className='body-sm mt-1 text-ink-secondary'>
                              {[item.organization, item.location]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          {(item.description ?? []).length > 0 && (
                            <ul className='body-sm mt-3 list-disc space-y-1 pl-4 text-ink-secondary'>
                              {(item.description ?? []).map((line, lIdx) => (
                                <li key={`other-l-${lIdx}`}>{line}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    : <p className='body-sm text-ink-secondary'>Not listed</p>}
                  </div>
                </SectionCard>
              </section>

              <aside
                ref={detailAsideRef}
                className='max-2xl:static 2xl:sticky top-0 2xl:max-h-[calc(100dvh-10rem)] max-2xl:max-h-none self-start space-y-5 2xl:overflow-y-hidden max-2xl:overflow-visible pr-1'
              >
                <SectionCard
                  title='Skills'
                  layoutId='career-section-skills'
                  onClick={() =>
                    openSectionModal(
                      'career-section-skills',
                      <SkillsEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-skills',
                          <SkillsEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='space-y-4'>
                    {skillItems.length ?
                      skillItems.map((group, index) => (
                        <div key={`skill-view-${index}`}>
                          <p className='body-sm mb-2 capitalize text-ink-secondary font-medium'>
                            {group.type || 'Other'}
                          </p>
                          <TagList values={group.skills ?? []} />
                        </div>
                      ))
                    : <p className='body-sm text-ink-secondary'>Not listed</p>}
                  </div>
                </SectionCard>

                <SectionCard
                  title='Certifications'
                  layoutId='career-section-certifications'
                  onClick={() =>
                    openSectionModal(
                      'career-section-certifications',
                      <CertificationsEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-certifications',
                          <CertificationsEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='space-y-4'>
                    {certificationGroups.length ?
                      certificationGroups.map((group, groupIndex) => (
                        <div key={`cert-group-view-${groupIndex}`}>
                          {group.type && group.type !== 'Other' && (
                            <p className='body-sm mb-2 capitalize text-ink-secondary font-medium'>
                              {group.type}
                            </p>
                          )}
                          <div className='space-y-2'>
                            {(group.certifications ?? []).map(
                              (cert, certIndex) => (
                                <div
                                  key={`cert-view-${certIndex}`}
                                  className='text-sm text-ink-secondary'
                                >
                                  <span className='text-ink-primary font-medium'>
                                    {cert.name || 'Certification'}
                                  </span>
                                  {cert.issuer ? ` · ${cert.issuer}` : ''}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ))
                    : <p className='body-sm text-ink-secondary'>Not listed</p>}
                  </div>
                </SectionCard>

                <SectionCard
                  title='Education'
                  layoutId='career-section-education'
                  onClick={() =>
                    openSectionModal(
                      'career-section-education',
                      <EducationEditor
                        data={data}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await saveResumeData(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                  action={
                    <Button
                      size='sm'
                      variant='ghost'
                      Icon={Pencil}
                      onClick={() =>
                        openSectionModal(
                          'career-section-education',
                          <EducationEditor
                            data={data}
                            onClose={closeModal}
                            onSave={async (next) => {
                              await saveResumeData(next);
                              closeModal();
                            }}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  }
                >
                  <div className='space-y-4'>
                    {educationItems.length ?
                      educationItems.map((item, index) => (
                        <div key={`edu-view-${index}`}>
                          <p className='label text-ink-primary'>
                            {[item.degree, item.field_of_study]
                              .filter(Boolean)
                              .join(' · ') || 'Education'}
                          </p>
                          <p className='body-sm mt-1 text-ink-secondary'>
                            {item.institution || 'Institution not listed'}
                          </p>
                          <p className='body-sm text-ink-secondary'>
                            {dateRange(item.start_date, item.end_date)}
                          </p>
                          {(item.highlights ?? []).length > 0 && (
                            <ul className='body-sm mt-2 list-disc space-y-1 pl-4 text-ink-secondary'>
                              {(item.highlights ?? []).map((h, hIdx) => (
                                <li key={`edu-h-${hIdx}`}>{h}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    : <p className='body-sm text-ink-secondary'>Not listed</p>}
                  </div>
                </SectionCard>

                {languageItems.length > 0 && (
                  <SectionCard title='Language'>
                    <div className='space-y-2'>
                      {languageItems.map((item, index) => (
                        <div key={`lang-view-${index}`}>
                          <p className='body-sm text-ink-primary font-medium'>
                            {item.name || 'Language'}
                          </p>
                          <p className='body-sm text-ink-secondary'>
                            {item.proficiency || 'Not listed'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </aside>
            </div>
            <aside
              ref={profileAsideRef}
              className='sticky top-0 max-h-[calc(100dvh-10rem)] self-start space-y-5 overflow-y-hidden pr-1'
            >
              <ResumePreviewSidebar
                data={data}
                filename={resume.original_filename}
              />
              <ResumeScoreSidebar
                evaluation={sidebarEvaluation}
                evaluationIsCurrent={sidebarEvaluationIsCurrent}
                evaluating={evaluating}
                onEvaluate={() => void evaluate()}
                onOpenHistory={() => void openVersionHistory()}
              />
            </aside>
          </div>
          <ResumeSourceDebugger
            onRunAiParse={upload}
            onRunAiRaw={runRawAi}
            parsing={uploading}
          />
        </div>
      )}
      {activeTab === 'scores' && (
        <section className='custom-scrollbar-primary min-h-0 flex-1 overflow-y-auto pr-2'>
          <div className='mb-5'>
            <div>
              <h2 className='title-sub text-ink-primary'>Score history</h2>
              <p className='body-sm mt-1 text-ink-secondary'>
                Every score is tied to the resume data that was evaluated.
              </p>
            </div>
            <Button
              variant='secondary'
              size='sm'
              isLoading={loadingScores}
              onClick={() => void loadScoreHistory()}
            >
              Refresh
            </Button>
          </div>
          <div className='space-y-3'>
            {scoreHistory.map((item) => (
              <button
                key={item.id}
                className='flex w-full items-center justify-between gap-4 rounded-lg border border-border p-4 text-left hover:bg-background-secondary'
                onClick={() =>
                  previewResumeVersion({
                    id: item.id,
                    resume_version: 0,
                    evaluation: item.evaluation,
                    resume_data: item.resume_data,
                    created_at: item.created_at,
                  })
                }
              >
                <span>
                  <span className='block text-lg font-semibold text-ink-primary'>
                    {item.evaluation.overall_score ?? '—'}
                    <span className='text-sm font-normal text-ink-secondary'>
                      {' '}
                      / 100
                    </span>
                  </span>
                  <span className='body-sm text-ink-secondary'>
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </span>
                <span className='text-sm text-primary'>View snapshot</span>
              </button>
            ))}
            {!loadingScores && !scoreHistory.length && (
              <EmptyPlaceHolder
                message='No scores yet. Your first upload is scored automatically.'
                className='border-0 bg-transparent py-6'
              />
            )}
          </div>
        </section>
      )}
      {activeTab === 'settings' && careerProfile && (
        <section className='custom-scrollbar-primary min-h-0 flex-1 overflow-y-auto pr-2'>
          <div className='mb-5 flex items-center justify-between gap-4'>
            <div>
              <h2 className='title-sub text-ink-primary'>
                Application settings
              </h2>
              <p className='body-sm mt-1 text-ink-secondary'>
                These settings apply only to this Resume Profile.
              </p>
            </div>
          </div>
          <ApplicationSettingsCards
            profile={careerProfile}
            onSave={async (nextProfile) => {
              const saved = await api.updateCareerProfile(
                careerProfile.id,
                nextProfile,
              );
              setCareerProfile(saved);
              setCareerProfiles((current) =>
                current.map((item) => (item.id === saved.id ? saved : item)),
              );
              setResume(careerProfileAsResume(saved));
              showGlobalToast('Application settings saved.');
            }}
          />
          <div className='hidden grid gap-4 lg:grid-cols-2'>
            <SectionCard title='Job targets'>
              <Input
                value={careerProfile.search_terms.join(', ')}
                placeholder='Product manager, Growth manager'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    search_terms: splitList(event.target.value),
                  })
                }
              />
              <Input
                className='mt-3'
                value={careerProfile.search_location || ''}
                placeholder='Search location'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    search_location: event.target.value,
                  })
                }
              />
            </SectionCard>
            <SectionCard title='Eligibility and compensation'>
              <Input
                value={careerProfile.years_of_experience || ''}
                placeholder='Years of experience'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    years_of_experience: event.target.value,
                  })
                }
              />
              <Input
                className='mt-3'
                value={careerProfile.require_visa || ''}
                placeholder='Visa requirement'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    require_visa: event.target.value,
                  })
                }
              />
              <Input
                className='mt-3'
                value={String(careerProfile.desired_salary || '')}
                placeholder='Desired salary'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    desired_salary: event.target.value,
                  })
                }
              />
            </SectionCard>
            <SectionCard title='Professional profile'>
              <Input
                value={careerProfile.linkedin_url || ''}
                placeholder='LinkedIn URL'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    linkedin_url: event.target.value,
                  })
                }
              />
              <Input
                className='mt-3'
                value={careerProfile.website || ''}
                placeholder='Portfolio or website'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    website: event.target.value,
                  })
                }
              />
              <Textarea
                className='mt-3 w-full'
                minHeight={96}
                value={careerProfile.linkedin_summary || ''}
                placeholder='Professional summary'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    linkedin_summary: event.target.value,
                  })
                }
              />
            </SectionCard>
            <SectionCard title='AI answer context'>
              <Textarea
                className='w-full'
                minHeight={96}
                value={careerProfile.cover_letter || ''}
                placeholder='Cover letter context'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    cover_letter: event.target.value,
                  })
                }
              />
              <Textarea
                className='mt-3 w-full'
                minHeight={96}
                value={careerProfile.user_information_all || ''}
                placeholder='Additional application context'
                onChange={(event) =>
                  setCareerProfile({
                    ...careerProfile,
                    user_information_all: event.target.value,
                  })
                }
              />
            </SectionCard>
          </div>
        </section>
      )}
    </div>
  );
}
