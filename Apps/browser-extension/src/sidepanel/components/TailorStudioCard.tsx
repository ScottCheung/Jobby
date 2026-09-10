/** @format */

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  History,
  Layers,
  Loader2,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { IPEmotion } from '@jobby/ui/components/UI/IPEmotion';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';
import {
  ResumePdfPreview,
  renderResumePdfOnce,
} from '@jobby/ui/components/UI/Resume/ResumePdfPreview';
import { CoverLetterPdfPreview } from '@jobby/ui/components/UI/Resume/CoverLetterPdfPreview';
import {
  formatResumeFilename,
  formatResumeAsPlainText as formatResumeAsPlainTextImpl,
  formatCoverLetterFilename,
  defaultMasterResumeData,
  mergeResumeData,
} from '@jobby/ui/components/UI/Resume/helpers';
import { StructuredJobDescription } from '@jobby/ui/components/UI/StructuredJobDescription';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type {
  DocType,
  LLMUsageSummary,
  TailoredResume,
} from '../../shared/contracts/tailored-resume';
import { formatRelativeTime } from '@jobby/ui/lib/date-formatter';
import {
  closeFloatingResumePreview,
  openStandaloneResumePreview,
} from '../services/resume-floating-preview';
import { sendContentCommandToActiveTab } from '../services/messaging';
import { renderCoverLetterPdfForExtension } from '../services/cover-letter-pdf-renderer';
import type { useTailoredResumeStudio } from '../hooks/useTailoredResumeStudio';
import { AiGeneratingCard } from './AiGeneratingCard';
import { cn, copyToClipboard } from '@jobby/ui/lib/utils';
import {
  DetectionProviderBadge,
  isGenericDetection,
} from '@jobby/ui/components/UI/job-analysis/DetectionProviderBadge';
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from '@jobby/ui/components/UI/tooltip';

export const formatResumeAsPlainText = formatResumeAsPlainTextImpl;

function documentTypeLabel(item: TailoredResume): string[] {
  const generated = item.raw_ai_response?.generated_documents as
    | { resume?: boolean; cover_letter?: boolean }
    | undefined;
  const hasResume =
    Boolean(generated?.resume) || Object.keys(item.resume_data || {}).length > 0;
  const hasCoverLetter = Boolean(generated?.cover_letter) || Boolean(savedCoverLetter(item));
  if (hasResume && hasCoverLetter) return ['CV', 'CL'];
  if (hasCoverLetter) return ['CL'];
  if (hasResume) return ['CV'];
  return [];
}

function savedCoverLetter(item: TailoredResume): string | null {
  if (item.cover_letter) return item.cover_letter;
  const legacyCoverLetter = item.raw_ai_response?.cover_letter;
  return typeof legacyCoverLetter === 'string' && legacyCoverLetter.trim() ?
      legacyCoverLetter
    : null;
}

function formatTokenCount(value: number): string {
  const count = Number.isFinite(value) ? Math.max(value, 0) : 0;
  const format = (amount: number, suffix: string) => `${Number(amount.toFixed(1))}${suffix}`;
  if (count < 1_000) return Math.round(count).toLocaleString();
  if (count < 1_000_000) return format(count / 1_000, 'K');
  return format(count / 1_000_000, 'M');
}

function operationLabel(operation?: string | null): string | null {
  if (!operation) return null;
  if (operation === 'resume_tailor') return 'Resume Tailor';
  if (operation === 'resume_and_cover_letter') return 'Resume + Cover Letter';
  if (operation === 'cover_letter') return 'Cover Letter';
  if (operation === 'multiple') return 'Multiple features';
  return operation.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function thinkingLabel(reasoningEffort?: string | null): string {
  if (!reasoningEffort) return 'Default';
  if (reasoningEffort === 'none') return 'Off';
  if (reasoningEffort === 'multiple') return 'Multiple';
  return reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1);
}

interface TokenBreakdownItemProps {
  label?: string;
  usage: LLMUsageSummary;
  maxTokens?: number;
}

function TokenBreakdownRow({ label, usage, maxTokens }: TokenBreakdownItemProps) {
  const cached = Math.max(0, usage.cached_input_tokens || 0);
  const uncachedInput = Math.max(0, (usage.input_tokens || 0) - cached);
  const reasoning = Math.max(0, usage.reasoning_tokens || 0);
  const answer = Math.max(
    0,
    usage.answer_tokens != null ?
      usage.answer_tokens
    : Math.max(0, (usage.output_tokens || 0) - reasoning),
  );
  const total = usage.total_tokens || (cached + uncachedInput + reasoning + answer) || 1;
  const safeTotal = Math.max(total, 1);
  const barWidth =
    maxTokens && maxTokens > 0 ?
      Math.max(15, Math.min(100, Math.round((total / maxTokens) * 100)))
    : 100;

  return (
    <div className='flex flex-col gap-1 w-full min-w-0'>
      {label && (
        <div className='flex items-center justify-between text-[9px] font-medium text-foreground'>
          <span>{label}</span>
          <span className='font-mono text-muted-foreground'>
            {(usage.duration_ms / 1000).toFixed(1)}s · {formatTokenCount(total)}
          </span>
        </div>
      )}
      <div
        className='h-1.5 rounded-full overflow-hidden flex bg-muted/40'
        style={{ width: `${barWidth}%` }}
      >
        {cached > 0 && <div className='bg-sky-400 dark:bg-sky-500 h-full' style={{ width: `${(cached / safeTotal) * 100}%` }} />}
        {uncachedInput > 0 && <div className='bg-indigo-400 dark:bg-indigo-500 h-full' style={{ width: `${(uncachedInput / safeTotal) * 100}%` }} />}
        {reasoning > 0 && <div className='bg-amber-400 dark:bg-amber-500 h-full' style={{ width: `${(reasoning / safeTotal) * 100}%` }} />}
        {answer > 0 && <div className='bg-emerald-400 dark:bg-emerald-500 h-full' style={{ width: `${(answer / safeTotal) * 100}%` }} />}
      </div>
      <div className='flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[8.5px] text-muted-foreground'>
        <span className='flex items-center gap-1'>
          <span className='w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0' />
          Input {formatTokenCount(usage.input_tokens || (cached + uncachedInput))}
        </span>
        <span className='flex items-center gap-1'>
          <span className='w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0' />
          Cached {formatTokenCount(cached)}
        </span>
        <span className='flex items-center gap-1'>
          <span className='w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0' />
          Reasoning {reasoning ? formatTokenCount(reasoning) : '—'}
        </span>
        <span className='flex items-center gap-1'>
          <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0' />
          Answer {answer ? formatTokenCount(answer) : '—'}
        </span>
        <span className='font-semibold text-foreground ml-auto'>
          Total {formatTokenCount(total)}
        </span>
      </div>
    </div>
  );
}

function calcTokenParts(u: LLMUsageSummary) {
  const cached = Math.max(0, u.cached_input_tokens || 0);
  const uncached = Math.max(0, (u.input_tokens || 0) - cached);
  const reasoning = Math.max(0, u.reasoning_tokens || 0);
  const answer = Math.max(
    0,
    u.answer_tokens != null ? u.answer_tokens : Math.max(0, (u.output_tokens || 0) - reasoning),
  );
  const total = u.total_tokens || cached + uncached + reasoning + answer || 1;
  return { cached, uncached, reasoning, answer, total };
}

function TokenBar({
  u,
  max,
  height = 'h-1',
}: {
  u: LLMUsageSummary;
  max?: number;
  height?: string;
}) {
  const { cached, uncached, reasoning, answer, total } = calcTokenParts(u);
  const safe = Math.max(total, 1);
  const w = max && max > 0 ? Math.max(15, Math.min(100, Math.round((total / max) * 100))) : 100;
  return (
    <div className={cn('rounded-full overflow-hidden flex bg-muted/40 w-full', height)} style={{ width: `${w}%` }}>
      {cached > 0 && <div className='bg-sky-400 dark:bg-sky-500 h-full' style={{ width: `${(cached / safe) * 100}%` }} />}
      {uncached > 0 && <div className='bg-indigo-400 dark:bg-indigo-500 h-full' style={{ width: `${(uncached / safe) * 100}%` }} />}
      {reasoning > 0 && <div className='bg-amber-400 dark:bg-amber-500 h-full' style={{ width: `${(reasoning / safe) * 100}%` }} />}
      {answer > 0 && <div className='bg-emerald-400 dark:bg-emerald-500 h-full' style={{ width: `${(answer / safe) * 100}%` }} />}
    </div>
  );
}

