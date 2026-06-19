/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CopyPlus,
  Trash2,
  MapPin,
  Pencil,
  Play,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  useConsole,
  emptyJobHuntingProfile,
} from '@/components/ConsoleContext';
import { SearchForm } from '@/components/forms';
import { SegmentedControl } from '@/components/UI/segmented-control';
import type { JobHuntingProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

type SearchSection = 'overview' | 'filters' | 'rules' | 'application';

function cloneProfile(
  profile: JobHuntingProfile,
  nextName: string,
): JobHuntingProfile {
  return {
    ...profile,
    id: undefined,
    is_default: false,
    name: nextName,
    filters: { ...(profile.filters ?? {}) },
    blacklist_rules: { ...(profile.blacklist_rules ?? {}) },
    whitelist_rules: { ...(profile.whitelist_rules ?? {}) },
    search_terms: [...(profile.search_terms ?? [])],
  };
}

function summarizeJobHuntingProfile(profile: JobHuntingProfile) {
  const filters = profile.filters ?? {};
  const searchTermsCount = profile.search_terms?.length ?? 0;
  const locationsCount =
    Array.isArray(filters.location) ? filters.location.length : 0;
  const companiesCount =
    Array.isArray(filters.companies) ? filters.companies.length : 0;
  const workplaceCount =
    Array.isArray(filters.on_site) ? filters.on_site.length : 0;

  return {
    searchTermsCount,
    locationsCount,
    companiesCount,
    workplaceCount,
    switchNumber: Number(filters.switch_number ?? 30) || 30,
    sortBy: String(filters.sort_by ?? 'Most recent'),
    datePosted: String(filters.date_posted ?? 'Past week'),
  };
}

function readOnlyItems(profile: JobHuntingProfile) {
  const filters = profile.filters ?? {};
  const blacklist = profile.blacklist_rules ?? {};
  const whitelist = profile.whitelist_rules ?? {};
  const salary =
    profile.desired_salary ? `$${profile.desired_salary}` : 'No salary target';
  const noticePeriod =
    profile.notice_period || profile.notice_period === 0 ?
      `${profile.notice_period} day notice`
    : 'No notice period';
  const resumePath =
    profile.resume_path ||
    (typeof profile.extra_data?.default_resume_path === 'string' ?
      profile.extra_data.default_resume_path
    : '') ||
    'No resume attached';

  return {
    keywords: profile.search_terms ?? [],
    materials: [
      resumePath,
      profile.linkedin_url || 'No LinkedIn URL',
      profile.website || 'No portfolio URL',
      profile.require_visa || 'No visa preference',
      profile.citizenship || 'No work authorization note',
      salary,
      noticePeriod,
      profile.recent_employer || 'No recent employer',
      profile.confidence_level ?
        `Confidence ${profile.confidence_level}`
      : 'No confidence level',
    ],
    applicationDetails: [
      { label: 'Resume path', value: resumePath },
      {
        label: 'Cover letter',
        value: profile.cover_letter || 'No cover letter',
      },
      {
        label: 'LinkedIn URL',
        value: profile.linkedin_url || 'No LinkedIn URL',
      },
      {
        label: 'Portfolio / website',
        value: profile.website || 'No portfolio URL',
      },
      {
        label: 'Citizenship / authorization',
        value: profile.citizenship || 'No work authorization note',
      },
      {
        label: 'Visa sponsorship',
        value: profile.require_visa || 'No visa preference',
      },
      {
        label: 'Years of experience',
        value: profile.years_of_experience || 'No experience set',
      },
      { label: 'Desired salary', value: salary },
      {
        label: 'Current CTC',
        value:
          profile.current_ctc ? `$${profile.current_ctc}` : 'No current CTC',
      },
      { label: 'Notice period', value: noticePeriod },
      {
        label: 'Recent employer',
        value: profile.recent_employer || 'No recent employer',
      },
      {
        label: 'Confidence level',
        value: profile.confidence_level || 'No confidence level',
      },
      {
        label: 'LinkedIn headline',
        value: profile.linkedin_headline || 'No headline',
      },
      {
        label: 'LinkedIn summary',
        value: profile.linkedin_summary || 'No summary',
      },
      {
        label: 'AI context',
        value: profile.user_information_all || 'No AI context',
      },
    ],
    filters: [
      profile.search_location || 'No search location',
      String(filters.sort_by ?? 'Most recent'),
      String(filters.date_posted ?? 'Past week'),
      `${Number(filters.switch_number ?? 30) || 30} applications per keyword`,
    ],
    targeting: [
      ...(Array.isArray(filters.on_site) ? filters.on_site : []),
      ...(Array.isArray(filters.job_type) ? filters.job_type : []),
      ...(Array.isArray(filters.experience_level) ?
        filters.experience_level
      : []),
    ],
    rules: [
      ...(Array.isArray(blacklist.about_company_bad_words) ?
        blacklist.about_company_bad_words
      : []),
      ...(Array.isArray(blacklist.bad_words) ? blacklist.bad_words : []),
      ...(Array.isArray(whitelist.about_company_good_words) ?
        whitelist.about_company_good_words
      : []),
    ],
  };
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className='rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-panel px-4 py-3'>
      <div className='text-[11px] uppercase tracking-wider text-ink-secondary/70'>
        {label}
      </div>
      <div className='mt-1 text-sm font-semibold text-ink-primary'>{value}</div>
      {hint ?
        <div className='mt-1 text-xs text-ink-secondary'>{hint}</div>
      : null}
    </div>
  );
}

