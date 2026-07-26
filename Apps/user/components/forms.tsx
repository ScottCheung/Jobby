/** @format */

'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  FileText,
  Globe,
  MapPin,
  MonitorCog,
  MoonStar,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UserRound,
} from 'lucide-react';
import type {
  RuntimeSettings,
  JobHuntingProfile,
  UserProfile,
} from '@/lib/types';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { InputField, Input } from '@/components/UI/input';
import { TagInput } from '@/components/UI/tag-input';
import { Textarea } from '@/components/UI/textarea';
import { Switch } from '@/components/UI/switch';
import { Checkbox } from '@/components/UI/checkbox';
import { Select } from '@/components/UI/select/select';
import { Button } from './UI/Button';
import { cn } from '@/lib/utils';

type FieldProps = {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  full?: boolean;
  hint?: string;
  required?: boolean;
};

type TagEditorProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
  full?: boolean;
  required?: boolean;
};

type ToggleCardProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: string;
};

type ChoiceCardGroupProps = {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    title: string;
    description?: string;
    icon?: string;
  }>;
  full?: boolean;
  icon?: any;
  required?: boolean;
};

type MultiChoiceGroupProps = {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: Array<{
    value: string;
    title: string;
    icon?: string;
  }>;
  full?: boolean;
  required?: boolean;
};

const statusOptions = {
  gender: ['Male', 'Female', 'Other', 'Decline'],
  yesNoDecline: ['Yes', 'No', 'Decline'],
  ethnicity: [
    'Decline / Prefer not to say',
    'Aboriginal or Torres Strait Islander',
    'Australian / Oceanian',
    'East Asian (e.g. Chinese, Japanese, Korean)',
    'South Asian (e.g. Indian, Pakistani, Sri Lankan)',
    'Southeast Asian (e.g. Filipino, Vietnamese, Indonesian)',
    'European / Caucasian',
    'Middle Eastern / North African',
    'Pacific Islander / Pasifika / Maori',
    'Sub-Saharan African',
    'Hispanic / Latino / South American',
    'North American Indigenous / First Nations',
    'Other',
  ],
  citizenship: [
    'Australian Citizen / Permanent Resident',
    'New Zealand Citizen (SCV 444)',
    'Work Visa (Full Work Rights)',
    'Student / Graduate Visa (Limited Work Rights)',
    'U.S. Citizen / Permanent Resident',
    'Canadian Citizen / Permanent Resident',
    'UK / EU Citizen / Permanent Resident',
    'Non-citizen / Requires Visa Sponsorship',
    'Other',
  ],
  sortBy: ['Most recent', 'Most relevant'],
  datePosted: ['Any time', 'Past month', 'Past week', 'Past 24 hours'],
  salary: [
    '',
    '$40,000+',
    '$60,000+',
    '$80,000+',
    '$100,000+',
    '$120,000+',
    '$140,000+',
    '$160,000+',
    '$180,000+',
    '$200,000+',
  ],
  experienceLevel: [
    'Internship',
    'Entry level',
    'Associate',
    'Mid-Senior level',
    'Director',
    'Executive',
  ],
  jobType: [
    'Full-time',
    'Part-time',
    'Contract',
    'Temporary',
    'Volunteer',
    'Internship',
    'Other',
  ],
  workplace: ['On-site', 'Remote', 'Hybrid'],
};

const searchSettingKeys = [
  'switch_number',
  'randomize_search_order',
  'sort_by',
  'date_posted',
  'salary',
  'easy_apply_only',
  'experience_level',
  'job_type',
  'on_site',
  'companies',
  'location',
  'industry',
  'job_function',
  'job_titles',
  'benefits',
  'commitments',
  'under_10_applicants',
  'in_your_network',
  'fair_chance_employer',
  'pause_after_filters',
  'about_company_bad_words',
  'about_company_good_words',
  'bad_words',
  'security_clearance',
  'current_experience',
];

