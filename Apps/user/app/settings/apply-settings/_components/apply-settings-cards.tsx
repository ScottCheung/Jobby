/** @format */

'use client';
import { Button, CardWithNorth } from '@jobby/ui';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';


import { SearchForm } from '@/components/forms';
import { cn } from '@/lib/utils';
import type { JobHuntingProfile, ApplicationSettings } from '@/lib/types';
import { ApplicationSettingsForm } from './application-settings-form';

export type ApplySettingsSection =
  | 'strategy'
  | 'filters'
  | 'policy'
  | 'automation'
  | 'ai_resume';

const sectionTitles: Record<ApplySettingsSection, string> = {
  strategy: 'Edit Search Strategy',
  filters: 'Edit LinkedIn Search Filters',
  policy: 'Edit Decision Policy & Blacklists',
  automation: 'Edit Automation Controls',
  ai_resume: 'Edit AI & Resume Strategy',
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function DisplayField({
  label,
  value,
  hint,
  full = false,
}: {
  label: string;
  value?: string | number | null;
  hint?: string;
  full?: boolean;
}) {
  const displayValue =
    value !== undefined && value !== null && String(value).trim() !== '' ?
      String(value)
    : null;
  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-3 rounded-xl bg-background-secondary/40 border border-border/40 min-h-[64px]',
        full ? 'col-span-full' : '',
      )}
    >
      <span className='text-xs font-medium text-ink-secondary/70'>{label}</span>
      {displayValue ?
        <span className='text-sm font-semibold text-ink-primary break-words'>
          {displayValue}
        </span>
      : <span className='text-xs italic text-ink-secondary/50'>
          Not configured
        </span>
      }
      {hint && (
        <span className='text-[11px] text-ink-secondary/60 mt-0.5'>{hint}</span>
      )}
    </div>
  );
}

function DisplayTagList({
  label,
  tags,
  full = false,
  emptyText = 'None specified',
}: {
  label: string;
  tags?: string[];
  full?: boolean;
  emptyText?: string;
}) {
  const items = tags?.filter(Boolean) ?? [];
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 p-3 rounded-xl bg-background-secondary/40 border border-border/40 min-h-[64px]',
        full ? 'col-span-full' : '',
      )}
    >
      <span className='text-xs font-medium text-ink-secondary/70'>{label}</span>
      {items.length > 0 ?
        <div className='flex flex-wrap gap-1.5'>
          {items.map((item) => (
            <span
              key={item}
              className='inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-panel border border-border/60 text-ink-primary'
            >
              {item}
            </span>
          ))}
        </div>
      : <span className='text-xs italic text-ink-secondary/50'>
          {emptyText}
        </span>
      }
    </div>
  );
}

/* ── View-Only Cards for Waterfall Layout ── */

