/** @format */

'use client';

import { useState } from 'react';
import {
  Check,
  ArrowRight,
  ChevronDown,
  Copy,
  EyeOff,
  Loader,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
} from '@jobby/ui/components/icons';
import { getSkillSearchTerms } from '../../../lib/job-skills';
import { classifySkills } from '../../../lib/job-skills/classification';
import { motion, LayoutGroup } from 'framer-motion';
import { Button } from '../Button';
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from '../popover';
import { Tooltip } from '../tooltip';
import { notify } from '../toast/toast-store';
import type {
  JobAnalysisCareerProfile,
  JobAnalysisEvaluation,
  JobAnalysisInspection,
  JobAnalysisSnapshot,
  JobAnalysisUserSkill,
  JobDescriptionOpenPayload,
  JobRequirementHighlightResult,
} from './types';
import { parseAndFormatJobDate } from '../../../lib/date-formatter';
import { extractJobRequirements } from '../../../lib/job-requirements';
import { cn } from '../../../lib/utils';
import { StructuredJobDescription } from '../StructuredJobDescription';
import { DetectionProviderBadge } from './DetectionProviderBadge';
import { EditJobModal } from './EditJobModal';

export interface JobDetailsProps {
  latestInspection: JobAnalysisInspection | null;
  latestMatch?: JobAnalysisEvaluation | null;
  isMatchLoading?: boolean;
  isInspecting: boolean;
  error?: string;
  onRetryMatch?: () => void;
  onClaimSkill?: (tech: string) => Promise<void> | void;
  onUnclaimSkill?: (tech: string) => Promise<void> | void;
  activeProfile?: JobAnalysisCareerProfile | null;
  profileSkills?: JobAnalysisUserSkill[];
  onReDetect?: () => void;
  onUpdateJobSnapshot?: (updates: Partial<JobAnalysisSnapshot>) => void;
  onHighlightJobRequirement?: (
    searchTerms: string[],
  ) => Promise<JobRequirementHighlightResult> | void;
  onOpenJobDescription?: (payload: JobDescriptionOpenPayload) => Promise<void> | void;
  initialDescriptionExpanded?: boolean;
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
  activeProfile?: JobAnalysisCareerProfile | null,
  profileSkills: JobAnalysisUserSkill[] = [],
): SkillSource {
  // 1. Explicitly claimed profile skills take top priority
  const claimedSkillSet = new Set<string>();
  for (const skill of profileSkills) {
    if (skill.skill_name) claimedSkillSet.add(skill.skill_name.toLowerCase());
    if (skill.canonical_name)
      claimedSkillSet.add(skill.canonical_name.toLowerCase());
  }
  if (isTechMatched(tech, claimedSkillSet)) return 'profile';

  // 2. Explicit skills in the user's master resume data
  const resumeSkillSet = new Set<string>();
  if (activeProfile?.resume_data?.skills) {
    for (const group of activeProfile.resume_data.skills) {
      for (const skill of group.skills || []) {
        if (skill) resumeSkillSet.add(skill.trim().toLowerCase());
      }
    }
  }
  if (isTechMatched(tech, resumeSkillSet)) return 'resume';

  // 3. AI / match evaluation against experience or projects text
  if (isTechMatched(tech, matchedSet)) return 'resume';

  return 'unclaimed';
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
  onLocate,
}: {
  label: string;
  value?: string;
  showFreshness?: boolean;
  onLocate?: () => void;
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
          <span
            className={cn(
              'transition-colors',
              onLocate &&
                'cursor-pointer hover:underline hover:text-primary',
            )}
            onClick={onLocate}
            title={
              onLocate ?
                `Locate ${label.toLowerCase()} on page`
              : undefined
            }
            role={onLocate ? 'button' : undefined}
            tabIndex={onLocate ? 0 : undefined}
            onKeyDown={
              onLocate ?
                (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onLocate();
                  }
                }
              : undefined
            }
          >
            {formatted.displayText}
          </span>
          {tier && (
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                tier === 'new' &&
                  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                tier === 'aging' &&
                  'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
                tier === 'stale' &&
                  'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
              )}
            >
              {tier === 'new' ?
                'New'
              : tier === 'aging' ?
                'Aging'
              : 'Stale'}
            </span>
          )}
        </div>
      : <span className='text-muted-foreground/70 italic text-[11px]'>
          Unknown
        </span>
      }
    </div>
  );
}