function ReadOnlyBlock({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <section className='rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-panel p-5'>
      <div className='flex items-center gap-2 text-ink-primary'>
        {icon}
        <h3 className='text-sm font-semibold'>{title}</h3>
      </div>
      <div className='mt-4 flex flex-wrap gap-2'>
        {items.length ?
          items.map((item, index) => (
            <span
              key={`${title}-${item}-${index}`}
              className='inline-flex items-center rounded-full border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 px-3 py-1.5 text-xs text-ink-secondary'
            >
              {item}
            </span>
          ))
        : <span className='text-sm text-ink-secondary'>{emptyLabel}</span>}
      </div>
    </section>
  );
}

function DetailGrid({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <section className='rounded-2xl   p-5'>
      <div className='flex items-center gap-2 text-ink-primary'>
        {icon}
        <h3 className='text-sm font-semibold'>{title}</h3>
      </div>
      <div className='mt-4 grid gap-3 md:grid-cols-2'>
        {items.map((item) => (
          <div
            key={item.label}
            className='rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/30 px-4 py-3'
          >
            <div className='text-[11px] uppercase tracking-wider text-ink-secondary/70'>
              {item.label}
            </div>
            <div className='mt-1 whitespace-pre-wrap break-words text-sm text-ink-primary'>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SearchPage() {
  const {
    jobHuntingProfile,
    setJobHuntingProfile,
    jobHuntingProfiles,
    createJobHuntingProfile,
    activateJobHuntingProfile,
    deleteJobHuntingProfile,
    saveJobHuntingProfile,
    hasLoadedInitialData,
  } = useConsole();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [draftProfile, setDraftProfile] =
    useState<JobHuntingProfile>(jobHuntingProfile);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeSection, setActiveSection] = useState<SearchSection>('overview');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const defaultProfile =
      jobHuntingProfiles.find((profile) => profile.is_default) ??
      jobHuntingProfile;
    if (!defaultProfile?.id) return;
    setSelectedProfileId((current) => current || defaultProfile.id || '');
    if (!isEditingProfile) {
      const activeSelection =
        jobHuntingProfiles.find(
          (profile) => profile.id === selectedProfileId,
        ) ?? defaultProfile;
      setDraftProfile(activeSelection);
    }
  }, [
    isEditingProfile,
    jobHuntingProfile,
    jobHuntingProfiles,
    selectedProfileId,
  ]);

  const selectedProfile =
    jobHuntingProfiles.find((profile) => profile.id === selectedProfileId) ??
    jobHuntingProfile;

  const summary = useMemo(
    () => summarizeJobHuntingProfile(selectedProfile ?? emptyJobHuntingProfile),
    [selectedProfile],
  );
  const readOnly = useMemo(
    () => readOnlyItems(selectedProfile ?? emptyJobHuntingProfile),
    [selectedProfile],
  );

  const sectionOptions = [
    { value: 'overview', label: 'Overview' },
    { value: 'application', label: 'Application' },
    { value: 'filters', label: 'Filters' },
    { value: 'rules', label: 'Rules' },
  ];

  const beginEdit = () => {
    setDraftProfile(selectedProfile ?? emptyJobHuntingProfile);
    setIsEditingProfile(true);
  };

  const cancelEdit = () => {
    setDraftProfile(selectedProfile ?? emptyJobHuntingProfile);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await saveJobHuntingProfile(draftProfile);
      setIsEditingProfile(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateProfile = async () => {
    const base = selectedProfile ?? jobHuntingProfile ?? emptyJobHuntingProfile;
    const created = await createJobHuntingProfile(
      cloneProfile(base, `${base.name || 'Search Profile'} Copy`),
    );
    setSelectedProfileId(created.id ?? '');
    setDraftProfile(created);
    setIsEditingProfile(true);
    setActiveSection('overview');
  };

  const handleActivateProfile = async (profileId: string) => {
    if (profileId === selectedProfileId && selectedProfile?.is_default) return;
    await activateJobHuntingProfile(profileId);
    setSelectedProfileId(profileId);
    setIsEditingProfile(false);
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile?.id) return;
    await deleteJobHuntingProfile(selectedProfile.id);
    setIsEditingProfile(false);
  };

  if (!hasLoadedInitialData) {
    return (
      <div className='grid grid-cols-1 gap-6'>
        <section className='panel p-6 text-sm text-ink-secondary'>
          Refreshing data...
        </section>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 h-[calc(100vh-64px)] min-h-[640px] overflow-hidden'>
      <aside className='rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-panel p-4 flex flex-col min-h-0'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-base font-semibold text-ink-primary'>
              Job Hunting Profiles
            </h2>
            <p className='mt-1 text-sm text-ink-secondary'>
              Choose the profile that defines what to search for, what to skip,
              and which resume version to use next.
            </p>
          </div>
          <button
            type='button'
            className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 text-ink-secondary hover:text-ink-primary cursor-pointer'
            onClick={() => void handleCreateProfile()}
            title='Create a new search profile'
          >
            <CopyPlus className='h-4 w-4' />
          </button>
        </div>

        <div className='mt-4 flex-1 overflow-y-auto space-y-2 pr-1'>
          {jobHuntingProfiles.map((profile) => {
            const isSelected = profile.id === selectedProfileId;
            const profileSummary = summarizeJobHuntingProfile(profile);
            return (
              <button
                key={profile.id}
                type='button'
                onClick={() => {
                  setSelectedProfileId(profile.id ?? '');
                  setIsEditingProfile(false);
                }}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                  isSelected ?
                    'border-zinc-900 dark:border-zinc-100 bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                  : 'border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 text-ink-primary hover:border-zinc-400 dark:hover:border-zinc-700',
                )}
              >
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-semibold'>
                      {profile.name || 'Untitled profile'}
                    </div>
                    <div
                      className={cn(
                        'mt-1 truncate text-xs',
                        isSelected ?
                          'text-white/70 dark:text-zinc-700'
                        : 'text-ink-secondary',
                      )}
                    >
                      {profile.search_location || 'No location'}
                    </div>
                  </div>
                  {profile.is_default && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
                        isSelected ?
                          'bg-white/15 text-white dark:bg-zinc-900/10 dark:text-zinc-900'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      <Check className='h-3 w-3' />
                      Running
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    'mt-3 grid grid-cols-2 gap-2 text-[11px]',
                    isSelected ?
                      'text-white/70 dark:text-zinc-700'
                    : 'text-ink-secondary',
                  )}
                >
                  <span>{profileSummary.searchTermsCount} keywords</span>
                  <span>{profileSummary.switchNumber} / keyword</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className='min-h-0 overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-panel flex flex-col'>
        <div className='sticky top-0 z-10 border-b border-zinc-200/70 dark:border-zinc-800/80 bg-panel/95 backdrop-blur-md px-6 py-5'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <div className='flex items-center gap-2'>
                  <h1 className='text-xl font-semibold text-ink-primary'>
                    {selectedProfile?.name || 'Search Profile'}
                  </h1>
                  {selectedProfile?.is_default && (
                    <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400'>
                      <Play className='h-3 w-3' />
                      Active run profile
                    </span>
                  )}
                </div>
                <p className='mt-1 text-sm text-ink-secondary'>
                  {selectedProfile?.search_location ||
                    'No search location selected'}
                </p>
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                {!selectedProfile?.is_default && selectedProfile?.id && (
                  <button
                    type='button'
                    className='inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 px-3.5 py-2 text-sm font-medium text-ink-primary hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer'
                    onClick={() =>
                      void handleActivateProfile(selectedProfile.id!)
                    }
                  >
                    <Play className='h-4 w-4' />
                    Use for runs
                  </button>
                )}

                {selectedProfile?.id &&
                  jobHuntingProfiles.length > 1 &&
                  !isEditingProfile && (
                    <button
                      type='button'
                      className='inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 px-3.5 py-2 text-sm font-medium text-ink-primary hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer'
                      onClick={() => void handleDeleteProfile()}
                    >
                      <Trash2 className='h-4 w-4' />
                      Delete
                    </button>
                  )}

                {isEditingProfile ?
                  <>
                    <button
                      type='button'
                      className='inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 px-3.5 py-2 text-sm font-medium text-ink-primary hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer'
                      onClick={cancelEdit}
                    >
                      <X className='h-4 w-4' />
                      Cancel
                    </button>
                    <button
                      type='button'
                      className='inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950 cursor-pointer disabled:opacity-60'
                      onClick={() => void handleSaveProfile()}
                      disabled={isSavingProfile}
                    >
                      <Save className='h-4 w-4' />
                      {isSavingProfile ? 'Saving...' : 'Save profile'}
                    </button>
                  </>
                : <button
                    type='button'
                    className='inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950 cursor-pointer'
                    onClick={beginEdit}
                  >
                    <Pencil className='h-4 w-4' />
                    Edit
                  </button>
                }
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <SegmentedControl
                value={activeSection}
                onChange={(next) => setActiveSection(next as SearchSection)}
                options={sectionOptions}
                className='mx-0'
              />
            </div>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-6'>
          {isEditingProfile ?
            <div className='space-y-6'>
              {activeSection === 'overview' && (
                <SearchForm
                  value={draftProfile}
                  onChange={setDraftProfile}
                  onSave={() => void handleSaveProfile()}
                  section='overview'
                />
              )}
              {activeSection === 'filters' && (
                <SearchForm
                  value={draftProfile}
                  onChange={setDraftProfile}
                  onSave={() => void handleSaveProfile()}
                  section='filters'
                />
              )}
              {activeSection === 'application' && (
                <SearchForm
                  value={draftProfile}
                  onChange={setDraftProfile}
                  onSave={() => void handleSaveProfile()}
                  section='application'
                />
              )}
              {activeSection === 'rules' && (
                <SearchForm
                  value={draftProfile}
                  onChange={setDraftProfile}
                  onSave={() => void handleSaveProfile()}
                  section='rules'
                />
              )}
            </div>
          : <div className='space-y-6'>
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <SummaryCard
                  label='Keywords'
                  value={`${summary.searchTermsCount}`}
                  hint='Search phrases in rotation'
                />
                <SummaryCard
                  label='Switch After'
                  value={`${summary.switchNumber}`}
                  hint='Applications per keyword'
                />
                <SummaryCard
                  label='Sort'
                  value={summary.sortBy}
                  hint='LinkedIn results order'
                />
                <SummaryCard
                  label='Date Window'
                  value={summary.datePosted}
                  hint='Posting freshness filter'
                />
              </div>

              {activeSection === 'overview' && (
                <div className='grid gap-6 xl:grid-cols-2'>
                  <ReadOnlyBlock
                    title='Keywords'
                    icon={<Search className='h-4 w-4' />}
                    items={readOnly.keywords}
                    emptyLabel='No keywords yet.'
                  />
                  <DetailGrid
                    title='Application Package'
                    icon={<Check className='h-4 w-4' />}
                    items={readOnly.applicationDetails}
                  />
                  <ReadOnlyBlock
                    title='Primary Filters'
                    icon={<SlidersHorizontal className='h-4 w-4' />}
                    items={readOnly.filters}
                    emptyLabel='No filters configured.'
                  />
                  <ReadOnlyBlock
                    title='Targeting'
                    icon={<MapPin className='h-4 w-4' />}
                    items={readOnly.targeting}
                    emptyLabel='No targeting constraints configured.'
                  />
                  <ReadOnlyBlock
                    title='Rules'
                    icon={<Sparkles className='h-4 w-4' />}
                    items={readOnly.rules}
                    emptyLabel='No skip or whitelist rules configured.'
                  />
                </div>
              )}

              {activeSection === 'filters' && (
                <div className='grid gap-6 xl:grid-cols-2'>
                  <ReadOnlyBlock
                    title='Primary Filters'
                    icon={<SlidersHorizontal className='h-4 w-4' />}
                    items={readOnly.filters}
                    emptyLabel='No filters configured.'
                  />
                  <ReadOnlyBlock
                    title='Targeting'
                    icon={<MapPin className='h-4 w-4' />}
                    items={readOnly.targeting}
                    emptyLabel='No targeting constraints configured.'
                  />
                </div>
              )}

              {activeSection === 'application' && (
                <div className='grid gap-6 xl:grid-cols-2'>
                  <DetailGrid
                    title='Application Package'
                    icon={<Check className='h-4 w-4' />}
                    items={readOnly.applicationDetails}
                  />
                </div>
              )}

              {activeSection === 'rules' && (
                <ReadOnlyBlock
                  title='Rules'
                  icon={<Sparkles className='h-4 w-4' />}
                  items={readOnly.rules}
                  emptyLabel='No skip or whitelist rules configured.'
                />
              )}
            </div>
          }
        </div>
      </section>
    </div>
  );
}
