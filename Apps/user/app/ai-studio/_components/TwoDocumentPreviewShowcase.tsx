/** @format */

'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  FileText,
  Copy,
  Check,
  Download,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { Button } from '@jobby/ui';
import {
  ResumeHtmlDocument,
  CoverLetterHtmlDocument,
  formatResumeAsPlainText,
  formatResumeFilename,
  formatCoverLetterFilename,
  renderResumePdfOnce,
  renderCoverLetterPdfOnce,
  defaultResumeTemplate,
} from '@jobby/ui/components/UI/Resume';
import type { MasterResumeData } from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useConfirmStore } from '@/lib/store/confirm-store';

interface TwoDocumentPreviewShowcaseProps {
  resumeData: MasterResumeData;
  coreCompetencies?: string[];
  coverLetter?: string | null;
  company?: string;
  jobTitle?: string;
  selectedDoc?: 'resume' | 'cover_letter';
  onSelectDoc?: (doc: 'resume' | 'cover_letter') => void;
  isResumeGenerating?: boolean;
  isCoverLetterGenerating?: boolean;
  startedAt?: number;
  onCancelGeneration?: () => void;
  onGenerateCoverLetter?: () => void;
}

export function TwoDocumentPreviewShowcase({
  resumeData,
  coreCompetencies = [],
  coverLetter,
  company = '',
  jobTitle = '',
  selectedDoc = 'resume',
  onSelectDoc,
  isResumeGenerating = false,
  isCoverLetterGenerating = false,
  startedAt,
  onCancelGeneration,
  onGenerateCoverLetter,
}: TwoDocumentPreviewShowcaseProps) {
  const confirm = useConfirmStore((state) => state.confirm);

  const [activePreviewDoc, setActivePreviewDoc] = useState<
    'resume' | 'cover_letter' | null
  >(null);
  const [copiedDoc, setCopiedDoc] = useState<'resume' | 'cover_letter' | null>(
    null,
  );
  const [downloadingDoc, setDownloadingDoc] = useState<
    'resume' | 'cover_letter' | null
  >(null);

  const isResumeSelected = selectedDoc === 'resume';
  const isClSelected = selectedDoc === 'cover_letter';
  const hasCoverLetter = Boolean(coverLetter && coverLetter.trim());

  const handleCopyResume = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const text = formatResumeAsPlainText(resumeData, coreCompetencies);
      await navigator.clipboard.writeText(text);
      setCopiedDoc('resume');
      showGlobalToast('Resume text copied to clipboard');
      setTimeout(() => setCopiedDoc(null), 2000);
    } catch {
      showGlobalToast('Failed to copy resume');
    }
  };

  const handleCopyCoverLetter = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopiedDoc('cover_letter');
      showGlobalToast('Cover letter copied to clipboard');
      setTimeout(() => setCopiedDoc(null), 2000);
    } catch {
      showGlobalToast('Failed to copy cover letter');
    }
  };

  const handleDownloadResume = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDownloadingDoc('resume');
    try {
      const downloadName = formatResumeFilename(resumeData, company, jobTitle);
      const { blob } = await renderResumePdfOnce(
        resumeData,
        1,
        coreCompetencies,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showGlobalToast('Resume PDF downloaded');
    } catch {
      showGlobalToast('Failed to download resume PDF');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleDownloadCoverLetter = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!coverLetter) return;
    setDownloadingDoc('cover_letter');
    try {
      const downloadName = formatCoverLetterFilename(
        resumeData,
        company,
        jobTitle,
      );
      const { blob } = await renderCoverLetterPdfOnce(
        coverLetter,
        resumeData,
        company,
        jobTitle,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showGlobalToast('Cover letter PDF downloaded');
    } catch {
      showGlobalToast('Failed to download cover letter PDF');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleGenerateClWithConfirm = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onGenerateCoverLetter) return;
    const target =
      [jobTitle, company].filter(Boolean).join(' at ') || 'this role';
    const ok = await confirm({
      title: 'Generate Tailored Cover Letter',
      message: `Generate a bespoke Cover Letter tailored for "${target}"?`,
      confirmLabel: 'Generate CL',
      cancelLabel: 'Cancel',
      type: 'info',
    });
    if (ok) {
      onGenerateCoverLetter();
    }
  };

  const roleLabel =
    [jobTitle, company].filter(Boolean).join(' · ') || 'Applied Position';

  return (
    <>
      {/* ── Document Switcher Bar (Separated, Compact & Ergonomic) ── */}
      <div className='w-full max-w-full min-w-0'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch'>
          {/* ── 1. Resume / CV Selector Card ── */}
          <div
            onClick={() => onSelectDoc?.('resume')}
            className={cn(
              'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border select-none',
              isResumeSelected ?
                'bg-panel border-primary ring-2 ring-primary/25 shadow-md -translate-y-0.5'
              : 'bg-panel/70 border-primary/15 hover:border-primary/40 hover:bg-panel/90 hover:-translate-y-0.5',
            )}
          >
            {/* Left: Icon & Meta */}
            <div className='flex items-center gap-3 min-w-0'>
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isResumeSelected ?
                    'bg-primary text-white shadow-xs'
                  : 'bg-primary/10 text-primary group-hover:bg-primary/20',
                )}
              >
                <FileText className='h-5 w-5' />
              </div>
              <div className='min-w-0'>
                <div className='flex items-center gap-2'>
                  <h3 className='text-xs font-bold text-ink-primary truncate'>
                    Tailored Resume (CV)
                  </h3>
                  {isResumeSelected && (
                    <span className='inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold text-primary uppercase tracking-wide'>
                      <CheckCircle2 className='h-2.5 w-2.5' /> Selected
                    </span>
                  )}
                </div>
                <p className='text-[11px] text-ink-secondary truncate mt-0.5'>
                  {roleLabel}
                </p>
              </div>
            </div>

            {/* Right: Quick Actions */}
            <div
              className='flex items-center gap-1.5 shrink-0 self-end sm:self-center'
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size='sm'
                variant='outline'
                Icon={Eye}
                onClick={() => setActivePreviewDoc('resume')}
                className='!h-7 !px-2.5 !text-xs font-semibold text-ink-primary hover:text-primary !rounded-xl'
                title='Preview Resume Document'
              >
                Preview
              </Button>

              <Button
                size='sm'
                variant='outline'
                Icon={copiedDoc === 'resume' ? Check : Copy}
                onClick={handleCopyResume}
                className='!h-7 !px-2.5 !text-xs font-semibold text-ink-primary !rounded-xl'
                title='Copy formatted resume text'
              >
                {copiedDoc === 'resume' ? 'Copied' : 'Copy'}
              </Button>

              <Button
                size='sm'
                variant='default'
                Icon={Download}
                isLoading={downloadingDoc === 'resume'}
                onClick={handleDownloadResume}
                className='!h-7 !px-2.5 !text-xs font-semibold !rounded-xl shadow-xs'
                title='Download Resume PDF'
              >
                PDF
              </Button>
            </div>
          </div>

          {/* ── 2. Cover Letter / CL Selector Card ── */}
          <div
            onClick={() => onSelectDoc?.('cover_letter')}
            className={cn(
              'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border select-none',
              isClSelected ?
                'bg-panel border-primary ring-2 ring-primary/25 shadow-md -translate-y-0.5'
              : 'bg-panel/70 border-primary/15 hover:border-primary/40 hover:bg-panel/90 hover:-translate-y-0.5',
            )}
          >
            {/* Left: Icon & Meta */}
            <div className='flex items-center gap-3 min-w-0'>
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isClSelected ?
                    'bg-primary text-white shadow-xs'
                  : 'bg-primary/10 text-primary group-hover:bg-primary/20',
                )}
              >
                <Mail className='h-5 w-5' />
              </div>
              <div className='min-w-0'>
                <div className='flex items-center gap-2'>
                  <h3 className='text-xs font-bold text-ink-primary truncate'>
                    Tailored Cover Letter (CL)
                  </h3>
                  {isCoverLetterGenerating ? (
                    <span className='inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-600 dark:text-amber-400'>
                      <Loader2 className='h-2.5 w-2.5 animate-pulse' />{' '}
                      Generating
                    </span>
                  ) : isClSelected ? (
                    <span className='inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold text-primary uppercase tracking-wide'>
                      <CheckCircle2 className='h-2.5 w-2.5' /> Selected
                    </span>
                  ) : !hasCoverLetter ? (
                    <span className='inline-flex items-center rounded-md bg-ink-secondary/15 px-1.5 py-0.5 text-[9px] font-medium text-ink-secondary'>
                      Not Created
                    </span>
                  ) : null}
                </div>
                <p className='text-[11px] text-ink-secondary truncate mt-0.5'>
                  {hasCoverLetter ?
                    'Bespoke narrative letter matching role'
                  : 'Generate a targeted cover letter'}
                </p>
              </div>
            </div>

            {/* Right: Quick Actions */}
            <div
              className='flex items-center gap-1.5 shrink-0 self-end sm:self-center'
              onClick={(e) => e.stopPropagation()}
            >
              {isCoverLetterGenerating ? (
                <div className='flex items-center gap-2'>
                  <span className='text-xs font-semibold text-primary animate-pulse'>
                    AI Working...
                  </span>
                  {onCancelGeneration && (
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={onCancelGeneration}
                      className='!h-7 !px-2 text-xs text-red-500'
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ) : hasCoverLetter ? (
                <>
                  <Button
                    size='sm'
                    variant='outline'
                    Icon={Eye}
                    onClick={() => setActivePreviewDoc('cover_letter')}
                    className='!h-7 !px-2.5 !text-xs font-semibold text-ink-primary hover:text-primary !rounded-xl'
                    title='Preview Cover Letter Document'
                  >
                    Preview
                  </Button>

                  <Button
                    size='sm'
                    variant='outline'
                    Icon={copiedDoc === 'cover_letter' ? Check : Copy}
                    onClick={handleCopyCoverLetter}
                    className='!h-7 !px-2.5 !text-xs font-semibold text-ink-primary !rounded-xl'
                    title='Copy cover letter text'
                  >
                    {copiedDoc === 'cover_letter' ? 'Copied' : 'Copy'}
                  </Button>

                  <Button
                    size='sm'
                    variant='default'
                    Icon={Download}
                    isLoading={downloadingDoc === 'cover_letter'}
                    onClick={handleDownloadCoverLetter}
                    className='!h-7 !px-2.5 !text-xs font-semibold !rounded-xl shadow-xs'
                    title='Download Cover Letter PDF'
                  >
                    PDF
                  </Button>
                </>
              ) : onGenerateCoverLetter ? (
                <Button
                  size='sm'
                  variant='default'
                  Icon={Sparkles}
                  onClick={handleGenerateClWithConfirm}
                  className='!h-7 !px-2.5 !text-xs font-semibold !rounded-xl shadow-xs'
                >
                  Generate CL
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── High-Resolution, Non-blocking Preview Modal ── */}
      {activePreviewDoc &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs animate-in fade-in-50 duration-150'
            onClick={() => setActivePreviewDoc(null)}
          >
            <div
              className='flex h-[92vh] w-[92vw] max-w-5xl flex-col rounded-3xl overflow-hidden shadow-2xl border border-primary/40 bg-background'
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <header className='flex shrink-0 items-center justify-between border-b border-primary/20 px-5 py-3.5 bg-panel/85 backdrop-blur-md'>
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                    {activePreviewDoc === 'resume' ? (
                      <FileText className='h-5 w-5' />
                    ) : (
                      <Mail className='h-5 w-5' />
                    )}
                  </div>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <p className='label font-bold text-ink-primary truncate'>
                        {activePreviewDoc === 'resume' ?
                          formatResumeFilename(resumeData, company, jobTitle)
                        : formatCoverLetterFilename(
                            resumeData,
                            company,
                            jobTitle,
                          )}
                      </p>
                      <span className='rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary'>
                        {activePreviewDoc === 'resume' ?
                          'Tailored CV'
                        : 'Tailored CL'}
                      </span>
                    </div>
                    <p className='text-[11px] text-ink-secondary truncate mt-0.5'>
                      {roleLabel} · 1 page document
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  <Button
                    size='sm'
                    variant='outline'
                    Icon={
                      (
                        activePreviewDoc === 'resume' ?
                          copiedDoc === 'resume'
                        : copiedDoc === 'cover_letter'
                      ) ?
                        Check
                      : Copy
                    }
                    onClick={
                      activePreviewDoc === 'resume' ?
                        handleCopyResume
                      : handleCopyCoverLetter
                    }
                    className='!h-8 !px-3 text-xs font-semibold !rounded-xl'
                  >
                    Copy Text
                  </Button>

                  <Button
                    size='sm'
                    variant='default'
                    Icon={Download}
                    isLoading={
                      activePreviewDoc === 'resume' ?
                        downloadingDoc === 'resume'
                      : downloadingDoc === 'cover_letter'
                    }
                    onClick={
                      activePreviewDoc === 'resume' ?
                        handleDownloadResume
                      : handleDownloadCoverLetter
                    }
                    className='!h-8 !px-3 text-xs font-semibold !rounded-xl shadow-xs'
                  >
                    Download PDF
                  </Button>

                  <button
                    type='button'
                    aria-label='Close preview'
                    onClick={() => setActivePreviewDoc(null)}
                    className='flex h-8 w-8 items-center justify-center rounded-xl text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition cursor-pointer'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              </header>

              {/* Modal Body: Crisp Instant Vector Render */}
              <div className='flex-1 overflow-auto p-4 sm:p-8 bg-slate-900/10 dark:bg-black/40 flex justify-center custom-scrollbar'>
                <div className='shadow-2xl rounded-sm overflow-hidden bg-white max-w-3xl w-full my-auto transition-all'>
                  {activePreviewDoc === 'resume' ? (
                    <ResumeHtmlDocument
                      config={defaultResumeTemplate}
                      data={resumeData}
                      coreCompetencies={coreCompetencies}
                      keyQualifications={[]}
                    />
                  ) : coverLetter ? (
                    <CoverLetterHtmlDocument
                      coverLetter={coverLetter}
                      candidateData={resumeData}
                      company={company}
                      jobTitle={jobTitle}
                    />
                  ) : (
                    <div className='p-12 text-center text-ink-secondary'>
                      No cover letter generated yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
