/** @format */

'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
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
import { SearchForm } from '@/components/forms';
import { WaterfallLayout } from '@/components/layout/waterfallLayout';
import { Button } from '@/components/UI/Button';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { cn } from '@/lib/utils';
import type { JobHuntingProfile } from '@/lib/types';

type Section =
  | 'overview'
  | 'filters'
  | 'rules'
  | 'materials'
  | 'eligibility'
  | 'career'
  | 'ai';
type Status = { label: string; tone: 'ready' | 'needs_attention' | 'optional' };

const details: Record<
  Section,
  { title: string; description: string; icon: typeof Search }
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
const values = (value: unknown) =>
  Array.isArray(value) ? value.filter(Boolean).map(String) : [];
const compactPath = (value: string) =>
  value.split(/[\\/]/).filter(Boolean).at(-1) || value;
const hasResume = (profile: JobHuntingProfile) =>
  Boolean(
    profile.resume_path?.trim() ||
    String(profile.extra_data?.default_resume_path ?? '').trim(),
  );
function status(section: Section, profile: JobHuntingProfile): Status {
  if (section === 'overview')
    return profile.search_terms?.length ?
        { label: 'Ready', tone: 'ready' }
      : { label: '1 required item', tone: 'needs_attention' };
  if (section === 'materials')
    return hasResume(profile) ?
        { label: 'Ready', tone: 'ready' }
      : { label: '1 required item', tone: 'needs_attention' };
  if (section === 'eligibility')
    return profile.years_of_experience?.trim() ?
        { label: 'Ready', tone: 'ready' }
      : { label: '1 required item', tone: 'needs_attention' };
  return { label: 'Optional', tone: 'optional' };
}
function Tags({
  values: items,
  empty = 'Not configured',
}: {
  values: string[];
  empty?: string;
}) {
  return items.length ?
      <div className='flex flex-wrap gap-1.5'>
        {items.map((item) => (
          <span
            key={item}
            className='body-sm rounded-md bg-background-secondary px-2 py-1 text-ink-secondary'
          >
            {item}
          </span>
        ))}
      </div>
    : <p className='body-sm text-ink-secondary'>{empty}</p>;
}
function Line({
  label,
  value,
  muted,
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
function Badge({ value }: { value: Status }) {
  return (
    <span
      className={cn(
        'rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        value.tone === 'ready' ?
          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : value.tone === 'needs_attention' ?
          'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-background-secondary text-ink-secondary',
      )}
    >
      {value.label}
    </span>
  );
}
function Card({
  section,
  profile,
  onEdit,
  children,
}: {
  section: Section;
  profile: JobHuntingProfile;
  onEdit: (section: Section) => void;
  children: React.ReactNode;
}) {
  const item = details[section];
  const Icon = item.icon;
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
      className='bg-panel card'
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex min-w-0 items-start gap-3 col'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Icon className='h-4 w-4' />
          </div>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='title-card text-ink-primary'>{item.title}</h2>
              <Badge value={status(section, profile)} />
            </div>
            <p className='body-sm mt-0.5 text-ink-secondary'>
              {item.description}
            </p>
          </div>
        </div>
        <motion.button
          type='button'
          title={`Edit ${item.title}`}
          aria-label={`Edit ${item.title}`}
          className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-primary'
        >
          <Pencil className='h-4 w-4' />
        </motion.button>
      </div>
      <div className='mt-5'>{children}</div>
    </motion.section>
  );
}
function Editor({
  section,
  profile,
  onSave,
  onClose,
}: {
  section: Section;
  profile: JobHuntingProfile;
  onSave: (profile: JobHuntingProfile) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const item = details[section];
  const Icon = item.icon;
  const save = async () => {
    if (section === 'eligibility' && !draft.years_of_experience?.trim()) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className='flex max-h-[88vh] min-h-[480px] flex-col'>
      <header className='header'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
            <Icon className='h-5 w-5' />
          </div>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='title-section text-ink-primary'>{item.title}</h2>
              <Badge value={status(section, draft)} />
            </div>
            <p className='body-md mt-1 text-ink-secondary'>
              {item.description}
            </p>
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
      <div className='body'>
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
          onClick={() => void save()}
          disabled={
            saving ||
            (section === 'eligibility' && !draft.years_of_experience?.trim())
          }
          Icon={Check}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </footer>
    </div>
  );
}

export function ApplicationSettingsCards({
  profile,
  onSave,
}: {
  profile: JobHuntingProfile;
  onSave: (profile: JobHuntingProfile) => Promise<void>;
}) {
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);
  const summary = useMemo(() => {
    const filters = profile.filters ?? {};
    const resumePath =
      profile.resume_path ||
      String(profile.extra_data?.default_resume_path ?? '');
    return {
      filters,
      resumePath,
      resumeFilename:
        String(profile.extra_data?.resume_filename ?? '').trim() ||
        (resumePath ? compactPath(resumePath) : ''),
      ruleCount:
        values(profile.blacklist_rules?.about_company_bad_words).length +
        values(profile.blacklist_rules?.bad_words).length +
        values(profile.whitelist_rules?.about_company_good_words).length,
      targeting: [
        ...values(filters.on_site),
        ...values(filters.job_type),
        ...values(filters.experience_level),
      ],
      aboutBadWords: values(profile.blacklist_rules?.about_company_bad_words),
      descriptionBadWords: values(profile.blacklist_rules?.bad_words),
    };
  }, [profile]);
  const edit = (section: Section) =>
    openModal({
      layoutId: `job-profile-editor-${section}`,
      className: 'w-[94vw] max-w-6xl max-h-[88vh] rounded-lg',
      content: (
        <Editor
          section={section}
          profile={profile}
          onClose={closeModal}
          onSave={async (next) => {
            await onSave(next);
            closeModal();
          }}
        />
      ),
      onClose: closeModal,
    });
  return (
    <WaterfallLayout gap={16} minColumnWidth={350}>
      <Card section='overview' profile={profile} onEdit={edit}>
        <Tags
          values={profile.search_terms ?? []}
          empty='Add at least one title or keyword to start searching.'
        />
        <div className='mt-4'>
          <Line
            label='Search location'
            value={profile.search_location || 'Anywhere'}
            muted={!profile.search_location}
          />
          <Line
            label='Candidate scan limit'
            value={`${Number(summary.filters.switch_number ?? 30) || 30} candidates`}
          />
        </div>
      </Card>
      <Card section='materials' profile={profile} onEdit={edit}>
        <Line
          label='Resume'
          value={summary.resumeFilename || 'Not attached'}
          muted={!summary.resumePath}
        />
        <Line
          label='LinkedIn'
          value={profile.linkedin_url ? 'Connected' : 'Not added'}
          muted={!profile.linkedin_url}
        />
        <Line
          label='Portfolio'
          value={profile.website ? 'Connected' : 'Not added'}
          muted={!profile.website}
        />
      </Card>
      <Card section='filters' profile={profile} onEdit={edit}>
        <Line
          label='Sort and date'
          value={`${String(summary.filters.sort_by ?? 'Most recent')} · ${String(summary.filters.date_posted ?? 'Past week')}`}
        />
        <div className='mt-3'>
          <p className='text-[11px] font-semibold uppercase tracking-wider text-ink-secondary'>
            Targeting
          </p>
          <div className='mt-2'>
            <Tags
              values={summary.targeting}
              empty='Any workplace, job type, and level'
            />
          </div>
        </div>
      </Card>
      <Card section='eligibility' profile={profile} onEdit={edit}>
        <Line
          label='Work authorization'
          value={
            profile.citizenship ||
            `Visa sponsorship: ${profile.require_visa || 'No'}`
          }
          muted={!profile.citizenship}
        />
        <Line
          label='Experience cap'
          value={
            profile.years_of_experience ?
              `${profile.years_of_experience} years`
            : 'Required'
          }
          muted={!profile.years_of_experience}
        />
        <p className='body-sm mt-3 text-ink-secondary'>
          Roles requiring more experience than this will be skipped.
        </p>
        <Line
          label='Notice period'
          value={
            (
              profile.notice_period !== null &&
              profile.notice_period !== undefined
            ) ?
              `${profile.notice_period} days`
            : 'Not set'
          }
          muted={
            profile.notice_period === null ||
            profile.notice_period === undefined
          }
        />
        <Line
          label='Compensation'
          value={
            profile.desired_salary ?
              `Target $${profile.desired_salary}`
            : 'Not added'
          }
          muted={!profile.desired_salary}
        />
      </Card>
      <Card section='rules' profile={profile} onEdit={edit}>
        <Line
          label='Active rules'
          value={summary.ruleCount ? `${summary.ruleCount} phrases` : 'None'}
          muted={!summary.ruleCount}
        />
        <div className='mt-3'>
          <Tags
            values={[
              ...summary.aboutBadWords,
              ...summary.descriptionBadWords,
            ].slice(0, 6)}
            empty='No company or description exclusions'
          />
        </div>
      </Card>
      <Card section='career' profile={profile} onEdit={edit}>
        <Line
          label='Recent employer'
          value={profile.recent_employer || 'Not added'}
          muted={!profile.recent_employer}
        />
        <Line
          label='Headline'
          value={profile.linkedin_headline || 'Not added'}
          muted={!profile.linkedin_headline}
        />
        <Line
          label='Summary'
          value={profile.linkedin_summary ? 'Written' : 'Not added'}
          muted={!profile.linkedin_summary}
        />
      </Card>
      <Card section='ai' profile={profile} onEdit={edit}>
        <Line
          label='Cover letter'
          value={profile.cover_letter ? 'Prepared' : 'Not added'}
          muted={!profile.cover_letter}
        />
        <Line
          label='Answer context'
          value={
            (
              profile.user_information_all ||
              profile.extra_data?.user_information_all
            ) ?
              'Prepared'
            : 'Not added'
          }
          muted={
            !profile.user_information_all &&
            !profile.extra_data?.user_information_all
          }
        />
        <div className='mt-3 flex items-center gap-2 body-sm text-ink-secondary'>
          <BadgeCheck className='h-4 w-4 text-primary' />
          Used when a form needs a tailored written answer.
        </div>
      </Card>
    </WaterfallLayout>
  );
}
