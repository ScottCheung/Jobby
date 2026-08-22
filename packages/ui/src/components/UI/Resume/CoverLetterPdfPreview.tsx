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
import {
  Document,
  Font,
  Link as PdfLink,
  Page,
  Path as PdfPath,
  Svg as PdfSvg,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';
import { Button } from '../Button';
import { Mail, Phone, MapPin, FolderGit2, Globe } from 'lucide-react';
import {
  formatCoverLetterFilename,
  resumeContactItems,
  resumeFullName,
  type ResumeContactItem,
} from './helpers';
import type { MasterResumeData } from './types';
import {
  CLBG_MAIN_PATH_D,
  COVER_LETTER_GOLD_SVG_DATA_URI,
} from './cover-letter-contour';
import { SACRAMENTO_FONT_DATA_URI } from './cover-letter-font';

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

// Register commercial-use free handwriting font (SIL Open Font License 1.1)
Font.register({
  family: 'Sacramento',
  src: SACRAMENTO_FONT_DATA_URI,
});

export const COVER_LETTER_SIGNATURE_STYLE = {
  fontFamily:
    "'Sacramento', 'Dancing Script', 'Caveat', 'Brush Script MT', 'Segoe Script', cursive",
  fontStyle: 'normal',
  fontWeight: 400,
} as const;

interface CoverLetterMetrics {
  bodyFontSize: number;
  bodyLineHeight: number;
  paragraphGap: number;
  paddingTop: number;
  paddingBottom: number;
  paddingX: number;
  headerGap: number;
  namePaddingBottom: number;
  ruleMarginTop: number;
  salutationGapTop: number;
  salutationGapBottom: number;
  signatureGapTop: number;
}

function computeLayoutMetrics(text: string): CoverLetterMetrics {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  if (wordCount < 160 || charCount < 950) {
    // Short letter: spacious, elegant letterhead spacing
    return {
      bodyFontSize: 11.5,
      bodyLineHeight: 1.85,
      paragraphGap: 20,
      paddingTop: 50,
      paddingBottom: 45,
      paddingX: 50,
      headerGap: 20,
      namePaddingBottom: 5,
      ruleMarginTop: 9,
      salutationGapTop: 16,
      salutationGapBottom: 16,
      signatureGapTop: 28,
    };
  } else if (wordCount < 260 || charCount < 1600) {
    // Standard medium letter: balanced and open
    return {
      bodyFontSize: 10.8,
      bodyLineHeight: 1.72,
      paragraphGap: 15,
      paddingTop: 115,
      paddingBottom: 40,
      paddingX: 48,
      headerGap: 18,
      namePaddingBottom: 4,
      ruleMarginTop: 8,
      salutationGapTop: 14,
      salutationGapBottom: 14,
      signatureGapTop: 22,
    };
  } else {
    // Long letter: compact to strictly preserve 1-page layout
    return {
      bodyFontSize: 9.8,
      bodyLineHeight: 1.58,
      paragraphGap: 10,
      paddingTop: 90,
      paddingBottom: 35,
      paddingX: 46,
      headerGap: 14,
      namePaddingBottom: 4,
      ruleMarginTop: 7,
      salutationGapTop: 12,
      salutationGapBottom: 10,
      signatureGapTop: 16,
    };
  }
}

interface ParsedCoverLetter {
  salutation: string;
  paragraphs: string[];
  signoff: string;
  signoffName: string;
}

function parseCoverLetterContent(
  text: string,
  candidateData?: MasterResumeData,
  company?: string,
): ParsedCoverLetter {
  const rawParagraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p): p is string => Boolean(p));

  let salutation = '';
  let signoff = 'Sincerely';
  let signoffName =
    candidateData ? resumeFullName(candidateData) : 'Scott Zhang';

  const remainingParagraphs: string[] = [];

  for (let i = 0; i < rawParagraphs.length; i++) {
    const p = rawParagraphs[i];
    if (!p) continue;

    // Check for salutation at beginning
    if (i === 0 && /^Dear\b/i.test(p)) {
      salutation = p.replace(/,\s*$/, '');
      continue;
    }

    // Check for signoff at end
    if (
      i === rawParagraphs.length - 1 &&
      /^(Sincerely|Best regards|Kind regards|Warm regards|Regards|Respectfully|Yours sincerely)/i.test(
        p,
      )
    ) {
      const lines = p
        .split('\n')
        .map((l) => l.trim())
        .filter((l): l is string => Boolean(l));
      const firstLine = lines[0];
      if (firstLine) {
        signoff = firstLine.replace(/,\s*$/, '') || 'Sincerely';
      }
      if (lines.length > 1) {
        signoffName = lines.slice(1).join(' ');
      }
      continue;
    }

    remainingParagraphs.push(p);
  }

  if (!salutation) {
    salutation =
      company ? `Dear Hiring Team at ${company}` : 'Dear Hiring Manager';
  }

  return {
    salutation,
    paragraphs:
      remainingParagraphs.length > 0 ? remainingParagraphs : rawParagraphs,
    signoff,
    signoffName,
  };
}

