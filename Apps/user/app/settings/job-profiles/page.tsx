/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  FileText,
  Pencil,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import {
  emptyJobHuntingProfile,
  useConsole,
} from '@/components/ConsoleContext';
import { SearchForm } from '@/components/forms';
import { WaterfallLayout } from '@/components/layout/waterfallLayout';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { api } from '@/lib/api';
import type { JobHuntingProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/Button';
import { ActiveResumeModal } from '@/app/settings/resume/_component/active-resume-modal';

type SearchSection =
  | 'overview'
  | 'filters'
  | 'rules'
  | 'materials'
  | 'eligibility'
  | 'career'
  | 'ai';

type SectionStatus = {
  label: string;
  tone: 'ready' | 'needs_attention' | 'optional';
};

const EDITOR_DETAILS: Record<
  SearchSection,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  overview: {
    title: 'Job targets',
    description: 'Choose the roles and primary location to search.',
    icon: Search,
  },
  filters: {
    title: 'Search filters',
    description: 'Narrow results before the automation starts applying.',
    icon: SlidersHorizontal,
  },
  rules: {
    title: 'Skip rules',
    description: 'Exclude roles and employers that do not fit.',
    icon: ShieldAlert,
  },
  materials: {
    title: 'Resume and links',
    description: 'Provide the document and online profiles used in forms.',
    icon: FileText,
  },
  eligibility: {
    title: 'Eligibility and compensation',
    description:
      'Set your experience cap, work authorization, and compensation details.',
    icon: CircleDollarSign,
  },
  career: {
    title: 'Professional profile',
    description: 'Keep the career details used in applications up to date.',
    icon: UserRound,
  },
  ai: {
    title: 'AI answer context',
    description: 'Give generated answers the right facts and writing context.',
    icon: Sparkles,
  },
};