const runtimeExtraKeys = [
  'close_tabs',
  'follow_companies',
  'run_non_stop',
  'alternate_sortby',
  'cycle_date_posted',
  'stop_date_cycle_at_24hr',
  'disable_extensions',
  'keep_screen_awake',
  'showAiErrorAlerts',
];

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  full = false,
  hint,
  required = false,
}: FieldProps) {
  if (multiline) {
    return (
      <Textarea
        label={label}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        helpTextShort={hint}
        containerClassName={full ? 'field full' : 'field'}
        showCharCount={false}
        required={required}
        optional={!required}
      />
    );
  }
  return (
    <InputField
      label={label}
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      helpTextShort={hint}
      containerClassName={full ? 'field full' : 'field'}
      showCharCount={false}
      required={required}
      optional={!required}
    />
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className='section-header'>
      <div className='section-icon'>{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function TagEditor({
  label,
  values,
  onChange,
  placeholder = 'Add a value and press Enter',
  hint,
  full = false,
  required = false,
}: TagEditorProps) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <div className='flex items-center gap-2'>
        <label>{label}</label>
        <span
          className={cn(
            'rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            required ?
              'bg-red-500/10 text-red-500'
            : 'bg-background-secondary text-ink-secondary',
          )}
        >
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      {hint ?
        <p className='field-hint'>{hint}</p>
      : null}
      <TagInput values={values} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
  icon,
}: ToggleCardProps) {
  return (
    <div
      role='button'
      tabIndex={0}
      className={`toggle-card cursor-pointer select-none ${checked ? 'active' : ''}`}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div className='toggle-card-copy'>
        <div className='toggle-card-title'>
          <span className='toggle-card-glyph'>{icon ?? '•'}</span>
          <strong>{label}</strong>
        </div>
        <p>{description}</p>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

function ChoiceCardGroup({
  label,
  hint,
  value,
  onChange,
  options,
  full = false,
  icon,
  required = false,
}: ChoiceCardGroupProps) {
  return (
    <Select
      label={label}
      helpTextShort={hint}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      containerClassName={full ? 'field full' : 'field'}
      placeholder={`Select ${label.toLowerCase()}...`}
      icon={icon}
      required={required}
      optional={!required}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.title}
        </option>
      ))}
    </Select>
  );
}

