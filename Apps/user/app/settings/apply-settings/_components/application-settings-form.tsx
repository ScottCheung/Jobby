/** @format */

'use client';
import { Button, InputField, Select, Switch, TagInput } from '@jobby/ui';

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  Cpu,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { ApplicationSettings } from '@/lib/types';





import { cn } from '@/lib/utils';

type SettingsSection = 'policy' | 'automation' | 'ai_resume';

type Props = {
  section: SettingsSection;
  value: ApplicationSettings;
  onChange: (value: ApplicationSettings) => void;
  onSave?: () => void;
  isSaving?: boolean;
};

function ToggleCard({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  icon: Icon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <div
      role='button'
      tabIndex={0}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={cn(
        'flex items-start justify-between gap-4 p-4 rounded-xl border border-border/50 bg-background-secondary/40 transition-all select-none',
        disabled
          ? 'cursor-not-allowed opacity-75'
          : 'cursor-pointer hover:border-primary/40 hover:bg-background-secondary/70',
        checked && 'border-primary/30 bg-primary/5',
      )}
    >
      <div className='flex items-start gap-3 min-w-0'>
        {Icon && (
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5',
              checked
                ? 'bg-primary/10 text-primary'
                : 'bg-background-secondary text-ink-secondary',
            )}
          >
            <Icon className='size-4' />
          </div>
        )}
        <div>
          <p className='text-sm font-semibold text-ink-primary'>{label}</p>
          {hint && (
            <p className='text-xs text-ink-secondary mt-0.5 leading-relaxed'>
              {hint}
            </p>
          )}
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()} className='shrink-0 pt-0.5'>
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function ApplicationSettingsForm({
  section,
  value,
  onChange,
  onSave,
  isSaving = false,
}: Props) {
  const policy = value.policy;
  const automation = value.automation;
  const ai = value.ai;
  const resume = value.resume;

  const update = <K extends keyof ApplicationSettings>(
    key: K,
    next: ApplicationSettings[K],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className='space-y-6 max-w-4xl'>
      {/* Policy Section */}
      {section === 'policy' && (
        <div className='grid gap-6'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <InputField
              label='Minimum Match Score'
              type='number'
              min={0}
              max={1}
              step={0.01}
              value={policy.minimum_match_threshold}
              onChange={(e) =>
                update('policy', {
                  ...policy,
                  minimum_match_threshold: Number(e.target.value),
                })
              }
              helpTextShort='Jobs below this match threshold (0.0 to 1.0) are automatically skipped.'
            />
            <Select
              label='Application Type'
              value={policy.only_easy_apply ? 'easy' : 'all'}
              onChange={(e) =>
                update('policy', {
                  ...policy,
                  only_easy_apply: e.target.value === 'easy',
                })
              }
              helpTextShort='Target all supported application forms or filter for Easy Apply only.'
            >
              <option value='all'>All supported applications</option>
              <option value='easy'>Easy Apply only</option>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-semibold text-ink-primary block'>
              Blacklisted Companies
            </label>
            <p className='text-xs text-ink-secondary mb-2'>
              Applications for these companies will be automatically skipped during job search.
            </p>
            <TagInput
              values={policy.blacklisted_companies}
              onChange={(next) =>
                update('policy', { ...policy, blacklisted_companies: next })
              }
              placeholder='Add company name and press Enter...'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-semibold text-ink-primary block'>
              Blacklisted Job Terms
            </label>
            <p className='text-xs text-ink-secondary mb-2'>
              Jobs containing any of these terms in title or description will be skipped.
            </p>
            <TagInput
              values={policy.blacklisted_job_terms}
              onChange={(next) =>
                update('policy', { ...policy, blacklisted_job_terms: next })
              }
              placeholder='Add term (e.g. Senior, Manager, Secret Clearance) and press Enter...'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-semibold text-ink-primary block'>
              Preferred / Whitelisted Companies
            </label>
            <p className='text-xs text-ink-secondary mb-2'>
              Prioritize and keep track of applications for these target companies.
            </p>
            <TagInput
              values={policy.whitelisted_companies}
              onChange={(next) =>
                update('policy', { ...policy, whitelisted_companies: next })
              }
              placeholder='Add preferred company name and press Enter...'
            />
          </div>
        </div>
      )}

      {/* Automation Section */}
      {section === 'automation' && (
        <div className='grid gap-6'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <Select
              label='Execution Mode'
              value={automation.execution_mode}
              onChange={(e) =>
                update('automation', {
                  ...automation,
                  execution_mode: e.target.value as typeof automation.execution_mode,
                })
              }
              helpTextShort='Human confirmation is required before final submission.'
            >
              <option value='dry_run'>Dry Run (Simulation only)</option>
              <option value='prepare_only'>Prepare Applications Only</option>
              <option value='human_confirmed'>Human Confirmed</option>
              <option value='submit'>Submit After Confirmation</option>
            </Select>

            <Select
              label='Review Channel'
              value={automation.review_channel}
              onChange={(e) =>
                update('automation', {
                  ...automation,
                  review_channel: e.target.value as typeof automation.review_channel,
                })
              }
              helpTextShort='Choose where final confirmation occurs before submission.'
            >
              <option value='browser'>Browser Confirmation</option>
              <option value='console'>Console Confirmation</option>
            </Select>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <InputField
              label='Candidate Scan Limit'
              type='number'
              min={1}
              max={500}
              value={automation.max_jobs_per_run}
              onChange={(e) =>
                update('automation', {
                  ...automation,
                  max_jobs_per_run: Math.max(1, Number(e.target.value)),
                })
              }
              helpTextShort='Maximum candidates checked under one locked search term; only one application is executed.'
            />
            <InputField
              label='Retries Per Job'
              type='number'
              min={0}
              max={10}
              value={automation.max_retries}
              onChange={(e) =>
                update('automation', {
                  ...automation,
                  max_retries: Math.max(0, Number(e.target.value)),
                })
              }
              helpTextShort='Automated retry attempts for transient errors.'
            />
          </div>

          <div className='grid grid-cols-1 gap-3'>
            <ToggleCard
              label='Require Confirmation Before Submit'
              checked={true}
              disabled={true}
              hint='Final submission always requires explicit human confirmation.'
              icon={ShieldCheck}
              onChange={() => undefined}
            />
            <ToggleCard
              label='Stop on Unknown Required Question'
              checked={automation.stop_on_unknown_question}
              hint='Pause automation flow when a required answer cannot be verified.'
              icon={SlidersHorizontal}
              onChange={(next) =>
                update('automation', {
                  ...automation,
                  stop_on_unknown_question: next,
                })
              }
            />
          </div>

          <div className='flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-300'>
            <AlertTriangle className='mt-0.5 size-4 shrink-0' />
            <div>
              <p className='font-semibold text-xs'>Safety Guard Active</p>
              <p className='mt-0.5 text-amber-700/80 dark:text-amber-300/80'>
                Applications will pause at the review step whenever an unverified required question is encountered.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI & Resume Section */}
      {section === 'ai_resume' && (
        <div className='grid gap-6'>
          <ToggleCard
            label='Enable AI Assistance'
            checked={ai.enabled}
            hint='AI is only invoked after policy selects a valid application.'
            icon={Bot}
            onChange={(next) => update('ai', { ...ai, enabled: next })}
          />

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <InputField
              label='AI Provider'
              value={ai.provider}
              onChange={(e) => update('ai', { ...ai, provider: e.target.value })}
              placeholder='openai'
              helpTextShort='LLM service provider (e.g. openai, anthropic, gemini).'
            />
            <InputField
              label='AI Model'
              value={ai.model}
              onChange={(e) => update('ai', { ...ai, model: e.target.value })}
              placeholder='gpt-4o-mini'
              helpTextShort='Model name for answering job application questions.'
            />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <InputField
              label='Minimum Confidence'
              type='number'
              min={0}
              max={1}
              step={0.01}
              value={ai.min_confidence}
              onChange={(e) =>
                update('ai', { ...ai, min_confidence: Number(e.target.value) })
              }
              helpTextShort='Minimum confidence score required.'
            />
            <InputField
              label='AI Calls Per Job'
              type='number'
              min={0}
              max={20}
              value={ai.max_calls_per_job}
              onChange={(e) =>
                update('ai', {
                  ...ai,
                  max_calls_per_job: Math.max(0, Number(e.target.value)),
                })
              }
              helpTextShort='Maximum LLM calls per application.'
            />
            <InputField
              label='Daily Budget ($)'
              type='number'
              min={0}
              step={0.01}
              value={ai.daily_budget}
              onChange={(e) =>
                update('ai', {
                  ...ai,
                  daily_budget: Math.max(0, Number(e.target.value)),
                })
              }
              helpTextShort='Daily cost limit for AI assistance.'
            />
          </div>

          <ToggleCard
            label='Allow Tailored Resume Generation'
            checked={ai.allow_tailored_resume}
            hint='Generate role-customized resumes for high-match opportunities.'
            icon={Sparkles}
            onChange={(next) => update('ai', { ...ai, allow_tailored_resume: next })}
          />

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <InputField
              label='Tailored Resume Threshold'
              type='number'
              min={0}
              max={1}
              step={0.01}
              value={resume.tailored_match_threshold}
              onChange={(e) =>
                update('resume', {
                  ...resume,
                  tailored_match_threshold: Number(e.target.value),
                })
              }
              helpTextShort='Minimum job match score required to tailor resume.'
            />
            <InputField
              label='Master Resume ID'
              value={resume.master_resume_id ?? ''}
              onChange={(e) =>
                update('resume', {
                  ...resume,
                  master_resume_id: e.target.value || null,
                })
              }
              placeholder='Master resume ID'
              helpTextShort='Primary resume used as base for tailoring.'
            />
          </div>

          <ToggleCard
            label='Require Review for Tailored Resumes'
            checked={resume.require_tailored_review}
            hint='Requires explicit human review before submitting tailored resumes.'
            icon={FileText}
            onChange={(next) =>
              update('resume', { ...resume, require_tailored_review: next })
            }
          />
        </div>
      )}

      {/* Optional Card Bottom Action */}
      {onSave && (
        <div className='mt-8 pt-4 border-t border-border/40 flex items-center justify-end'>
          <Button
            onClick={onSave}
            isLoading={isSaving}
            Icon={Check}
            size='md'
          >
            Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}