function valuesOf(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function compactPath(value: string) {
  const pieces = value.split(/[\\/]/).filter(Boolean);
  return pieces.at(-1) || value;
}

function normalizeSection(value: string | null | undefined): SearchSection {
  if (value === 'application') return 'materials';
  if (
    value === 'overview' ||
    value === 'filters' ||
    value === 'rules' ||
    value === 'materials' ||
    value === 'eligibility' ||
    value === 'career' ||
    value === 'ai'
  ) {
    return value;
  }
  return 'overview';
}

function hasResume(profile: JobHuntingProfile) {
  return Boolean(
    profile.resume_path?.trim() ||
    String(profile.extra_data?.default_resume_path ?? '').trim(),
  );
}

function getSectionStatus(
  section: SearchSection,
  profile: JobHuntingProfile,
): SectionStatus {
  if (section === 'overview') {
    return profile.search_terms?.length ?
        { label: 'Ready', tone: 'ready' }
      : { label: '1 required item', tone: 'needs_attention' };
  }
  if (section === 'materials') {
    return hasResume(profile) ?
        { label: 'Ready', tone: 'ready' }
      : { label: '1 required item', tone: 'needs_attention' };
  }
  if (section === 'eligibility') {
    return profile.years_of_experience?.trim() ?
        { label: 'Ready', tone: 'ready' }
      : { label: '1 required item', tone: 'needs_attention' };
  }
  return { label: 'Optional', tone: 'optional' };
}

function TagList({
  values,
  empty = 'Not configured',
}: {
  values: string[];
  empty?: string;
}) {
  if (!values.length) {
    return <p className='body-sm text-ink-secondary'>{empty}</p>;
  }

  return (
    <div className='flex flex-wrap gap-1.5'>
      {values.map((value) => (
        <span
          key={value}
          className='body-sm rounded-md bg-background-secondary px-2 py-1 text-ink-secondary'
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function DetailLine({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className='flex items-start justify-between gap-4 border-b border-border/40 py-2.5 last:border-b-0'>
      <span className='body-sm shrink-0 text-ink-secondary'>{label}</span>
      <span
        className={cn(
          'body-sm min-w-0 text-right font-medium text-ink-primary',
          muted && 'text-ink-secondary',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: SectionStatus }) {
  return (
    <span
      className={cn(
        'rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        status.tone === 'ready' ?
          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : status.tone === 'needs_attention' ?
          'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-background-secondary text-ink-secondary',
      )}
    >
      {status.label}
    </span>
  );
}

function ConfigCard({
  section,
  status,
  children,
  onEdit,
}: {
  section: SearchSection;
  status: SectionStatus;
  children: React.ReactNode;
  onEdit: (section: SearchSection) => void;
}) {
  const { title, description, icon: Icon } = EDITOR_DETAILS[section];

  return (
    <motion.section
      layoutId={`job-profile-editor-${section}`}
      onClick={() => onEdit(section)}
      transition={{
        type: 'spring',
        duration: 0.7,
        bounce: 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
      className=' bg-panel card'
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex min-w-0 items-start gap-3 col'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Icon className='h-4 w-4' />
          </div>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='title-card text-ink-primary'>{title}</h2>
              <StatusBadge status={status} />
            </div>
            <p className='body-sm mt-0.5 text-ink-secondary'>{description}</p>
          </div>
        </div>
        <motion.button
          type='button'
          title={`Edit ${title}`}
          aria-label={`Edit ${title}`}
          className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-primary'
        >
          <Pencil className='h-4 w-4' />
        </motion.button>
      </div>
      <div className='mt-5'>{children}</div>
    </motion.section>
  );
}

function JobProfileEditorModal({
  section,
  profile,
  onSave,
  onClose,
}: {
  section: SearchSection;
  profile: JobHuntingProfile;
  onSave: (profile: JobHuntingProfile) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const { title, description, icon: Icon } = EDITOR_DETAILS[section];
  const status = getSectionStatus(section, draft);

  const handleSave = async () => {
    if (section === 'eligibility' && !draft.years_of_experience?.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[480px] flex-col'>
      <header className='flex shrink-0 items-start justify-between gap-5 border-b border-border/60 px-6 py-5 md:px-8'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
            <Icon className='h-5 w-5' />
          </div>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='title-section text-ink-primary'>{title}</h2>
              <StatusBadge status={status} />
            </div>
            <p className='body-md mt-1 text-ink-secondary'>{description}</p>
          </div>
        </div>
        <button
          type='button'
          title='Close editor'
          aria-label='Close editor'
          onClick={onClose}
          className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
        >
          <X className='h-4 w-4' />
        </button>
      </header>

      <div className='custom-scrollbar-primary flex-1 overflow-y-auto px-6 py-6 md:px-8'>
        <SearchForm
          value={draft}
          onChange={setDraft}
          onSave={() => undefined}
          section={section}
          embedded
        />
      </div>

      <footer className='footer'>
        <Button variant='ghost' onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={
            isSaving ||
            (section === 'eligibility' && !draft.years_of_experience?.trim())
          }
          Icon={Check}
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </footer>
    </div>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const {
    jobHuntingProfile,
    saveJobHuntingProfile,
    hasLoadedInitialData,
    profile: userProfile,
    setJobHuntingProfile,
    loadData,
  } = useConsole();
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);
  const onboardingSection = searchParams?.get('section');
  const shouldOpenEditor = searchParams?.get('edit') === '1';

  const selectedProfile = jobHuntingProfile ?? emptyJobHuntingProfile;

  const summary = useMemo(() => {
    const filters = selectedProfile.filters ?? {};
    const resumePath =
      selectedProfile.resume_path ||
      String(selectedProfile.extra_data?.default_resume_path ?? '');
    const resumeFilename =
      String(selectedProfile.extra_data?.resume_filename ?? '').trim() ||
      (resumePath ? compactPath(resumePath) : '');
    const ruleCount =
      valuesOf(selectedProfile.blacklist_rules?.about_company_bad_words)
        .length +
      valuesOf(selectedProfile.blacklist_rules?.bad_words).length +
      valuesOf(selectedProfile.whitelist_rules?.about_company_good_words)
        .length;

    return {
      filters,
      resumePath,
      resumeFilename,
      ruleCount,
      targeting: [
        ...valuesOf(filters.on_site),
        ...valuesOf(filters.job_type),
        ...valuesOf(filters.experience_level),
      ],
      locations: valuesOf(filters.location),
      companies: valuesOf(filters.companies),
      aboutBadWords: valuesOf(
        selectedProfile.blacklist_rules?.about_company_bad_words,
      ),
      descriptionBadWords: valuesOf(selectedProfile.blacklist_rules?.bad_words),
    };
  }, [selectedProfile]);

  const openActiveResume = () => {
    openModal({
      layoutId: 'active-resume',
      className: 'w-[94vw] max-w-2xl max-h-[86vh] rounded-lg',
      content: (
        <ActiveResumeModal
          currentUrl={summary.resumePath}
          onClose={closeModal}
          onUpload={() => {
            closeModal();
            window.location.href = '/settings/resume';
          }}
          onSelected={async () => {
            const nextProfile = await api.jobHuntingProfile();
            setJobHuntingProfile(nextProfile);
            loadData();
          }}
        />
      ),
      onClose: closeModal,
    });
  };

  const completion = useMemo(() => {
    const ready = [
      Boolean(
        userProfile.first_name?.trim() &&
        userProfile.last_name?.trim() &&
        userProfile.phone_number?.trim(),
      ),
      Boolean(selectedProfile.search_terms?.length),
      hasResume(selectedProfile),
      Boolean(selectedProfile.years_of_experience?.trim()),
    ];
    return { complete: ready.filter(Boolean).length, total: ready.length };
  }, [selectedProfile, userProfile]);

  const openEditor = (section: SearchSection, profile = selectedProfile) => {
    openModal({
      layoutId: `job-profile-editor-${section}`,
      className: 'w-[94vw] max-w-6xl max-h-[88vh] rounded-lg',
      content: (
        <JobProfileEditorModal
          section={section}
          profile={profile}
          onClose={closeModal}
          onSave={async (nextProfile) => {
            await saveJobHuntingProfile(nextProfile);
            closeModal();
          }}
        />
      ),
      onClose: closeModal,
    });
  };

  useEffect(() => {
    if (!hasLoadedInitialData || !shouldOpenEditor) return;
    openEditor(normalizeSection(onboardingSection));
    // This URL is only created by the dashboard quick start; it should open once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedInitialData, shouldOpenEditor]);

  if (!hasLoadedInitialData) {
    return (
      <section className='panel p-6 text-ink-secondary'>
        Refreshing data...
      </section>
    );
  }

  const isMinimumReady = completion.complete === completion.total;
  const remaining = completion.total - completion.complete;

  return (
    <div className='flex h-[calc(100vh-64px)] min-h-[640px] flex-col overflow-hidden'>
      <main className='custom-scrollbar-primary min-h-0 flex-1 overflow-y-auto pr-1'>
        <header className='flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5'>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <BriefcaseBusiness className='h-5 w-5 text-primary' />
              <h1 className='title-section text-ink-primary'>Job Search</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold',
                  isMinimumReady ?
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                )}
              >
                <Check className='h-3 w-3' />
                {isMinimumReady ?
                  'Minimum setup ready'
                : `${remaining} required item${remaining === 1 ? '' : 's'} remaining`
                }
              </span>
            </div>
            <p className='body-md mt-1 text-ink-secondary'>
              Targets and application settings for{' '}
              <span className='font-medium text-ink-primary'>
                {summary.resumeFilename || 'your active resume'}
              </span>.
            </p>
          </div>
          <Button
            variant='secondary'
            size='md'
            Icon={FileText}
            layoutId='active-resume'
            onClick={openActiveResume}
          >
            Active Resume
          </Button>
        </header>

        <div className='pt-5'>
          <WaterfallLayout gap={16} minColumnWidth={350}>
            {[
              <ConfigCard
                key='targets'
                section='overview'
                status={getSectionStatus('overview', selectedProfile)}
                onEdit={openEditor}
              >
                <TagList
                  values={selectedProfile.search_terms ?? []}
                  empty='Add at least one title or keyword to start searching.'
                />
                <div className='mt-4'>
                  <DetailLine
                    label='Search location'
                    value={selectedProfile.search_location || 'Anywhere'}
                    muted={!selectedProfile.search_location}
                  />
                  <DetailLine
                    label='Switch after'
                    value={`${Number(summary.filters.switch_number ?? 30) || 30} applications`}
                  />
                </div>
              </ConfigCard>,

              <ConfigCard
                key='materials'
                section='materials'
                status={getSectionStatus('materials', selectedProfile)}
                onEdit={openEditor}
              >
                <DetailLine
                  label='Resume'
                  value={
                    summary.resumeFilename ?
                      summary.resumeFilename
                    : 'Not attached'
                  }
                  muted={!summary.resumePath}
                />
                <DetailLine
                  label='LinkedIn'
                  value={
                    selectedProfile.linkedin_url ? 'Connected' : 'Not added'
                  }
                  muted={!selectedProfile.linkedin_url}
                />
                <DetailLine
                  label='Portfolio'
                  value={selectedProfile.website ? 'Connected' : 'Not added'}
                  muted={!selectedProfile.website}
                />
              </ConfigCard>,

              <ConfigCard
                key='filters'
                section='filters'
                status={getSectionStatus('filters', selectedProfile)}
                onEdit={openEditor}
              >
                <DetailLine
                  label='Sort and date'
                  value={`${String(summary.filters.sort_by ?? 'Most recent')} · ${String(summary.filters.date_posted ?? 'Past week')}`}
                />
                <div className='mt-3'>
                  <p className='text-[11px] font-semibold uppercase tracking-wider text-ink-secondary'>
                    Targeting
                  </p>
                  <div className='mt-2'>
                    <TagList
                      values={summary.targeting}
                      empty='Any workplace, job type, and level'
                    />
                  </div>
                </div>
              </ConfigCard>,

              <ConfigCard
                key='eligibility'
                section='eligibility'
                status={getSectionStatus('eligibility', selectedProfile)}
                onEdit={openEditor}
              >
                <DetailLine
                  label='Work authorization'
                  value={
                    selectedProfile.citizenship ||
                    `Visa sponsorship: ${selectedProfile.require_visa || 'No'}`
                  }
                  muted={!selectedProfile.citizenship}
                />
                <DetailLine
                  label='Experience cap'
                  value={
                    selectedProfile.years_of_experience ?
                      `${selectedProfile.years_of_experience} years`
                    : 'Required'
                  }
                  muted={!selectedProfile.years_of_experience}
                />
                <p className='body-sm mt-3 text-ink-secondary'>
                  Roles requiring more experience than this will be skipped.
                </p>
                <DetailLine
                  label='Notice period'
                  value={
                    selectedProfile.notice_period !== null &&
                    selectedProfile.notice_period !== undefined ?
                      `${selectedProfile.notice_period} days`
                    : 'Not set'
                  }
                  muted={selectedProfile.notice_period === null || selectedProfile.notice_period === undefined}
                />
                <DetailLine
                  label='Compensation'
                  value={
                    selectedProfile.desired_salary ?
                      `Target $${selectedProfile.desired_salary}`
                    : 'Not added'
                  }
                  muted={!selectedProfile.desired_salary}
                />
              </ConfigCard>,

              <ConfigCard
                key='rules'
                section='rules'
                status={getSectionStatus('rules', selectedProfile)}
                onEdit={openEditor}
              >
                <DetailLine
                  label='Active rules'
                  value={
                    summary.ruleCount ? `${summary.ruleCount} phrases` : 'None'
                  }
                  muted={!summary.ruleCount}
                />
                <div className='mt-3'>
                  <TagList
                    values={[
                      ...summary.aboutBadWords,
                      ...summary.descriptionBadWords,
                    ].slice(0, 6)}
                    empty='No company or description exclusions'
                  />
                </div>
              </ConfigCard>,

              <ConfigCard
                key='career'
                section='career'
                status={getSectionStatus('career', selectedProfile)}
                onEdit={openEditor}
              >
                <DetailLine
                  label='Recent employer'
                  value={selectedProfile.recent_employer || 'Not added'}
                  muted={!selectedProfile.recent_employer}
                />
                <DetailLine
                  label='Headline'
                  value={selectedProfile.linkedin_headline || 'Not added'}
                  muted={!selectedProfile.linkedin_headline}
                />
                <DetailLine
                  label='Summary'
                  value={
                    selectedProfile.linkedin_summary ? 'Written' : 'Not added'
                  }
                  muted={!selectedProfile.linkedin_summary}
                />
              </ConfigCard>,

              <ConfigCard
                key='ai'
                section='ai'
                status={getSectionStatus('ai', selectedProfile)}
                onEdit={openEditor}
              >
                <DetailLine
                  label='Cover letter'
                  value={
                    selectedProfile.cover_letter ? 'Prepared' : 'Not added'
                  }
                  muted={!selectedProfile.cover_letter}
                />
                <DetailLine
                  label='Answer context'
                  value={
                    (
                      selectedProfile.user_information_all ||
                      selectedProfile.extra_data?.user_information_all
                    ) ?
                      'Prepared'
                    : 'Not added'
                  }
                  muted={
                    !selectedProfile.user_information_all &&
                    !selectedProfile.extra_data?.user_information_all
                  }
                />
                <div className='mt-3 flex items-center gap-2 body-sm text-ink-secondary'>
                  <BadgeCheck className='h-4 w-4 text-primary' />
                  Used when a form needs a tailored written answer.
                </div>
              </ConfigCard>,
            ]}
          </WaterfallLayout>
        </div>
      </main>
    </div>
  );
}
