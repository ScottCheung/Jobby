/** @format */

'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  Building2,
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
  JobPreferences,
  RuntimeSettings,
  SearchProfile,
  UserProfile,
} from '@/lib/types';

type FieldProps = {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  full?: boolean;
  hint?: string;
};

type TagEditorProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
  full?: boolean;
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
};

const statusOptions = {
  gender: ['Male', 'Female', 'Other', 'Decline'],
  yesNoDecline: ['Yes', 'No', 'Decline'],
  ethnicity: [
    'Decline',
    'Hispanic/Latino',
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Other',
  ],
  citizenship: [
    'U.S. Citizen/Permanent Resident',
    'Non-citizen allowed to work for any employer',
    'Non-citizen allowed to work for current employer',
    'Non-citizen seeking work authorization',
    'Canadian Citizen/Permanent Resident',
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
  'did_masters',
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
}: FieldProps) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{label}</label>
      {hint ?
        <p className='field-hint'>{hint}</p>
      : null}
      {multiline ?
        <textarea
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      : <input
          type={type}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      }
    </div>
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
}: TagEditorProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const normalized = draft.trim();
    if (!normalized) return;
    if (values.includes(normalized)) {
      setDraft('');
      return;
    }
    onChange([...values, normalized]);
    setDraft('');
  };

  const removeTag = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{label}</label>
      {hint ?
        <p className='field-hint'>{hint}</p>
      : null}
      <div className='tag-editor'>
        <div className='tag-list'>
          {values.map((value) => (
            <button
              key={value}
              type='button'
              className='tag-chip'
              onClick={() => removeTag(value)}
              title={`Remove ${value}`}
            >
              <span>{value}</span>
              <strong>×</strong>
            </button>
          ))}
        </div>
        <div className='tag-input-row'>
          <input
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                addTag();
              }
            }}
          />
          <button type='button' className='ghost mini' onClick={addTag}>
            Add
          </button>
        </div>
      </div>
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
    <button
      type='button'
      className={`toggle-card ${checked ? 'active' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <div className='toggle-card-copy'>
        <div className='toggle-card-title'>
          <span className='toggle-card-glyph'>{icon ?? '•'}</span>
          <strong>{label}</strong>
        </div>
        <p>{description}</p>
      </div>
      <div className={`toggle-card-switch ${checked ? 'on' : ''}`}>
        <span />
      </div>
    </button>
  );
}

function ChoiceCardGroup({
  label,
  hint,
  value,
  onChange,
  options,
  full = false,
}: ChoiceCardGroupProps) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{label}</label>
      {hint ?
        <p className='field-hint'>{hint}</p>
      : null}
      <div className='choice-grid'>
        {options.map((option) => (
          <button
            key={option.value}
            type='button'
            className={`choice-card ${value === option.value ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <div className='choice-card-head'>
              <span>{option.icon ?? '•'}</span>
              <strong>{option.title}</strong>
            </div>
            {option.description ?
              <p>{option.description}</p>
            : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiChoiceGroup({
  label,
  hint,
  values,
  onChange,
  options,
  full = false,
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
      <label>{label}</label>
      {hint ?
        <p className='field-hint'>{hint}</p>
      : null}
      <div className='choice-grid'>
        {options.map((option) => (
          <button
            key={option.value}
            type='button'
            className={`choice-card compact ${values.includes(option.value) ? 'active' : ''}`}
            onClick={() => toggle(option.value)}
          >
            <div className='choice-card-head'>
              <span>{option.icon ?? '•'}</span>
              <strong>{option.title}</strong>
            </div>
          </button>
        ))}
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

function searchExtra(value: SearchProfile, key: string) {
  return (
    value.filters?.[key] ??
    value.blacklist_rules?.[key] ??
    value.whitelist_rules?.[key]
  );
}

function updateSearchSetting(
  value: SearchProfile,
  key: string,
  next: unknown,
): SearchProfile {
  const filters = { ...value.filters };
  const blacklistRules = { ...value.blacklist_rules };
  const whitelistRules = { ...value.whitelist_rules };

  if (
    [
      'about_company_bad_words',
      'about_company_good_words',
      'bad_words',
    ].includes(key)
  ) {
    blacklistRules[key] = next;
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
    <section className='panel'>
      <SectionHeader
        icon={<UserRound size={18} />}
        title='Personal Information'
        description='These values power most Easy Apply questions and identity checks.'
      />
      <div className='form-grid'>
        <Field
          label='First name'
          value={value.first_name}
          onChange={(next) => set('first_name', next)}
        />
        <Field
          label='Last name'
          value={value.last_name}
          onChange={(next) => set('last_name', next)}
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
        />
      </div>
      <div className='actions'>
        <button className='primary' onClick={onSave}>
          Save profile
        </button>
      </div>
    </section>
  );
}

export function PreferencesForm({
  value,
  onChange,
  onSave,
}: {
  value: JobPreferences;
  onChange: (value: JobPreferences) => void;
  onSave: () => void;
}) {
  const set = (key: keyof JobPreferences, nextValue: string) =>
    onChange({ ...value, [key]: nextValue });

  return (
    <section className='panel'>
      <SectionHeader
        icon={<Briefcase size={18} />}
        title='Application Inputs'
        description='These answers feed resume uploads, salary questions, work authorization, and cover letters.'
      />
      <div className='form-grid'>
        <Field
          label='Default resume path'
          value={value.resume_path}
          onChange={(next) => onChange({ ...value, resume_path: next })}
          full
          hint='Maps to default_resume_path in the worker config.'
        />
        <Field
          label='Years of experience'
          value={value.years_of_experience}
          onChange={(next) => set('years_of_experience', next)}
        />
        <ChoiceCardGroup
          label='Visa sponsorship required'
          value={value.require_visa}
          onChange={(next) => set('require_visa', next)}
          options={[
            {
              value: 'Yes',
              title: 'Yes',
              description: 'Need sponsorship now or later.',
              icon: '✦',
            },
            {
              value: 'No',
              title: 'No',
              description: 'Can work without sponsorship.',
              icon: '✓',
            },
          ]}
        />
        <Field
          label='Website / portfolio'
          value={value.website}
          onChange={(next) => set('website', next)}
          full
        />
        <Field
          label='LinkedIn URL'
          value={value.linkedin_url}
          onChange={(next) => set('linkedin_url', next)}
          full
        />
        <ChoiceCardGroup
          label='Citizenship / work authorization'
          value={value.us_citizenship}
          onChange={(next) => set('us_citizenship', next)}
          options={statusOptions.citizenship.map((item) => ({
            value: item,
            title: item,
            icon: '◌',
          }))}
          full
        />
        <Field
          label='Desired salary'
          value={value.desired_salary}
          onChange={(next) => set('desired_salary', next)}
          type='number'
        />
        <Field
          label='Current CTC'
          value={value.current_ctc}
          onChange={(next) => set('current_ctc', next)}
          type='number'
        />
        <Field
          label='Notice period (days)'
          value={value.notice_period}
          onChange={(next) => set('notice_period', next)}
          type='number'
        />
        <Field
          label='Recent employer'
          value={value.recent_employer}
          onChange={(next) => set('recent_employer', next)}
        />
        <Field
          label='Confidence level'
          value={value.confidence_level}
          onChange={(next) => set('confidence_level', next)}
        />
        <Field
          label='LinkedIn headline'
          value={value.linkedin_headline}
          onChange={(next) => set('linkedin_headline', next)}
          full
        />
        <Field
          label='LinkedIn summary'
          value={value.linkedin_summary}
          onChange={(next) => set('linkedin_summary', next)}
          multiline
          full
        />
        <Field
          label='Cover letter'
          value={value.cover_letter}
          onChange={(next) => set('cover_letter', next)}
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
          hint='Optional long-form context passed to AI for answering application questions.'
        />
      </div>
      <div className='actions'>
        <button className='primary' onClick={onSave}>
          Save preferences
        </button>
      </div>
    </section>
  );
}

export function SearchForm({
  value,
  onChange,
  onSave,
}: {
  value: SearchProfile;
  onChange: (value: SearchProfile) => void;
  onSave: () => void;
}) {
  const filters = value.filters ?? {};

  return (
    <section className='panel'>
      <SectionHeader
        icon={<Search size={18} />}
        title='Search Strategy'
        description='Define the roles you want, the filters LinkedIn should use, and the rules the worker should skip.'
      />
      <div className='form-grid'>
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
        />

        <Field
          label='Applications per term before switching'
          value={String(searchExtra(value, 'switch_number') ?? 30)}
          onChange={(next) =>
            onChange(
              updateSearchSetting(value, 'switch_number', Number(next) || 0),
            )
          }
          type='number'
        />

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
                onChange(updateSearchSetting(value, 'easy_apply_only', next))
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
                onChange(updateSearchSetting(value, 'in_your_network', next))
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
                  updateSearchSetting(value, 'randomize_search_order', next),
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
              checked={asBoolean(filters.security_clearance)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'security_clearance', next))
              }
              icon='🛡'
            />
            <ToggleCard
              label='Has masters degree'
              description="Expand eligibility where master's is mentioned."
              checked={asBoolean(filters.did_masters)}
              onChange={(next) =>
                onChange(updateSearchSetting(value, 'did_masters', next))
              }
              icon='🎓'
            />
          </div>
        </div>

        <Field
          label='Current experience cap'
          value={String(searchExtra(value, 'current_experience') ?? 5)}
          onChange={(next) =>
            onChange(
              updateSearchSetting(
                value,
                'current_experience',
                Number(next) || 0,
              ),
            )
          }
          type='number'
          hint='Use -1 to stop filtering by required experience.'
        />

        <TagEditor
          label='About company bad words'
          values={asStringList(value.blacklist_rules?.about_company_bad_words)}
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
          values={asStringList(value.blacklist_rules?.about_company_good_words)}
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
      </div>
      <div className='actions'>
        <button className='primary' onClick={onSave}>
          Save search config
        </button>
      </div>
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
  onSave: () => void;
}) {
  const settings = value.settings ?? {};

  return (
    <section className='panel'>
      <SectionHeader
        icon={<MonitorCog size={18} />}
        title='Runtime Settings'
        description='These toggles control how the local worker behaves while Chrome is running.'
      />

      <div className='form-grid'>
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
        <button className='primary' onClick={onSave}>
          Save runtime settings
        </button>
      </div>
    </section>
  );
}
