/** @format */

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
import { resumeContactItems, resumeFullName } from './helpers';
import type { MasterResumeData } from './types';
import { CLBG_MAIN_PATH_D } from './cover-letter-contour';
import { SACRAMENTO_FONT_DATA_URI } from './cover-letter-font';

// Register commercial-use free handwriting font (SIL Open Font License 1.1)
Font.register({
  family: 'Sacramento',
  src: SACRAMENTO_FONT_DATA_URI,
});

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

export function computeLayoutMetrics(text: string): CoverLetterMetrics {
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

export function parseCoverLetterContent(
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