function MultiChoiceGroup({
  label,
  hint,
  values,
  onChange,
  options,
  full = false,
  required = false,
}: MultiChoiceGroupProps) {
  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  };

  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <div className='flex items-center gap-2'>
        <label className='label block'>{label}</label>
        <span
          className={cn(
            'rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            required ?
              'bg-red-500/10 text-red-500'
            : 'bg-background-secondary text-ink-secondary',
          )}
        >
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      {hint ?
        <p className='field-hint mb-2'>{hint}</p>
      : null}
      <div className='flex flex-wrap gap-4 mt-2'>
        {options.map((option) => {
          const isChecked = values.includes(option.value);
          const id = `${label}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className='body-sm flex items-center gap-2 cursor-pointer text-ink-secondary hover:text-ink-primary select-none'
            >
              <Checkbox
                id={id}
                checked={isChecked}
                onCheckedChange={() => toggle(option.value)}
              />
              <span>{option.title}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function updateExtra<T extends { extra_data?: Record<string, unknown> }>(
  value: T,
  key: string,
  next: unknown,
): T {
  return {
    ...value,
    extra_data: {
      ...(value.extra_data ?? {}),
      [key]: next,
    },
  };
}

function searchExtra(value: JobHuntingProfile, key: string) {
  return (
    value.filters?.[key] ??
    value.blacklist_rules?.[key] ??
    value.whitelist_rules?.[key]
  );
}

function compactPath(value: string) {
  const pieces = value.split(/[\\/]/).filter(Boolean);
  return pieces.at(-1)?.split('?')[0] || value;
}

function resumeDisplay(value: JobHuntingProfile) {
  const path =
    value.resume_path?.trim() ||
    String(value.extra_data?.default_resume_path ?? '').trim();
  const filename =
    String(value.extra_data?.resume_filename ?? '').trim() ||
    (path ? compactPath(path) : '');
  return { path, filename };
}

function updateSearchSetting(
  value: JobHuntingProfile,
  key: string,
  next: unknown,
): JobHuntingProfile {
  const filters = { ...value.filters };
  const blacklistRules = { ...value.blacklist_rules };
  const whitelistRules = { ...value.whitelist_rules };

  if (['about_company_bad_words', 'bad_words'].includes(key)) {
    blacklistRules[key] = next;
  } else if (key === 'about_company_good_words') {
    whitelistRules[key] = next;
  } else {
    filters[key] = next;
  }

  return {
    ...value,
    filters,
    blacklist_rules: blacklistRules,
    whitelist_rules: whitelistRules,
  };
}

function runtimeExtra(value: RuntimeSettings, key: string) {
  return value.settings?.[key];
}

function updateRuntimeSetting(
  value: RuntimeSettings,
  key: string,
  next: unknown,
): RuntimeSettings {
  return {
    ...value,
    settings: {
      ...(value.settings ?? {}),
      [key]: next,
    },
  };
}

export function ProfileForm({
  value,
  onChange,
  onSave,
}: {
  value: UserProfile;
  onChange: (value: UserProfile) => void;
  onSave: () => void;
}) {
  const set = (key: keyof UserProfile, nextValue: string) =>
    onChange({ ...value, [key]: nextValue });

  return (
    <CardWithNorth title='Personal Information'>
      <div className='pb-6 pr-6 flex flex-col '>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          <Field
            label='Preferred Name'
            value={value.preferred_name}
            onChange={(next) => set('preferred_name', next)}
            hint='Used as your display name across the app.'
          />
          <Field
            label='First name'
            value={value.first_name}
            onChange={(next) => set('first_name', next)}
            required
          />
          <Field
            label='Last name'
            value={value.last_name}
            onChange={(next) => set('last_name', next)}
            required
          />
          <Field
            label='Middle name'
            value={value.middle_name}
            onChange={(next) => set('middle_name', next)}
          />
          <Field
            label='Phone number'
            value={value.phone_number}
            onChange={(next) => set('phone_number', next)}
            required
          />
          <Field
            label='Current city'
            value={value.current_city}
            onChange={(next) => set('current_city', next)}
          />
          <Field
            label='Country'
            value={value.country}
            onChange={(next) => set('country', next)}
          />
          <Field
            label='Street'
            value={value.street}
            onChange={(next) => set('street', next)}
            full
          />
          <Field
            label='State'
            value={value.state}
            onChange={(next) => set('state', next)}
          />
          <Field
            label='Zipcode'
            value={value.zipcode}
            onChange={(next) => set('zipcode', next)}
          />

          <ChoiceCardGroup
            label='Ethnicity'
            value={value.ethnicity}
            onChange={(next) => set('ethnicity', next)}
            options={statusOptions.ethnicity.map((item) => ({
              value: item,
              title: item,
              icon: '◌',
            }))}
            full
            icon={UserRound}
          />
          <ChoiceCardGroup
            label='Gender'
            value={value.gender}
            onChange={(next) => set('gender', next)}
            options={statusOptions.gender.map((item) => ({
              value: item,
              title: item,
              icon: '◌',
            }))}
            icon={UserRound}
          />
          <ChoiceCardGroup
            label='Gender identity'
            value={value.gender_identity}
            onChange={(next) => set('gender_identity', next)}
            options={statusOptions.gender.map((item) => ({
              value: item,
              title: item,
              icon: '◌',
            }))}
            icon={UserRound}
          />
          <ChoiceCardGroup
            label='Disability status'
            value={value.disability_status}
            onChange={(next) => set('disability_status', next)}
            options={statusOptions.yesNoDecline.map((item) => ({
              value: item,
              title: item,
              icon:
                item === 'Yes' ? '♿'
                : item === 'No' ? '○'
                : '—',
            }))}
            icon={ShieldCheck}
          />
          <ChoiceCardGroup
            label='Veteran status'
            value={value.veteran_status}
            onChange={(next) => set('veteran_status', next)}
            options={statusOptions.yesNoDecline.map((item) => ({
              value: item,
              title: item,
              icon:
                item === 'Yes' ? '★'
                : item === 'No' ? '○'
                : '—',
            }))}
            icon={ShieldCheck}
          />
        </div>
        <div className='actions'>
          <Button onClick={onSave}>Save profile</Button>
        </div>
      </div>
    </CardWithNorth>
  );
}

export function SearchForm({
  value,
  onChange,
  onSave,
  section = 'overview',
  embedded = false,
}: {
  value: JobHuntingProfile;
  onChange: (value: JobHuntingProfile) => void;
  onSave: (value: JobHuntingProfile) => void;
  section?:
    | 'overview'
    | 'filters'
    | 'rules'
    | 'materials'
    | 'eligibility'
    | 'career'
    | 'ai'
    | 'application';
  embedded?: boolean;
}) {
  const resolvedSection = section === 'application' ? 'materials' : section;
  const filters = value.filters ?? {};
  const showOverview = resolvedSection === 'overview';
  const showFilters = resolvedSection === 'filters';
  const showRules = resolvedSection === 'rules';
  const showMaterials = resolvedSection === 'materials';
  const showEligibility = resolvedSection === 'eligibility';
  const showCareer = resolvedSection === 'career';
  const showAi = resolvedSection === 'ai';
  const attachedResume = resumeDisplay(value);
  const setProfileField = (key: keyof JobHuntingProfile, nextValue: string) =>
    onChange({ ...value, [key]: nextValue });

  return (
    <section className={embedded ? '' : 'panel'}>
      {!embedded && (
        <SectionHeader
          icon={<Search size={18} />}
          title='Search Strategy'
          description={
            showMaterials || showEligibility || showCareer || showAi ?
              'Bind this job hunting profile to its own resume, cover letter, work authorization, and AI answer context.'
            : 'Define the roles you want, the filters LinkedIn should use, and the rules the worker should skip.'
          }
        />
      )}
      <div className='form-grid'>
        {showOverview && (
          <div className='grid grid-cols-2 gap-4'>
            <Field
              label='Profile name'
              value={value.name}
              onChange={(next) => onChange({ ...value, name: next })}
            />
            <Field
              label='Search location'
              value={value.search_location}
              onChange={(next) => onChange({ ...value, search_location: next })}
            />

            <TagEditor
              label='Search terms'
              values={value.search_terms}
              onChange={(next) => onChange({ ...value, search_terms: next })}
              placeholder='Software Engineer'
              hint='Each tag becomes one LinkedIn search term.'
              full
              required
            />

            <Field
              label='Applications per term before switching'
              value={String(searchExtra(value, 'switch_number') ?? 30)}
              onChange={(next) =>
                onChange(
                  updateSearchSetting(
                    value,
                    'switch_number',
                    Number(next) || 0,
                  ),
                )
              }
              type='number'
            />
          </div>
        )}

        {showFilters && (
          <>
            <ChoiceCardGroup
              label='Sort by'
              value={String(filters.sort_by ?? 'Most recent')}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'sort_by', next))
              }
              options={statusOptions.sortBy.map((item) => ({
                value: item,
                title: item,
                icon: item === 'Most recent' ? '⚡' : '◎',
              }))}
              icon={TimerReset}
            />

            <ChoiceCardGroup
              label='Date posted'
              value={String(filters.date_posted ?? 'Past week')}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'date_posted', next))
              }
              options={statusOptions.datePosted.map((item) => ({
                value: item,
                title: item,
                icon: '◷',
              }))}
              icon={MoonStar}
            />

            <ChoiceCardGroup
              label='Minimum salary'
              value={String(filters.salary ?? '')}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'salary', next))
              }
              options={statusOptions.salary.map((item) => ({
                value: item,
                title: item || 'No salary filter',
                icon: item ? '$' : '○',
              }))}
              full
              icon={Briefcase}
            />

            <MultiChoiceGroup
              label='Experience level'
              values={asStringList(filters.experience_level)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'experience_level', next))
              }
              options={statusOptions.experienceLevel.map((item) => ({
                value: item,
                title: item,
                icon: '◌',
              }))}
              full
            />

            <MultiChoiceGroup
              label='Job type'
              values={asStringList(filters.job_type)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'job_type', next))
              }
              options={statusOptions.jobType.map((item) => ({
                value: item,
                title: item,
                icon: '◌',
              }))}
              full
            />

            <MultiChoiceGroup
              label='Workplace'
              values={asStringList(filters.on_site)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'on_site', next))
              }
              options={statusOptions.workplace.map((item) => ({
                value: item,
                title: item,
                icon:
                  item === 'Remote' ? '⌂'
                  : item === 'Hybrid' ? '◐'
                  : '◉',
              }))}
              full
            />

            <TagEditor
              label='Companies'
              values={asStringList(filters.companies)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'companies', next))
              }
              placeholder='Google'
            />
            <TagEditor
              label='Locations'
              values={asStringList(filters.location)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'location', next))
              }
              placeholder='Sydney'
            />
            <TagEditor
              label='Industries'
              values={asStringList(filters.industry)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'industry', next))
              }
              placeholder='Software Development'
            />
            <TagEditor
              label='Job functions'
              values={asStringList(filters.job_function)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'job_function', next))
              }
              placeholder='Engineering'
            />
            <TagEditor
              label='Job titles'
              values={asStringList(filters.job_titles)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'job_titles', next))
              }
              placeholder='Frontend Engineer'
            />
            <TagEditor
              label='Benefits'
              values={asStringList(filters.benefits)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'benefits', next))
              }
              placeholder='401(k)'
            />
            <TagEditor
              label='Commitments'
              values={asStringList(filters.commitments)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'commitments', next))
              }
              placeholder='Full-time'
            />

            <div className='field full'>
              <label>LinkedIn filter toggles</label>
              <div className='toggle-grid'>
                <ToggleCard
                  label='Easy Apply only'
                  description='Only target jobs with LinkedIn Easy Apply.'
                  checked={asBoolean(filters.easy_apply_only, true)}
                  onChange={(next) =>
                    onChange(
                      updateSearchSetting(value, 'easy_apply_only', next),
                    )
                  }
                  icon='⚡'
                />
                <ToggleCard
                  label='Under 10 applicants'
                  description='Prefer fresher postings with less competition.'
                  checked={asBoolean(filters.under_10_applicants)}
                  onChange={(next) =>
                    onChange(
                      updateSearchSetting(value, 'under_10_applicants', next),
                    )
                  }
                  icon='10'
                />
                <ToggleCard
                  label='In your network'
                  description='Prefer jobs connected to your existing network.'
                  checked={asBoolean(filters.in_your_network)}
                  onChange={(next) =>
                    onChange(
                      updateSearchSetting(value, 'in_your_network', next),
                    )
                  }
                  icon='◎'
                />
                <ToggleCard
                  label='Fair chance employer'
                  description='Bias toward employers that flag fair-chance hiring.'
                  checked={asBoolean(filters.fair_chance_employer)}
                  onChange={(next) =>
                    onChange(
                      updateSearchSetting(value, 'fair_chance_employer', next),
                    )
                  }
                  icon='✓'
                />
                <ToggleCard
                  label='Randomize term order'
                  description='Shuffle search terms instead of using a fixed sequence.'
                  checked={asBoolean(filters.randomize_search_order, true)}
                  onChange={(next) =>
                    onChange(
                      updateSearchSetting(
                        value,
                        'randomize_search_order',
                        next,
                      ),
                    )
                  }
                  icon='↺'
                />
                <ToggleCard
                  label='Pause after filters'
                  description='Stop after applying filters so you can inspect the result.'
                  checked={asBoolean(filters.pause_after_filters, true)}
                  onChange={(next) =>
                    onChange(
                      updateSearchSetting(value, 'pause_after_filters', next),
                    )
                  }
                  icon='⏸'
                />
                <ToggleCard
                  label='Has security clearance'
                  description='Allow jobs that require clearance or polygraph.'
                  checked={asBoolean(searchExtra(value, 'security_clearance'))}
                  onChange={(next) =>
                    onChange(
                      updateSearchSetting(value, 'security_clearance', next),
                    )
                  }
                  icon='🛡'
                />
              </div>
            </div>
          </>
        )}

        {showRules && (
          <>
            <TagEditor
              label='About company bad words'
              values={asStringList(
                value.blacklist_rules?.about_company_bad_words,
              )}
              onChange={(next) =>
                onChange(
                  updateSearchSetting(value, 'about_company_bad_words', next),
                )
              }
              placeholder='Staffing'
              hint='Skip companies whose About page contains these words.'
              full
            />
            <TagEditor
              label='About company good words'
              values={asStringList(
                value.whitelist_rules?.about_company_good_words,
              )}
              onChange={(next) =>
                onChange(
                  updateSearchSetting(value, 'about_company_good_words', next),
                )
              }
              placeholder='Robert Half'
              hint='Whitelist exceptions to bad-company rules.'
              full
            />
            <TagEditor
              label='Job description bad words'
              values={asStringList(value.blacklist_rules?.bad_words)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'bad_words', next))
              }
              placeholder='Security Clearance'
              hint='Skip jobs whose descriptions contain these phrases.'
              full
            />
          </>
        )}

        {showMaterials && (
          <>
            <div className='field full'>
              <div className='flex items-center gap-2'>
                <label>Resume</label>
                <span className='rounded-sm bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-500'>
                  Required
                </span>
              </div>
              <div className='mt-2 flex items-center justify-between gap-3 rounded-md border border-border bg-background-secondary p-3'>
                <div className='flex min-w-0 items-center gap-3'>
                  <div className='flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
                    <FileText className='size-5' />
                  </div>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium text-ink-primary'>
                      {attachedResume.filename || 'No resume attached'}
                    </p>
                    <p className='text-xs text-ink-secondary'>
                      {attachedResume.path ?
                        'Managed from Master Resume upload'
                      : 'Upload a resume to attach it to this profile'}
                    </p>
                  </div>
                </div>
                {attachedResume.path ?
                  <a
                    href={attachedResume.path}
                    target='_blank'
                    rel='noreferrer'
                    className='shrink-0 text-sm font-medium text-primary hover:underline'
                  >
                    Open
                  </a>
                : null}
              </div>
            </div>
            <Field
              label='Website / portfolio'
              value={value.website}
              onChange={(next) => setProfileField('website', next)}
              full
            />
            <Field
              label='LinkedIn URL'
              value={value.linkedin_url}
              onChange={(next) => setProfileField('linkedin_url', next)}
              full
            />
          </>
        )}

        {showEligibility && (
          <>
            <Field
              label='Years of experience'
              value={value.years_of_experience}
              onChange={(next) =>
                onChange(
                  updateSearchSetting(
                    { ...value, years_of_experience: next },
                    'current_experience',
                    next.trim() ? Number(next) : -1,
                  ),
                )
              }
              type='number'
              required
              hint='Required. Jobs asking for more experience than this will be skipped.'
            />
            <ChoiceCardGroup
              label='Visa sponsorship required'
              value={value.require_visa}
              onChange={(next) => setProfileField('require_visa', next)}
              options={[
                {
                  value: 'Yes',
                  title: 'Yes',
                },
                {
                  value: 'No',
                  title: 'No',
                },
              ]}
              icon={Globe}
            />
            <ChoiceCardGroup
              label='Citizenship / work authorization'
              value={value.citizenship}
              onChange={(next) => setProfileField('citizenship', next)}
              options={statusOptions.citizenship.map((item) => ({
                value: item,
                title: item,
                icon: '◌',
              }))}
              full
              icon={Globe}
            />
            <Field
              label='Desired salary'
              value={value.desired_salary}
              onChange={(next) => setProfileField('desired_salary', next)}
              type='number'
            />
            <Field
              label='Current CTC'
              value={value.current_ctc}
              onChange={(next) => setProfileField('current_ctc', next)}
              type='number'
            />
            <Field
              label='Notice period (days)'
              value={value.notice_period}
              onChange={(next) =>
                onChange({ ...value, notice_period: Number(next) || 0 })
              }
              type='number'
            />
          </>
        )}

        {showCareer && (
          <>
            <Field
              label='Recent employer'
              value={value.recent_employer}
              onChange={(next) => setProfileField('recent_employer', next)}
            />
            <Field
              label='Confidence level'
              value={value.confidence_level}
              onChange={(next) => setProfileField('confidence_level', next)}
            />
            <Field
              label='LinkedIn headline'
              value={value.linkedin_headline}
              onChange={(next) => setProfileField('linkedin_headline', next)}
              full
            />
            <Field
              label='LinkedIn summary'
              value={value.linkedin_summary}
              onChange={(next) => setProfileField('linkedin_summary', next)}
              multiline
              full
            />
          </>
        )}

        {showAi && (
          <>
            <Field
              label='Cover letter'
              value={value.cover_letter}
              onChange={(next) => setProfileField('cover_letter', next)}
              multiline
              full
            />
            <Field
              label='User information for AI'
              value={
                value.user_information_all ??
                String(value.extra_data?.user_information_all ?? '')
              }
              onChange={(next) =>
                onChange(
                  updateExtra(
                    { ...value, user_information_all: next },
                    'user_information_all',
                    next,
                  ),
                )
              }
              multiline
              full
            />
          </>
        )}
      </div>
      {!embedded && (
        <div className='actions'>
          <Button onClick={() => onSave(value)}>Save search config</Button>
        </div>
      )}
    </section>
  );
}

export function RuntimeForm({
  value,
  onChange,
  onSave,
}: {
  value: RuntimeSettings;
  onChange: (value: RuntimeSettings) => void;
  onSave: (value: RuntimeSettings) => void;
}) {
  const settings = value.settings ?? {};

  return (
    <section className='panel'>
      <SectionHeader
        icon={<MonitorCog size={18} />}
        title='Runtime Settings'
        description='These toggles control how the local worker behaves while Chrome is running.'
      />

      <div className='grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
        <div className='field full'>
          <label>Execution mode</label>
          <div className='toggle-grid'>
            <ToggleCard
              label='Run in background'
              description='Keep the worker quieter and reduce manual prompts.'
              checked={value.run_in_background}
              onChange={(next) =>
                onChange({ ...value, run_in_background: next })
              }
              icon='◐'
            />
            <ToggleCard
              label='Safe mode'
              description='Use a more conservative browser profile strategy.'
              checked={value.safe_mode}
              onChange={(next) => onChange({ ...value, safe_mode: next })}
              icon='🛡'
            />
            <ToggleCard
              label='Stealth mode'
              description='Favor anti-detection behavior where supported.'
              checked={value.stealth_mode}
              onChange={(next) => onChange({ ...value, stealth_mode: next })}
              icon='🕶'
            />
            <ToggleCard
              label='Pause before submit'
              description='Ask for human confirmation before final submission.'
              checked={value.pause_before_submit}
              onChange={(next) =>
                onChange({ ...value, pause_before_submit: next })
              }
              icon='⏸'
            />
            <ToggleCard
              label='Pause at failed question'
              description='Stop if the worker cannot confidently answer a field.'
              checked={value.pause_at_failed_question}
              onChange={(next) =>
                onChange({ ...value, pause_at_failed_question: next })
              }
              icon='?'
            />
            <ToggleCard
              label='Overwrite previous answers'
              description='Replace existing LinkedIn form answers instead of keeping them.'
              checked={value.overwrite_previous_answers}
              onChange={(next) =>
                onChange({ ...value, overwrite_previous_answers: next })
              }
              icon='↻'
            />
            <ToggleCard
              label='Learn from manual answers'
              description='Save answers you type during a paused workflow.'
              checked={value.learn_from_manual_answers}
              onChange={(next) =>
                onChange({ ...value, learn_from_manual_answers: next })
              }
              icon='✎'
            />
            <ToggleCard
              label='Close external tabs'
              description='Auto-close tabs opened by external application flows.'
              checked={asBoolean(runtimeExtra(value, 'close_tabs'))}
              onChange={(next) =>
                onChange(updateRuntimeSetting(value, 'close_tabs', next))
              }
              icon='⇥'
            />
            <ToggleCard
              label='Follow companies'
              description='Tick the follow-company box during Easy Apply.'
              checked={asBoolean(runtimeExtra(value, 'follow_companies'))}
              onChange={(next) =>
                onChange(updateRuntimeSetting(value, 'follow_companies', next))
              }
              icon='★'
            />
            <ToggleCard
              label='Run non-stop'
              description='Cycle continuously until you stop the worker.'
              checked={asBoolean(runtimeExtra(value, 'run_non_stop'))}
              onChange={(next) =>
                onChange(updateRuntimeSetting(value, 'run_non_stop', next))
              }
              icon='∞'
            />
            <ToggleCard
              label='Alternate sort order'
              description='Switch between LinkedIn sort modes across cycles.'
              checked={asBoolean(runtimeExtra(value, 'alternate_sortby'), true)}
              onChange={(next) =>
                onChange(updateRuntimeSetting(value, 'alternate_sortby', next))
              }
              icon='⇅'
            />
            <ToggleCard
              label='Cycle date posted'
              description='Rotate date-posted filter over repeated loops.'
              checked={asBoolean(
                runtimeExtra(value, 'cycle_date_posted'),
                true,
              )}
              onChange={(next) =>
                onChange(updateRuntimeSetting(value, 'cycle_date_posted', next))
              }
              icon='◷'
            />
            <ToggleCard
              label='Stop date cycle at 24h'
              description='Don’t go older than the 24-hour bucket when cycling.'
              checked={asBoolean(
                runtimeExtra(value, 'stop_date_cycle_at_24hr'),
                true,
              )}
              onChange={(next) =>
                onChange(
                  updateRuntimeSetting(value, 'stop_date_cycle_at_24hr', next),
                )
              }
              icon='24'
            />
            <ToggleCard
              label='Disable extensions'
              description='Start Chrome with extensions disabled.'
              checked={asBoolean(runtimeExtra(value, 'disable_extensions'))}
              onChange={(next) =>
                onChange(
                  updateRuntimeSetting(value, 'disable_extensions', next),
                )
              }
              icon='⊘'
            />
            <ToggleCard
              label='Keep screen awake'
              description='Prevent the machine from sleeping during a run.'
              checked={asBoolean(
                runtimeExtra(value, 'keep_screen_awake'),
                true,
              )}
              onChange={(next) =>
                onChange(updateRuntimeSetting(value, 'keep_screen_awake', next))
              }
              icon='☀'
            />
            <ToggleCard
              label='AI error alerts'
              description='Show alerts when AI providers fail.'
              checked={asBoolean(runtimeExtra(value, 'showAiErrorAlerts'))}
              onChange={(next) =>
                onChange(updateRuntimeSetting(value, 'showAiErrorAlerts', next))
              }
              icon='⚠'
            />
          </div>
        </div>

        <Field
          label='Click gap'
          value={value.click_gap}
          onChange={(next) =>
            onChange({ ...value, click_gap: Number(next) || 0 })
          }
          type='number'
          hint='Higher values slow down the worker to look more human.'
        />
        <Field
          label='Question similarity threshold'
          value={value.question_similarity_threshold}
          onChange={(next) =>
            onChange({ ...value, question_similarity_threshold: next })
          }
          type='number'
          hint='Lower values make saved answers match more aggressively.'
        />
      </div>
      <div className='actions'>
        <button className='primary' onClick={() => onSave(value)}>
          Save runtime settings
        </button>
      </div>
    </section>
  );
}