function renderPdfFormattedParagraph(
  text: string,
  fontSize: number,
  lineHeight: number,
  marginBottom: number,
  keyPrefix: string,
) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text
      key={keyPrefix}
      style={{
        fontSize,
        lineHeight,
        marginBottom,
        color: '#292524',
        textAlign: 'justify',
      }}
    >
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text
              key={index}
              style={{
                fontFamily: 'Helvetica-Bold',
                color: '#1C1917',
              }}
            >
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

function PdfContactIcon({ type, color }: { type: string; color: string }) {
  const size = 7.5;
  const svgStyle = {
    width: size,
    height: size,
    marginRight: 2.5,
    marginTop: -0.1,
  };

  switch (type) {
    case 'email':
      return (
        <PdfSvg viewBox='0 0 24 24' style={svgStyle}>
          <PdfPath
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6'
          />
        </PdfSvg>
      );
    case 'phone':
      return (
        <PdfSvg viewBox='0 0 24 24' style={svgStyle}>
          <PdfPath
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'
          />
        </PdfSvg>
      );
    case 'location':
      return (
        <PdfSvg viewBox='0 0 24 24' style={svgStyle}>
          <PdfPath
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
          />
        </PdfSvg>
      );
    case 'linkedin':
      return (
        <PdfSvg viewBox='0 0 24 24' style={svgStyle}>
          <PdfPath
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
          />
        </PdfSvg>
      );
    case 'portfolio':
      return (
        <PdfSvg viewBox='0 0 24 24' style={svgStyle}>
          <PdfPath
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'
          />
        </PdfSvg>
      );
    case 'website':
      return (
        <PdfSvg viewBox='0 0 24 24' style={svgStyle}>
          <PdfPath
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z M2 12h20'
          />
        </PdfSvg>
      );
    default:
      return null;
  }
}

