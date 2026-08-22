/** @format */

import { useState } from 'react';
import {
  Check,
  Loader,
  Minus,
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
import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type { CareerProfile } from '../../shared/contracts/tailored-resume';
import { parseAndFormatJobDate } from '../../shared/utils/date-formatter';
import { cn } from '@jobby/ui/lib/utils';

interface PageClassBannerProps {
  latestInspection: PageInspection | null;
  latestPlan?: ValidatedApplicationPlanResponse | null;
  isInspecting: boolean;
  error?: string;
  onRetryPlan?: () => void;
  onClaimSkill?: (tech: string) => Promise<void> | void;
  onUnclaimSkill?: (tech: string) => Promise<void> | void;
  activeProfile?: CareerProfile | null;
  onReDetect?: () => void;
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

function getSkillSource(
  tech: string,
  matchedSet: Set<string>,
  activeProfile?: CareerProfile | null,
): SkillSource {
  const isMatched = isTechMatched(tech, matchedSet);
  if (!isMatched) return 'unclaimed';

  if (!activeProfile?.resume_data?.skills) {
    return 'resume';
  }

  const profileSkillSet = new Set<string>();
  for (const group of activeProfile.resume_data.skills) {
    for (const s of group.skills || []) {
      if (s) profileSkillSet.add(s.trim().toLowerCase());
    }
  }

  const isPresentInProfile = isTechMatched(tech, profileSkillSet);
  if (isPresentInProfile) {
    return 'profile';
  }

  return 'resume';
}

function hasResolvedCompany(company: string | undefined): boolean {
  const normalized = company?.trim().toLowerCase();
  return Boolean(
    normalized && normalized !== 'unknown' && normalized !== 'unknown company',
  );
}

/**
 * Diagnostic & details banner shown at the top of the side panel.
 * Displays all extracted details for identified job listing pages in English.
 */
export function PageClassBanner({
  latestInspection,
  latestPlan,
  isInspecting,
  error,
  onRetryPlan,
  onClaimSkill,
  onUnclaimSkill,
  activeProfile,
  onReDetect,
  authConnected = true,
  onSignIn: _onSignIn,
}: PageClassBannerProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [claimingSkills, setClaimingSkills] = useState<Set<string>>(new Set());
  const [unclaimingSkills, setUnclaimingSkills] = useState<Set<string>>(
    new Set(),
  );
  const [activeTech, setActiveTech] = useState<string | null>(null);

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
              Easy Apply:
            </span>
            <div className='h-3.5 w-10 rounded-md animate-skeleton-shimmer' />
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
      datePosted,
      description,
      technologies,
      easyApply,
      externalId,
    } = latestInspection.snapshot;

    const matchedTerms = latestPlan?.plan?.decision?.matched_terms || [];
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
            <span className='page-class-banner__icon text-primary font-bold'>
              ✓
            </span>
            <strong className='text-xs font-bold text-foreground'>
              Job Page Identified
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
            <span className='rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary capitalize'>
              {platform}
            </span>
          </div>
        </div>

        {/* Full Identified Information */}
        <div className='grid gap-1.5 text-xs text-foreground/90'>
          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Job Title:
            </span>
            <span className='font-semibold text-foreground'>{title}</span>
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Company:
            </span>
            <span className='font-semibold text-foreground'>{company}</span>
          </div>

          {location && (
            <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
              <span className='text-muted-foreground text-[11px] font-medium'>
                Location:
              </span>
              <span>{location}</span>
            </div>
          )}

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-center'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Posted:
            </span>
            {datePosted ?
              (() => {
                const formatted = parseAndFormatJobDate(datePosted);
                const tier =
                  formatted.freshnessTier ??
                  (formatted.ageInDays != null ?
                    formatted.ageInDays <= 4 ? 'new'
                    : formatted.ageInDays <= 7 ? 'aging'
                    : 'stale'
                  : undefined);
                return (
                  <div className='flex items-center gap-1.5 flex-wrap'>
                    <span>{formatted.displayText}</span>
                    {tier === 'new' && (
                      <span className='inline-flex items-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold leading-none'>
                        New
                      </span>
                    )}
                    {tier === 'aging' && (
                      <span className='inline-flex items-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold leading-none'>
                        Aging
                      </span>
                    )}
                    {tier === 'stale' && (
                      <span className='inline-flex items-center rounded-md bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 px-1.5 py-0.5 text-[10px] font-semibold leading-none'>
                        Stale
                      </span>
                    )}
                  </div>
                );
              })()
            : <span className='text-muted-foreground/70 italic text-[11px]'>
                Unknown
              </span>
            }
          </div>

          <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Easy Apply:
            </span>
            <div>
              <div
                className={
                  easyApply ?
                    'font-semibold text-success border border-success inline-flex items-center justify-center rounded-full px-1 '
                  : 'text-muted-foreground text-xs'
                }
              >
                {easyApply ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          {technologies && technologies.length > 0 && (
            <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 items-start'>
              <span className='text-muted-foreground text-[11px] font-medium pt-0.5'>
                Technologies:
              </span>
              <div className='flex flex-wrap gap-1'>
                {technologies.map((tech: string) => {
                  // Page refreshes can overlap a completed plan evaluation.
                  // Keep the per-technology status tied only to that evaluation.
                  const isLoading = !latestPlan?.plan?.decision;

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
                          : <span className='inline-flex w-3.5 h-3.5 items-center justify-center rounded-full bg-warning/25 text-warning group-hover:bg-primary group-hover:text-primary-foreground transition-colors'>
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

          {authConnected && error && !latestPlan?.plan?.decision && (
            <div
              className='flex items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[10px] text-warning'
              role='alert'
            >
              <span>{error}</span>
              {onRetryPlan && (
                <Tooltip
                  content={
                    <span className='text-xs'>Retry technology evaluation</span>
                  }
                  side='left'
                  delay={100}
                >
                  <button
                    type='button'
                    className='inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-warning/15'
                    aria-label='Retry technology evaluation'
                    onClick={onRetryPlan}
                  >
                    <RotateCcw className='h-3 w-3' />
                  </button>
                </Tooltip>
              )}
            </div>
          )}

          {externalId && (
            <details className='mt-1 text-[10px] text-muted-foreground/60 cursor-pointer select-none'>
              <summary className='hover:text-muted-foreground transition-colors'>
                Show Technical Details
              </summary>
              <div className='grid grid-cols-[85px_minmax(0,1fr)] gap-1 mt-1 font-mono text-[10px] border-t border-primary/40 pt-1'>
                <span>External ID:</span>
                <span className='truncate'>{externalId}</span>
              </div>
            </details>
          )}

          {description && (
            <div className='mt-1 pt-2 border-t border-primary/60 grid gap-1'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-[11px] font-semibold uppercase tracking-wider'>
                  Job Description
                </span>
                <button
                  type='button'
                  className='text-[11px] font-medium text-primary hover:underline cursor-pointer bg-transparent border-0 p-0'
                  onClick={() => setIsDescExpanded((prev) => !prev)}
                >
                  {isDescExpanded ? 'Show Less ▲' : 'Show More ▼'}
                </button>
              </div>
              <div
                className={`text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap ${
                  isDescExpanded ? '' : 'job-desc-collapsed'
                }`}
              >
                {description}
              </div>
            </div>
          )}
        </div>
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
    <details
      className={`page-class-banner page-class-banner--no-job ${isClassifierRejection ? ' page-class-banner--skip' : ''}`}
    >
      <summary className='page-class-banner__summary' role='status'>
        <span className='page-class-banner__icon'>
          {isClassifierRejection ? '✗' : '!'}
        </span>
        <span className='page-class-banner__label'>
          {isClassifierRejection ?
            <>
              <strong>Non-Job Page</strong>
              <span className='page-class-banner__sub'>Parsing skipped</span>
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
