/** @format */

import { useState } from 'react';
import {
  Check,
  ArrowRight,
  Copy,
  Loader,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@jobby/ui/components/UI/popover';
import { Tooltip } from '@jobby/ui/components/UI/tooltip';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';
import type { JobMatchEvaluation } from '../../shared/contracts/job-match';
import type {
  JobSnapshot,
  PageInspection,
} from '../../shared/contracts/page-inspection';
import type {
  CareerProfile,
  UserSkill,
} from '../../shared/contracts/tailored-resume';
import { parseAndFormatJobDate } from '../../shared/utils/date-formatter';
import { extractJobRequirements } from '../../shared/utils/job-requirements';
import { cn } from '@jobby/ui/lib/utils';
import { StructuredJobDescription } from '@jobby/ui/components/UI/StructuredJobDescription';
import { sendContentCommandToActiveTab } from '../services/messaging';
import { DetectionProviderBadge } from './DetectionProviderBadge';
import { EditJobModal } from './EditJobModal';

interface PageClassBannerProps {
  latestInspection: PageInspection | null;
  latestMatch?: JobMatchEvaluation | null;
  isMatchLoading?: boolean;
  isInspecting: boolean;
  error?: string;
  onRetryMatch?: () => void;
  onClaimSkill?: (tech: string) => Promise<void> | void;
  onUnclaimSkill?: (tech: string) => Promise<void> | void;
  activeProfile?: CareerProfile | null;
  profileSkills?: UserSkill[];
  onReDetect?: () => void;
  onUpdateJobSnapshot?: (updates: Partial<JobSnapshot>) => void;
  onHighlightJobRequirement?: (
    searchTerms: string[],
  ) => Promise<boolean> | void;
  authConnected?: boolean;
  onSignIn?: () => void;
}

const TECH_ALIAS_MAP: Record<string, string> = {
  reactjs: 'react',
  'react.js': 'react',
  vuejs: 'vue',
  'vue.js': 'vue',
  golang: 'go',
  k8s: 'kubernetes',
  aws: 'aws',
  gcp: 'gcp',
  azure: 'azure',
  nodejs: 'node',
  'node.js': 'node',
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mongo: 'mongodb',
  mongodb: 'mongodb',
  nextjs: 'next',
  'next.js': 'next',
  next: 'next',
  expressjs: 'express',
  rest: 'rest',
  restful: 'rest',
  apis: 'api',
  api: 'api',
  frontend: 'frontend',
  'front-end': 'frontend',
  backend: 'backend',
  'back-end': 'backend',
  fullstack: 'fullstack',
  'full-stack': 'fullstack',
  devops: 'devops',
  docker: 'docker',
  graphql: 'graphql',
  tailwind: 'tailwind',
  tailwindcss: 'tailwind',
};

function isTechMatched(tech: string, matchedSet: Set<string>): boolean {
  if (!tech || matchedSet.size === 0) return false;
  const rawLower = tech.trim().toLowerCase();

  // Direct match
  if (matchedSet.has(rawLower)) return true;

  // Canonical alias match
  const canonical = TECH_ALIAS_MAP[rawLower];
  if (canonical && matchedSet.has(canonical)) return true;

  // Reverse canonical lookup
  for (const matchedItem of matchedSet) {
    if (TECH_ALIAS_MAP[matchedItem] === rawLower) return true;
    if (canonical && TECH_ALIAS_MAP[matchedItem] === canonical) return true;
  }

  // Tokenize compound terms (e.g. "React.js", "REST APIs", "C++", "CI/CD")
  const tokens = rawLower
    .split(/[\s/\-+,.;:()&|]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (matchedSet.has(token)) return true;
    const tokenCanonical = TECH_ALIAS_MAP[token];
    if (tokenCanonical && matchedSet.has(tokenCanonical)) return true;
    for (const matchedItem of matchedSet) {
      if (TECH_ALIAS_MAP[matchedItem] === token) return true;
      if (tokenCanonical && TECH_ALIAS_MAP[matchedItem] === tokenCanonical)
        return true;
    }
  }

  return false;
}

type SkillSource = 'profile' | 'resume' | 'unclaimed';

export function shouldShowTechnologyLoading(
  authConnected: boolean,
  isMatchLoading: boolean,
): boolean {
  return authConnected && isMatchLoading;
}

export function getSkillSource(
  tech: string,
  matchedSet: Set<string>,
  activeProfile?: CareerProfile | null,
  profileSkills: UserSkill[] = [],
): SkillSource {
  const isMatched = isTechMatched(tech, matchedSet);
  if (!isMatched) return 'unclaimed';

  const resumeSkillSet = new Set<string>();
  if (activeProfile?.resume_data?.skills) {
    for (const group of activeProfile.resume_data.skills) {
      for (const skill of group.skills || []) {
        if (skill) resumeSkillSet.add(skill.trim().toLowerCase());
      }
    }
  }
  if (isTechMatched(tech, resumeSkillSet)) return 'resume';

  const claimedSkillSet = new Set<string>();
  for (const skill of profileSkills) {
    if (skill.skill_name) claimedSkillSet.add(skill.skill_name.toLowerCase());
    if (skill.canonical_name)
      claimedSkillSet.add(skill.canonical_name.toLowerCase());
  }
  if (isTechMatched(tech, claimedSkillSet)) return 'profile';

  // A match may come from experience, projects, or other resume text.
  return 'resume';
}

function hasResolvedCompany(company: string | undefined): boolean {
  const normalized = company?.trim().toLowerCase();
  return Boolean(
    normalized && normalized !== 'unknown' && normalized !== 'unknown company',
  );
}

function PostingDateRow({
  label,
  value,
  showFreshness = false,
}: {
  label: string;
  value?: string;
  showFreshness?: boolean;
}) {
  const formatted = value ? parseAndFormatJobDate(value) : null;
  const tier = showFreshness ? formatted?.freshnessTier : undefined;
  return (
    <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
      <span className='text-muted-foreground text-[11px] font-medium'>
        {label}:
      </span>
      {formatted ?
        <div className='flex items-center gap-1.5 flex-wrap'>
          <span>{formatted.displayText}</span>
          {tier && (
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                tier === 'new' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                tier === 'aging' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
                tier === 'stale' && 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
              )}
            >
              {tier === 'new' ? 'New' : tier === 'aging' ? 'Aging' : 'Stale'}
            </span>
          )}
        </div>
      : <span className='text-muted-foreground/70 italic text-[11px]'>Unknown</span>}
    </div>
  );
}

