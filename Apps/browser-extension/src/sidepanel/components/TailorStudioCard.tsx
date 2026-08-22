/** @format */

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileText,
  History,
  Layers,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';
import {
  ResumePdfPreview,
  renderResumePdfOnce,
  formatResumeFilename,
  formatResumeAsPlainText as formatResumeAsPlainTextImpl,
  CoverLetterPdfPreview,
  formatCoverLetterFilename,
  defaultMasterResumeData,
} from '@jobby/ui/components/UI/Resume';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type {
  DocType,
  TailoredResume,
} from '../../shared/contracts/tailored-resume';
import { formatRelativeTime } from '../../shared/utils/date-formatter';
import {
  closeFloatingResumePreview,
  openStandaloneResumePreview,
} from '../services/resume-floating-preview';
import { renderCoverLetterPdfInWorker } from '../services/cover-letter-pdf-renderer';
import type { useTailoredResumeStudio } from '../hooks/useTailoredResumeStudio';
import { AiGeneratingCard } from './AiGeneratingCard';
import { AuthGuardBanner } from './AuthGuardBanner';
import { cn } from '@jobby/ui/lib/utils';

export const formatResumeAsPlainText = formatResumeAsPlainTextImpl;

function documentTypeLabel(item: TailoredResume): string[] {
  const generated = item.raw_ai_response?.generated_documents as
    | { resume?: boolean; cover_letter?: boolean }
    | undefined;
  if (generated?.resume && generated?.cover_letter) return ['CV', 'CL'];
  if (generated?.cover_letter) return ['CL'];
  return ['CV'];
}

function savedCoverLetter(item: TailoredResume): string | null {
  if (item.cover_letter) return item.cover_letter;
  const legacyCoverLetter = item.raw_ai_response?.cover_letter;
  return typeof legacyCoverLetter === 'string' && legacyCoverLetter.trim() ?
      legacyCoverLetter
    : null;
}

interface TailorStudioCardProps {
  studio: ReturnType<typeof useTailoredResumeStudio>;
  latestInspection: PageInspection | null;
  authConnected?: boolean;
  onSignIn?: () => void;
  /** The CV & CL tab is intentionally a document manager, not a job reader. */
  managementOnly?: boolean;
}

