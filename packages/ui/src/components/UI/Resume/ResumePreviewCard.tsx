/** @format */

'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Copy, Download, Sparkles } from 'lucide-react';
import { Button } from '../Button';
import { notify } from '../toast/toast-store';
import { ResumePdfPreview, renderResumePdfOnce } from './ResumePdfPreview';
import { formatResumeAsPlainText, formatResumeFilename } from './helpers';
import type { MasterResumeData } from './types';

export type ResumePreviewCardProps = {
  data: MasterResumeData;
  filename?: string;
  title?: string;
  badge?: string;
  coreCompetencies?: string[];
  keyQualifications?: string[];
  company?: string;
  jobTitle?: string;
  showCompetencies?: boolean;
  onOpenModal?: (content: ReactNode) => void;
  onPreview?: () => void;
  onNewWindow?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  className?: string;
  headerAction?: ReactNode;
};

export function ResumePreviewCard({
  data,
  filename,
  title,
  badge,
  coreCompetencies,
  keyQualifications,
  company,
  jobTitle,
  showCompetencies = true,
  onOpenModal,
  onPreview,
  onNewWindow,
  onEdit,
  onDownload,
  onCopy,
  className = '',
  headerAction,
}: ResumePreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const competencies = coreCompetencies ?? data.core_competencies ?? [];

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    try {
      const text = formatResumeAsPlainText(data, competencies);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify.success('Resume copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error('Failed to copy resume to clipboard');
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
        filename || formatResumeFilename(data, company, jobTitle);
      const { blob } = await renderResumePdfOnce(
        data,
        1,
        competencies,
        keyQualifications,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify.success('Resume downloaded');
    } catch {
      notify.error('Failed to download resume PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`group relative h-36 sm:h-40 w-full cursor-zoom-in bg-background-secondary overflow-hidden rounded-lg p-1.5 ${className}`}
    >
      {/* Header */}
      <div className='flex items-center justify-between gap-2 border-b border-primary/40 pb-2.5 w-full min-w-0'>
        <div className='min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden'>
          <Sparkles className='w-3.5 h-3.5 text-primary shrink-0' />
          <strong className='text-xs font-bold text-ink-primary shrink-0'>
            Resume
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
            title='Copy formatted resume text'
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
            title='Download resume PDF'
          >
            Download
          </Button>
        </div>
      </div>

      {/* Matched Core Competencies (Read-only tag chips) */}
      {showCompetencies && competencies.length > 0 && (
        <div className='flex flex-col gap-1.5 w-full min-w-0'>
          <span className='text-ink-secondary text-[10px] font-bold uppercase tracking-wider'>
            Core Competencies
          </span>
          <div className='flex flex-wrap gap-1.5'>
            {competencies.map((comp, idx) => (
              <span
                key={`${comp}-${idx}`}
                className='inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-[9px] font-semibold text-primary'
              >
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Embedded Live Preview */}
      <div className='flex flex-col gap-2 pt-1 w-full min-w-0'>
        <ResumePdfPreview
          data={data}
          filename={filename}
          coreCompetencies={competencies}
          keyQualifications={keyQualifications}
          company={company}
          jobTitle={jobTitle}
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
