/** @format */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  X,
} from 'lucide-react';
import { Button } from '../Button';
import { Mail, Phone, MapPin, FolderGit2, Globe } from 'lucide-react';
import {
  formatCoverLetterFilename,
  resumeContactItems,
  resumeFullName,
  type ResumeContactItem,
} from './helpers';
import type { MasterResumeData } from './types';
import { COVER_LETTER_GOLD_SVG_DATA_URI } from './cover-letter-contour';
import {
  computeLayoutMetrics,
  parseCoverLetterContent,
  renderCoverLetterPdfOnce,
} from './cover-letter-pdf-document';
export {
  CoverLetterPdfDocument,
  renderCoverLetterPdfOnce,
} from './cover-letter-pdf-document';

export type CoverLetterPdfPreviewProps = {
  coverLetter: string;
  candidateData?: MasterResumeData;
  company?: string;
  jobTitle?: string;
  filename?: string;
  fileSize?: number | null;
  onOpenModal?: (content: ReactNode) => void;
  onPreview?: () => void;
  onNewWindow?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
};

export const COVER_LETTER_SIGNATURE_STYLE = {
  fontFamily:
    "'Sacramento', 'Dancing Script', 'Caveat', 'Brush Script MT', 'Segoe Script', cursive",
  fontStyle: 'normal',
  fontWeight: 400,
} as const;

function renderHtmlFormattedParagraph(
  text: string,
  fontSize: number,
  lineHeight: number,
  marginBottom: number,
  key: number | string,
) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <p
      key={key}
      style={{
        fontSize: `${fontSize * 1.32}px`,
        lineHeight: lineHeight,
        marginBottom: `${marginBottom * 1.25}px`,
      }}
      className='text-stone-800 dark:text-stone-200 text-justify tracking-normal'
    >
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong
              key={index}
              className='font-bold text-stone-950 dark:text-white'
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

function LinkedinHtmlIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={{
        width: '0.9em',
        height: '0.9em',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' />
      <rect x='2' y='9' width='4' height='12' />
      <circle cx='4' cy='4' r='2' />
    </svg>
  );
}

function HtmlContactIcon({ type }: { type: ResumeContactItem['type'] }) {
  const iconStyle = {
    width: '0.92em',
    height: '0.92em',
    display: 'inline-block',
    verticalAlign: 'middle',
  };
  const className = 'shrink-0 text-[#784508] -translate-y-[0.5px]';
  switch (type) {
    case 'email':
      return <Mail className={className} style={iconStyle} />;
    case 'phone':
      return <Phone className={className} style={iconStyle} />;
    case 'location':
      return <MapPin className={className} style={iconStyle} />;
    case 'linkedin':
      return <LinkedinHtmlIcon className={className} style={iconStyle} />;
    case 'portfolio':
      return <FolderGit2 className={className} style={iconStyle} />;
    case 'website':
      return <Globe className={className} style={iconStyle} />;
    default:
      return null;
  }
}