export function CoverLetterPdfDocument({
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
    <Document title={`${name} - Cover Letter`}>
      <Page
        size='A4'
        style={{
          paddingTop: metrics.paddingTop,
          paddingBottom: metrics.paddingBottom,
          paddingLeft: metrics.paddingX,
          paddingRight: metrics.paddingX,
          backgroundColor: '#ffffff',
          fontFamily: 'Helvetica',
          color: '#292524',
          position: 'relative',
        }}
      >
        {/* Top-Right Decorative Contour: Exact vector SVG from clbg.svg in matching Warm Gold */}
        <PdfSvg
          viewBox='0 0 928 888'
          style={{
            position: 'absolute',
            top: -50,
            right: -30,
            width: 150,
            height: 150,
            opacity: 1,
            transform: 'rotate(-85deg)',
          }}
        >
          <PdfPath
            d={CLBG_MAIN_PATH_D}
            fill='#D4A853'
            transform='matrix(0.866025, 0.5, -0.500207, 0.866384, 309.4571, 6.361)'
          />
        </PdfSvg>

        {/* Bottom-Left Decorative Contour: Scaled vector SVG in matching Warm Gold */}
        <PdfSvg
          viewBox='0 0 928 888'
          style={{
            position: 'absolute',
            bottom: -110,
            left: -100,
            width: 370,
            height: 370,
            opacity: 0.28,
            transform: 'rotate(-25deg)',
          }}
        >
          <PdfPath
            d={CLBG_MAIN_PATH_D}
            fill='#D4A853'
            transform='matrix(0.866025, 0.5, -0.500207, 0.866384, 309.4571, 6.361)'
          />
        </PdfSvg>
        {/* ── 2. DETAILED REFERENCE / SUBJECT SECTION (Placed on top) ── */}
        <View
          style={{
            marginBottom: 30,
            marginTop: -10,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <View
            style={{
              backgroundColor: '#FAF5EC',
              // borderWidth: 0.8,
              // borderColor: '#DEC8A0',
              borderRadius: 9999,
              paddingHorizontal: 18,
              paddingVertical: 8,
              marginLeft: -10,
              alignSelf: 'flex-start',
            }}
          >
            <Text
              style={{
                fontSize: 8.8,
                fontFamily: 'Helvetica-Bold',
                color: '#784508',
                letterSpacing: 0.2,
              }}
            >
              {subjectTitle}
            </Text>
          </View>
        </View>
        {/* ── 1. EXECUTIVE CANDIDATE LETTERHEAD (Identical to CV) ── */}
        <View
          style={{
            marginBottom: metrics.headerGap,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <Text
            style={{
              fontSize: 23,
              fontFamily: 'Helvetica-Bold',
              color: '#1C1917',
              lineHeight: 1.1,
              letterSpacing: -0.2,
              marginBottom: metrics.namePaddingBottom,
            }}
          >
            {name}
          </Text>

          {headline && (
            <Text
              style={{
                fontSize: 9.8,
                fontFamily: 'Helvetica-Bold',
                color: '#784508',
                marginBottom: 3,
              }}
            >
              {headline}
            </Text>
          )}

          {contacts.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                marginTop: 2,
                marginBottom: 2,
              }}
            >
              {contacts.map((item, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  {idx > 0 && (
                    <Text
                      style={{
                        marginHorizontal: 4,
                        color: '#DEC8A0',
                        fontSize: 8.5,
                      }}
                    >
                      |
                    </Text>
                  )}
                  <PdfContactIcon type={item.type} color='#784508' />
                  {item.href ?
                    <PdfLink
                      src={item.href}
                      style={{
                        fontSize: 8.5,
                        color: '#57534E',
                        textDecoration: 'none',
                      }}
                    >
                      {item.text}
                    </PdfLink>
                  : <Text style={{ fontSize: 8.5, color: '#57534E' }}>
                      {item.text}
                    </Text>
                  }
                </View>
              ))}
            </View>
          )}

          {/* Warm Gold Accent Divider Rule (Matching CV) */}
          <View
            style={{
              width: '100%',
              height: 1.5,
              backgroundColor: '#D4A853',
              marginTop: metrics.ruleMarginTop,
            }}
          />
        </View>

        {/* ── 3. SALUTATION & DATE ROW (Aligned horizontally) ── */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: metrics.salutationGapBottom,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Helvetica-Bold',
              color: '#1C1917',
              lineHeight: 1.1,
              letterSpacing: -0.2,
              marginBottom: metrics.namePaddingBottom,
              // textTransform: 'uppercase',
            }}
          >
            {salutation},
          </Text>

          <Text
            style={{
              fontSize: 8.8,
              color: '#78716C',
              fontFamily: 'Helvetica',
            }}
          >
            {formattedDate}
          </Text>
        </View>

        {/* ── 4. BODY PARAGRAPHS ── */}
        <View style={{ position: 'relative', zIndex: 10 }}>
          {paragraphs.map((para, i) =>
            renderPdfFormattedParagraph(
              para,
              metrics.bodyFontSize,
              metrics.bodyLineHeight,
              metrics.paragraphGap,
              `para-${i}`,
            ),
          )}
        </View>

        {/* ── 5. SIGNATURE SECTION (Directly attached to body, no candidate, no line) ── */}
        <View
          style={{
            marginTop: metrics.signatureGapTop,
            alignSelf: 'flex-end',
            alignItems: 'flex-end',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <Text
            style={{
              fontSize: metrics.bodyFontSize * 0.95,
              color: '#44403C',
              marginBottom: 2,
              fontFamily: 'Helvetica',
            }}
          >
            {signoff},
          </Text>
          <Text
            style={{
              fontSize: 26,
              fontFamily: 'Sacramento',
              color: '#784508',
              transform: 'rotate(-4deg)',
            }}
          >
            {signoffName}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCoverLetterPdfOnce(
  coverLetter: string,
  candidateData?: MasterResumeData,
  company?: string,
  jobTitle?: string,
): Promise<{ blob: Blob; pages: number }> {
  const instance = pdf(
    <CoverLetterPdfDocument
      coverLetter={coverLetter}
      candidateData={candidateData}
      company={company}
      jobTitle={jobTitle}
    />,
  );
  const blob = await instance.toBlob();
  return { blob, pages: 1 };
}

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