export function TailorStudioCard({
  studio,
  latestInspection,
  authConnected = true,
  onSignIn,
  managementOnly = false,
}: TailorStudioCardProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
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
  const historyRailRef = useRef<HTMLDivElement>(null);
  const [coverLetterFileSize, setCoverLetterFileSize] = useState<number | null>(
    null,
  );
  const coverLetterPdfCacheRef = useRef<{
    key: string;
    promise: ReturnType<typeof renderCoverLetterPdfInWorker>;
  } | null>(null);

  const {
    jobTitle,
    company,
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
  const hasGeneratedResume =
    (
      generatedDocuments &&
      ('resume' in generatedDocuments || 'cover_letter' in generatedDocuments)
    ) ?
      generatedDocuments.resume === true
    : Boolean(resume);
  const effectiveResume = resume || originalResume || defaultMasterResumeData;
  const displayResume = hasGeneratedResume ? effectiveResume : null;
  const competencies = result?.core_competencies || [];

  // A resume-only version must never invent a default cover letter. Showing one
  // here made it look as if the user had generated a document they did not ask for.
  const effectiveCoverLetter = result?.cover_letter || null;

  // Active generating view: only shown if activeOptimisticId is selected/active
  const isViewingGenerating = Boolean(
    activeOptimisticId &&
    (!result || result?.tailored_resume?.id === activeOptimisticId),
  );
  const activeOptimisticItem = savedResumes.find(
    (s) => s.id === activeOptimisticId,
  );
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
    let url = `${webAppBaseUrl}/settings/resume`;
    if (result?.tailored_resume?.id) {
      url = `${webAppBaseUrl}/job-review?id=${result.tailored_resume.id}`;
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
    if (!resume) return;
    try {
      const text = formatResumeAsPlainText(resume, competencies);
      await navigator.clipboard.writeText(text);
      setCopiedResume(true);
      notify.success('Resume copied to clipboard');
      setTimeout(() => setCopiedResume(false), 2000);
    } catch {
      notify.error('Failed to copy resume to clipboard');
    }
  };

  const handleCopyCoverLetter = async () => {
    if (!effectiveCoverLetter) return;
    try {
      await navigator.clipboard.writeText(effectiveCoverLetter);
      setCopiedCoverLetter(true);
      notify.success('Cover letter copied to clipboard');
      setTimeout(() => setCopiedCoverLetter(false), 2000);
    } catch {
      notify.error('Failed to copy to clipboard');
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
        company || detectedJob?.company,
        jobTitle || detectedJob?.title,
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
      company || detectedJob?.company,
      jobTitle || detectedJob?.title,
    );

  const renderTailoredCoverLetterPdf = () => {
    if (!effectiveCoverLetter) throw new Error('No cover letter is available.');
    const candidateData = effectiveResume || undefined;
    const resolvedCompany = company || detectedJob?.company;
    const resolvedJobTitle = jobTitle || detectedJob?.title;
    const key = JSON.stringify([
      effectiveCoverLetter,
      candidateData,
      resolvedCompany,
      resolvedJobTitle,
    ]);
    if (coverLetterPdfCacheRef.current?.key === key) {
      return coverLetterPdfCacheRef.current.promise;
    }
    const promise = renderCoverLetterPdfInWorker(
      effectiveCoverLetter,
      candidateData,
      resolvedCompany,
      resolvedJobTitle,
    );
    coverLetterPdfCacheRef.current = { key, promise };
    void promise.catch(() => {
      if (coverLetterPdfCacheRef.current?.promise === promise) {
        coverLetterPdfCacheRef.current = null;
      }
    });
    return promise;
  };

  useEffect(() => {
    if (!effectiveCoverLetter) {
      setCoverLetterFileSize(null);
      coverLetterPdfCacheRef.current = null;
      return;
    }
    let cancelled = false;
    setCoverLetterFileSize(null);
    void renderTailoredCoverLetterPdf()
      .then(({ blob }) => {
        if (!cancelled) setCoverLetterFileSize(blob.size);
      })
      .catch(() => {
        if (!cancelled) setCoverLetterFileSize(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    effectiveCoverLetter,
    effectiveResume,
    company,
    detectedJob?.company,
    jobTitle,
    detectedJob?.title,
  ]);

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
        company: company || detectedJob?.company,
        jobTitle: jobTitle || detectedJob?.title,
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
      company || detectedJob?.company,
      jobTitle || detectedJob?.title,
    );

  const renderTailoredResumePdf = () => {
    if (!resume) throw new Error('No tailored resume is available.');
    return renderResumePdfOnce(resume, 1, competencies, []);
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
        company: company || detectedJob?.company,
        jobTitle: jobTitle || detectedJob?.title,
        filename: downloadName,
        pages,
        fileSize: blob.size,
        pdfScale: scale,
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
            const rendered = await renderCoverLetterPdfInWorker(
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
            editUrl: `${webAppBaseUrl}/job-review?id=${saved.id}`,
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
    if (!resume) return;
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
      {!authConnected && onSignIn && (
        <AuthGuardBanner
          onSignIn={onSignIn}
          title='Sign In to Tailor Resume & Cover Letter'
          description='Sign in with your Jobby account to automatically generate customized resumes matched to this job.'
        />
      )}

      {/* Job context and generation controls belong to Home. Keep this available
          only for the standalone editor flow. */}
      {!managementOnly && (
        <>
          <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5 !p-3.5 w-full min-w-0 max-w-full box-border'>
            {/* Header */}
            <div className='flex items-center justify-between gap-2 border-b border-primary/20 pb-2 w-full min-w-0'>
              <div className='flex items-center gap-1.5 min-w-0 flex-1'>
                <span className='page-class-banner__icon text-primary font-bold shrink-0'>
                  ✓
                </span>
                <strong className='text-xs font-bold text-foreground truncate'>
                  {hasDetectedJob ?
                    'Job Page Identified'
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
                <span className='rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary capitalize'>
                  {detectedJob?.platform || 'Manual'}
                </span>
              </div>
            </div>

            {/* Job Details Key-Value List */}
            <div className='grid gap-1.5 text-xs text-foreground/90 w-full min-w-0'>
              <div className='grid grid-cols-[75px_minmax(0,1fr)] gap-1 items-baseline'>
                <span className='text-muted-foreground text-[10px] font-medium'>
                  Job Title:
                </span>
                <span className='font-semibold text-foreground break-words'>
                  {jobTitle || detectedJob?.title || 'Not specified'}
                </span>
              </div>

              <div className='grid grid-cols-[75px_minmax(0,1fr)] gap-1 items-baseline'>
                <span className='text-muted-foreground text-[10px] font-medium'>
                  Company:
                </span>
                <span className='font-semibold text-foreground break-words'>
                  {company || detectedJob?.company || 'Not specified'}
                </span>
              </div>
            </div>

            {/* Collapsible Job Description Section */}
            <div className='border-t border-primary/20 pt-2 flex flex-col gap-1.5 w-full min-w-0'>
              <div className='flex items-center justify-between w-full min-w-0'>
                <span className='text-muted-foreground text-[10px] font-semibold uppercase tracking-wider'>
                  Job Description
                </span>
                <span className='text-[8px] ml-1'>
                  {jobDescription ?
                    `${jobDescription.length.toLocaleString()} characters`
                  : 'Empty'}
                </span>
              </div>

              {/* Quick Preview Text */}
              {!isDescExpanded && jobDescription && (
                <p className='text-[10px] text-transparent bg-gradient-to-b from-ink-secondary from-60% to-transparent bg-clip-text text-muted-foreground leading-relaxed line-clamp-3 pt-0.5'>
                  {jobDescription}
                </p>
              )}

              {/* Full Text Preview */}
              {isDescExpanded && jobDescription && (
                <div className='max-h-[380px] overflow-y-auto text-[10px] text-muted-foreground leading-relaxed pt-0.5 whitespace-pre-wrap pr-1.5 custom-scrollbar-primary'>
                  {jobDescription}
                </div>
              )}
            </div>
            <button
              type='button'
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className={`text-[10px] justify-center font-medium text-primary hover:underline flex items-center gap-0.5 bg-transparent border-0 cursor-pointer ${
                isDescExpanded ? 'mt-2 pt-1' : '-mt-13 pt-10'
              }`}
            >
              <span>{isDescExpanded ? 'Collapse' : 'Show More'}</span>
              {isDescExpanded ?
                <ChevronUp className='w-3 h-3' />
              : <ChevronDown className='w-3 h-3' />}
            </button>
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
              {/* Row 1: Tailor Resume for this Job (Full row) */}
              <Button
                variant='default'
                // size='md'
                Icon={Sparkles}
                isLoading={isGeneratingType('resume')}
                onClick={() => handleOpenConfirm('resume')}
                disabled={isGeneratingType('resume') || !jobDescription.trim()}
              >
                {mockMode ? 'Mock Tailor Resume' : 'Tailor Resume'}
              </Button>

              {/* Row 2: Cover Letter & Both (Half row each, 2 columns) */}
              <div className='grid grid-cols-2 gap-2 w-full min-w-0'>
                <Button
                  variant='outline'
                  // size='sm'
                  Icon={FileText}
                  isLoading={isGeneratingType('cover_letter')}
                  onClick={() => handleOpenConfirm('cover_letter')}
                  disabled={
                    isGeneratingType('cover_letter') || !jobDescription.trim()
                  }
                >
                  {mockMode ? 'Mock Letter' : 'Generate CL'}
                </Button>

                <Button
                  variant='outline'
                  // size='sm'
                  Icon={Layers}
                  isLoading={isGeneratingType('both')}
                  onClick={() => handleOpenConfirm('both')}
                  disabled={isGeneratingType('both') || !jobDescription.trim()}
                >
                  {mockMode ? 'Mock Both' : 'Get Both'}
                </Button>
              </div>
            </div>
          </div>
        </>
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

          <div className='relative'>
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
                    {/* Floating absolute delete button on top-right */}
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCandidate(item);
                      }}
                      className='absolute top-1.5 right-1.5 z-10 opacity-0 group-hover/history:opacity-100  p-1 rounded-md text-muted-foreground group-hover/history:text-red-500 group-hover/history:bg-red-500/10 backdrop-blur-xl transition-all duration-150 cursor-pointer'
                      title='Delete tailored record'
                      aria-label={`Delete record for ${item.job_title || item.company || 'Tailored application'}`}
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
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
                    <div className='flex items-center gap-1 mt-2 w-full'>
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
                    <div className='mt-auto flex w-full items-center justify-between border-t border-primary/15 pt-1'>
                      {timeAgo && (
                        <span className='text-[8px] text-muted-foreground'>
                          {timeAgo}
                        </span>
                      )}
                      {isSelected && (
                        <span className='rounded-full bg-primary/15 px-1 py-0.5 text-[6.5px] font-bold uppercase tracking-wide text-primary'>
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
        <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5 !p-3.5 w-full min-w-0 max-w-full box-border'>
          {/* Header */}
          <div className='flex items-center justify-between gap-2 border-b border-primary/40 pb-2.5 w-full min-w-0'>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-1.5'>
                <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
                <strong className='text-xs font-bold text-foreground truncate'>
                  Resume
                </strong>
              </div>
            </div>

            <div className='flex items-center gap-1.5 shrink-0'>
              <Button
                size='sm'
                variant='outline'
                Icon={copiedResume ? Check : Copy}
                onClick={() => void handleCopyResume()}
                title='Copy formatted resume text'
              >
                {copiedResume ? 'Copied' : 'Copy'}
              </Button>

              <Button
                size='sm'
                variant='default'
                Icon={Download}
                onClick={() => void handleDownloadResume()}
                title='Download the resume PDF'
              >
                Download
              </Button>
            </div>
          </div>

          {/* Preview card with hover actions: page modal, floating window, web edit, or download */}
          <div className='flex flex-col gap-2 pt-1 w-full min-w-0'>
            <ResumePdfPreview
              data={displayResume}
              coreCompetencies={competencies}
              company={company || detectedJob?.company}
              jobTitle={jobTitle || detectedJob?.title}
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
        <div className='page-class-banner page-class-banner--job flex-col !items-stretch gap-2.5 !p-3.5 w-full min-w-0 max-w-full box-border'>
          <div className='flex items-center justify-between gap-2 border-b border-primary/40 pb-2.5 w-full min-w-0'>
            <div className='min-w-0 flex-1 flex items-center gap-1.5'>
              <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
              <strong
                className='text-xs font-bold text-foreground truncate'
                title={
                  jobTitle || detectedJob?.title ?
                    `Cover Letter (${jobTitle || detectedJob?.title})`
                  : 'Cover Letter'
                }
              >
                Cover Letter
                {jobTitle || detectedJob?.title ?
                  ` (${jobTitle || detectedJob?.title})`
                : ''}
              </strong>
            </div>

            <div className='flex items-center gap-1.5 shrink-0'>
              <Button
                size='sm'
                variant='outline'
                Icon={copiedCoverLetter ? Check : Copy}
                onClick={handleCopyCoverLetter}
                title='Copy cover letter text'
              >
                {copiedCoverLetter ? 'Copied' : 'Copy'}
              </Button>

              <Button
                size='sm'
                variant='default'
                Icon={Download}
                onClick={() => void handleDownloadCoverLetter()}
                title='Download cover letter PDF'
              >
                Download
              </Button>
            </div>
          </div>

          <div className='flex flex-col gap-2 pt-1 w-full min-w-0'>
            <CoverLetterPdfPreview
              coverLetter={effectiveCoverLetter}
              candidateData={effectiveResume || undefined}
              company={company || detectedJob?.company}
              jobTitle={jobTitle || detectedJob?.title}
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
                onClick={async () => {
                  const type = confirmModalType;
                  setConfirmModalType(null);
                  await generateTailoredResume(type);
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