/** Portal tooltip wrapper — bypasses overflow clipping. */
function UsageTooltip({
  children,
  content,
  side = 'bottom',
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align='start'
          sideOffset={6}
          collisionPadding={8}
          className='z-[9999] rounded-lg bg-popover/95 p-2.5 shadow-xl backdrop-blur-md text-popover-foreground flex flex-col gap-2 w-[240px] border-none! outline-none pointer-events-auto max-w-none!'
        >
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

/** Two stacked mini bars for history cards. Tooltip shows full breakdown. */
function TokenMiniBar({
  usage,
  breakdown,
  className,
}: {
  usage: LLMUsageSummary;
  breakdown?: { resume?: LLMUsageSummary | null; cover_letter?: LLMUsageSummary | null } | null;
  className?: string;
}) {
  const hasBoth = Boolean(breakdown?.resume && breakdown?.cover_letter);
  const resumeUsage = breakdown?.resume;
  const clUsage = breakdown?.cover_letter;
  const maxTokens =
    hasBoth ?
      Math.max(resumeUsage?.total_tokens || 0, clUsage?.total_tokens || 0, 1)
    : undefined;

  const tooltipContent = hasBoth && resumeUsage && clUsage ? (
    <>
      <TokenBreakdownRow label='Resume' usage={resumeUsage} maxTokens={maxTokens} />
      <div className='pt-1'>
        <TokenBreakdownRow label='Cover Letter' usage={clUsage} maxTokens={maxTokens} />
      </div>
    </>
  ) : (
    <TokenBreakdownRow usage={usage} />
  );

  const bars = (
    <div className={cn('flex flex-col gap-0.5 w-full cursor-default', className)}>
      {hasBoth && resumeUsage ? (
        <>
          <TokenBar u={resumeUsage} max={maxTokens} />
          {clUsage && <TokenBar u={clUsage} max={maxTokens} />}
        </>
      ) : (
        <TokenBar u={usage} />
      )}
    </div>
  );

  return (
    <UsageTooltip content={tooltipContent} side='bottom'>
      {bars}
    </UsageTooltip>
  );
}

/** Text badge with time + tokens. Tooltip shows breakdown via portal. */
function TokenUsageBadge({
  usage,
  breakdown,
  mode = 'single',
  label,
  className,
}: {
  usage?: LLMUsageSummary | null;
  breakdown?: {
    resume?: LLMUsageSummary | null;
    cover_letter?: LLMUsageSummary | null;
  } | null;
  mode?: 'total' | 'single';
  label?: string;
  className?: string;
}) {
  if (!usage) return null;

  const hasBothBreakdown = mode === 'total' && Boolean(breakdown?.resume && breakdown?.cover_letter);
  const resumeUsage = breakdown?.resume;
  const clUsage = breakdown?.cover_letter;
  const maxTokens =
    hasBothBreakdown ?
      Math.max(resumeUsage?.total_tokens || 0, clUsage?.total_tokens || 0, 1)
    : undefined;

  const tooltipContent = hasBothBreakdown ? (
    <>
      {resumeUsage && <TokenBreakdownRow label='Resume' usage={resumeUsage} maxTokens={maxTokens} />}
      {clUsage && (
        <div className='pt-1'>
          <TokenBreakdownRow label='Cover Letter' usage={clUsage} maxTokens={maxTokens} />
        </div>
      )}
    </>
  ) : (
    <TokenBreakdownRow label={label} usage={usage} />
  );

  return (
    <UsageTooltip content={tooltipContent} side='top'>
      <span className={cn('text-[9.5px] font-mono text-muted-foreground hover:text-foreground cursor-default transition-colors select-none inline-flex items-center', className)}>
        {(usage.duration_ms / 1000).toFixed(1)}s · {formatTokenCount(usage.total_tokens)} tokens
      </span>
    </UsageTooltip>
  );
}

/** Inline always-visible bar + meta for preview card headers. */
function TokenInlineBar({
  usage,
  company,
  jobTitle,
  className,
}: {
  usage: LLMUsageSummary;
  company?: string;
  jobTitle?: string;
  className?: string;
}) {
  const { total } = calcTokenParts(usage);
  const roleLabel = [company, jobTitle].filter(Boolean).join(' - ');

  return (
    <div className={cn('flex flex-col gap-1 w-full min-w-0', className)}>
      <div className='flex min-w-0 items-center justify-between gap-2'>
        {roleLabel ? (
          <UsageTooltip content={roleLabel} side='bottom'>
            <span className='min-w-0 flex-1 truncate text-[9px] font-mono text-muted-foreground'>
              {roleLabel}
            </span>
          </UsageTooltip>
        ) : (
          <span className='min-w-0 flex-1' />
        )}
        <span className='shrink-0 whitespace-nowrap text-[9px] font-mono text-muted-foreground'>
          {(usage.duration_ms / 1000).toFixed(1)}s {formatTokenCount(total)} tokens
        </span>
      </div>
      <UsageTooltip content={<TokenBreakdownRow usage={usage} />} side='bottom'>
        <div className='w-full h-1.5 cursor-default'>
          <TokenBar u={usage} height='h-1.5' />
        </div>
      </UsageTooltip>
    </div>
  );
}

interface TailorStudioCardProps {
  studio: ReturnType<typeof useTailoredResumeStudio>;
  latestInspection: PageInspection | null;
  /** The CV & CL tab is intentionally a document manager, not a job reader. */
  managementOnly?: boolean;
  onNavigateHome?: () => void;
  onReDetect?: () => void;
  isInspecting?: boolean;
}

export function TailorStudioCard({
  studio,
  latestInspection,
  managementOnly = false,
  onNavigateHome,
  onReDetect,
  isInspecting = false,
}: TailorStudioCardProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);
  const [confirmModalType, setConfirmModalType] = useState<DocType | null>(
    null,
  );
  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<TailoredResume | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [openDocumentMenu, setOpenDocumentMenu] = useState<
    'resume' | 'cover_letter' | null
  >(null);
  const [documentAction, setDocumentAction] = useState<{
    action: 'delete' | 'regenerate';
    documentType: 'resume' | 'cover_letter';
  } | null>(null);
  const [isDocumentActionLoading, setIsDocumentActionLoading] =
    useState(false);
  const historyRailRef = useRef<HTMLDivElement>(null);
  const [renderedCoverLetterFileSize, setRenderedCoverLetterFileSize] =
    useState<number | null>(null);
  const [renderedResumeFileSize, setRenderedResumeFileSize] = useState<
    number | null
  >(null);
  const coverLetterPdfCacheRef = useRef<{
    key: string;
    promise: ReturnType<typeof renderCoverLetterPdfForExtension>;
  } | null>(null);

  const {
    jobTitle,
    company,
    datePosted,
    jobDescription,
    mockMode,
    setMockMode,
    isPreviewLoading,
    generationTasks,
    isGeneratingType,
    activeOptimisticId,
    preview,
    showPreviewModal,
    setShowPreviewModal,
    result,
    savedResumes,
    careerProfiles,
    selectedProfileId,
    switchProfile,
    makeDefaultProfile,
    originalResume,
    detectedJob,
    populateFromDetected,
    loadSavedResume,
    previewPrompt,
    generateTailoredResume,
    cancelGeneration,
    deleteSavedResume,
    deleteTailoredDocument,
    simulateDevGeneration,
    clearDevGeneration,
  } = studio;

  const isJobPage = latestInspection?.kind === 'job';
  const hasDetectedJob =
    isJobPage &&
    (Boolean(detectedJob?.title) || Boolean(detectedJob?.jobDescription));
  const resume = result?.resume_data;
  const generatedDocuments = result?.tailored_resume?.raw_ai_response
    ?.generated_documents as
    | { resume?: boolean; cover_letter?: boolean }
    | undefined;
  // A CL-only result carries base resume data solely for the letter's
  // candidate details. Do not present that data as a newly generated CV.
  const hasResumeData = Boolean(resume && Object.keys(resume).length > 0);
  const hasGeneratedResume =
    (
      generatedDocuments &&
      ('resume' in generatedDocuments || 'cover_letter' in generatedDocuments)
    ) ?
      generatedDocuments.resume === true
    : hasResumeData;
  const baseResume = originalResume || defaultMasterResumeData;
  const effectiveResume = mergeResumeData(resume, baseResume);
  const displayResume = hasGeneratedResume && hasResumeData ? effectiveResume : null;
  const competencies =
    result?.core_competencies?.length ?
      result.core_competencies
    : effectiveResume.core_competencies || [];

  // A resume-only version must never invent a default cover letter. Showing one
  // here made it look as if the user had generated a document they did not ask for.
  const effectiveCoverLetter = result?.cover_letter || null;

  const inspectionCompany =
    latestInspection?.kind === 'job' && latestInspection.snapshot.company ?
      latestInspection.snapshot.company
    : '';
  const inspectionTitle =
    latestInspection?.kind === 'job' && latestInspection.snapshot.title ?
      latestInspection.snapshot.title
    : '';

  // Active generating view: only shown if activeOptimisticId is selected/active
  const isViewingGenerating = Boolean(
    activeOptimisticId &&
    (!result || result?.tailored_resume?.id === activeOptimisticId),
  );

  const hasDocuments =
    savedResumes.length > 0 ||
    isViewingGenerating ||
    Boolean(displayResume) ||
    Boolean(effectiveCoverLetter);
  const activeOptimisticItem = savedResumes.find(
    (s) => s.id === activeOptimisticId,
  );
  const activeRecord = result?.tailored_resume || activeOptimisticItem;

  const activeCompany =
    activeRecord?.company ||
    company ||
    inspectionCompany ||
    detectedJob?.company ||
    '';
  const activeJobTitle =
    activeRecord?.job_title ||
    jobTitle ||
    inspectionTitle ||
    detectedJob?.title ||
    '';
  const rawAi = (activeRecord?.raw_ai_response || result?.raw_ai_response) as
    | Record<string, unknown>
    | undefined;
  const storedCoverLetterSize =
    typeof rawAi?.cover_letter_file_size === 'number' ?
      rawAi.cover_letter_file_size
    : (activeRecord?.cover_letter_file_size ?? null);
  const storedResumeSize =
    typeof rawAi?.resume_file_size === 'number' ?
      rawAi.resume_file_size
    : (activeRecord?.resume_file_size ?? null);

  const coverLetterFileSize =
    storedCoverLetterSize ?? renderedCoverLetterFileSize;
  const resumeFileSize = storedResumeSize ?? renderedResumeFileSize;
  const activeGeneratingTask =
    isViewingGenerating ?
      generationTasks.find(
        (t) =>
          t.optimisticId === activeOptimisticId || t.id.startsWith('dev-task-'),
      ) ||
      generationTasks[generationTasks.length - 1] ||
      null
    : null;
  const activeGeneratingDocType =
    activeGeneratingTask?.docType ||
    activeOptimisticItem?.generatingDocType ||
    'resume';

  const confirmTypeBusy = Boolean(
    confirmModalType && isGeneratingType(confirmModalType),
  );
  const resumeGenerating = isGeneratingType('resume');
  const coverLetterGenerating = isGeneratingType('cover_letter');
  const bothGenerating = isGeneratingType('both');
  const activeGeneration = generationTasks[generationTasks.length - 1];
  const hasActiveGeneration = Boolean(activeGeneration);
  const activeGenerationLabel =
    activeGeneration?.docType === 'cover_letter' ? 'cover letter'
    : activeGeneration?.docType === 'both' ? 'CV and cover letter'
    : 'CV';

  const activeProfile = careerProfiles.find((p) => p.id === selectedProfileId);
  const baseProfileName =
    activeProfile?.name ||
    [originalResume?.basics?.first_name, originalResume?.basics?.last_name]
      .filter(Boolean)
      .join(' ') ||
    'Default Resume';

  const webAppBaseUrl = (
    import.meta.env.VITE_WEB_APP_URL || 'http://localhost:3000'
  ).replace(/\/$/, '');

  const getWebEditorUrl = () => {
    let url = `${webAppBaseUrl}/ai-studio/master`;
    if (result?.tailored_resume?.id) {
      url = `${webAppBaseUrl}/ai-studio/tailor/${result.tailored_resume.id}`;
    }
    return url;
  };

  const handleOpenWebEditor = () => {
    window.open(getWebEditorUrl(), '_blank');
  };

  const handleOpenConfirm = (type: DocType) => {
    if (!jobDescription.trim()) {
      notify.error('Please provide a job description first');
      return;
    }
    setConfirmModalType(type);
  };

  const handleCopyResume = async () => {
    const targetResume = displayResume || effectiveResume;
    if (!targetResume) return;
    try {
      const text = formatResumeAsPlainText(targetResume, competencies);
      const success = await copyToClipboard(text);
      if (success) {
        setCopiedResume(true);
        notify.success('Resume copied to clipboard');
        setTimeout(() => setCopiedResume(false), 2000);
      } else {
        notify.error('Failed to copy resume to clipboard');
      }
    } catch {
      notify.error('Failed to copy resume to clipboard');
    }
  };

  const handleCopyCoverLetter = async () => {
    if (!effectiveCoverLetter) return;
    try {
      const success = await copyToClipboard(effectiveCoverLetter);
      if (success) {
        setCopiedCoverLetter(true);
        notify.success('Cover letter copied to clipboard');
        setTimeout(() => setCopiedCoverLetter(false), 2000);
      } else {
        notify.error('Failed to copy to clipboard');
      }
    } catch {
      notify.error('Failed to copy to clipboard');
    }
  };

  const requestDocumentAction = (
    action: 'delete' | 'regenerate',
    documentType: 'resume' | 'cover_letter',
  ) => {
    setOpenDocumentMenu(null);
    setDocumentAction({ action, documentType });
  };

  const handleConfirmDocumentAction = async () => {
    if (!documentAction || !activeRecord?.id) return;
    const { action, documentType } = documentAction;
    const documentLabel = documentType === 'resume' ? 'CV' : 'cover letter';
    setIsDocumentActionLoading(true);
    try {
      if (action === 'delete') {
        await deleteTailoredDocument(activeRecord.id, documentType);
        setDocumentAction(null);
      } else {
        setDocumentAction(null);
        await generateTailoredResume(documentType, {
          tailoredResumeId: activeRecord.id,
          jobTitle: activeRecord.job_title || activeJobTitle,
          company: activeRecord.company || activeCompany,
          jobDescription: activeRecord.job_description,
        });
        return;
      }
    } catch (error) {
      notify.error(
        error instanceof Error ?
          error.message
        : `Failed to ${action} ${documentLabel}`,
      );
    } finally {
      setIsDocumentActionLoading(false);
    }
  };

  const handleDownloadCoverLetter = async () => {
    if (!effectiveCoverLetter) return;
    try {
      const { blob } = await renderTailoredCoverLetterPdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const downloadName = formatCoverLetterFilename(
        effectiveResume,
        activeCompany,
        activeJobTitle,
      );
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      notify.error('Failed to download cover letter PDF');
    }
  };

  const getCoverLetterDownloadName = () =>
    formatCoverLetterFilename(
      effectiveResume,
      activeCompany,
      activeJobTitle,
    );

  const renderTailoredCoverLetterPdf = () => {
    if (!effectiveCoverLetter) throw new Error('No cover letter is available.');
    const candidateData = effectiveResume || undefined;
    const resolvedCompany = activeCompany;
    const resolvedJobTitle = activeJobTitle;
    const key = JSON.stringify([
      effectiveCoverLetter,
      candidateData,
      resolvedCompany,
      resolvedJobTitle,
    ]);
    if (coverLetterPdfCacheRef.current?.key === key) {
      return coverLetterPdfCacheRef.current.promise;
    }
    const promise = renderCoverLetterPdfForExtension(
      effectiveCoverLetter,
      candidateData,
      resolvedCompany,
      resolvedJobTitle,
    );
    coverLetterPdfCacheRef.current = { key, promise };
    void promise.then(({ blob }) => setRenderedCoverLetterFileSize(blob.size));
    void promise.catch(() => {
      if (coverLetterPdfCacheRef.current?.promise === promise) {
        coverLetterPdfCacheRef.current = null;
      }
    });
    return promise;
  };

  const handleOpenInPageCoverLetterPreview = async () => {
    if (!effectiveCoverLetter) return;

    closeFloatingResumePreview();
    const downloadName = getCoverLetterDownloadName();

    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) {
        notify.error('Could not find the active page for preview.');
        return;
      }

      const { blob, pages } = await renderTailoredCoverLetterPdf();
      const pdfDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const payload = {
        type: 'content.show-resume-preview',
        data: resume || originalResume,
        pdfDataUrl,
        company: activeCompany,
        jobTitle: activeJobTitle,
        filename: downloadName,
        pages: pages || 1,
        fileSize: blob.size,
        generatedAt: new Date().toISOString(),
        editUrl: getWebEditorUrl(),
      };

      try {
        await chrome.tabs.sendMessage(activeTab.id, payload);
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['src/content/bootstrap.ts-loader.js'],
        });
        await chrome.tabs.sendMessage(activeTab.id, payload);
      }
    } catch (error) {
      const message =
        error instanceof Error ?
          error.message
        : 'Could not open cover letter preview.';
      notify.error(message);
    }
  };

  const handleOpenFloatingCoverLetterPreview = async () => {
    if (!effectiveCoverLetter) return;

    let standalonePreview;
    try {
      standalonePreview = openStandaloneResumePreview(getWebEditorUrl());
    } catch {
      notify.error('Your browser blocked the standalone preview window.');
      return;
    }

    try {
      await closeInPageResumePreview();
    } catch {
      // Ignore
    }

    try {
      const { blob } = await renderTailoredCoverLetterPdf();
      await standalonePreview.setPdf(blob, getCoverLetterDownloadName());
    } catch (error) {
      standalonePreview.showError(
        error instanceof Error ?
          error.message
        : 'Could not generate this cover letter PDF. Please try again.',
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      await deleteSavedResume(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch {
      // Error handled in hook
    } finally {
      setIsDeleting(false);
    }
  };

  const getResumeDownloadName = () =>
    formatResumeFilename(
      resume,
      activeCompany,
      activeJobTitle,
    );

  const renderTailoredResumePdf = async () => {
    const targetResume = displayResume || effectiveResume;
    if (!targetResume) throw new Error('No tailored resume is available.');
    const rendered = await renderResumePdfOnce(
      targetResume,
      1,
      competencies,
      [],
    );
    setRenderedResumeFileSize(rendered.blob.size);
    return rendered;
  };

  const closeInPageResumePreview = async () => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab?.id === undefined) return;

    // Remove the host directly so this operation cannot depend on a content
    // script listener surviving LinkedIn's dynamic application modal updates.
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        document.getElementById('jobby-in-page-resume-modal-root')?.remove();
      },
    });

    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: 'content.close-resume-preview',
      });
    } catch {
      // The host was already removed. A missing listener only prevents
      // non-visual cleanup and must not block the next preview mode.
    }
  };

  const handleOpenInPageResumePreview = async () => {
    if (!resume) return;

    closeFloatingResumePreview();
    const downloadName = getResumeDownloadName();

    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) {
        notify.error('Could not find the active page for preview.');
        return;
      }

      const { blob, pages, scale } = await renderTailoredResumePdf();
      const pdfDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const payload = {
        type: 'content.show-resume-preview',
        data: resume,
        pdfDataUrl,
        coreCompetencies: competencies,
        company: activeCompany,
        jobTitle: activeJobTitle,
        filename: downloadName,
        pages,
        fileSize: blob.size,
        pdfScale: scale,
        generatedAt: new Date().toISOString(),
        editUrl: getWebEditorUrl(),
      };

      await sendContentCommandToActiveTab(payload);
    } catch (error) {
      const message =
        error instanceof Error ?
          error.message
        : 'Could not open resume preview.';
      notify.error(message);
    }
  };

  const scrollHistory = (direction: number) => {
    const rail = historyRailRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * 176,
      behavior: 'smooth',
    });
  };

  const handleOpenResumeLibrary = async () => {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) throw new Error('Could not find the active page.');
      // Refresh the injected module so the full-page library always uses the
      // current controls instead of a stale content-script instance. Vite
      // hashes this filename in production, so read the installed manifest
      // rather than hard-coding the development filename.
      const bootstrapScript = (
        chrome.runtime.getManifest().content_scripts || []
      )
        .flatMap((entry) => entry.js || [])
        .find((path) => /bootstrap\.ts-loader(?:-[^/]+)?\.js$/.test(path));
      if (!bootstrapScript)
        throw new Error('Could not find the resume-library page script.');
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: [bootstrapScript],
      });
      const payload = {
        type: 'content.show-resume-library',
        // Earlier saved records keep their cover letter in raw_ai_response.
        // Normalize it before passing the library so CV and CL are both shown.
        resumes: savedResumes
          .filter((item) => !item.isGenerating)
          .map((item) => ({ ...item, cover_letter: savedCoverLetter(item) })),
        selectedId: result?.tailored_resume?.id,
      };
      await chrome.tabs.sendMessage(activeTab.id, payload);
    } catch (error) {
      notify.error(
        error instanceof Error ?
          error.message
        : 'Could not open the resume library.',
      );
    }
  };

  const handleOpenInPageJobDescription = async () => {
    if (!jobDescription?.trim()) return;
    try {
      await sendContentCommandToActiveTab({
        type: 'content.show-job-description',
        title: jobTitle || detectedJob?.title || 'Job Description',
        company: company || detectedJob?.company || undefined,
        datePosted: datePosted || undefined,
        description: jobDescription,
      });
    } catch (error) {
      notify.error(
        error instanceof Error ?
          error.message
        : 'Could not open in-page preview.',
      );
    }
  };

  const handleCopyJobDescription = async () => {
    if (!jobDescription?.trim()) return;
    try {
      const success = await copyToClipboard(jobDescription);
      if (success) {
        notify.success('Job Description copied');
      } else {
        notify.error('Failed to copy job description');
      }
    } catch {
      notify.error('Failed to copy job description');
    }
  };

  useEffect(() => {
    const onLibraryPreview = (message: unknown) => {
      if (
        typeof message !== 'object' ||
        message === null ||
        (message as { type?: unknown }).type !==
          'tailor.preview-library-document'
      )
        return;

      const request = message as { id?: unknown; documentType?: unknown };
      if (
        typeof request.id !== 'string' ||
        (request.documentType !== 'resume' &&
          request.documentType !== 'cover_letter')
      )
        return;
      const saved = savedResumes.find((item) => item.id === request.id);
      if (!saved) return;

      void (async () => {
        try {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (!activeTab?.id)
            throw new Error('Could not find the active page.');

          const isCoverLetter = request.documentType === 'cover_letter';
          const coverLetter = savedCoverLetter(saved);
          if (isCoverLetter && !coverLetter)
            throw new Error('No cover letter is saved for this tailoring.');

          const competencies =
            saved.core_competencies || saved.key_qualifications || [];
          let blob: Blob;
          let pages: number;
          let pdfScale: number | undefined;
          if (isCoverLetter) {
            const rendered = await renderCoverLetterPdfForExtension(
              coverLetter!,
              saved.resume_data,
              saved.company || undefined,
              saved.job_title || undefined,
            );
            blob = rendered.blob;
            pages = rendered.pages || 1;
          } else {
            const rendered = await renderResumePdfOnce(
              saved.resume_data,
              1,
              competencies,
              [],
            );
            blob = rendered.blob;
            pages = rendered.pages;
            pdfScale = rendered.scale;
          }
          const pdfDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          await chrome.tabs.sendMessage(activeTab.id, {
            type: 'content.show-resume-preview',
            data: saved.resume_data,
            ...(isCoverLetter ? {} : { coreCompetencies: competencies }),
            company: saved.company || undefined,
            jobTitle: saved.job_title || undefined,
            filename:
              isCoverLetter ?
                formatCoverLetterFilename(
                  saved.resume_data,
                  saved.company || undefined,
                  saved.job_title || undefined,
                )
              : formatResumeFilename(
                  saved.resume_data,
                  saved.company || '',
                  saved.job_title || '',
                ),
            pdfDataUrl,
            pages,
            fileSize: blob.size,
            ...(pdfScale === undefined ? {} : { pdfScale }),
            generatedAt: saved.created_at,
            editUrl: `${webAppBaseUrl}/ai-studio/tailor/${saved.id}`,
          });
        } catch (error) {
          notify.error(
            error instanceof Error ?
              error.message
            : 'Could not open this preview.',
          );
        }
      })();
    };

    chrome.runtime.onMessage.addListener(onLibraryPreview);
    return () => chrome.runtime.onMessage.removeListener(onLibraryPreview);
  }, [savedResumes, webAppBaseUrl]);

  useEffect(() => {
    const onLibraryDelete = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: { ok: boolean }) => void,
    ): boolean | void => {
      if (
        typeof message !== 'object' ||
        message === null ||
        (message as { type?: unknown }).type !== 'tailor.delete-library-resume'
      )
        return;
      const id = (message as { id?: unknown }).id;
      if (typeof id !== 'string') {
        sendResponse({ ok: false });
        return;
      }
      void deleteSavedResume(id)
        .then(() => sendResponse({ ok: true }))
        .catch(() => {
          notify.error('Could not delete this tailored resume.');
          sendResponse({ ok: false });
        });
      return true;
    };
    chrome.runtime.onMessage.addListener(onLibraryDelete);
    return () => chrome.runtime.onMessage.removeListener(onLibraryDelete);
  }, [deleteSavedResume]);

  const handleOpenFloatingResumePreview = async () => {
    if (!resume) return;

    let standalonePreview;
    try {
      // Open first, while this button click is still an active user gesture.
      standalonePreview = openStandaloneResumePreview(getWebEditorUrl());
    } catch {
      notify.error('Your browser blocked the standalone preview window.');
      return;
    }

    try {
      await closeInPageResumePreview();
    } catch {
      // A LinkedIn page that cannot be scripted must not block the preview.
    }

    try {
      const { blob } = await renderTailoredResumePdf();
      await standalonePreview.setPdf(blob, getResumeDownloadName());
    } catch (error) {
      standalonePreview.showError(
        error instanceof Error ?
          error.message
        : 'Could not generate this resume PDF. Please try again.',
      );
    }
  };

  const handleDownloadResume = async () => {
    const targetResume = displayResume || effectiveResume;
    if (!targetResume) return;
    try {
      const { blob } = await renderTailoredResumePdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getResumeDownloadName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      const message =
        error instanceof Error ?
          error.message
        : 'Could not download resume PDF.';
      notify.error(message);
    }
  };

  return (
    <div className='w-full min-w-0 max-w-full overflow-x-hidden flex flex-col gap-3 pb-6'>
      {/* Job context and generation controls belong to Home. Keep this available
          only for the standalone editor flow. */}
      {!managementOnly && (
        <>
          <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5 !p-3.5 w-full min-w-0 max-w-full box-border'>
            {/* Header */}
            <div className='flex items-center justify-between gap-2 border-b border-primary/20 pb-2 w-full min-w-0'>
              <div className='flex items-center gap-1.5 min-w-0 flex-1'>
                <strong className='text-xs font-bold text-foreground truncate'>
                  {hasDetectedJob ?
                    'Job Identified'
                  : 'Target Job Requirements'}
                </strong>
              </div>

              <div className='flex items-center gap-1.5 shrink-0'>
                {hasDetectedJob && (
                  <button
                    type='button'
                    onClick={populateFromDetected}
                    className='inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer'
                    title='Re-detect job details'
                    aria-label='Re-detect job details'
                  >
                    <RefreshCw className='w-3.5 h-3.5' />
                  </button>
                )}
                <DetectionProviderBadge
                  platform={detectedJob?.platform}
                  url={detectedJob?.url}
                  activeProfile={activeProfile}
                />
              </div>
            </div>

            {hasDetectedJob && isGenericDetection(detectedJob?.platform) && (
              <div
                className='rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[10px] leading-relaxed text-warning'
                role='alert'
              >
                Results may be inaccurate—please verify the extracted
                information.
              </div>
            )}

            {/* Job Details Key-Value List */}
            <div className='grid gap-1.5 text-xs text-foreground/90 w-full min-w-0'>
              <div className='grid grid-cols-[75px_minmax(0,1fr)] gap-1 items-baseline'>
                <span className='text-muted-foreground text-[10px] font-medium'>
                  Job Title:
                </span>
                <div className='min-w-0 flex-1 flex flex-col gap-0.5'>
                  <span className='font-semibold text-foreground break-words'>
                    {activeJobTitle || 'Not specified'}
                  </span>
                  {!isViewingGenerating && activeRecord?.usage && (
                    <TokenUsageBadge
                      usage={activeRecord.usage}
                      breakdown={activeRecord.usage_breakdown}
                      mode='total'
                      className='mt-0.5'
                    />
                  )}
                </div>
              </div>

              <div className='grid grid-cols-[75px_minmax(0,1fr)] gap-1 items-baseline'>
                <span className='text-muted-foreground text-[10px] font-medium'>
                  Company:
                </span>
                <span className='font-semibold text-foreground break-words'>
                  {activeCompany || 'Not specified'}
                </span>
              </div>
            </div>

            {/* Collapsible Job Description Section */}
            <div className='border-t border-primary/20 pt-2 flex flex-col gap-1.5 w-full min-w-0'>
              <div className='flex items-center justify-between w-full min-w-0'>
                <span className='text-muted-foreground text-[10px] font-semibold uppercase tracking-wider'>
                  Job Description
                </span>
                <div className='flex items-center gap-1.5'>
                  {jobDescription ?
                    <>
                      <button
                        type='button'
                        className='inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer'
                        onClick={() => void handleOpenInPageJobDescription()}
                        title='Open in full page modal'
                        aria-label='Open in full page modal'
                      >
                        <Maximize2 className='h-3 w-3' />
                      </button>
                      <button
                        type='button'
                        className='inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer'
                        onClick={() => void handleCopyJobDescription()}
                        title='Copy Job Description'
                        aria-label='Copy Job Description'
                      >
                        <Copy className='h-3 w-3' />
                      </button>
                      <span className='text-[8px] text-muted-foreground/60 ml-0.5'>
                        {`${jobDescription.length.toLocaleString()} chars`}
                      </span>
                    </>
                  : <span className='text-[8px] text-muted-foreground/60'>
                      Empty
                    </span>
                  }
                </div>
              </div>

              {jobDescription && (
                <div
                  className={cn(
                    'transition-all duration-200',
                    isDescExpanded ?
                      'max-h-[380px] overflow-y-auto pr-1'
                    : 'max-h-[90px] overflow-hidden relative',
                  )}
                >
                  <StructuredJobDescription
                    content={jobDescription}
                    size='sm'
                    maxBlocks={isDescExpanded ? undefined : 3}
                  />
                  {/* {!isDescExpanded && (
                    <div className='absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-panel to-transparent pointer-events-none' />
                  )} */}
                </div>
              )}
            </div>
            {jobDescription && (
              <button
                type='button'
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className='text-[10px] justify-center font-medium text-primary hover:underline flex items-center gap-0.5 bg-transparent border-0 cursor-pointer pt-1'
              >
                <span>{isDescExpanded ? 'Collapse' : 'Show More'}</span>
                {isDescExpanded ?
                  <ChevronUp className='w-3 h-3' />
                : <ChevronDown className='w-3 h-3' />}
              </button>
            )}
          </div>

          {/* ── 2. BASE RESUME CARD & TAILOR ACTION BUTTONS ── */}
          <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-3 !p-3.5 w-full min-w-0 max-w-full box-border'>
            {/* Base Profile Status Line */}
            <div className='flex items-center justify-between gap-2 border-b border-primary/20 pb-2 w-full min-w-0'>
              <div className='flex items-center gap-2 min-w-0 flex-1'>
                <div className='min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden'>
                  <span className='text-[10px] font-medium text-muted-foreground shrink-0'>
                    Base Resume:
                  </span>
                  {careerProfiles.length > 1 ?
                    <select
                      value={selectedProfileId}
                      onChange={(e) => switchProfile(e.target.value)}
                      className='text-xs font-semibold text-foreground bg-transparent border-0 focus:outline-none cursor-pointer truncate max-w-[140px]'
                      title='Switch career profile'
                    >
                      {careerProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.is_default ? '★ (Default)' : ''}
                        </option>
                      ))}
                    </select>
                  : <span className='text-xs font-semibold text-foreground truncate'>
                      {baseProfileName}{' '}
                      {activeProfile?.is_default ? '★ (Default)' : ''}
                    </span>
                  }
                </div>
              </div>

              {activeProfile && !activeProfile.is_default && (
                <button
                  type='button'
                  onClick={() => void makeDefaultProfile(activeProfile.id)}
                  className='text-[10.5px] font-semibold text-primary hover:underline flex items-center gap-1 shrink-0 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md border border-primary/30 transition-all cursor-pointer'
                  title='Set this profile as default base resume'
                >
                  <Star className='w-3 h-3 text-primary fill-primary/30' />
                  <span>Set as Default</span>
                </button>
              )}
            </div>

            {/* Primary Action Buttons */}
            <div className='flex flex-col gap-2 w-full min-w-0'>
              {hasActiveGeneration && (
                <div
                  role='status'
                  aria-live='polite'
                  className='flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary'
                >
                  <Loader2 className='mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin' />
                  <div className='min-w-0'>
                    <p className='text-[10px] font-bold'>
                      Your {activeGenerationLabel} generation has started
                    </p>
                    <p className='mt-0.5 text-[9px] leading-relaxed text-muted-foreground'>
                      You can continue browsing. This action is disabled until
                      the current generation finishes.
                    </p>
                  </div>
                </div>
              )}

              <div className='grid grid-cols-3 gap-2 w-full min-w-0'>
                <Button
                  variant='default'
                  // size='md'
                  Icon={resumeGenerating ? Loader2 : Sparkles}
                  iconClassName={resumeGenerating ? 'animate-spin' : undefined}
                  onClick={() => handleOpenConfirm('resume')}
                  disabled={hasActiveGeneration || !jobDescription.trim()}
                >
                  {resumeGenerating ?
                    'Generating CV...'
                  : mockMode ?
                    'Mock Tailor Resume'
                  : 'Tailor Resume'}
                </Button>
                <Button
                  variant='outline'
                  // size='sm'
                  Icon={coverLetterGenerating ? Loader2 : FileText}
                  iconClassName={
                    coverLetterGenerating ? 'animate-spin' : undefined
                  }
                  onClick={() => handleOpenConfirm('cover_letter')}
                  disabled={hasActiveGeneration || !jobDescription.trim()}
                >
                  {coverLetterGenerating ?
                    'Generating CL...'
                  : mockMode ?
                    'Mock Letter'
                  : 'Generate CL'}
                </Button>

                <Button
                  variant='outline'
                  // size='sm'
                  Icon={bothGenerating ? Loader2 : Layers}
                  iconClassName={bothGenerating ? 'animate-spin' : undefined}
                  onClick={() => handleOpenConfirm('both')}
                  disabled={hasActiveGeneration || !jobDescription.trim()}
                >
                  {bothGenerating ?
                    'Generating Both...'
                  : mockMode ?
                    'Mock Both'
                  : 'Get Both'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Empty State Placeholder (When no tailored documents exist) ── */}
      {!hasDocuments && (
        <div className='w-full rounded-2xl bg-primary/10 p-2.5 flex flex-col gap-2.5 border-0 shadow-none'>
          {/* Re-detect action */}
          {onReDetect && (
            <button
              type='button'
              onClick={onReDetect}
              disabled={isInspecting}
              className={cn(
                'w-full py-2 px-3 rounded-xl flex items-center justify-center gap-1.5',
                'text-[11px] font-medium text-muted-foreground hover:text-primary',
                'bg-background-50/50 hover:bg-background-50 transition-colors',
                'border-0 shadow-none cursor-pointer disabled:opacity-50',
              )}
            >
              <RefreshCw
                className={cn('w-3 h-3', isInspecting && 'animate-spin')}
              />
              <span>
                {isInspecting ? 'Re-scanning page...' : 'Re-scan Current Page'}
              </span>
            </button>
          )}

          {/* Banner / Mascot Header */}
          <div className='rounded-xl bg-background-50/90 backdrop-blur-sm px-4 pt-3 pb-4 flex flex-col items-center text-center border-0 shadow-none'>
            <div className='relative w-24 h-24 -mt-1 mb-1 flex items-center justify-center'>
              <IPEmotion emotionId={0} className='w-24 h-24' />
            </div>

            <h3 className='text-xs font-bold text-primary uppercase tracking-wider'>
              No Tailored Documents
            </h3>

            <p className='text-[11px] text-muted-foreground leading-relaxed mt-1 max-w-[260px]'>
              No tailored resumes or cover letters yet. Start tailoring on the{' '}
              <strong className='text-primary font-bold'>Home</strong> tab when
              viewing a job posting.
            </p>

            <div className='flex items-center justify-center gap-2 mt-3'>
              {onNavigateHome && (
                <Button
                  variant='default'
                  size='sm'
                  Icon={Sparkles}
                  onClick={onNavigateHome}
                >
                  Go to Home
                </Button>
              )}
              <Button
                variant='outline'
                size='sm'
                Icon={ExternalLink}
                onClick={handleOpenWebEditor}
              >
                Master Resume
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. SAVED RESUMES HISTORY CAROUSEL (Horizontal Scrollable Cards) ── */}
      {savedResumes.length > 0 && (
        <div className='w-full min-w-0 max-w-full flex flex-col gap-1.5 overflow-hidden'>
          <div className='flex items-center justify-between px-1 w-full min-w-0'>
            <span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1'>
              <History className='w-3 h-3 text-primary' />
              Recent Tailor ({savedResumes.length})
            </span>
            <div className='flex items-center gap-1'>
              <button
                type='button'
                onClick={() => scrollHistory(-1)}
                className='rounded-md border border-primary/30 p-1 text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary'
                aria-label='Show previous tailored resumes'
              >
                <ChevronLeft className='h-3 w-3' />
              </button>
              <button
                type='button'
                onClick={() => scrollHistory(1)}
                className='rounded-md border border-primary/30 p-1 text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary'
                aria-label='Show more tailored resumes'
              >
                <ChevronRight className='h-3 w-3' />
              </button>
              <button
                type='button'
                onClick={() => void handleOpenResumeLibrary()}
                className='ml-1 rounded-md bg-primary px-2 py-1 text-[9px] font-bold text-primary-foreground transition hover:opacity-90'
              >
                More
              </button>
            </div>
          </div>

          <div className='relative overflow-visible'>
            <div
              ref={historyRailRef}
              className='w-full min-w-0 max-w-full flex items-stretch gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth box-border'
            >
              {savedResumes.map((item) => {
                const isOptimistic = Boolean(item.isGenerating);
                const isSelected =
                  (isOptimistic && activeOptimisticId === item.id) ||
                  (!isOptimistic && result?.tailored_resume?.id === item.id);
                const timeAgo =
                  isOptimistic ? 'Generating' : (
                    formatRelativeTime(item.created_at)
                  );

                if (isOptimistic) {
                  return (
                    <button
                      key={item.id}
                      type='button'
                      onClick={() => loadSavedResume(item)}
                      className={`group/history border page-class-banner--job relative shrink-0 w-[150px] min-h-[86px] p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer flex flex-col gap-1  ${
                        isSelected ?
                          'border-primary  text-primary shadow-xs '
                        : 'page-class-banner--job border-primary/0 hover:-translate-y-0.5 hover:bg-muted/40 hover:border-primary text-foreground'
                      }`}
                    >
                      {' '}
                      <div className='flex items-center justify-between gap-1 w-full min-w-0  transition-all'>
                        <span
                          className={cn(
                            'text-[8px] font-bold leading-tight line-clamp-1 flex-1 min-w-0',
                            // isSelected ?
                            //   'text-primary-foreground'
                            // : 'text-primary',
                          )}
                        >
                          {item.job_title || 'Tailored Resume'}
                        </span>
                      </div>
                      <div className='flex items-center justify-between gap-1 w-full min-w-0'>
                        <p
                          className={cn(
                            'text-[12px] text-ink-primary font-semibold leading-tight line-clamp-1 break-words flex-1 min-w-0',
                            // isSelected ?
                            //   'text-primary-foreground'
                            // : 'text-ink-primary',
                          )}
                        >
                          {item.company || 'Job Application'}{' '}
                        </p>
                      </div>
                      <div className='flex mt-3 items-start justify-between gap-1 w-full min-w-0'>
                        <span className='inline-flex animate-text-shimmer animate-text-shimmer-primary items-center gap-1 text-[8px] font-bold text-primary uppercase tracking-tight truncate'>
                          <Sparkles className='w-2.5 h-2.5 text-primary shrink-0' />
                          <span className='truncate '>AI is Working...</span>
                        </span>
                      </div>
                    </button>
                  );
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => loadSavedResume(item)}
                    className={`group/history border page-class-banner--job relative shrink-0 w-[150px] min-h-[86px] p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer flex flex-col gap-1  ${
                      isSelected ?
                        'border-primary  text-primary shadow-xs '
                      : 'page-class-banner--job border-primary/0 hover:-translate-y-0.5 hover:bg-muted/40 hover:border-primary text-foreground'
                    }`}
                  >
                    {/* Delete button on hover, usage summary when selected */}

                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteCandidate(item);
                        }}
                        className='absolute top-1.5 right-1.5 z-10 opacity-0 group-hover/history:opacity-100 p-1 rounded-md text-muted-foreground group-hover/history:text-red-500 group-hover/history:bg-red-500/10 backdrop-blur-xl transition-all duration-150 cursor-pointer'
                        title='Delete tailored record'
                        aria-label={`Delete record for ${item.job_title || item.company || 'Tailored application'}`}
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>

                    <div className='flex items-center justify-between gap-1 w-full min-w-0 transition-all'>
                      <span
                        className={cn(
                          'text-[8px] font-bold leading-tight line-clamp-1 flex-1 min-w-0 pr-10',
                        )}
                      >
                        {item.job_title || 'Tailored Resume'}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-1 w-full min-w-0'>
                      <p
                        className={cn(
                          'text-[12px] text-ink-primary font-semibold leading-tight line-clamp-1 break-words flex-1 min-w-0',
                          // isSelected ?
                          //   'text-primary-foreground'
                          // : 'text-ink-primary',
                        )}
                      >
                        {item.company || 'Job Application'}{' '}
                      </p>
                    </div>
                    <div className='flex  items-end justify-between gap-1 w-full min-w-0'>

                    <div className='flex items-end gap-1 mt-2 w-full'>
                      {documentTypeLabel(item).map((type, typeIdx) => (
                        <Fragment key={`${type}-${typeIdx}`}>
                          <span className='text-[7px] bg-primary-gradient rounded px-2 py-0.5 font-bold uppercase tracking-wide text-primary-foreground'>
                            {type}
                          </span>
                          {/* {typeIdx !== arr.length - 1 && (
                            <span className='text-[8px] font-bold uppercase tracking-wide text-muted-foreground'>
                              +
                            </span>
                          )} */}
                        </Fragment>
                      ))}
                    </div>
                     {item.usage ? (
                      <span className='flex text-[7.5px] font-mono text-primary/70 leading-none select-none pointer-events-none'>
                        {(item.usage.duration_ms / 1000).toFixed(1)}s·{formatTokenCount(item.usage.total_tokens)}
                      </span>
                    ) : null}
                    </div>
                    {/* Token mini bar replaces the divider */}
                    {item.usage && (
                      <TokenMiniBar
                        usage={item.usage}
                        breakdown={item.usage_breakdown}
                        className='mt-auto pt-1'
                      />
                    )}
                    <div className='flex w-full items-center justify-between pt-0.5'>
                      <span className='text-[8px] text-muted-foreground'>
                        {timeAgo}
                      </span>
                      {isSelected && (
                        <span className='rounded-full bg-primary/15 px-1 py-0.5 text-[6.5px] font-bold uppercase tracking-wide text-primary shrink-0 ml-1'>
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE AI GENERATION VIEW (Consistent showcase card layout with document skeleton) ── */}
      {isViewingGenerating && (
        <AiGeneratingCard
          jobTitle={
            activeGeneratingTask?.jobTitle ||
            activeOptimisticItem?.job_title ||
            jobTitle ||
            detectedJob?.title
          }
          company={
            activeGeneratingTask?.company ||
            activeOptimisticItem?.company ||
            company ||
            detectedJob?.company
          }
          docType={activeGeneratingDocType}
          startedAt={
            activeGeneratingTask?.startedAt ||
            (activeOptimisticItem?.created_at ?
              Date.parse(activeOptimisticItem.created_at)
            : undefined)
          }
          onCancel={() => {
            const taskId =
              activeGeneratingTask?.id ||
              (activeOptimisticId ? `dev-task-${activeGeneratingDocType}` : '');
            if (taskId) void cancelGeneration(taskId);
          }}
        />
      )}

      {/* ── 4. RESUME PREVIEW SHOWCASE (Tailored or Default Base Resume) ── */}
      {!isViewingGenerating && displayResume && (
        <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-3  !p-3 w-full min-w-0 max-w-full box-border !rouned-xl'>
          {/* Header row: title + actions */}
          <div className='flex items-center justify-between gap-3 w-full min-w-0'>
            <div className='flex items-center gap-1.5 min-w-0 flex-1'>
              <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
              <strong
                className='text-xs font-bold text-foreground truncate'
                title={[
                  'Resume',
                  activeCompany && activeJobTitle ?
                    `${activeCompany} - ${activeJobTitle}`
                  : (activeCompany || activeJobTitle),
                ]
                  .filter(Boolean)
                  .join(' | ')}
              >
                Resume

              </strong>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <Button
                size='sm'
                className='!rounded-lg'
                variant='default'
                Icon={Download}
                onClick={() => void handleDownloadResume()}
                title='Download the resume PDF'
              >
                Download
              </Button>
              <div className='relative'>
                <button
                  type='button'
                  onClick={() =>
                    setOpenDocumentMenu((current) =>
                      current === 'resume' ? null : 'resume',
                    )
                  }
                  className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary'
                  aria-label='Resume actions'
                  aria-haspopup='menu'
                  aria-expanded={openDocumentMenu === 'resume'}
                >
                  <MoreHorizontal className='h-4 w-4' />
                </button>
                {openDocumentMenu === 'resume' && (
                  <>
                    <button
                      type='button'
                      aria-label='Close resume actions'
                      className='fixed inset-0 z-20 cursor-default'
                      onClick={() => setOpenDocumentMenu(null)}
                    />
                    <div
                      role='menu'
                      className='absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-border/70 bg-panel p-1.5 shadow-xl'
                    >
                      <button
                        type='button'
                        role='menuitem'
                        onClick={() => {
                          setOpenDocumentMenu(null);
                          void handleCopyResume();
                        }}
                        className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary'
                      >
                        <Copy className='h-3.5 w-3.5 shrink-0' />
                        {copiedResume ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type='button'
                        role='menuitem'
                        disabled={hasActiveGeneration}
                        onClick={() => requestDocumentAction('regenerate', 'resume')}
                        className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <RefreshCw className='h-3.5 w-3.5 shrink-0' />
                        Regenerate CV
                      </button>
                      <button
                        type='button'
                        role='menuitem'
                        disabled={hasActiveGeneration}
                        onClick={() => requestDocumentAction('delete', 'resume')}
                        className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <Trash2 className='h-3.5 w-3.5 shrink-0' />
                        Delete CV
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Inline token bar below header */}
          {!isViewingGenerating &&
            (activeRecord?.usage_breakdown?.resume || activeRecord?.usage) && (
              <TokenInlineBar
                usage={activeRecord!.usage_breakdown?.resume ?? activeRecord!.usage!}
                company={activeCompany}
                jobTitle={activeJobTitle}
              />
            )}

          {/* Preview card with hover actions: page modal, floating window, web edit, or download */}
          <div className='flex flex-col gap-2 w-full min-w-0'>
            <ResumePdfPreview
              data={displayResume}
              coreCompetencies={competencies}
              company={activeCompany}
              jobTitle={activeJobTitle}
              fileSize={resumeFileSize}
              onPreview={() => void handleOpenInPageResumePreview()}
              onNewWindow={() => void handleOpenFloatingResumePreview()}
              onEdit={handleOpenWebEditor}
              onDownload={() => void handleDownloadResume()}
            />
          </div>
        </div>
      )}

      {/* ── 5. COVER LETTER SHOWCASE (Tailored or Default Template) ── */}
      {!isViewingGenerating && effectiveCoverLetter && (
        <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-3  !p-3 w-full min-w-0 max-w-full box-border !rouned-xl'>
          <div className='flex items-center justify-between gap-3 w-full min-w-0'>
            <div className='flex items-center gap-1.5 min-w-0 flex-1'>
              <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
              <strong
                className='text-xs font-bold text-foreground truncate'
                title={
                  'Cover Letter'}
              >
                Cover Letter
                
              </strong>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <Button
                size='sm'
                variant='default'
                className='!rounded-lg'
                Icon={Download}
                onClick={() => void handleDownloadCoverLetter()}
                title='Download cover letter PDF'
              >
                Download
              </Button>
              <div className='relative'>
                <button
                  type='button'
                  onClick={() =>
                    setOpenDocumentMenu((current) =>
                      current === 'cover_letter' ? null : 'cover_letter',
                    )
                  }
                  className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary'
                  aria-label='Cover letter actions'
                  aria-haspopup='menu'
                  aria-expanded={openDocumentMenu === 'cover_letter'}
                >
                  <MoreHorizontal className='h-4 w-4' />
                </button>
                {openDocumentMenu === 'cover_letter' && (
                  <>
                    <button
                      type='button'
                      aria-label='Close cover letter actions'
                      className='fixed inset-0 z-20 cursor-default'
                      onClick={() => setOpenDocumentMenu(null)}
                    />
                    <div
                      role='menu'
                      className='absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-border/70 bg-panel p-1.5 shadow-xl'
                    >
                      <button
                        type='button'
                        role='menuitem'
                        onClick={() => {
                          setOpenDocumentMenu(null);
                          void handleCopyCoverLetter();
                        }}
                        className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary'
                      >
                        <Copy className='h-3.5 w-3.5 shrink-0' />
                        {copiedCoverLetter ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type='button'
                        role='menuitem'
                        disabled={hasActiveGeneration}
                        onClick={() =>
                          requestDocumentAction('regenerate', 'cover_letter')
                        }
                        className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <RefreshCw className='h-3.5 w-3.5 shrink-0' />
                        Regenerate CL
                      </button>
                      <button
                        type='button'
                        role='menuitem'
                        disabled={hasActiveGeneration}
                        onClick={() =>
                          requestDocumentAction('delete', 'cover_letter')
                        }
                        className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <Trash2 className='h-3.5 w-3.5 shrink-0' />
                        Delete CL
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {!isViewingGenerating &&
            (activeRecord?.usage_breakdown?.cover_letter || activeRecord?.usage) && (
              <TokenInlineBar
                usage={activeRecord!.usage_breakdown?.cover_letter ?? activeRecord!.usage!}
                company={activeCompany}
                jobTitle={activeJobTitle}
              />
            )}

          <div className='flex flex-col gap-2 w-full min-w-0'>
            <CoverLetterPdfPreview
              coverLetter={effectiveCoverLetter}
              candidateData={effectiveResume || undefined}
              company={activeCompany}
              jobTitle={activeJobTitle}
              fileSize={coverLetterFileSize}
              onPreview={() => void handleOpenInPageCoverLetterPreview()}
              onNewWindow={() => void handleOpenFloatingCoverLetterPreview()}
              onEdit={handleOpenWebEditor}
              onDownload={() => void handleDownloadCoverLetter()}
            />
          </div>
        </div>
      )}

      {/* ── Advanced Dev Settings (Subtle Link at Bottom) ── */}
      <div className='flex flex-col gap-2 px-1 pt-1 w-full min-w-0 border-t border-border/40 mt-1'>
        <div className='flex items-center justify-between w-full min-w-0'>
          <button
            type='button'
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className='inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-medium bg-transparent border-0 cursor-pointer p-0 transition'
          >
            <SlidersHorizontal className='w-3 h-3' />
            <span>{showAdvancedSettings ? 'Hide Options' : 'Dev Options'}</span>
          </button>

          {showAdvancedSettings && (
            <div className='flex items-center gap-2'>
              <label
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition select-none ${
                  mockMode ?
                    'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold'
                  : 'bg-muted/40 text-muted-foreground'
                }`}
                title='Zero-token Mock Mode'
              >
                <input
                  type='checkbox'
                  checked={mockMode}
                  onChange={(e) => setMockMode(e.target.checked)}
                  className='sr-only'
                />
                <Zap className='w-2.5 h-2.5' />
                <span>Mock AI</span>
              </label>

              <Button
                size='sm'
                variant='ghost'
                Icon={Eye}
                onClick={() => previewPrompt('resume')}
                isLoading={isPreviewLoading}
                disabled={isPreviewLoading || !jobDescription.trim()}
                className='!h-5 !px-1.5 text-[10px]'
              >
                Preview Prompt
              </Button>
            </div>
          )}
        </div>

        {showAdvancedSettings && (
          <div className='flex flex-col gap-1.5 p-2 rounded-xl bg-muted/40 border border-primary/20 text-[10px]'>
            <div className='flex items-center justify-between'>
              <span className='font-semibold text-muted-foreground text-[10px]'>
                Simulate Waiting State (UI Debug):
              </span>
              {generationTasks.some((t) => t.id.startsWith('dev-task-')) && (
                <button
                  type='button'
                  onClick={clearDevGeneration}
                  className='text-[9px] text-destructive hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0'
                >
                  Clear Simulation
                </button>
              )}
            </div>
            <div className='grid grid-cols-3 gap-1.5'>
              <button
                type='button'
                onClick={() => simulateDevGeneration('resume')}
                className={`py-1 px-1.5 rounded-lg font-medium text-[9.5px] transition cursor-pointer text-center border truncate ${
                  (
                    generationTasks.some(
                      (t) =>
                        t.docType === 'resume' && t.id.startsWith('dev-task-'),
                    )
                  ) ?
                    'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                  : 'bg-card hover:bg-muted text-foreground border-border'
                }`}
                title='Toggle simulated resume generating state'
              >
                Generating CV
              </button>
              <button
                type='button'
                onClick={() => simulateDevGeneration('cover_letter')}
                className={`py-1 px-1.5 rounded-lg font-medium text-[9.5px] transition cursor-pointer text-center border truncate ${
                  (
                    generationTasks.some(
                      (t) =>
                        t.docType === 'cover_letter' &&
                        t.id.startsWith('dev-task-'),
                    )
                  ) ?
                    'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                  : 'bg-card hover:bg-muted text-foreground border-border'
                }`}
                title='Toggle simulated cover letter generating state'
              >
                Generating CL
              </button>
              <button
                type='button'
                onClick={() => simulateDevGeneration('both')}
                className={`py-1 px-1.5 rounded-lg font-medium text-[9.5px] transition cursor-pointer text-center border truncate ${
                  (
                    generationTasks.some(
                      (t) =>
                        t.docType === 'both' && t.id.startsWith('dev-task-'),
                    )
                  ) ?
                    'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                  : 'bg-card hover:bg-muted text-foreground border-border'
                }`}
                title='Toggle simulated both resume and cover letter generating state'
              >
                Generating Both
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Document Action Confirmation Modal ── */}
      {documentAction && (
        <div
          className='modal-backdrop'
          onClick={() => !isDocumentActionLoading && setDocumentAction(null)}
        >
          <div
            className='!w-full !max-w-[390px] flex flex-col bg-panel !border-0 rounded-2xl shadow-2xl overflow-hidden'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start justify-between px-5 pt-5 pb-2'>
              <h3 className='text-sm font-bold text-foreground'>
                {documentAction.action === 'delete' ? 'Delete' : 'Regenerate'}{' '}
                {documentAction.documentType === 'resume' ? 'CV' : 'Cover Letter'}
              </h3>
              <button
                type='button'
                className='close-btn !border-0 text-muted-foreground hover:text-foreground'
                disabled={isDocumentActionLoading}
                onClick={() => setDocumentAction(null)}
                aria-label='Close'
              >
                &times;
              </button>
            </div>
            <div className='px-5 py-3'>
              <p className='text-xs leading-relaxed text-muted-foreground'>
                {documentAction.action === 'delete' ?
                  `Are you sure you want to delete only this ${documentAction.documentType === 'resume' ? 'CV' : 'cover letter'}? The other document will be kept and this action cannot be undone.`
                : `Are you sure you want to regenerate this ${documentAction.documentType === 'resume' ? 'CV' : 'cover letter'}? The current version will be replaced.`}
              </p>
            </div>
            <div className='flex items-center justify-end gap-2.5 px-5 pb-5 pt-2'>
              <Button
                variant='ghost'
                size='sm'
                disabled={isDocumentActionLoading}
                onClick={() => setDocumentAction(null)}
                className='!rounded-xl font-semibold text-xs'
              >
                Cancel
              </Button>
              <Button
                variant='default'
                size='sm'
                Icon={documentAction.action === 'delete' ? Trash2 : RefreshCw}
                isLoading={isDocumentActionLoading}
                disabled={isDocumentActionLoading}
                onClick={() => void handleConfirmDocumentAction()}
                className={cn(
                  '!rounded-xl !text-white !border-0 font-semibold text-xs shadow-md',
                  documentAction.action === 'delete' ?
                    '!bg-rose-600 hover:!bg-rose-700'
                  : '!bg-primary hover:!bg-primary/90',
                )}
              >
                {documentAction.action === 'delete' ? 'Delete' : 'Regenerate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permanent Deletion Confirmation Modal ── */}
      {deleteCandidate && (
        <div
          className='modal-backdrop'
          onClick={() => !isDeleting && setDeleteCandidate(null)}
        >
          <div
            className='!w-full !max-w-[390px] flex flex-col bg-panel !border-0 !border-none rounded-2xl shadow-2xl overflow-hidden'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Completely borderless */}
            <div className='flex items-start justify-between px-5 pt-5 pb-2 !border-0 !bg-transparent'>
              <div className='flex flex-col gap-1'>
                <h3 className='text-sm font-bold text-foreground'>
                  Delete Tailored Record
                </h3>
              </div>
              <button
                type='button'
                className='close-btn !border-0 text-muted-foreground hover:text-foreground'
                disabled={isDeleting}
                onClick={() => setDeleteCandidate(null)}
                aria-label='Close'
              >
                &times;
              </button>
            </div>

            {/* Body - Soft tinted background blocks, no border */}
            <div className='flex flex-col gap-2.5 px-5 py-2'>
              {/* Soft Neutral Details Block */}
              <div className='flex flex-col gap-2 p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 !border-0 text-xs'>
                <div className='grid grid-cols-[75px_minmax(0,1fr)] gap-1 items-baseline'>
                  <span className='text-muted-foreground text-[11px] font-medium'>
                    Target Role:
                  </span>
                  <span className='font-semibold text-foreground break-words'>
                    {deleteCandidate.job_title || 'Tailored Resume'}
                  </span>
                </div>
                <div className='grid grid-cols-[75px_minmax(0,1fr)] gap-1 items-baseline'>
                  <span className='text-muted-foreground text-[11px] font-medium'>
                    Company:
                  </span>
                  <span className='font-semibold text-foreground break-words'>
                    {deleteCandidate.company || 'Job Application'}
                  </span>
                </div>
                {deleteCandidate.created_at && (
                  <div className='grid grid-cols-[75px_minmax(0,1fr)] gap-1 items-baseline'>
                    <span className='text-muted-foreground text-[11px] font-medium'>
                      Created:
                    </span>
                    <span className='text-[11px] text-muted-foreground'>
                      {new Date(deleteCandidate.created_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              {/* Soft Red/Rose Warning Block */}
              <div className='flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 !border-0'>
                <div className='flex flex-col gap-1 min-w-0 text-left'>
                  <span className='text-xs font-bold text-rose-600 dark:text-rose-400'>
                    Permanent & Non-recoverable
                  </span>
                  <p className='text-[11px] text-muted-foreground leading-relaxed'>
                    Due to storage pressure, this record will be permanently
                    deleted and cannot be recovered.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer - Completely borderless */}
            <div className='flex items-center justify-end gap-2.5 px-5 pb-5 pt-2 !border-0 !bg-transparent'>
              <Button
                variant='ghost'
                size='sm'
                disabled={isDeleting}
                onClick={() => setDeleteCandidate(null)}
                className='!rounded-xl !border-0 font-semibold text-xs'
              >
                Cancel
              </Button>
              <Button
                variant='default'
                size='sm'
                Icon={Trash2}
                isLoading={isDeleting}
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className='!rounded-xl !bg-rose-600 hover:!bg-rose-700 !text-white !border-0 font-semibold text-xs shadow-md'
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coin Consumption Confirmation Modal ── */}
      {confirmModalType && (
        <div
          className='modal-backdrop'
          onClick={() => setConfirmModalType(null)}
        >
          <div
            className='modal-card max-w-[420px]'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='modal-header'>
              <div>
                <span className='modal-badge bg-primary text-primary-foreground'>
                  Coin Confirmation
                </span>
                <h3 className='text-sm font-bold text-foreground'>
                  {confirmModalType === 'resume' ?
                    'Tailor Resume for this Job'
                  : confirmModalType === 'cover_letter' ?
                    'Generate Cover Letter'
                  : 'Tailor Resume & Cover Letter'}
                </h3>
              </div>
              <button
                type='button'
                className='close-btn'
                onClick={() => setConfirmModalType(null)}
              >
                &times;
              </button>
            </div>

            <div className='modal-body gap-3'>
              {/* Coin Cost Box */}
              <div className='flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30'>
                <div className='flex items-center gap-2.5 min-w-0'>
                  <div className='flex flex-col min-w-0'>
                    <span className='text-[8px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wide'>
                      Coin Consumption
                    </span>
                    <span className='text-xs font-semibold text-foreground truncate'>
                      {mockMode ?
                        '0 Coins (Mock AI Mode)'
                      : confirmModalType === 'both' ?
                        'Bundle Discount'
                      : ''}
                    </span>
                  </div>
                </div>
                <span className='text-base font-extrabold text-amber-600 dark:text-amber-400 shrink-0'>
                  {mockMode ?
                    '0'
                  : confirmModalType === 'both' ?
                    '18'
                  : '10'}{' '}
                  <span className='text-xs font-medium text-muted-foreground'>
                    Coins
                  </span>
                </span>
              </div>

              {/* Target Job Details Summary */}
              <div className='review-details-grid gap-1.5'>
                <div className='grid grid-cols-[70px_minmax(0,1fr)] gap-1 items-baseline'>
                  <span className='text-muted-foreground text-[10px] font-medium'>
                    Target Job:
                  </span>
                  <span className='font-semibold text-foreground break-words'>
                    {jobTitle || detectedJob?.title || 'Not specified'}
                  </span>
                </div>
                <div className='grid grid-cols-[70px_minmax(0,1fr)] gap-1 items-baseline'>
                  <span className='text-muted-foreground text-[10px] font-medium'>
                    Company:
                  </span>
                  <span className='font-semibold text-foreground break-words'>
                    {company || detectedJob?.company || 'Not specified'}
                  </span>
                </div>
                <div className='grid grid-cols-[70px_minmax(0,1fr)] gap-1 items-baseline'>
                  <span className='text-muted-foreground text-[10px] font-medium'>
                    Base Profile:
                  </span>
                  <span className='font-semibold text-foreground text-[10px] truncate'>
                    {baseProfileName}
                  </span>
                </div>
                <div className='grid grid-cols-[70px_minmax(0,1fr)] gap-1 items-baseline border-t border-primary/40 pt-1.5 mt-0.5'>
                  <span className='text-muted-foreground text-[10px] font-medium'>
                    Summary:
                  </span>
                  <span className='font-semibold text-[10px] text-primary break-words'>
                    {confirmModalType === 'resume' ?
                      'Tailored Resume (Summary, Competencies, Skills, Experience)'
                    : confirmModalType === 'cover_letter' ?
                      'Targeted Cover Letter'
                    : 'Tailored Resume + Targeted Cover Letter'}
                  </span>
                </div>
              </div>

              <p className='text-[10px] text-muted-foreground leading-relaxed'>
                {mockMode ?
                  'Zero-token test mode is currently active. No actual coins or AI tokens will be used.'
                : 'Tailoring content with AI consumes coins from your account balance. Confirm below to proceed.'
                }
              </p>
            </div>

            <div className='modal-footer'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setConfirmModalType(null)}
              >
                Cancel
              </Button>
              <Button
                size='sm'
                Icon={Sparkles}
                isLoading={confirmTypeBusy}
                disabled={confirmTypeBusy}
                onClick={() => {
                  const type = confirmModalType;
                  setConfirmModalType(null);
                  void generateTailoredResume(type);
                }}
              >
                Confirm & Tailor (
                {mockMode ?
                  '0'
                : confirmModalType === 'both' ?
                  '18'
                : '10'}
                )
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Prompt Preview Modal ── */}
      {showPreviewModal && preview && (
        <div
          className='modal-backdrop'
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className='modal-card max-w-[480px]'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='modal-header'>
              <div>
                <span className='modal-badge'>Payload Inspector</span>
                <h3 className='text-sm font-bold text-foreground'>
                  AI Tailor Prompt Preview
                </h3>
              </div>
              <button
                type='button'
                className='close-btn'
                onClick={() => setShowPreviewModal(false)}
              >
                &times;
              </button>
            </div>
            <div className='modal-body max-h-[360px] overflow-y-auto'>
              {preview.messages.map((msg, i) => (
                <div key={i} className='mb-3'>
                  <span className='text-[10px] font-bold uppercase text-primary'>
                    {msg.role}
                  </span>
                  <pre className='text-[10px] p-2 bg-muted/40 rounded-lg overflow-x-auto whitespace-pre-wrap text-foreground font-mono mt-1'>
                    {msg.content}
                  </pre>
                </div>
              ))}
            </div>
            <div className='modal-footer flex items-center justify-end gap-2 p-3 border-t border-primary/20'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setShowPreviewModal(false)}
              >
                Close
              </Button>
              <Button
                size='sm'
                Icon={Sparkles}
                onClick={() => generateTailoredResume('resume')}
                disabled={isGeneratingType('resume')}
                className='text-white dark:text-foreground'
              >
                Confirm & Tailor
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