function CopyFieldButton({ label, value }: { label: string; value: string }) {
  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify.success(`${label} copied`);
    } catch {
      notify.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <button
      type='button'
      className='inline-flex h-4 w-4 shrink-0 align-middle items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer'
      onClick={() => void copyValue()}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      <Copy className='h-3 w-3' />
    </button>
  );
}

function CopyableFieldRow({
  label,
  value,
  valueClassName,
  truncate = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  truncate?: boolean;
}) {
  const valueElement = (
    <span
      className={cn(
        'align-middle',
        valueClassName,
        truncate && 'inline-block max-w-[calc(100%-1.25rem)] truncate whitespace-nowrap',
      )}
    >
      {value}
    </span>
  );

  return (
    <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-start'>
      <span className='text-muted-foreground text-[11px] font-medium'>
        {label}:
      </span>
      <div className='min-w-0'>
        <span className='align-middle'>
          {truncate ?
            <Tooltip content={value} side='top' align='start' size='sm'>
              {valueElement}
            </Tooltip>
          : valueElement}
          <span className='ml-1'>
            <CopyFieldButton label={label} value={value} />
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Diagnostic & details banner shown at the top of the side panel.
 * Displays all extracted details for identified job listing pages in English.
 */
export function PageClassBanner({
  latestInspection,
  latestMatch,
  isMatchLoading = false,
  isInspecting,
  error,
  onRetryMatch,
  onClaimSkill,
  onUnclaimSkill,
  activeProfile,
  profileSkills = [],
  onReDetect,
  onUpdateJobSnapshot,
  onHighlightJobRequirement,
  authConnected = true,
  onSignIn: _onSignIn,
}: PageClassBannerProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [claimingSkills, setClaimingSkills] = useState<Set<string>>(new Set());
  const [unclaimingSkills, setUnclaimingSkills] = useState<Set<string>>(
    new Set(),
  );
  const [activeTech, setActiveTech] = useState<string | null>(null);

  const saveJob = (updates: Partial<JobSnapshot>) => {
    onUpdateJobSnapshot?.(updates);
    notify.success('Job details updated');
  };

  const handleClaim = async (tech: string) => {
    if (!onClaimSkill || claimingSkills.has(tech)) return;
    setClaimingSkills((prev) => new Set(prev).add(tech));
    try {
      await onClaimSkill(tech);
    } finally {
      setClaimingSkills((prev) => {
        const next = new Set(prev);
        next.delete(tech);
        return next;
      });
    }
  };

  const handleUnclaim = async (tech: string) => {
    if (!onUnclaimSkill || unclaimingSkills.has(tech)) return;
    setUnclaimingSkills((prev) => new Set(prev).add(tech));
    try {
      await onUnclaimSkill(tech);
    } finally {
      setUnclaimingSkills((prev) => {
        const next = new Set(prev);
        next.delete(tech);
        return next;
      });
    }
  };

  const isWaitingForCompany =
    latestInspection?.kind === 'job' &&
    !hasResolvedCompany(latestInspection.snapshot.company);

  if (isInspecting || !latestInspection || isWaitingForCompany) {
    return (
      <div
        className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5'
        role='status'
      >
        <div className='flex items-center justify-between gap-2 border-b border-primary/20 pb-2'>
          <div className='flex items-center gap-1.5'>
            <strong className='text-xs font-bold text-foreground animate-text-shimmer-primary animate-text-shimmer'>
              Inspecting Page...
            </strong>
          </div>
          <span className='h-4 w-16 rounded-full animate-skeleton-shimmer' />
        </div>

        {/* Skeleton Placeholder Content matching loaded job structure */}
        <div className='grid gap-2 text-xs text-foreground/90 pt-0.5'>
          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Job Title:
            </span>
            <div className='h-3.5 w-3/4 rounded-md animate-skeleton-shimmer' />
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Company:
            </span>
            <div className='h-3.5 w-1/2 rounded-md animate-skeleton-shimmer' />
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Location:
            </span>
            <div className='h-3.5 w-2/3 rounded-md animate-skeleton-shimmer' />
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Posted:
            </span>
            <div className='h-3.5 w-1/3 rounded-md animate-skeleton-shimmer' />
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Technologies:
            </span>
            <div className='flex gap-1.5'>
              <div className='h-4 w-14 rounded-md animate-skeleton-shimmer' />
              <div className='h-4 w-16 rounded-md animate-skeleton-shimmer' />
            </div>
          </div>

          <div className='mt-1 pt-2 border-t border-primary/60 grid gap-1.5'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-[11px] font-semibold uppercase tracking-wider'>
                Job Description
              </span>
            </div>
            <div className='grid gap-1.5 pt-0.5'>
              <div className='h-3 w-full rounded-md animate-skeleton-shimmer' />
              <div className='h-3 w-5/6 rounded-md animate-skeleton-shimmer' />
              <div className='h-3 w-4/6 rounded-md animate-skeleton-shimmer' />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (latestInspection.kind === 'job') {
    const {
      platform,
      title,
      company,
      location,
      firstPostedAt,
      lastPostedAt,
      isReposted,
      description,
      technologies,
      externalId,
    } = latestInspection.snapshot;

    const handleOpenInPageJobDescription = async () => {
      if (!description) return;
      try {
        await sendContentCommandToActiveTab({
          type: 'content.show-job-description',
          title: title || 'Job Description',
          company: company || undefined,
          location: location || undefined,
          datePosted: firstPostedAt || lastPostedAt || undefined,
          description,
          platform: platform || undefined,
        });
      } catch (error) {
        notify.error(
          error instanceof Error ? error.message : 'Could not open in-page preview.',
        );
      }
    };

    const eligibilityRequirements = extractJobRequirements(description);

    const matchedTerms = latestMatch?.matched_terms || [];
    const matchedSet = new Set(
      matchedTerms.map((t: string) => t.toLowerCase()),
    );

    return (
      <div
        className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5'
        role='status'
      >
        <div className='flex items-center justify-between gap-2 border-b border-primary/20 pb-2'>
          <div className='flex items-center gap-1.5'>
            <strong className='text-xs font-bold text-foreground'>
              Job Identified
            </strong>
          </div>
          <div className='flex items-center gap-1.5 shrink-0'>
            {onReDetect && (
              <button
                type='button'
                onClick={onReDetect}
                disabled={isInspecting}
                className='inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                title='Re-detect job page'
                aria-label='Re-detect job page'
              >
                <RefreshCw
                  className={cn('w-3.5 h-3.5', isInspecting && 'animate-spin')}
                />
              </button>
            )}
            <button
              type='button'
              onClick={() => setEditOpen(true)}
              className='inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer'
              title='Edit job details'
              aria-label='Edit job details'
            >
              <Pencil className='h-3.5 w-3.5' />
            </button>
            <DetectionProviderBadge
              platform={platform}
              url={latestInspection.snapshot.url}
            />
          </div>
        </div>

        {/* Full Identified Information */}
        <div className='grid gap-1.5 text-xs text-foreground/90'>
          <CopyableFieldRow
            label='Job ID'
            value={externalId}
            valueClassName='font-mono text-[10px] text-foreground'
            truncate
          />

          <CopyableFieldRow
            label='Job Title'
            value={title}
            valueClassName='font-bold text-ink-primary'
          />

          <CopyableFieldRow
            label='Company'
            value={company}
            valueClassName='font-bold text-ink-primary'
          />

          {eligibilityRequirements.length > 0 && (
            <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-start'>
              <span className='text-muted-foreground text-[11px] font-medium pt-0.5'>
                Eligibility:
              </span>
              <div className='flex flex-wrap gap-1'>
                {eligibilityRequirements.map((requirement) => {
                  if (!requirement || typeof requirement.label !== 'string')
                    return null;
                  return (
                    <button
                      type='button'
                      key={requirement.label}
                      className='group inline-flex skill-claim-pill items-center gap-1 border border-destructive/30 bg-destructive/10 py-0.5 pl-1.5 pr-0.5 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/20 cursor-pointer'
                      onClick={() => {
                        void onHighlightJobRequirement?.(
                          requirement.searchTerms,
                        );
                      }}
                      title='Show this requirement in the job description'
                      aria-label={`Show ${requirement.label} in the job description`}
                    >
                      <span>{requirement.label}</span>
                      <span className='inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive/10 text-destructive group-hover:text-destructive-foreground group-hover:bg-destructive '>
                        <ArrowRight className='h-2.5 w-2.5 stroke-[2.5]' />
                      </span>
                    </button>
                  );
                })}
                <CopyFieldButton
                  label='Eligibility'
                  value={eligibilityRequirements
                    .map((requirement) => requirement.label)
                    .join(', ')}
                />
              </div>
            </div>
          )}

          {location && (
            <CopyableFieldRow label='Location' value={location} truncate />
          )}

          {isReposted ?
            <>
              <PostingDateRow label='First posted' value={firstPostedAt} />
              <PostingDateRow label='Reposted' value={lastPostedAt} showFreshness />
            </>
          : <PostingDateRow label='Posted' value={lastPostedAt || firstPostedAt} showFreshness />}

          {technologies && technologies.length > 0 && (
            <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-start'>
              <span className='text-muted-foreground text-[11px] font-medium pt-0.5'>
                Technologies:
              </span>
              <div className='flex flex-wrap gap-1'>
                {technologies.map((tech: string) => {
                  const isLoading = shouldShowTechnologyLoading(
                    authConnected,
                    isMatchLoading,
                  );

                  if (isLoading) {
                    return (
                      <span
                        key={tech}
                        className='rounded-md px-1.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-0.5 border bg-muted/40 text-muted-foreground border-primary/50 animate-text-shimmer animate-text-shimmer-primary '
                      >
                        {tech} ?
                      </span>
                    );
                  }

                  const source = getSkillSource(
                    tech,
                    matchedSet,
                    activeProfile,
                    profileSkills,
                  );
                  const isClaiming = claimingSkills.has(tech);
                  const isUnclaiming = unclaimingSkills.has(tech);
                  const isPopoverOpen = activeTech === tech;

                  // 1. Added in Profile Skills (Uniform green pill, click popover with [Remove from Profile])
                  if (source === 'profile') {
                    return (
                      <Popover
                        key={tech}
                        open={isPopoverOpen}
                        onOpenChange={(open) => {
                          setActiveTech(open ? tech : null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type='button'
                            disabled={isUnclaiming}
                            aria-label={`Manage profile skill ${tech}`}
                            style={{ borderRadius: '6px 12px 12px 6px' }}
                            className={cn(
                              'group relative cursor-pointer pl-1.5 pr-0.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 border bg-success/15 text-success border-success/30 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 hover:shadow-xs active:scale-95 transition-all duration-150 select-none',
                            )}
                          >
                            <span>{tech}</span>
                            {isUnclaiming ?
                              <span className='inline-flex items-center justify-center'>
                                <Loader className='w-2.5 h-2.5 animate-spin' />
                              </span>
                            : <span className='inline-flex w-3.5 h-3.5 items-center justify-center rounded-full bg-success/25 text-success group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors'>
                                <Check className='w-2.5 h-2.5 stroke-[2.5] group-hover:hidden' />
                                <Minus className='w-2.5 h-2.5 stroke-[2.5] hidden group-hover:block' />
                              </span>
                            }
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side='top'
                          align='center'
                          sideOffset={6}
                          className='w-64 p-3 rounded-xl border border-primary/80 bg-background text-foreground shadow-xl text-xs space-y-2.5 z-[200]'
                        >
                          <div className='flex items-center justify-between border-b border-primary/60 pb-1.5'>
                            <div className='flex items-center gap-1.5'>
                              <span className='flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold'>
                                ✓
                              </span>
                              <span className='font-bold text-xs'>{tech}</span>
                            </div>
                            <span className='rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400'>
                              Profile Skill
                            </span>
                          </div>
                          <p className='text-[11px] text-muted-foreground leading-relaxed'>
                            Added to your career profile skills and matched to
                            this job.
                          </p>
                          <div className='flex items-center justify-end gap-1.5 pt-1'>
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='h-6 px-2 text-[11px] cursor-pointer'
                              onClick={() => setActiveTech(null)}
                            >
                              Close
                            </Button>
                            <Button
                              type='button'
                              variant='destructive'
                              size='sm'
                              disabled={isUnclaiming}
                              className='h-6 px-2 text-[11px] gap-1 cursor-pointer font-medium'
                              onClick={() => {
                                setActiveTech(null);
                                void handleUnclaim(tech);
                              }}
                            >
                              <Trash2 className='h-3 w-3' />
                              <span>Remove from Profile</span>
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  }

                  // 2. Base Resume Skill (Uniform green pill, click popover showing Base Resume info)
                  if (source === 'resume') {
                    return (
                      <Popover
                        key={tech}
                        open={isPopoverOpen}
                        onOpenChange={(open) => {
                          setActiveTech(open ? tech : null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type='button'
                            aria-label={`Base resume skill ${tech}`}
                            className='rounded-md px-1.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 border bg-success/15 text-success border-success/30 hover:bg-success/25 hover:border-success/50 transition-all duration-150 cursor-pointer select-none'
                          >
                            <span>{tech} ✓</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side='top'
                          align='center'
                          sideOffset={6}
                          className='w-64 p-3 rounded-xl border border-primary/80 bg-background text-foreground shadow-xl text-xs space-y-2.5 z-[200]'
                        >
                          <div className='flex items-center justify-between border-b border-primary/60 pb-1.5'>
                            <div className='flex items-center gap-1.5'>
                              <span className='flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold'>
                                ✓
                              </span>
                              <span className='font-bold text-xs'>{tech}</span>
                            </div>
                            <span className='rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400'>
                              Base Resume
                            </span>
                          </div>
                          <p className='text-[11px] text-muted-foreground leading-relaxed'>
                            Matched from your uploaded base resume and work
                            experience.
                          </p>
                          <p className='text-[10px] text-muted-foreground/80 italic'>
                            To edit base resume skills, update your Master
                            Resume in Settings.
                          </p>
                          <div className='flex items-center justify-end pt-1'>
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='h-6 px-2 text-[11px] cursor-pointer'
                              onClick={() => setActiveTech(null)}
                            >
                              Got it
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  }

                  // 3. Unclaimed Skill (Amber pill, click popover with confirmation buttons)
                  return (
                    <Popover
                      key={tech}
                      open={isPopoverOpen}
                      onOpenChange={(open) => {
                        setActiveTech(open ? tech : null);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type='button'
                          disabled={isClaiming}
                          aria-label={`Claim ${tech} skill`}
                          style={{ borderRadius: '6px 12px 12px 6px' }}
                          className={cn(
                            'skill-claim-pill group relative cursor-pointer pl-1.5 pr-0.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 border bg-warning/15 text-warning border-warning/30 hover:bg-warning/25 hover:border-warning/50 hover:shadow-xs active:scale-95 transition-all duration-150 select-none',
                          )}
                        >
                          <span>{tech}</span>
                          {isClaiming ?
                            <span className='inline-flex items-center justify-center'>
                              <Loader className='w-2.5 h-2.5 animate-spin' />
                            </span>
                          : <span className='inline-flex w-3.5 h-3.5 items-center justify-center rounded-full bg-warning/25 text-warning group-hover:bg-warning group-hover:text-primary-foreground transition-colors'>
                              <Plus className='w-2.5 h-2.5 stroke-[2.5]' />
                            </span>
                          }
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side='top'
                        align='center'
                        sideOffset={6}
                        className='w-64 p-3 rounded-xl border border-primary/80 bg-background text-foreground shadow-xl text-xs space-y-2.5 z-[200]'
                      >
                        <div className='flex items-center justify-between border-b border-primary/60 pb-1.5'>
                          <div className='flex items-center gap-1.5'>
                            <span className='flex h-4 w-4 items-center justify-center rounded-full bg-warning/20 text-warning text-[10px] font-bold'>
                              +
                            </span>
                            <span className='font-bold text-xs'>
                              Add {tech}?
                            </span>
                          </div>
                          <span className='rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning'>
                            Unclaimed
                          </span>
                        </div>
                        <p className='text-[11px] text-muted-foreground leading-relaxed'>
                          Add <strong>{tech}</strong> to your profile skills to
                          boost your match score for this role.
                        </p>
                        <div className='flex items-center justify-end gap-1.5 pt-1'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-[11px] cursor-pointer'
                            onClick={() => setActiveTech(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type='button'
                            variant='default'
                            size='sm'
                            disabled={isClaiming}
                            className='h-6 px-2.5 text-[11px] gap-1 cursor-pointer font-semibold'
                            onClick={() => {
                              setActiveTech(null);
                              void handleClaim(tech);
                            }}
                          >
                            <Plus className='h-3 w-3' />
                            <span>Add to Profile</span>
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </div>
          )}

          {authConnected && error && !latestMatch && (
            <div
              className='flex items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[10px] text-warning'
              role='alert'
            >
              <span>{error}</span>
              {onRetryMatch && (
                <Tooltip
                  content={
                    <span className='text-xs'>Retry technology evaluation</span>
                  }
                  side='top'
                  align='end'
                  delay={100}
                >
                  <button
                    type='button'
                    className='inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-warning/15'
                    aria-label='Retry technology evaluation'
                    onClick={onRetryMatch}
                  >
                    <RotateCcw className='h-3 w-3' />
                  </button>
                </Tooltip>
              )}
            </div>
          )}

          {description && (
            <div className='mt-1 pt-2 border-t border-primary/60 grid gap-1.5'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-[11px] font-semibold uppercase tracking-wider'>
                  Job Description
                </span>
                <div className='flex items-center gap-1.5'>
                  <button
                    type='button'
                    className='inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer'
                    onClick={() => void handleOpenInPageJobDescription()}
                    title='Open in full page modal'
                    aria-label='Open in full page modal'
                  >
                    <Maximize2 className='h-3 w-3' />
                  </button>
                  <CopyFieldButton
                    label='Job Description'
                    value={description}
                  />
                  <button
                    type='button'
                    className='text-[11px] font-medium text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 ml-0.5'
                    onClick={() => setIsDescExpanded((prev) => !prev)}
                  >
                    {isDescExpanded ? 'Show Less ▲' : 'Show More ▼'}
                  </button>
                </div>
              </div>
              <div
                className={cn(
                  'transition-all duration-200',
                  isDescExpanded ?
                    'max-h-[380px] overflow-y-auto pr-1'
                  : 'max-h-[110px] overflow-hidden relative',
                )}
              >
                <StructuredJobDescription
                  content={description}
                  size='sm'
                  maxBlocks={isDescExpanded ? undefined : 4}
                />
                {!isDescExpanded && (
                  <div className='absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-panel to-transparent pointer-events-none' />
                )}
              </div>
            </div>
          )}
        </div>

        <EditJobModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          snapshot={latestInspection.snapshot}
          onSave={saveJob}
        />
      </div>
    );
  }

  // not_job_page or unsupported_page
  const reason =
    (
      latestInspection.kind === 'not_job_page' ||
      latestInspection.kind === 'unsupported_page'
    ) ?
      latestInspection.reason
    : 'Unknown reason';

  const isClassifierRejection =
    reason.includes('没有任何求职信号') || reason.includes('置信度不足');

  return (
    <details className='page-class-banner page-class-banner--no-job'>
      <summary className='page-class-banner__summary' role='status'>
        <span className='page-class-banner__icon'>
          {isClassifierRejection ? '✗' : '!'}
        </span>
        <span className='page-class-banner__label'>
          {isClassifierRejection ?
            <>
              <strong>Non-Job Page</strong>
              <span className='page-class-banner__sub'>
                No job details found
              </span>
            </>
          : <>
              <strong>Insufficient Content</strong>
              <span className='page-class-banner__sub'>
                Unable to extract job info
              </span>
            </>
          }
        </span>
        <span className='page-class-banner__expand-hint'>▾ Show Reason</span>
      </summary>
      <p className='page-class-banner__reason'>{reason}</p>
    </details>
  );
}
