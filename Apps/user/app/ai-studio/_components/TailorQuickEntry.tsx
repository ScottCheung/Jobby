/** @format */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  FileText,
  Layers,
  Link as LinkIcon,
  Briefcase,
  Building,
  Loader2,
  User,
  FlaskConical,
  Eye,
  Edit3,
  Trash2,
  ClipboardPaste,
  CheckCircle2,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { Button, EmptyPlaceHolder } from '@jobby/ui';
import { StructuredJobDescription } from '@/components/StructuredJobDescription';
import { api } from '@/lib/api';
import type { CareerProfile } from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { cn } from '@/lib/utils';

// Helper to format slug to title case
function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

interface ParsedJobMeta {
  url?: string;
  platform?: string;
  company?: string;
  jobTitle?: string;
  domain?: string;
}

export function parseJobUrlOrText(input: string): ParsedJobMeta {
  const trimmed = input.trim();
  const meta: ParsedJobMeta = {};

  // Check if input starts with URL or contains a URL
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    meta.url = urlMatch[0];
    try {
      const parsedUrl = new URL(meta.url);
      const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
      meta.domain = host;

      if (host.includes('linkedin.com')) {
        meta.platform = 'LinkedIn';
      } else if (host.includes('seek.com')) {
        meta.platform = 'Seek';
      } else if (host.includes('indeed.com')) {
        meta.platform = 'Indeed';
      } else if (host.includes('glassdoor.com')) {
        meta.platform = 'Glassdoor';
      } else if (host.includes('greenhouse.io')) {
        meta.platform = 'Greenhouse';
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts[0] && parts[0] !== 'embed') meta.company = slugToTitle(parts[0]);
      } else if (host.includes('lever.co')) {
        meta.platform = 'Lever';
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts[0]) meta.company = slugToTitle(parts[0]);
      } else if (host.includes('ashbyhq.com')) {
        meta.platform = 'Ashby';
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts[0]) meta.company = slugToTitle(parts[0]);
      } else if (host.includes('workable.com')) {
        meta.platform = 'Workable';
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts[0]) meta.company = slugToTitle(parts[0]);
      } else if (host.includes('workday.com') || host.includes('myworkdayjobs.com')) {
        meta.platform = 'Workday';
        const sub = host.split('.')[0];
        if (sub && sub !== 'myworkdayjobs') meta.company = slugToTitle(sub);
      } else if (host.includes('bamboohr.com')) {
        meta.platform = 'BambooHR';
        const sub = host.split('.')[0];
        if (sub) meta.company = slugToTitle(sub);
      } else if (host.includes('smartrecruiters.com')) {
        meta.platform = 'SmartRecruiters';
      } else {
        const domainParts = host.split('.');
        if (domainParts[0]) {
          meta.company = slugToTitle(domainParts[0]);
        }
      }

      // Try extract job title from slug in path
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      for (const segment of pathSegments) {
        if (
          segment.length > 5 &&
          !/^\d+$/.test(segment) &&
          !/^(jobs|job|view|careers|apply|detail|v)$/i.test(segment)
        ) {
          const cleanedSlug = segment.replace(/-\d{4,}$/, ''); // remove trailing numeric ids
          if (cleanedSlug.length > 3) {
            meta.jobTitle = slugToTitle(cleanedSlug);
            break;
          }
        }
      }
    } catch {
      // Ignore URL parse errors
    }
    return meta;
  }

  // Parse plain text patterns (e.g. "# Frontend Engineer at Linear" or "Company: Stripe")
  const lines = trimmed.split('\n').slice(0, 10);
  for (const line of lines) {
    const l = line.trim();
    const companyMatch = l.match(/(?:Company|Employer|Organization)\s*[:：]\s*(.+)/i);
    if (companyMatch && companyMatch[1]) {
      meta.company = companyMatch[1].replace(/[*_#]/g, '').trim();
    }
    const roleMatch = l.match(/(?:Role|Title|Position|Job Title)\s*[:：]\s*(.+)/i);
    if (roleMatch && roleMatch[1]) {
      meta.jobTitle = roleMatch[1].replace(/[*_#]/g, '').trim();
    }
    const atMatch = l.match(/^#?\s*([A-Za-z0-9\s/]+)\s+(?:at|@)\s+([A-Za-z0-9\s.,-]+)$/i);
    if (atMatch && atMatch[1] && atMatch[2] && !meta.jobTitle && !meta.company) {
      meta.jobTitle = atMatch[1].trim();
      meta.company = atMatch[2].trim();
    }
  }

  return meta;
}

interface TailorQuickEntryProps {
  onGenerationStart: (params: {
    docType: 'resume' | 'cover_letter' | 'both';
    jobTitle: string;
    company: string;
    jobDescription: string;
    mock?: boolean;
    careerProfileId?: string;
  }) => void;
  isGenerating?: boolean;
  selectedProfileId?: string;
  onProfileChange?: (id: string) => void;
  className?: string;
}

export function TailorQuickEntry({
  onGenerationStart,
  isGenerating = false,
  selectedProfileId,
  onProfileChange,
  className,
}: TailorQuickEntryProps) {
  const confirm = useConfirmStore((state) => state.confirm);

  const [jobInput, setJobInput] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | undefined>();
  const [mockMode, setMockMode] = useState(false);
  const [profiles, setProfiles] = useState<CareerProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('raw');

  useEffect(() => {
    async function loadProfiles() {
      try {
        const list = await api.careerProfiles().catch(() => []);
        if (list && list.length > 0) {
          setProfiles(list);
          const def = list.find((p) => p.is_default) || list[0];
          setActiveProfileId(selectedProfileId || def.id);
        }
      } catch {
        // Fallback
      }
    }
    void loadProfiles();
  }, [selectedProfileId]);

  const handleProfileSelect = (id: string) => {
    setActiveProfileId(id);
    if (onProfileChange) onProfileChange(id);
  };

  // Smart auto extraction on input change
  const handleInputChange = (val: string) => {
    setJobInput(val);
    if (!val.trim()) {
      setDetectedPlatform(undefined);
      return;
    }
    const meta = parseJobUrlOrText(val);
    if (meta.platform) setDetectedPlatform(meta.platform);
    if (meta.company && !company) setCompany(meta.company);
    if (meta.jobTitle && !jobTitle) setJobTitle(meta.jobTitle);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleInputChange(text);
        showGlobalToast('Content pasted from clipboard');
      }
    } catch {
      showGlobalToast('Unable to read clipboard. Please paste manually.');
    }
  };

  const handleClear = () => {
    setJobInput('');
    setJobTitle('');
    setCompany('');
    setDetectedPlatform(undefined);
  };

  const handleStart = async (docType: 'resume' | 'cover_letter' | 'both') => {
    if (!jobInput.trim()) {
      showGlobalToast('Please provide a Job Description or Job Posting Link to begin.');
      return;
    }

    const targetDoc =
      docType === 'resume' ? 'Resume (CV)'
      : docType === 'cover_letter' ? 'Cover Letter (CL)'
      : 'Both Resume & Cover Letter';

    const targetTarget =
      [jobTitle.trim(), company.trim()].filter(Boolean).join(' at ') ||
      'the provided job description';

    const confirmed = await confirm({
      title: `Confirm Tailoring ${targetDoc}`,
      message: `Generate customized ${targetDoc} for "${targetTarget}"? ${
        mockMode ?
          '\n\n🧪 Debug Mock Mode is ON: This run is simulated and will consume 0 AI tokens.'
        : ''
      }`,
      confirmLabel: mockMode ? 'Mock Generate (0 Tokens)' : 'Start Tailoring',
      cancelLabel: 'Cancel',
      type: 'info',
    });

    if (!confirmed) return;

    onGenerationStart({
      docType,
      jobTitle: jobTitle.trim(),
      company: company.trim(),
      jobDescription: jobInput.trim(),
      mock: mockMode,
      careerProfileId: activeProfileId || undefined,
    });
  };

  const hasContent = jobInput.trim().length > 0;
  const wordCount = useMemo(() => {
    return jobInput.trim().split(/\s+/).filter(Boolean).length;
  }, [jobInput]);

  return (
    <div className={cn('flex flex-col w-full min-h-[calc(100vh-140px)] pb-24', className)}>
      {/* ── Top Meta Bar: Title, Profile & Controls ── */}
      <div className='flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-primary/20 bg-background/50 backdrop-blur-sm sticky top-0 z-20 py-2'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs'>
            <Sparkles className='h-5 w-5' />
          </div>
          <div>
            <h1 className='text-lg font-bold tracking-tight text-ink-primary flex items-center gap-2'>
              Tailor Studio
            </h1>
            <p className='text-xs text-ink-secondary'>
              Paste any job link or description to tailor bespoke CV and Cover Letter.
            </p>
          </div>
        </div>

        {/* Right Tools */}
        <div className='flex flex-wrap items-center gap-2.5'>
          {/* Debug Mock Toggle */}
          <label className='flex items-center gap-1.5 cursor-pointer rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 transition-all select-none'>
            <input
              type='checkbox'
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
              className='rounded border-amber-500/40 text-amber-500 focus:ring-amber-500/30 cursor-pointer h-3.5 w-3.5'
            />
            <FlaskConical className='w-3.5 h-3.5' />
            <span>Mock AI (0 Tokens)</span>
          </label>

          {/* Profile Selector */}
          {profiles.length > 0 && (
            <div className='flex items-center gap-1.5 rounded-xl border border-primary/20 bg-panel/80 px-2.5 py-1 text-xs'>
              <User className='h-3.5 w-3.5 text-primary shrink-0' />
              <select
                value={activeProfileId}
                onChange={(e) => handleProfileSelect(e.target.value)}
                className='bg-transparent text-xs font-semibold text-ink-primary focus:outline-none cursor-pointer py-0.5 max-w-[150px] truncate'
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id} className='bg-panel text-ink-primary'>
                    {p.name || 'Unnamed Profile'} {p.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Metadata In-Place Fields (Company & Title) ── */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 pb-2'>
        <div className='relative flex items-center'>
          <Building className='absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-secondary' />
          <input
            type='text'
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder='Target Company (e.g. Stripe, Google, Canva)'
            disabled={isGenerating}
            className='w-full rounded-2xl border border-primary/20 bg-panel/60 pl-10 pr-3 py-2.5 text-xs font-medium text-ink-primary placeholder:text-ink-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all'
          />
        </div>

        <div className='relative flex items-center'>
          <Briefcase className='absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-secondary' />
          <input
            type='text'
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder='Target Role Title (e.g. Senior Frontend Engineer)'
            disabled={isGenerating}
            className='w-full rounded-2xl border border-primary/20 bg-panel/60 pl-10 pr-3 py-2.5 text-xs font-medium text-ink-primary placeholder:text-ink-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all'
          />
        </div>
      </div>

      {/* ── Main Spacious Job Description Workspace ── */}
      <div className='flex-1 flex flex-col mt-3 rounded-2xl border border-primary/20 bg-panel/40 backdrop-blur-md overflow-hidden shadow-sm'>
        {/* Workspace Toolbar Header */}
        <div className='flex items-center justify-between px-4 py-2.5 border-b border-primary/15 bg-panel/80'>
          <div className='flex items-center gap-2'>
            <span className='text-xs font-bold text-ink-primary flex items-center gap-1.5'>
              <FileText className='h-4 w-4 text-primary' />
              Job Description (JD)
            </span>
            {detectedPlatform && (
              <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary'>
                <Globe className='h-2.5 w-2.5' />
                {detectedPlatform}
              </span>
            )}
            {hasContent && (
              <span className='text-[11px] text-ink-secondary font-medium pl-1'>
                · {wordCount} words ({jobInput.length} chars)
              </span>
            )}
          </div>

          <div className='flex items-center gap-2'>
            {/* View Mode Segmented Controls (Structured vs Raw) */}
            {hasContent && (
              <div className='flex items-center rounded-xl border border-primary/20 bg-background/80 p-0.5 text-xs'>
                <button
                  type='button'
                  onClick={() => setViewMode('structured')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    viewMode === 'structured'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-ink-secondary hover:text-ink-primary',
                  )}
                >
                  <Eye className='h-3 w-3' />
                  Structured View
                </button>
                <button
                  type='button'
                  onClick={() => setViewMode('raw')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    viewMode === 'raw'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-ink-secondary hover:text-ink-primary',
                  )}
                >
                  <Edit3 className='h-3 w-3' />
                  Edit / Raw
                </button>
              </div>
            )}

            {!hasContent && (
              <Button
                variant='outline'
                size='sm'
                Icon={ClipboardPaste}
                onClick={handlePasteClipboard}
                className='!h-7 !px-2.5 text-xs'
              >
                Paste Clipboard
              </Button>
            )}

            {hasContent && (
              <Button
                variant='ghost'
                size='sm'
                Icon={Trash2}
                onClick={handleClear}
                className='!h-7 !px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10'
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Content Body: Raw Textarea or Structured View */}
        <div className='flex-1 flex flex-col min-h-[360px] p-4 overflow-y-auto'>
          {viewMode === 'structured' && hasContent ? (
            <div className='p-4 bg-background/60 rounded-xl border border-primary/10 select-text leading-relaxed'>
              <StructuredJobDescription content={jobInput} />
            </div>
          ) : (
            <textarea
              value={jobInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={`Paste the complete Job Description, or paste a Job URL directly from LinkedIn, Seek, Indeed, Greenhouse, Lever, Ashby, Workable, Workday...\n\nExample:\n• Paste URL: https://boards.greenhouse.io/stripe/jobs/12345\n• Or paste raw job description with responsibilities and requirements`}
              disabled={isGenerating}
              className='w-full flex-1 min-h-[340px] bg-transparent text-xs font-normal text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none leading-relaxed resize-none'
            />
          )}
        </div>
      </div>

      {/* ── Floating Sticky Bottom Action Bar ── */}
      <footer className='fixed bottom-0 left-0 right-0 z-40 bg-panel/90 backdrop-blur-xl border-t border-primary/25 px-6 py-3 shadow-2xl transition-all'>
        <div className='max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4'>
          {/* Target Role & Status Info */}
          <div className='flex items-center gap-3 min-w-0'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary'>
              {isGenerating ? (
                <Loader2 className='h-4.5 w-4.5 animate-spin' />
              ) : (
                <Sparkles className='h-4.5 w-4.5' />
              )}
            </div>
            <div className='min-w-0'>
              <p className='text-xs font-bold text-ink-primary truncate'>
                {isGenerating ? (
                  'AI Tailoring in Progress...'
                ) : (
                  [jobTitle, company].filter(Boolean).join(' at ') ||
                  (hasContent ? 'Job details ready' : 'Paste job URL or text above')
                )}
              </p>
              <div className='flex items-center gap-2 text-[11px] text-ink-secondary mt-0.5 truncate'>
                {hasContent ? (
                  <span className='flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium'>
                    <CheckCircle2 className='h-3 w-3' /> Ready to tailor
                  </span>
                ) : (
                  <span>Awaiting job description</span>
                )}
                {mockMode && (
                  <>
                    <span>•</span>
                    <span className='text-amber-500 font-bold'>Mock Mode (0 tokens)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3 Tailor Action Buttons */}
          <div className='flex items-center gap-2.5 shrink-0'>
            <Button
              variant='outline'
              Icon={isGenerating ? Loader2 : FileText}
              iconClassName={isGenerating ? 'animate-spin' : undefined}
              disabled={isGenerating || !hasContent}
              onClick={() => void handleStart('cover_letter')}
              className='!h-9 !px-3.5 text-xs font-semibold'
            >
              {isGenerating ? 'Generating...' : (
                mockMode ? 'Mock CL' : 'Generate CL'
              )}
            </Button>

            <Button
              variant='secondary'
              Icon={isGenerating ? Loader2 : Sparkles}
              iconClassName={isGenerating ? 'animate-spin' : undefined}
              disabled={isGenerating || !hasContent}
              onClick={() => void handleStart('resume')}
              className='!h-9 !px-4 text-xs font-semibold'
            >
              {isGenerating ? 'Generating...' : (
                mockMode ? 'Mock CV' : 'Tailor Resume (CV)'
              )}
            </Button>

            <Button
              variant='default'
              Icon={isGenerating ? Loader2 : Layers}
              iconClassName={isGenerating ? 'animate-spin' : undefined}
              disabled={isGenerating || !hasContent}
              onClick={() => void handleStart('both')}
              className='!h-9 !px-4 text-xs font-bold shadow-md'
            >
              {isGenerating ? 'Generating...' : (
                mockMode ? 'Mock Both (CV + CL)' : 'Get Both (CV & CL)'
              )}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