function GoogleIcon({
  className = 'w-3 h-3 shrink-0',
}: {
  className?: string;
}) {
  return (
    <svg className={className} viewBox='0 0 24 24' aria-hidden='true'>
      <path
        fill='#4285F4'
        d='M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z'
      />
      <path
        fill='#34A853'
        d='M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z'
      />
      <path
        fill='#FBBC05'
        d='M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z'
      />
      <path
        fill='#EA4335'
        d='M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z'
      />
    </svg>
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
  onLocate,
  locateTitle,
}: {
  label: string;
  value?: string;
  valueClassName?: string;
  truncate?: boolean;
  onLocate?: () => void;
  locateTitle?: string;
}) {
  if (!value) return null;

  const valueElement = (
    <span
      className={cn(
        'align-middle transition-colors',
        valueClassName,
        onLocate &&
          'cursor-pointer hover:underline hover:text-primary',
        truncate &&
          'inline-block max-w-[calc(100%-1.25rem)] truncate whitespace-nowrap',
      )}
      onClick={onLocate}
      title={
        onLocate ?
          (locateTitle || `Locate ${label.toLowerCase()} on page`)
        : undefined
      }
      role={onLocate ? 'button' : undefined}
      tabIndex={onLocate ? 0 : undefined}
      onKeyDown={
        onLocate ?
          (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onLocate();
            }
          }
        : undefined
      }
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
export function JobDetails({
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
  onOpenJobDescription,
  initialDescriptionExpanded = true,
  authConnected = true,
  onSignIn: _onSignIn,
}: JobDetailsProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(
    initialDescriptionExpanded,
  );
  const isDescriptionFullyVisible = isDescExpanded;
  const [editOpen, setEditOpen] = useState(false);
  const [claimingSkills, setClaimingSkills] = useState<Set<string>>(new Set());
  const [unclaimingSkills, setUnclaimingSkills] = useState<Set<string>>(
    new Set(),
  );
  const [activeTech, setActiveTech] = useState<string | null>(null);
  const [showBonusCategories, setShowBonusCategories] = useState(false);
  const [skillNavStats, setSkillNavStats] = useState<
    Record<string, { current: number; total: number }>
  >({});

  const saveJob = (updates: Partial<JobAnalysisSnapshot>) => {
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
    latestInspection.snapshot.platform !== 'manual' &&
    !hasResolvedCompany(latestInspection.snapshot.company);

  if (isInspecting || !latestInspection || isWaitingForCompany) {
    return (
      <div
        className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5'
        role='status'
      >
        <div className='flex items-center w-full justify-between gap-2 border-b border-primary/20 pb-2'>
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

          <div className='grid gap-1.5 pt-0.5'>
            <span className='text-muted-foreground text-[11px] font-medium'>
              Core
            </span>
            <div className='ml-1.5 pl-2 border-l-2 border-primary/20 flex flex-wrap gap-1.5'>
              <div className='h-5 w-16 rounded-md animate-skeleton-shimmer' />
              <div className='h-5 w-20 rounded-md animate-skeleton-shimmer' />
              <div className='h-5 w-14 rounded-md animate-skeleton-shimmer' />
              <div className='h-5 w-24 rounded-md animate-skeleton-shimmer' />
              <div className='h-5 w-18 rounded-md animate-skeleton-shimmer' />
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
      postingDateRaw,
      description,
      technologies,
      externalId,
    } = latestInspection.snapshot;

    const isLocatableDomDate = (rawLabel?: string): boolean => {
      if (!rawLabel || typeof rawLabel !== 'string') return false;
      const trimmed = rawLabel.trim();
      if (!trimmed) return false;
      if (/^\d{4}-\d{2}-\d{2}(?:T|\b)/i.test(trimmed)) {
        return false;
      }
      return true;
    };

    const handleOpenInPageJobDescription = async () => {
      if (!description) return;
      try {
        await onOpenJobDescription?.({
          title: title || 'Job Description',
          company: company || undefined,
          location: location || undefined,
          datePosted: firstPostedAt || lastPostedAt || undefined,
          description,
          platform: platform || undefined,
        });
      } catch (error) {
        notify.error(
          error instanceof Error ?
            error.message
          : 'Could not open job description preview.',
        );
      }
    };

    const eligibilityRequirements = extractJobRequirements(description);

    const matchedTerms = latestMatch?.matched_terms || [];
    const matchedSet = new Set(
      matchedTerms.map((t: string) => t.toLowerCase()),
    );

    const handleLocateJobSection = (sectionTitle: string) => {
      if (!onHighlightJobRequirement || !sectionTitle) return;
      const cleanTerm = sectionTitle.replace(/[:：?？!！]+$/g, '').trim();
      const searchTerms = Array.from(
        new Set([sectionTitle.trim(), cleanTerm].filter(Boolean)),
      );
      void onHighlightJobRequirement(searchTerms);
    };

    return (
      <div
        className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5'
        role='status'
      >
        <div className='flex w-full items-center justify-between gap-2 border-b border-primary/20 pb-2'>
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
              activeProfile={activeProfile}
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
            onLocate={
              title && onHighlightJobRequirement ?
                () => {
                  void onHighlightJobRequirement([title]);
                }
              : undefined
            }
            locateTitle='Locate job title on page'
          />

          <CopyableFieldRow
            label='Company'
            value={company}
            valueClassName='font-bold text-ink-primary'
            onLocate={
              company && hasResolvedCompany(company) && onHighlightJobRequirement ?
                () => {
                  void onHighlightJobRequirement([company]);
                }
              : undefined
            }
            locateTitle='Locate company on page'
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
                  const isPreferred = requirement.priority === 'preferred';
                  return onHighlightJobRequirement ?
                    (
                      <button
                        type='button'
                        key={requirement.label}
                        className={cn(
                          'group inline-flex skill-claim-pill items-center gap-1 border py-0.5 pl-1.5 pr-0.5 text-[10px] font-semibold transition-colors cursor-pointer',
                          isPreferred ?
                            'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20'
                          : 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20',
                        )}
                        onClick={() => {
                          void onHighlightJobRequirement(
                            requirement.searchTerms,
                          );
                        }}
                        title='Show this requirement in the job description'
                        aria-label={`Show ${requirement.label} in the job description`}
                      >
                        <span>{requirement.label}</span>
                        <span
                          className={cn(
                            'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full',
                            isPreferred ?
                              'bg-warning/10 text-warning group-hover:bg-warning group-hover:text-destructive-foreground'
                            : 'bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground',
                          )}
                        >
                          <ArrowRight className='h-2.5 w-2.5 stroke-[2.5]' />
                        </span>
                      </button>
                    )
                  : (
                      <span
                        key={requirement.label}
                        className={cn(
                          'inline-flex skill-claim-pill items-center border py-0.5 px-1.5 text-[10px] font-semibold',
                          isPreferred ?
                            'border-warning/30 bg-warning/10 text-warning'
                          : 'border-destructive/30 bg-destructive/10 text-destructive',
                        )}
                      >
                        {requirement.label}
                      </span>
                    );
                })}
              </div>
            </div>
          )}

          {location && (
            <CopyableFieldRow
              label='Location'
              value={location}
              truncate
              onLocate={
                onHighlightJobRequirement ?
                  () => {
                    const parts = location
                      .split(/[,/|•-]/)
                      .map((p) => p.trim())
                      .filter(Boolean);
                    void onHighlightJobRequirement(
                      Array.from(new Set([location, ...parts])),
                    );
                  }
                : undefined
              }
              locateTitle='Locate location on page'
            />
          )}

          {isReposted ?
            <>
              <PostingDateRow
                label='First posted'
                value={firstPostedAt}
              />
              <PostingDateRow
                label='Reposted'
                value={lastPostedAt}
                showFreshness
                onLocate={
                  isLocatableDomDate(postingDateRaw?.label) &&
                  onHighlightJobRequirement ?
                    () => {
                      void onHighlightJobRequirement([
                        postingDateRaw!.label!.trim(),
                      ]);
                    }
                  : undefined
                }
              />
            </>
          : <PostingDateRow
              label='Posted'
              value={lastPostedAt || firstPostedAt}
              showFreshness
              onLocate={
                isLocatableDomDate(postingDateRaw?.label) &&
                onHighlightJobRequirement ?
                  () => {
                    void onHighlightJobRequirement([
                      postingDateRaw!.label!.trim(),
                    ]);
                  }
                : undefined
              }
            />
          }

          {technologies &&
            technologies.length > 0 &&
            (() => {
              const classifiedSkills = classifySkills(technologies);

              const handleIgnoreSingleSkill = (techToIgnore: string) => {
                const updated = (technologies || []).filter(
                  (t) => t !== techToIgnore,
                );
                onUpdateJobSnapshot?.({ technologies: updated });
              };

              const handleOpenSearch = (query: string) => {
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent('What is ' + query)}`;
                const extensionTabs = (
                  globalThis as {
                    chrome?: { tabs?: { create?: (options: { url: string }) => void } };
                  }
                ).chrome?.tabs;
                if (extensionTabs?.create) {
                  extensionTabs.create({ url: searchUrl });
                } else {
                  window.open(searchUrl, '_blank', 'noopener,noreferrer');
                }
              };

              const handleLocateSkill = async (targetTech: string) => {
                const res = await onHighlightJobRequirement?.(
                  getSkillSearchTerms(targetTech),
                );
                if (res && typeof res === 'object' && res.highlighted) {
                  setSkillNavStats((prev) => ({
                    ...prev,
                    [targetTech]: {
                      current: res.currentIndex,
                      total: res.matchCount,
                    },
                  }));
                }
              };

              const renderSkillPill = (tech: string) => {
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

                let pillElement: React.ReactNode = null;

                // 1. Added in Profile Skills (Uniform green pill, click popover with [Remove from Profile])
                if (source === 'profile') {
                  pillElement = (
                    <Popover
                      open={isPopoverOpen}
                      onOpenChange={(open) => {
                        setActiveTech(open ? tech : null);
                        if (open) handleLocateSkill(tech);
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
                        sideOffset={8}
                        collisionPadding={12}
                        className='w-[270px] max-w-[calc(100vw-24px)] p-3 rounded-xl border-none bg-panel text-foreground shadow-2xl text-xs flex flex-col gap-2.5 z-[200]'
                      >
                        <PopoverArrow width={14} height={7} />
                        <div className='flex items-center justify-between pb-0.5'>
                          <div className='flex items-center gap-1.5 min-w-0 flex-1 mr-2'>

                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent('What is ' + tech)}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenSearch(tech);
                              }}
                              className='font-bold text-xs truncate max-w-full hover:underline hover:text-primary transition-colors cursor-pointer'
                              title={`Search "${tech}" on Google`}
                            >
                              {tech}
                            </a>
                            {skillNavStats[tech] && (
                              <button
                                type='button'
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void handleLocateSkill(tech);
                                }}
                                title='Click to jump to next match in JD'
                                className='shrink-0 rounded-full bg-yellow-400 text-black px-1.5 py-0.2 text-[9px] font-extrabold font-mono tracking-tight shadow-xs hover:bg-yellow-300 active:scale-95 transition-all cursor-pointer'
                              >
                                {skillNavStats[tech].current}/
                                {skillNavStats[tech].total}
                              </button>
                            )}
                            <CopyFieldButton label={tech} value={tech} />
                          </div>
                          <span className='shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400'>
                            Profile Skill
                          </span>
                        </div>
                        <p className='text-[11px] text-muted-foreground leading-relaxed'>
                          Added to your career profile skills and matched to
                          this job.
                        </p>
                        {skillNavStats[tech] &&
                          skillNavStats[tech].total > 1 && (
                            <Button
                              type='button'
                              variant='custom'
                              size='sm'
                              className='w-full h-6.5 px-2 text-[11px] gap-1.5 cursor-pointer font-semibold bg-amber-400/20 text-amber-900 dark:text-amber-200 border border-amber-400/40 hover:bg-amber-400/35 hover:text-amber-950 dark:hover:text-amber-100 hover:border-amber-400/60 transition-all rounded-lg shadow-2xs active:scale-[0.98]'
                              onClick={() => void handleLocateSkill(tech)}
                            >
                              <span>
                                Jump to next match (
                                {skillNavStats[tech].current}/
                                {skillNavStats[tech].total})
                              </span>
                              <ArrowRight className='w-3 h-3 ml-0.5' />
                            </Button>
                          )}
                        <div className='flex items-center gap-1.5 pt-1 w-full'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='flex-1 h-6.5 px-2 text-[11px] gap-1.5 cursor-pointer font-medium border-border/80 hover:border-primary/60 hover:bg-primary/15 hover:text-primary dark:hover:bg-primary/25 transition-all active:scale-95 min-w-0 shadow-2xs'
                            onClick={() => handleOpenSearch(tech)}
                            title={`Search "${tech}" on Google`}
                          >
                            <GoogleIcon className='w-3 h-3' />
                            <span className='truncate'>Google</span>
                          </Button>
                          <Button
                            type='button'
                            variant='destructive'
                            size='sm'
                            disabled={isUnclaiming}
                            className='flex-1 h-6.5 px-2 text-[11px] gap-1.5 cursor-pointer font-medium hover:bg-destructive/90 transition-all active:scale-95 min-w-0 shadow-2xs'
                            onClick={() => {
                              setActiveTech(null);
                              void handleUnclaim(tech);
                            }}
                          >
                            <Minus className='h-3 w-3' />
                            <span className='truncate'>Unclaim</span>
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                } else if (source === 'resume') {
                  // 2. Base Resume Skill (Uniform green pill, click popover showing Base Resume info)
                  pillElement = (
                    <Popover
                      open={isPopoverOpen}
                      onOpenChange={(open) => {
                        setActiveTech(open ? tech : null);
                        if (open) handleLocateSkill(tech);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type='button'
                          aria-label={`Base resume skill ${tech}`}
                          className='rounded-md px-1.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 border bg-success/15 text-success border-success/30 hover:bg-success/25 hover:border-success/50 transition-all duration-700 cursor-pointer select-none'
                        >
                          <span>{tech} ✓</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side='top'
                        align='center'
                        sideOffset={8}
                        collisionPadding={12}
                        className='w-[270px] max-w-[calc(100vw-24px)] p-3 rounded-xl border-none bg-panel text-foreground shadow-2xl text-xs flex flex-col gap-2.5 z-[200]'
                      >
                        <PopoverArrow width={14} height={7} />
                        <div className='flex items-center justify-between pb-0.5'>
                          <div className='flex items-center gap-1.5 min-w-0 flex-1 mr-2'>

                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent('What is ' + tech)}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenSearch(tech);
                              }}
                              className='font-bold text-xs truncate max-w-full hover:underline hover:text-primary transition-colors cursor-pointer'
                              title={`Search "${tech}" on Google`}
                            >
                              {tech}
                            </a>
                            {skillNavStats[tech] && (
                              <button
                                type='button'
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void handleLocateSkill(tech);
                                }}
                                title='Click to jump to next match in JD'
                                className='shrink-0 rounded-full bg-yellow-400 text-black px-1.5 py-0.2 text-[9px] font-extrabold font-mono tracking-tight shadow-xs hover:bg-yellow-300 active:scale-95 transition-all cursor-pointer'
                              >
                                {skillNavStats[tech].current}/
                                {skillNavStats[tech].total}
                              </button>
                            )}
                            <CopyFieldButton label={tech} value={tech} />
                          </div>
                          <span className='shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400'>
                            Base Resume
                          </span>
                        </div>
                        <p className='text-[11px] text-muted-foreground leading-relaxed'>
                          Matched from your uploaded base resume and work
                          experience.
                        </p>
                        {skillNavStats[tech] &&
                          skillNavStats[tech].total > 1 && (
                            <Button
                              type='button'
                              variant='custom'
                              size='sm'
                              className='w-full h-6.5 px-2 text-[11px] gap-1.5 cursor-pointer font-semibold bg-amber-400/20 text-amber-900 dark:text-amber-200 border border-amber-400/40 hover:bg-amber-400/35 hover:text-amber-950 dark:hover:text-amber-100 hover:border-amber-400/60 transition-all rounded-lg shadow-2xs active:scale-[0.98]'
                              onClick={() => void handleLocateSkill(tech)}
                            >
                              <span>
                                Jump to next match (
                                {skillNavStats[tech].current}/
                                {skillNavStats[tech].total})
                              </span>
                              <ArrowRight className='w-3 h-3 ml-0.5' />
                            </Button>
                          )}
                        <p className='text-[10px] text-muted-foreground/80 italic'>
                          To edit base resume skills, update your Master Resume
                          in Settings.
                        </p>
                        <div className='flex items-center gap-1.5 pt-1 w-full'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='flex-1 h-6.5 px-2 text-[11px] gap-1.5 cursor-pointer font-medium border-border/80 hover:border-primary/60 hover:bg-primary/15 hover:text-primary dark:hover:bg-primary/25 transition-all active:scale-95 min-w-0 shadow-2xs'
                            onClick={() => handleOpenSearch(tech)}
                            title={`Search "${tech}" on Google`}
                          >
                            <GoogleIcon className='w-3 h-3' />
                            <span className='truncate'>Google</span>
                          </Button>
            
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                } else {
                  // 3. Unclaimed Skill (Amber pill, click popover with confirmation buttons)
                  pillElement = (
                    <Popover
                      open={isPopoverOpen}
                      onOpenChange={(open) => {
                        setActiveTech(open ? tech : null);
                        if (open) handleLocateSkill(tech);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type='button'
                          disabled={isClaiming}
                          aria-label={`Claim ${tech} skill`}
                          style={{ borderRadius: '6px 12px 12px 6px' }}
                          className={cn(
                            'skill-claim-pill group relative cursor-pointer pl-1.5 pr-0.5 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 border bg-warning/15 text-warning border-warning/30 hover:bg-warning/25 hover:border-warning/50 hover:shadow-xs active:scale-95 transition-all duration-700 select-none',
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
                        sideOffset={8}
                        collisionPadding={12}
                        className='w-[270px] max-w-[calc(100vw-24px)] p-3 rounded-xl border-none bg-panel text-foreground shadow-2xl text-xs flex flex-col gap-2.5 z-[200]'
                      >
                        <PopoverArrow width={14} height={7} />
                        <div className='flex items-center justify-between pb-0.5'>
                          <div className='flex items-center gap-1.5 min-w-0 flex-1 mr-2'>

                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent('What is ' + tech)}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenSearch(tech);
                              }}
                              className='font-bold text-xs truncate max-w-full hover:underline hover:text-primary transition-colors cursor-pointer'
                              title={`Search "${tech}" on Google`}
                            >
                              {tech}
                            </a>
                            {skillNavStats[tech] && (
                              <button
                                type='button'
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void handleLocateSkill(tech);
                                }}
                                title='Click to jump to next match in JD'
                                className='shrink-0 rounded-full bg-yellow-400 text-black px-1.5 py-0.2 text-[9px] font-extrabold font-mono tracking-tight shadow-xs hover:bg-yellow-300 active:scale-95 transition-all cursor-pointer'
                              >
                                {skillNavStats[tech].current}/
                                {skillNavStats[tech].total}
                              </button>
                            )}
                            <CopyFieldButton label={tech} value={tech} />
                          </div>
                          <span className='shrink-0 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning'>
                            Unclaimed
                          </span>
                        </div>
                        <p className='text-[11px] text-muted-foreground leading-relaxed'>
                          Claim <strong>{tech}</strong> to your profile skills
                          to boost your match score for this role.
                        </p>
                        {skillNavStats[tech] &&
                          skillNavStats[tech].total > 1 && (
                            <Button
                              type='button'
                              variant='custom'
                              size='sm'
                              className='w-full h-6.5 px-2 text-[11px] gap-1.5 cursor-pointer font-semibold bg-amber-400/20 text-amber-900 dark:text-amber-200 border border-amber-400/40 hover:bg-amber-400/35 hover:text-amber-950 dark:hover:text-amber-100 hover:border-amber-400/60 transition-all rounded-lg shadow-2xs active:scale-[0.98]'
                              onClick={() => void handleLocateSkill(tech)}
                            >
                              <span>
                                Jump to next match (
                                {skillNavStats[tech].current}/
                                {skillNavStats[tech].total})
                              </span>
                              <ArrowRight className='w-3 h-3 ml-0.5' />
                            </Button>
                          )}
                        <div className='flex items-center gap-1.5 pt-1 w-full'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='flex-1 h-6.5 px-1.5 text-[11px] gap-1 cursor-pointer font-medium border-border/80 hover:border-primary/60 hover:bg-primary/15 hover:text-primary dark:hover:bg-primary/25 transition-all active:scale-95 min-w-0 shadow-2xs'
                            onClick={() => handleOpenSearch(tech)}
                            title={`Search "${tech}" on Google`}
                          >
                            <GoogleIcon className='w-3 h-3' />
                            <span className='truncate'>Google</span>
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='flex-1 h-6.5 px-1.5 text-[11px] gap-1 cursor-pointer font-medium border-border/80 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-all active:scale-95 min-w-0 shadow-2xs'
                            onClick={() => {
                              setActiveTech(null);
                              handleIgnoreSingleSkill(tech);
                            }}
                          >
                            <EyeOff className='h-3 w-3' />
                            <span className='truncate'>Ignore</span>
                          </Button>
                          <Button
                            type='button'
                            variant='default'
                            size='sm'
                            disabled={isClaiming}
                            className='flex-1 h-6.5 px-1.5 text-[11px] gap-1 cursor-pointer font-semibold hover:bg-primary/90 transition-all active:scale-95 min-w-0 shadow-2xs'
                            onClick={() => {
                              setActiveTech(null);
                              void handleClaim(tech);
                            }}
                          >
                            <Plus className='h-3 w-3' />
                            <span className='truncate'>Claim</span>
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                }

                return (
                  <motion.div
                    key={tech}
                    layout
                    layoutId={`skill-pill-${tech}`}
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 32,
                    }}
                    className='inline-flex'
                  >
                    {pillElement}
                  </motion.div>
                );
              };

              const isSkillMatched = (tech: string) => {
                const source = getSkillSource(
                  tech,
                  matchedSet,
                  activeProfile,
                  profileSkills,
                );
                return source !== 'unclaimed';
              };

              const getMatchCount = (skills: string[]) => {
                return skills.filter((s) => isSkillMatched(s)).length;
              };

              const coreSkills =
                classifiedSkills.allCoreSkills.length > 0 ?
                  classifiedSkills.allCoreSkills
                : technologies;
              const coreMatched = getMatchCount(coreSkills);

              const bonusSkills = classifiedSkills.allBonusSkills;
              const bonusMatched = getMatchCount(bonusSkills);

              return (
                <LayoutGroup id='job-technologies-layout'>
                  <div className='flex flex-col gap-3.5 pt-0.5'>
                    {/* Core Skills */}
                    <div className='flex flex-col gap-1.5'>
                      <div className='text-muted-foreground text-[11px] font-medium'>
                        Core ({coreMatched}/{coreSkills.length})
                      </div>
                      <div className='ml-1.5 pl-2 border-l-2 border-primary/20 flex flex-wrap gap-1 items-center'>
                        {coreSkills.map((tech: string) =>
                          renderSkillPill(tech),
                        )}
                      </div>
                    </div>

                    {/* Bonus Skills */}
                    {bonusSkills.length > 0 &&
                      (() => {
                        const hasMultipleGroups =
                          classifiedSkills.bonusGroups.length > 1;
                        const singleGroupName =
                          classifiedSkills.bonusGroups[0]?.displayName;
                        const headerLabel =
                          hasMultipleGroups ?
                            `Bonus (${bonusMatched}/${bonusSkills.length})`
                          : `Bonus - ${singleGroupName || 'Other'} (${bonusMatched}/${bonusSkills.length})`;

                        return (
                          <div className='flex flex-col gap-1.5'>
                            <div className='flex items-center justify-between'>
                              <span className='text-muted-foreground text-[11px] font-medium'>
                                {headerLabel}
                              </span>
                              {hasMultipleGroups && (
                                <button
                                  type='button'
                                  onClick={() =>
                                    setShowBonusCategories((prev) => !prev)
                                  }
                                  className='text-[10px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-primary/5 transition-colors cursor-pointer select-none'
                                  title={
                                    showBonusCategories ? 'Hide details' : (
                                      'Show category details'
                                    )
                                  }
                                  aria-label={
                                    showBonusCategories ?
                                      'Hide category details'
                                    : 'Show category details'
                                  }
                                >
                                  <span>Detail</span>
                                  <ChevronDown
                                    className={cn(
                                      'w-3 h-3 transition-transform duration-200 ease-in-out',
                                      showBonusCategories && 'rotate-180',
                                    )}
                                  />
                                </button>
                              )}
                            </div>

                            {/* Categorized view when expanded vs Aggregated view */}
                            {hasMultipleGroups && showBonusCategories ?
                              <div className='flex flex-col gap-2 pt-0.5 ml-1.5 pl-2 border-l-2 border-primary/20'>
                                {classifiedSkills.bonusGroups.map(
                                  (group, groupIndex) => {
                                    const groupMatched = getMatchCount(
                                      group.skills,
                                    );
                                    return (
                                      <div
                                        key={group.industry}
                                        className='flex flex-col gap-1'
                                      >
                                        <motion.div
                                          initial={{ opacity: 0, x: 20 }}
                                          whileInView={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: 20 }}
                                          transition={{
                                            duration: 0.7,
                                            delay: 0.15 * groupIndex,
                                          }}
                                          className='flex items-center justify-between'
                                        >
                                          <span
                                            className='text-[10px] font-medium text-warning/90'
                                            title={`Bonus: ${group.displayName}`}
                                          >
                                            ✦ {group.displayName} (
                                            {groupMatched}/{group.skills.length}
                                            )
                                          </span>
                                        </motion.div>
                                        <div className='flex flex-wrap gap-1 items-center'>
                                          {group.skills.map((tech: string) =>
                                            renderSkillPill(tech),
                                          )}
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            : <div className='ml-1.5 pl-2 border-l-2 border-primary/20 flex flex-wrap gap-1 items-center'>
                                {bonusSkills.map((tech: string) =>
                                  renderSkillPill(tech),
                                )}
                              </div>
                            }
                          </div>
                        );
                      })()}
                  </div>
                </LayoutGroup>
              );
            })()}

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
            <div className='mt-1 pt-2 grid gap-1.5'>
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
                  isDescriptionFullyVisible ?
                    'pr-1'
                  : 'max-h-[110px] overflow-hidden relative',
                )}
              >
                <StructuredJobDescription
                  content={description}
                  size='sm'
                  maxBlocks={isDescriptionFullyVisible ? undefined : 4}
                  onHighlightHeader={
                    onHighlightJobRequirement ?
                      handleLocateJobSection
                    : undefined
                  }
                />
                {/* {!isDescExpanded && (
                  <div className='absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-panel to-transparent pointer-events-none' />
                )} */}
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