export function SearchStrategyCard({
  value,
  onClick,
}: {
  value: JobHuntingProfile;
  onClick?: () => void;
}) {
  const switchNum =
    (value.filters?.switch_number as number | undefined) ??
    (value.extra_data?.switch_number as number | undefined) ??
    30;

  return (
    <motion.div
      layoutId='apply-card-strategy'
      transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
      onClick={onClick}
      className='cursor-pointer group/card relative'
    >
      <CardWithNorth title='Search Keywords & Location' size='sm'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <DisplayTagList
            label='Search Terms'
            tags={value.search_terms}
            full
            emptyText='No search terms added'
          />
          <DisplayField label='Target Location' value={value.search_location} />
          <DisplayField
            label='Applications Per Term'
            value={switchNum ? `${switchNum} jobs before switching` : undefined}
          />
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

export function LinkedInFiltersCard({
  value,
  onClick,
}: {
  value: JobHuntingProfile;
  onClick?: () => void;
}) {
  const filters = value.filters ?? {};
  return (
    <motion.div
      layoutId='apply-card-filters'
      transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
      onClick={onClick}
      className='cursor-pointer group/card relative'
    >
      <CardWithNorth title='LinkedIn Search Filters' size='sm'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <DisplayField
            label='Sort By'
            value={String(filters.sort_by ?? 'Most recent')}
          />
          <DisplayField
            label='Date Posted'
            value={String(filters.date_posted ?? 'Past week')}
          />
          <DisplayField
            label='Minimum Salary'
            value={filters.salary ? String(filters.salary) : 'Any salary'}
          />
          <DisplayTagList
            label='Experience Level'
            tags={asStringList(filters.experience_level)}
          />
          <DisplayTagList
            label='Job Type'
            tags={asStringList(filters.job_type)}
          />
          <DisplayTagList
            label='Workplace'
            tags={asStringList(filters.on_site)}
          />
          <DisplayTagList
            label='Filter Companies'
            tags={asStringList(filters.companies)}
          />
          <DisplayTagList
            label='Filter Locations'
            tags={asStringList(filters.location)}
          />
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

export function DecisionPolicyCard({
  value,
  onClick,
}: {
  value: ApplicationSettings;
  onClick?: () => void;
}) {
  const policy = value.policy;
  const matchThresholdPercent = Math.round(
    (policy.minimum_match_threshold ?? 0.6) * 100,
  );

  return (
    <motion.div
      layoutId='apply-card-policy'
      transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
      onClick={onClick}
      className='cursor-pointer group/card relative'
    >
      <CardWithNorth title='Decision Policy & Blacklists' size='sm'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <DisplayField
            label='Minimum Match Score'
            value={`${matchThresholdPercent}% (${policy.minimum_match_threshold})`}
          />
          <DisplayField
            label='Application Type'
            value={
              policy.only_easy_apply ? 'Easy Apply only' : (
                'All supported applications'
              )
            }
          />
          <DisplayTagList
            label='Blacklisted Companies'
            tags={policy.blacklisted_companies}
            full
            emptyText='No blacklisted companies'
          />
          <DisplayTagList
            label='Blacklisted Job Terms'
            tags={policy.blacklisted_job_terms}
            full
            emptyText='No blacklisted terms'
          />
          <DisplayTagList
            label='Preferred / Whitelisted Companies'
            tags={policy.whitelisted_companies}
            full
            emptyText='No preferred companies'
          />
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

export function AutomationControlsCard({
  value,
  onClick,
}: {
  value: ApplicationSettings;
  onClick?: () => void;
}) {
  const auto = value.automation;
  const modeLabels: Record<string, string> = {
    dry_run: 'Dry Run (Simulation)',
    prepare_only: 'Prepare Applications Only',
    human_confirmed: 'Human Confirmed',
    submit: 'Submit After Confirmation',
  };
  const channelLabels: Record<string, string> = {
    browser: 'Browser Confirmation',
    console: 'Console Confirmation',
  };

  return (
    <motion.div
      layoutId='apply-card-automation'
      transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
      onClick={onClick}
      className='cursor-pointer group/card relative'
    >
      <CardWithNorth title='Automation & Execution Controls' size='sm'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <DisplayField
            label='Execution Mode'
            value={modeLabels[auto.execution_mode] || auto.execution_mode}
          />
          <DisplayField
            label='Review Channel'
            value={channelLabels[auto.review_channel] || auto.review_channel}
          />
          <DisplayField
            label='Candidate Scan Limit'
            value={`${auto.max_jobs_per_run} candidates`}
          />
          <DisplayField
            label='Retries Per Job'
            value={`${auto.max_retries} attempts`}
          />
          <DisplayField
            label='Submission Safeguard'
            value='Always require human confirmation'
            full
          />
          <DisplayField
            label='Unknown Question Handling'
            value={
              auto.stop_on_unknown_question ?
                'Stop automation on unknown question'
              : 'Skip & continue'
            }
            full
          />
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

export function AiResumeStrategyCard({
  value,
  onClick,
}: {
  value: ApplicationSettings;
  onClick?: () => void;
}) {
  const ai = value.ai;
  const resume = value.resume;

  return (
    <motion.div
      layoutId='apply-card-ai_resume'
      transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
      onClick={onClick}
      className='cursor-pointer group/card relative'
    >
      <CardWithNorth title='AI Assistance & Resume Strategy' size='sm'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <DisplayField
            label='AI Status'
            value={
              ai.enabled ?
                `Enabled (${ai.provider || 'openai'} / ${ai.model || 'gpt-4o-mini'})`
              : 'Disabled'
            }
            full
          />
          <DisplayField
            label='Minimum Confidence'
            value={
              ai.min_confidence ?
                `${Math.round(ai.min_confidence * 100)}%`
              : '0.70'
            }
          />
          <DisplayField
            label='LLM Budget & Limits'
            value={`Max ${ai.max_calls_per_job} calls / $${ai.daily_budget} daily`}
          />
          <DisplayField
            label='Tailored Resume'
            value={
              ai.allow_tailored_resume ?
                `Enabled (Threshold: ${Math.round((resume.tailored_match_threshold ?? 0.75) * 100)}%)`
              : 'Disabled'
            }
            full
          />
          <DisplayField
            label='Tailored Resume Review'
            value={
              resume.require_tailored_review ?
                'Human review required'
              : 'Auto apply'
            }
            full
          />
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

/* ── Modal Editor ── */

export function ApplySettingsModalEditor({
  section,
  jobHuntingProfile,
  applicationSettings,
  onSaveJobHuntingProfile,
  onSaveApplicationSettings,
  onClose,
}: {
  section: ApplySettingsSection;
  jobHuntingProfile: JobHuntingProfile;
  applicationSettings: ApplicationSettings;
  onSaveJobHuntingProfile: (updated: JobHuntingProfile) => Promise<void>;
  onSaveApplicationSettings: (updated: ApplicationSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [profileDraft, setProfileDraft] =
    useState<JobHuntingProfile>(jobHuntingProfile);
  const [appSettingsDraft, setAppSettingsDraft] =
    useState<ApplicationSettings>(applicationSettings);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (section === 'strategy' || section === 'filters') {
        await onSaveJobHuntingProfile(profileDraft);
      } else {
        await onSaveApplicationSettings(appSettingsDraft);
      }
      onClose();
    } catch {
      // Handled upstream
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[360px] w-full flex-col'>
      {/* Header */}
      <header className='flex items-center justify-between pb-4 border-b border-border/40 shrink-0'>
        <h2 className='title-card text-ink-primary'>
          {sectionTitles[section]}
        </h2>
        <button
          type='button'
          onClick={onClose}
          className='flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors cursor-pointer'
        >
          <X className='h-4 w-4' />
        </button>
      </header>

      {/* Content Area */}
      <div className='flex-1 overflow-y-auto custom-scrollbar-primary py-6 min-h-0 pr-1'>
        {(section === 'strategy' || section === 'filters') && (
          <SearchForm
            value={profileDraft}
            onChange={setProfileDraft}
            onSave={() => undefined}
            section={section === 'strategy' ? 'overview' : 'filters'}
            embedded
          />
        )}

        {(section === 'policy' ||
          section === 'automation' ||
          section === 'ai_resume') && (
          <ApplicationSettingsForm
            section={section}
            value={appSettingsDraft}
            onChange={setAppSettingsDraft}
          />
        )}
      </div>

      {/* Footer */}
      <footer className='flex items-center justify-end gap-3 pt-4 border-t border-border/40 shrink-0'>
        <Button variant='secondary' onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} isLoading={isSaving} Icon={Check}>
          Save Changes
        </Button>
      </footer>
    </div>
  );
}