export function CoverLetterHtmlDocument({
  coverLetter,
  candidateData,
  company,
  jobTitle,
}: {
  coverLetter: string;
  candidateData?: MasterResumeData;
  company?: string;
  jobTitle?: string;
}) {
  const name = candidateData ? resumeFullName(candidateData) : 'Scott Zhang';
  const headline = candidateData?.basics?.headline;
  const contacts = candidateData ? resumeContactItems(candidateData) : [];
  const metrics = computeLayoutMetrics(coverLetter);
  const { salutation, paragraphs, signoff, signoffName } =
    parseCoverLetterContent(coverLetter, candidateData, company);

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const subjectTitle =
    jobTitle ?
      `RE: Application for ${jobTitle}${company ? ` — ${company}` : ''}`
    : `RE: Job Application${company ? ` — ${company}` : ''}`;

  return (
    <div
      style={{
        width: 816,
        minHeight: 1056,
        paddingTop: `${metrics.paddingTop * 1.35}px`,
        paddingBottom: `${metrics.paddingBottom * 1.35}px`,
        paddingLeft: `${metrics.paddingX * 1.35}px`,
        paddingRight: `${metrics.paddingX * 1.35}px`,
        backgroundColor: '#ffffff',
        color: '#292524',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
      className='flex flex-col text-left select-none'
    >
      {/* Top-Right Decorative Contour: Exact vector SVG from clbg.svg in matching Warm Gold */}
      <img
        src={COVER_LETTER_GOLD_SVG_DATA_URI}
        alt=''
        className='absolute -top-10 -right-8 w-[235px] h-[235px] object-contain pointer-events-none opacity-35 rotate-[35deg] select-none'
      />

      {/* Bottom-Left Decorative Contour: Scaled vector SVG in matching Warm Gold */}
      <img
        src={COVER_LETTER_GOLD_SVG_DATA_URI}
        alt=''
        className='absolute -bottom-36 -left-32 w-[510px] h-[510px] object-contain pointer-events-none opacity-28 -rotate-[25deg] select-none'
      />

      <div className='relative z-10 flex flex-col'>
        {/* ── 1. CANDIDATE LETTERHEAD (Identical to CV) ── */}
        <div style={{ marginBottom: `${metrics.headerGap * 1.3}px` }}>
          <h1
            style={{ marginBottom: `${metrics.namePaddingBottom * 1.3}px` }}
            className='text-[29px] font-black tracking-tight text-stone-900 m-0 leading-tight'
          >
            {name}
          </h1>

          {headline && (
            <p className='text-[12.5px] font-bold text-[#784508] mt-0.5 mb-1.5'>
              {headline}
            </p>
          )}

          {contacts.length > 0 && (
            <div className='flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-stone-600 mt-1 mb-1'>
              {contacts.map((item, idx) => (
                <span key={idx} className='inline-flex items-center gap-1.5'>
                  {idx > 0 && (
                    <span className='text-[#DEC8A0] font-normal'>|</span>
                  )}
                  <HtmlContactIcon type={item.type} />
                  {item.href ?
                    <a
                      href={item.href}
                      target='_blank'
                      rel='noreferrer'
                      className='text-stone-600 hover:text-stone-900'
                    >
                      {item.text}
                    </a>
                  : <span>{item.text}</span>}
                </span>
              ))}
            </div>
          )}

          {/* Warm Gold Accent Divider (Matching CV) */}
          <div
            style={{ marginTop: `${metrics.ruleMarginTop * 1.3}px` }}
            className='w-full h-[2px] bg-[#D4A853]'
          />
        </div>

        {/* ── 2. DETAILED REFERENCE / SUBJECT SECTION (Placed on top) ── */}
        <div className='mb-3'>
          <div className='inline-flex items-center px-3 py-1 rounded bg-[#FAF5EC] border border-[#DEC8A0] text-[#784508] text-[11.5px] font-bold shadow-2xs'>
            {subjectTitle}
          </div>
        </div>

        {/* ── 3. SALUTATION & DATE ROW (Aligned horizontally) ── */}
        <div className='flex items-baseline justify-between gap-3 mb-3.5'>
          <h2
            style={{ fontSize: `${metrics.bodyFontSize * 1.4}px` }}
            className='font-bold text-stone-900 m-0'
          >
            {salutation},
          </h2>
          <span className='text-stone-500 font-medium text-[11.5px] shrink-0'>
            {formattedDate}
          </span>
        </div>

        {/* ── 4. BODY PARAGRAPHS ── */}
        <div className='flex flex-col text-justify'>
          {paragraphs.map((para, i) =>
            renderHtmlFormattedParagraph(
              para,
              metrics.bodyFontSize,
              metrics.bodyLineHeight,
              metrics.paragraphGap,
              i,
            ),
          )}
        </div>

        {/* ── 5. SIGNATURE SECTION (Attached directly to body) ── */}
        <div
          style={{ marginTop: `${metrics.signatureGapTop * 1.3}px` }}
          className='self-end flex flex-col items-end'
        >
          <p
            style={{ fontSize: `${metrics.bodyFontSize * 1.25}px` }}
            className='text-stone-700 m-0 mb-1 font-medium'
          >
            {signoff},
          </p>
          <span
            className='text-[36px] text-[#784508] -rotate-2 select-none leading-none'
            style={COVER_LETTER_SIGNATURE_STYLE}
          >
            {signoffName}
          </span>
        </div>
      </div>
    </div>
  );
}

export function formatCoverLetterPdfFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CoverLetterPdfPreview({
  coverLetter,
  candidateData,
  company,
  jobTitle,
  filename,
  fileSize: suppliedFileSize,
  onOpenModal,
  onPreview,
  onNewWindow,
  onEdit,
  onDownload,
}: CoverLetterPdfPreviewProps) {
  const activeUrlRef = useRef<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatedFileSize, setGeneratedFileSize] = useState<number | null>(
    null,
  );
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const fileSize = generatedFileSize ?? suppliedFileSize ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.round(rect.width);
      const nextH = Math.round(rect.height);
      if (nextW > 0 && nextH > 0) {
        setContainerSize((prev) => {
          if (
            Math.abs(prev.width - nextW) <= 2 &&
            Math.abs(prev.height - nextH) <= 2
          ) {
            return prev;
          }
          return { width: nextW, height: nextH };
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pageWidth = 816;
  const pageHeight = 1056;

  const thumbnailScale = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return 0.165;
    const availableWidth = Math.max(80, containerSize.width - 24);
    const availableHeight = Math.max(80, containerSize.height - 20);
    return Math.min(availableWidth / pageWidth, availableHeight / pageHeight);
  }, [containerSize.width, containerSize.height]);

  const resolvedFilename =
    filename || formatCoverLetterFilename(candidateData, company, jobTitle);

  const generatePdfBlob = async () => {
    if (pdfUrl) return pdfUrl;
    setIsGenerating(true);
    setError('');
    try {
      const { blob } = await renderCoverLetterPdfOnce(
        coverLetter,
        candidateData,
        company,
        jobTitle,
      );
      const nextUrl = URL.createObjectURL(blob);
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = nextUrl;
      setPdfUrl(nextUrl);
      setGeneratedFileSize(blob.size);
      setIsGenerating(false);
      return nextUrl;
    } catch {
      setError('Could not generate cover letter PDF.');
      setIsGenerating(false);
      return null;
    }
  };

  useEffect(
    () => () => {
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    },
    [],
  );

  const download = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    const url = pdfUrl || (await generatePdfBlob());
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = resolvedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openPreview = () => {
    if (onPreview) {
      onPreview();
      return;
    }
    if (onOpenModal) {
      void generatePdfBlob();
      onOpenModal(
        <div className='flex h-full flex-col bg-background'>
          <header className='flex shrink-0 items-center justify-between border-b border-primary/60 px-6 py-3.5 bg-panel/80 backdrop-blur-md'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <FileText className='h-4.5 w-4.5' />
              </div>
              <div className='min-w-0'>
                <p className='label font-semibold text-ink-primary truncate'>
                  {resolvedFilename}
                </p>
                <div className='flex items-center gap-2 text-xs text-ink-secondary mt-0.5 truncate'>
                  <span>1 page</span>
                  {fileSize ?
                    <>
                      <span className='opacity-40'>•</span>
                      <span>{formatCoverLetterPdfFileSize(fileSize)}</span>
                    </>
                  : null}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2 shrink-0'>
              <Button
                variant='secondary'
                size='sm'
                Icon={Download}
                onClick={download}
                disabled={isGenerating}
              >
                {isGenerating ? 'Compiling PDF...' : 'Download PDF'}
              </Button>
            </div>
          </header>

          {pdfUrl ?
            <iframe
              title='Cover Letter PDF preview'
              src={pdfUrl}
              className='h-full w-full border-0 bg-background-secondary transform-gpu'
            />
          : <div className='flex h-full flex-col items-center justify-center gap-2 text-ink-secondary'>
              <Loader2 className='h-6 w-6 animate-spin text-primary' />
              <p className='text-xs font-medium'>Loading PDF engine...</p>
            </div>
          }
        </div>,
      );
    } else {
      setIsModalOpen(true);
      void generatePdfBlob();
    }
  };

  return (
    <div className='flex flex-col gap-2 w-full min-w-0'>
      {/* ── THUMBNAIL LIVE PREVIEW (Compact & Efficient) ── */}
      <div
        ref={containerRef}
        onClick={openPreview}
        className='group relative h-36 sm:h-40 w-full cursor-zoom-in bg-background-secondary overflow-hidden rounded-lg p-1.5'
      >
        <div className='pointer-events-none flex items-center justify-center'>
          <div
            style={{
              width: pageWidth * thumbnailScale,
              height: pageHeight * thumbnailScale,
            }}
            className='relative shrink-0 select-none'
          >
            <div
              style={{
                width: pageWidth,
                height: pageHeight,
                transform: `scale(${thumbnailScale})`,
                transformOrigin: 'top left',
              }}
              className='absolute left-0 top-0 overflow-hidden rounded-xs bg-white shadow-md'
            >
              <CoverLetterHtmlDocument
                coverLetter={coverLetter}
                candidateData={candidateData}
                company={company}
                jobTitle={jobTitle}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className='absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-xs text-red-600 bg-panel/95 py-2 px-3 rounded-lg border border-red-200 dark:border-red-900/40 shadow-xs'>
            {error}
          </p>
        )}

        {isGenerating && (
          <div className='absolute right-2 top-2 rounded-full bg-white/90 dark:bg-slate-900/90 p-1 text-ink-secondary '>
            <Loader2 className='size-2.5 animate-spin text-primary' />
          </div>
        )}

        {/* Hover overlay actions */}
        <div className='absolute inset-0 z-20 flex items-center justify-center gap-1.5 bg-slate-950/20 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-xs'>
          <button
            type='button'
            title='In-Page Preview'
            aria-label='Preview Cover Letter PDF'
            onClick={(event) => {
              event.stopPropagation();
              openPreview();
            }}
            className='flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all'
          >
            <Maximize2 className='h-3.5 w-3.5' />
          </button>

          <button
            type='button'
            title='Open in New Window'
            aria-label='Open in new window'
            onClick={(event) => {
              event.stopPropagation();
              if (onNewWindow) {
                onNewWindow();
              } else if (pdfUrl) {
                window.open(pdfUrl, '_blank');
              } else {
                openPreview();
              }
            }}
            className='flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all'
          >
            <ExternalLink className='h-3.5 w-3.5' />
          </button>

          {onEdit && (
            <button
              type='button'
              title='Edit on Web'
              aria-label='Edit cover letter'
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className='flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all'
            >
              <Edit3 className='h-3.5 w-3.5' />
            </button>
          )}

          <button
            type='button'
            title='Download PDF'
            aria-label='Download cover letter PDF'
            onClick={(event) => {
              event.stopPropagation();
              if (onDownload) {
                onDownload();
              } else {
                download();
              }
            }}
            className='flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md disabled:opacity-50 transition-all'
            disabled={!onDownload && (!pdfUrl || isGenerating)}
          >
            <Download className='h-3.5 w-3.5' />
          </button>
        </div>

        {/* Bottom-left pill badge */}
        <div className='absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-md bg-panel/60 backdrop-blur-xs px-1.5 py-0.5 text-[9.5px] font-medium text-ink-primary'>
          <FileText className='h-3 w-3 text-primary shrink-0' />
          <span>
            1 page
            {fileSize ? `· ${formatCoverLetterPdfFileSize(fileSize)}` : ''}
          </span>
        </div>
      </div>

      {/* ── ENLARGED MODAL ZOOM PREVIEW ── */}
      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50 duration-150'
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className='flex h-[90vh] w-[88vw] max-w-6xl flex-col rounded-2xl overflow-hidden shadow-2xl border border-primary/80 bg-background'
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <header className='flex shrink-0 items-center justify-between border-b border-primary/60 px-3.5 py-3.5 bg-panel/80 backdrop-blur-md'>
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                    <div className='text-[11px] font-bold'>PDF</div>
                  </div>
                  <div className='min-w-0'>
                    <p className='label font-semibold text-ink-primary truncate'>
                      {resolvedFilename}
                    </p>
                    <div className='flex flex-wrap items-center gap-1 text-[10px] text-ink-secondary'>
                      <span>1 page</span>
                      {fileSize && (
                        <>
                          <span className='opacity-40'>•</span>
                          <span>{formatCoverLetterPdfFileSize(fileSize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  <Button
                    size='sm'
                    Icon={Download}
                    onClick={download}
                    disabled={!pdfUrl || isGenerating}
                  >
                    {isGenerating ? 'Compiling PDF...' : 'Download PDF'}
                  </Button>
                  <button
                    type='button'
                    aria-label='Close preview'
                    onClick={() => setIsModalOpen(false)}
                    className='flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-background-secondary transition cursor-pointer'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              </header>

              {/* Modal Body */}
              {pdfUrl ?
                <iframe
                  title='Cover Letter PDF preview'
                  src={pdfUrl}
                  className='h-full w-full border-0 bg-background-secondary transform-gpu'
                />
              : <div className='flex h-full flex-col items-center justify-center gap-2 text-ink-secondary'>
                  <Loader2 className='h-6 w-6 animate-spin text-primary' />
                  <p className='text-xs font-medium'>Loading PDF engine...</p>
                </div>
              }
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
