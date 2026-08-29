/** @format */

'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Copy, Download, Sparkles } from 'lucide-react';
import { Button } from '../Button';
import { notify } from '../toast/toast-store';
import {
  CoverLetterPdfPreview,
  renderCoverLetterPdfOnce,
} from './CoverLetterPdfPreview';
import { formatCoverLetterFilename } from './helpers';
import type { MasterResumeData } from './types';

export type CoverLetterPreviewCardProps = {
  coverLetter: string;
  candidateData?: MasterResumeData;
  company?: string;
  jobTitle?: string;
  filename?: string;
  title?: string;
  badge?: string;
  onOpenModal?: (content: ReactNode) => void;
  onPreview?: () => void;
  onNewWindow?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  className?: string;
  thumbnailClassName?: string;
  headerAction?: ReactNode;
};

export function CoverLetterPreviewCard({
  coverLetter,
  candidateData,
  company,
  jobTitle,
  filename,
  title,
  badge,
  thumbnailClassName,
  onOpenModal,
  onPreview,
  onNewWindow,
  onEdit,
  onDownload,
  onCopy,
  className = '',
  headerAction,
}: CoverLetterPreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      notify.success('Cover letter copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error('Failed to copy cover letter to clipboard');
    }
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    setDownloading(true);
    try {
      const downloadName =
        filename || formatCoverLetterFilename(candidateData, company, jobTitle);
      const { blob } = await renderCoverLetterPdfOnce(
        coverLetter,
        candidateData,
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
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify.success('Cover letter downloaded');
    } catch {
      notify.error('Failed to download cover letter PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-3xl border border-primary/20 bg-panel/70 p-5 backdrop-blur-xl shadow-lg w-full min-w-0 max-w-full overflow-hidden transition-all ${className}`}
    >
      {/* Header */}
      <div className='flex items-center justify-between gap-2 border-b border-primary/30 pb-3 w-full min-w-0'>
        <div className='min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden'>
          <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
          <strong className='text-xs font-bold text-ink-primary shrink-0'>
            Cover Letter
          </strong>
          {badge ?
            <span
              title={badge}
              className='inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary truncate max-w-[100px]'
            >
              {badge}
            </span>
          : title ?
            <span title={title} className='text-xs text-ink-secondary truncate'>
              {title}
            </span>
          : null}
        </div>

        <div className='flex items-center gap-1.5 shrink-0'>
          {headerAction}
          <Button
            size='sm'
            variant='outline'
            Icon={copied ? Check : Copy}
            onClick={() => void handleCopy()}
            className='!rounded-xl !h-7 !px-2.5 text-xs font-semibold text-ink-primary'
            title='Copy cover letter text'
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>

          <Button
            size='sm'
            variant='default'
            Icon={Download}
            isLoading={downloading}
            onClick={() => void handleDownload()}
            className='!rounded-xl !h-7 !px-2.5 text-xs font-semibold'
            title='Download cover letter PDF'
          >
            Download
          </Button>
        </div>
      </div>

      {/* Embedded Live Preview */}
      <div className='flex flex-col gap-2 pt-1 w-full min-w-0'>
        <CoverLetterPdfPreview
          coverLetter={coverLetter}
          candidateData={candidateData}
          company={company}
          jobTitle={jobTitle}
          filename={filename}
          thumbnailClassName={thumbnailClassName}
          onOpenModal={onOpenModal}
          onPreview={onPreview}
          onNewWindow={onNewWindow}
          onEdit={onEdit}
          onDownload={handleDownload}
        />
      </div>
    </div>
  );
}
