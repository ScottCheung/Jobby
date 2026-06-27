/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  useConsole,
  emptyJobHuntingProfile,
} from '@/components/ConsoleContext';
import { SearchForm } from '@/components/forms';
import type { JobHuntingProfile } from '@/lib/types';
import { WaterfallLayout } from '@/components/layout/waterfallLayout';

// Subcomponents
import { ProfileSidebar } from './_component/profile-sidebar';
import { ProfileHeader } from './_component/profile-header';
import { SummaryCards } from './_component/summary-cards';
import { ReadOnlyBlock } from './_component/read-only-block';
import { DetailGrid } from './_component/detail-grid';

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

export default function SearchPage() {
  const {
    jobHuntingProfile,
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

  const readOnly = useMemo(
    () => readOnlyItems(selectedProfile ?? emptyJobHuntingProfile),
    [selectedProfile],
  );

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
      <ProfileSidebar
        profiles={jobHuntingProfiles}
        selectedId={selectedProfileId}
        onSelect={(id) => {
          setSelectedProfileId(id);
          setIsEditingProfile(false);
        }}
        onCreate={handleCreateProfile}
      />

      <section className='min-h-0 overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-panel flex flex-col'>
        <ProfileHeader
          profile={selectedProfile}
          profilesCount={jobHuntingProfiles.length}
          isEditing={isEditingProfile}
          isSaving={isSavingProfile}
          activeSection={activeSection}
          onChangeSection={setActiveSection}
          onActivate={() => handleActivateProfile(selectedProfile?.id ?? '')}
          onDelete={handleDeleteProfile}
          onEdit={beginEdit}
          onCancel={cancelEdit}
          onSave={handleSaveProfile}
        />

        <div className='custom-scrollbar-primary flex-1 overflow-y-auto px-6 py-6'>
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
              <SummaryCards
                profile={selectedProfile ?? emptyJobHuntingProfile}
              />

              {activeSection === 'overview' && (
                <WaterfallLayout gap={24} minColumnWidth={420}>
                  {[
                    <ReadOnlyBlock
                      key='overview-keywords'
                      title='Keywords'
                      icon={<Search className='h-4 w-4' />}
                      items={readOnly.keywords}
                      emptyLabel='No keywords yet.'
                    />,
                    <DetailGrid
                      key='overview-application'
                      title='Application Package'
                      icon={<Check className='h-4 w-4' />}
                      items={readOnly.applicationDetails}
                    />,
                    <ReadOnlyBlock
                      key='overview-filters'
                      title='Primary Filters'
                      icon={<SlidersHorizontal className='h-4 w-4' />}
                      items={readOnly.filters}
                      emptyLabel='No filters configured.'
                    />,
                    <ReadOnlyBlock
                      key='overview-targeting'
                      title='Targeting'
                      icon={<MapPin className='h-4 w-4' />}
                      items={readOnly.targeting}
                      emptyLabel='No targeting constraints configured.'
                    />,
                    <ReadOnlyBlock
                      key='overview-rules'
                      title='Rules'
                      icon={<Sparkles className='h-4 w-4' />}
                      items={readOnly.rules}
                      emptyLabel='No skip or whitelist rules configured.'
                    />,
                  ]}
                </WaterfallLayout>
              )}

              {activeSection === 'filters' && (
                <WaterfallLayout gap={24} minColumnWidth={320}>
                  {[
                    <ReadOnlyBlock
                      key='filters-primary'
                      title='Primary Filters'
                      icon={<SlidersHorizontal className='h-4 w-4' />}
                      items={readOnly.filters}
                      emptyLabel='No filters configured.'
                    />,
                    <ReadOnlyBlock
                      key='filters-targeting'
                      title='Targeting'
                      icon={<MapPin className='h-4 w-4' />}
                      items={readOnly.targeting}
                      emptyLabel='No targeting constraints configured.'
                    />,
                  ]}
                </WaterfallLayout>
              )}

              {activeSection === 'application' && (
                <WaterfallLayout gap={24} minColumnWidth={420}>
                  {[
                    <DetailGrid
                      key='application-detail'
                      title='Application Package'
                      icon={<Check className='h-4 w-4' />}
                      items={readOnly.applicationDetails}
                    />,
                  ]}
                </WaterfallLayout>
              )}

              {activeSection === 'rules' && (
                <WaterfallLayout gap={24} minColumnWidth={320}>
                  {[
                    <ReadOnlyBlock
                      key='rules-primary'
                      title='Rules'
                      icon={<Sparkles className='h-4 w-4' />}
                      items={readOnly.rules}
                      emptyLabel='No skip or whitelist rules configured.'
                    />,
                  ]}
                </WaterfallLayout>
              )}
            </div>
          }
        </div>
      </section>
    </div>
  );
}
