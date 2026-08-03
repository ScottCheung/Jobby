/** @format */

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';
import type { MasterResumeData } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { defaultResumeTemplate } from '@/app/Resume/Template/templates/registry';
import { ResumeHtmlDocument } from '@/app/Resume/Template/[templateId]/_components/resume-html-document';
import { scaleResumeTemplate } from '@/app/Resume/Template/templates/scale';
import {
  createResumeHighlightRules,
  tokenizeResumeText,
  type ResumeHighlightRules,
} from '@/app/Resume/Template/templates/highlights';
import { useSmartOnePage } from '@/app/Resume/Template/templates/use-smart-one-page';
import type {
  ResumeSectionKey,
  ResumeTemplateConfig,
} from '@/app/Resume/Template/templates/types';

type ResumePdfPreviewProps = {
  data: MasterResumeData;
  filename: string;
  coreCompetencies?: string[];
  keyQualifications?: string[];
};

function createPdfStyles(template: ResumeTemplateConfig) {
  return StyleSheet.create({
    page: {
      paddingTop: template.paper.paddingTop,
      paddingRight: template.paper.paddingRight,
      paddingBottom: template.paper.paddingBottom,
      paddingLeft: template.paper.paddingLeft,
      color: template.colors.ink,
      fontFamily: template.typography.pdfFontFamily,
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight,
    },
    header: {
      borderBottomWidth: template.spacing.headerRuleWidth,
      borderBottomColor: template.colors.headerRule,
      paddingBottom: template.spacing.headerPaddingBottom,
    },
    name: {
      fontSize: template.typography.nameSize,
      fontFamily: 'Helvetica-Bold',
      lineHeight: 1.1,
    },
    headline: {
      marginTop: template.spacing.headlineGap,
      color: template.colors.muted,
      fontSize: template.typography.headlineSize,
    },
    contact: {
      marginTop: template.spacing.contactGap,
      color: template.colors.muted,
      fontSize: template.typography.contactSize,
    },
    section: { marginTop: template.spacing.sectionGap },
    sectionTitle: {
      borderBottomWidth: template.spacing.sectionRuleWidth,
      borderBottomColor: template.colors.rule,
      paddingBottom: template.spacing.sectionTitlePadding,
      fontFamily: 'Helvetica-Bold',
      fontSize: template.typography.sectionTitleSize,
      textTransform: 'uppercase',
    },
    entry: { marginTop: template.spacing.entryGap },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: template.spacing.rowGap,
    },
    entryTitle: {
      flexGrow: 1,
      fontFamily: 'Helvetica-Bold',
      fontSize: template.typography.bodySize,
    },
    date: {
      color: template.colors.muted,
      fontSize: template.typography.dateSize,
      flexShrink: 0,
    },
    detail: {
      marginTop: template.spacing.detailGap,
      color: template.colors.muted,
      fontSize: template.typography.dateSize,
    },
    url: {
      marginTop: template.spacing.bulletGap,
      color: template.colors.muted,
      fontSize: template.typography.urlSize,
      textDecoration: 'underline',
    },
    bullet: { flexDirection: 'row', marginTop: template.spacing.bulletGap },
    bulletMark: {
      width: template.spacing.bulletMarkWidth,
      fontSize: template.typography.sectionTitleSize,
    },
    bodyText: {
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight,
      color: template.colors.body,
    },
    bulletText: {
      flex: 1,
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight,
      color: template.colors.body,
    },
    technologies: {
      marginTop: template.spacing.technologyGap,
      color: template.colors.muted,
      fontSize: template.typography.metaSize,
    },
    technologiesLabel: {
      fontFamily: 'Helvetica-Bold',
      color: template.colors.body,
    },
    highlightSkill: {
      fontFamily: 'Helvetica-Bold',
      color: template.colors.skill,
    },
    highlightMetric: {
      fontFamily: 'Helvetica-Bold',
      color: template.colors.metric,
    },
    skillGroup: {
      flexDirection: 'row',
      marginTop: template.spacing.skillGap,
    },
    skillLabel: {
      width: template.spacing.skillLabelWidth,
      flexShrink: 0,
      fontFamily: 'Helvetica-Bold',
      fontSize: template.typography.dateSize,
      color: template.colors.ink,
    },
    skillValues: {
      flex: 1,
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight,
      color: template.colors.body,
    },
    footer: {
      position: 'absolute',
      bottom: template.spacing.footerBottom,
      left: template.spacing.footerInset,
      right: template.spacing.footerInset,
      textAlign: 'right',
      color: template.colors.subtle,
      fontSize: template.typography.footerSize,
    },
  });
}

type PdfStyles = ReturnType<typeof createPdfStyles>;

function fullName(data: MasterResumeData) {
  const basics = data.basics ?? {};
  return (
    [basics.first_name, basics.middle_name, basics.last_name]
      .filter(Boolean)
      .join(' ') || 'Resume'
  );
}

function dateRange(start?: string | null, end?: string | null) {
  return [start, end].filter(Boolean).join(' - ');
}

function PdfHighlightedText({
  value,
  rules,
  style,
  styles,
}: {
  value: string;
  rules: ResumeHighlightRules;
  style: any;
  styles: PdfStyles;
}) {
  return (
    <Text style={style}>
      {tokenizeResumeText(value, rules).map((token, index) =>
        token.kind === 'plain' ?
          token.value
        : <Text
            key={`${token.value}-${index}`}
            style={
              token.kind === 'skill' ?
                styles.highlightSkill
              : styles.highlightMetric
            }
          >
            {token.value}
          </Text>,
      )}
    </Text>
  );
}

function PdfBullets({
  items,
  styles,
  rules,
}: {
  items?: string[];
  styles: PdfStyles;
  rules: ResumeHighlightRules;
}) {
  return (
    <>
      {(items ?? []).filter(Boolean).map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bullet}>
          <Text style={styles.bulletMark}>-</Text>
          <PdfHighlightedText
            value={item}
            rules={rules}
            style={styles.bulletText}
            styles={styles}
          />
        </View>
      ))}
    </>
  );
}

function PdfTechnologies({
  technologies,
  styles,
  template,
}: {
  technologies?: string[];
  styles: PdfStyles;
  template: ResumeTemplateConfig;
}) {
  if (!technologies?.length) return null;
  return (
    <Text style={styles.technologies}>
      <Text style={styles.technologiesLabel}>Technologies: </Text>
      {technologies.join(template.separators.technologies)}
    </Text>
  );
}

function PdfSection({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: PdfStyles;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PdfResumeSection({
  section,
  data,
  coreCompetencies,
  keyQualifications,
  styles,
  template,
  rules,
}: {
  section: ResumeSectionKey;
  data: MasterResumeData;
  coreCompetencies: string[];
  keyQualifications: string[];
  styles: PdfStyles;
  template: ResumeTemplateConfig;
  rules: ResumeHighlightRules;
}) {
  switch (section) {
    case 'summary':
      return (
          data.summary || coreCompetencies.length || keyQualifications.length
        ) ?
          <>
            {data.summary ?
              <PdfSection
                title={template.sectionLabels.summary}
                styles={styles}
              >
                <PdfHighlightedText
                  value={data.summary}
                  rules={rules}
                  style={[
                    styles.bodyText,
                    { marginTop: template.spacing.contentInset },
                  ]}
                  styles={styles}
                />
              </PdfSection>
            : null}
            {coreCompetencies.length || keyQualifications.length ?
              <PdfSection title='Core Competencies' styles={styles}>
                <Text
                  style={[
                    styles.bodyText,
                    { marginTop: template.spacing.contentInset },
                  ]}
                >
                  {(coreCompetencies.length ? coreCompetencies : (
                    keyQualifications
                  )
                  ).join(template.separators.inline)}
                </Text>
              </PdfSection>
            : null}
          </>
        : null;
    case 'experience':
      return data.experience?.length ?
          <PdfSection title={template.sectionLabels.experience} styles={styles}>
            {data.experience.map((item, index) => (
              <View
                key={`${item.company}-${index}`}
                style={styles.entry}
                wrap={false}
              >
                <View style={styles.row}>
                  <Text style={styles.entryTitle}>
                    {[item.title, item.company]
                      .filter(Boolean)
                      .join(template.separators.inline)}
                  </Text>
                  <Text style={styles.date}>
                    {dateRange(item.start_date, item.end_date)}
                  </Text>
                </View>
                {item.location && (
                  <Text style={styles.detail}>{item.location}</Text>
                )}
                <PdfBullets
                  items={item.description}
                  styles={styles}
                  rules={rules}
                />
                <PdfTechnologies
                  technologies={item.technologies}
                  styles={styles}
                  template={template}
                />
              </View>
            ))}
          </PdfSection>
        : null;
    case 'education':
      return data.education?.length ?
          <PdfSection title={template.sectionLabels.education} styles={styles}>
            {data.education.map((item, index) => (
              <View
                key={`${item.institution}-${index}`}
                style={styles.entry}
                wrap={false}
              >
                <Text style={styles.entryTitle}>
                  {[item.degree, item.field_of_study]
                    .filter(Boolean)
                    .join(template.separators.inline)}
                </Text>
                <Text style={styles.detail}>
                  {[
                    item.institution,
                    item.location,
                    dateRange(item.start_date, item.end_date),
                  ]
                    .filter(Boolean)
                    .join(template.separators.inline)}
                </Text>
                <PdfBullets
                  items={item.highlights}
                  styles={styles}
                  rules={rules}
                />
              </View>
            ))}
          </PdfSection>
        : null;
    case 'projects':
      return data.projects?.length ?
          <PdfSection title={template.sectionLabels.projects} styles={styles}>
            {data.projects.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                style={styles.entry}
                wrap={false}
              >
                <View style={styles.row}>
                  <Text style={styles.entryTitle}>{item.name}</Text>
                  <Text style={styles.date}>
                    {dateRange(item.start_date, item.end_date)}
                  </Text>
                </View>
                {item.url && (
                  <Link src={item.url} style={styles.url}>
                    {item.url}
                  </Link>
                )}
                <PdfBullets
                  items={item.description}
                  styles={styles}
                  rules={rules}
                />
                <PdfTechnologies
                  technologies={item.technologies}
                  styles={styles}
                  template={template}
                />
              </View>
            ))}
          </PdfSection>
        : null;
    case 'skills':
      return data.skills?.length ?
          <PdfSection title={template.sectionLabels.skills} styles={styles}>
            {data.skills.map((group, index) => (
              <View key={`${group.type}-${index}`} style={styles.skillGroup}>
                {group.type && (
                  <Text style={styles.skillLabel}>{group.type}</Text>
                )}
                <Text style={styles.skillValues}>
                  {(group.skills ?? []).join(template.separators.inline)}
                </Text>
              </View>
            ))}
          </PdfSection>
        : null;
    case 'certifications':
      return data.certifications?.length ?
          <PdfSection
            title={template.sectionLabels.certifications}
            styles={styles}
          >
            {data.certifications
              .flatMap((group) => group.certifications ?? [])
              .map((item, index) => (
                <Text
                  key={`${item.name}-${index}`}
                  style={[
                    styles.bodyText,
                    { marginTop: template.spacing.skillGap },
                  ]}
                >
                  {[
                    item.name,
                    item.issuer,
                    dateRange(item.issue_date, item.expiry_date),
                  ]
                    .filter(Boolean)
                    .join(template.separators.inline)}
                </Text>
              ))}
          </PdfSection>
        : null;
    case 'languages':
      return data.languages?.length ?
          <PdfSection title={template.sectionLabels.languages} styles={styles}>
            <Text
              style={[
                styles.bodyText,
                { marginTop: template.spacing.skillGap },
              ]}
            >
              {data.languages
                .map((item) =>
                  [item.name, item.proficiency].filter(Boolean).join(' - '),
                )
                .join(template.separators.inline)}
            </Text>
          </PdfSection>
        : null;
    case 'other':
      return data.other?.length ?
          <PdfSection title={template.sectionLabels.other} styles={styles}>
            {data.other.map((item, index) => (
              <View
                key={`${item.title}-${index}`}
                style={styles.entry}
                wrap={false}
              >
                <Text style={styles.entryTitle}>
                  {[item.title, item.organization]
                    .filter(Boolean)
                    .join(template.separators.inline) ||
                    item.type ||
                    template.sectionLabels.other}
                </Text>
                {(item.location || item.date) && (
                  <Text style={styles.detail}>
                    {[item.location, item.date]
                      .filter(Boolean)
                      .join(template.separators.inline)}
                  </Text>
                )}
                <PdfBullets
                  items={item.description}
                  styles={styles}
                  rules={rules}
                />
              </View>
            ))}
          </PdfSection>
        : null;
  }
}

function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  const ua = navigator.userAgent || '';
  return Boolean(
    win.electron ||
    win.electronAPI ||
    win.ipcRenderer ||
    win.__TAURI__ ||
    /Electron|Tauri|Jobby|Desktop/i.test(ua),
  );
}

function ResumePdfDocument({
  data,
  template,
  coreCompetencies,
  keyQualifications,
}: {
  data: MasterResumeData;
  template: ResumeTemplateConfig;
  coreCompetencies: string[];
  keyQualifications: string[];
}) {
  const styles = createPdfStyles(template);
  const highlightRules = createResumeHighlightRules(data);
  const basics = data.basics ?? {};
  const links = [
    basics.email,
    basics.phone,
    basics.location?.city,
    basics.location?.state,
    basics.location?.country,
    basics.linkedin_id,
    basics.website,
    basics.portfolio_url,
  ].filter(Boolean);

  return (
    <Document
      title={fullName(data)}
      author={fullName(data)}
      creator='Jobby'
      producer='Jobby'
    >
      <Page size={template.paper.format} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{fullName(data)}</Text>
          {basics.headline && (
            <Text style={styles.headline}>{basics.headline}</Text>
          )}
          {links.length > 0 && (
            <Text style={styles.contact}>
              {links.join(template.separators.contact)}
            </Text>
          )}
        </View>

        {template.sectionOrder.map((section) => (
          <PdfResumeSection
            key={section}
            section={section}
            data={data}
            coreCompetencies={coreCompetencies}
            keyQualifications={keyQualifications}
            styles={styles}
            template={template}
            rules={highlightRules}
          />
        ))}

        {template.showPageNumbers && (
          <Text
            fixed
            style={styles.footer}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        )}
      </Page>
    </Document>
  );
}

async function pageCountFromPdf(blob: Blob) {
  const source = new TextDecoder().decode(await blob.arrayBuffer());
  return Math.max(1, (source.match(/\/Type\s*\/Page\b/g) ?? []).length);
}

async function renderResumePdf(
  data: MasterResumeData,
  template: ResumeTemplateConfig,
  coreCompetencies: string[],
  keyQualifications: string[],
) {
  const blob = await pdf(
    <ResumePdfDocument
      data={data}
      template={template}
      coreCompetencies={coreCompetencies}
      keyQualifications={keyQualifications}
    />,
  ).toBlob();
  return { blob, pages: await pageCountFromPdf(blob) };
}

async function renderResumePdfOnce(
  data: MasterResumeData,
  scale: number,
  coreCompetencies: string[],
  keyQualifications: string[],
) {
  const template = scaleResumeTemplate(defaultResumeTemplate, scale);
  const { blob, pages } = await renderResumePdf(
    data,
    template,
    coreCompetencies,
    keyQualifications,
  );
  return { blob, pages, scale };
}

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ResumePdfPreview({
  data,
  filename,
  coreCompetencies = [],
  keyQualifications = [],
}: ResumePdfPreviewProps) {
  const domId = useId().replace(/:/g, '');
  const activeUrlRef = useRef<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState<number | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const smartPage = useSmartOnePage(defaultResumeTemplate, data);
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);
  const layoutId = `resume-pdf-${domId}`;
  const downloadName = `${filename.replace(/\.pdf$/i, '') || 'resume'}.pdf`;
  const qualificationSignature = [
    ...coreCompetencies,
    ...keyQualifications,
  ].join('|');

  useEffect(() => {
    if (!smartPage.settled) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsGenerating(true);
      setError('');

      void renderResumePdfOnce(
        data,
        smartPage.scale,
        coreCompetencies,
        keyQualifications,
      )
        .then(({ blob, pages: pageCount, scale }) => {
          const nextUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(nextUrl);
            return;
          }
          if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
          activeUrlRef.current = nextUrl;
          setPdfUrl(nextUrl);
          setPages(pageCount);
          setFileSize(blob.size);
          setPdfScale(scale);
          setGeneratedAt(new Date());
          setIsGenerating(false);
        })
        .catch(() => {
          if (cancelled) return;
          setError('Could not generate this resume PDF.');
          setIsGenerating(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data, qualificationSignature, smartPage.scale, smartPage.settled]);

  useEffect(
    () => () => {
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    },
    [],
  );

  const download = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = downloadName;
    link.click();
  };

  const openPreview = () => {
    const isDesktop = isDesktopApp();
    openModal({
      layoutId,
      className:
        '!p-0 p-0 md:p-0 h-[90vh] w-[85vw] max-w-6xl rounded-2xl overflow-hidden shadow-2xl border border-border/80 transform-gpu',
      content: (
        <div className='flex h-full flex-col bg-background'>
          <header className='flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-3.5 bg-panel/80 backdrop-blur-md'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <FileText className='h-4.5 w-4.5' />
              </div>
              <div className='min-w-0'>
                <div className='flex items-center gap-2'>
                  <p className='label font-semibold text-ink-primary truncate'>
                    {filename}
                  </p>
                </div>
                <div className='flex flex-wrap items-center gap-2 text-xs text-ink-secondary mt-0.5'>
                  <span>
                    {pages ?? 1} page{pages === 1 ? '' : 's'}
                  </span>
                  {fileSize ?
                    <>
                      <span className='opacity-40'>•</span>
                      <span>{formatBytes(fileSize)}</span>
                    </>
                  : null}
                  {pdfScale ?
                    <>
                      <span className='opacity-40'>•</span>
                      <span>Fit Scale: {Math.round(pdfScale * 100)}%</span>
                    </>
                  : null}
                  {generatedAt ?
                    <>
                      <span className='opacity-40'>•</span>
                      <span>Generated {formatTime(generatedAt)}</span>
                    </>
                  : null}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2 shrink-0'>
              <button
                type='button'
                aria-label='Open template workbench'
                title='Open template workbench'
                onClick={() =>
                  window.open(
                    `/Resume/Template/${defaultResumeTemplate.id}`,
                    '_blank',
                  )
                }
                className='flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-ink-secondary hover:bg-background-secondary transition cursor-pointer'
              >
                <ExternalLink className='h-4 w-4' />
              </button>
              <Button
                variant='secondary'
                size='sm'
                Icon={Download}
                onClick={download}
                disabled={!pdfUrl}
              >
                {isGenerating ? 'Compiling PDF...' : 'Download PDF'}
              </Button>
              <button
                type='button'
                aria-label='Close preview'
                onClick={closeModal}
                className='flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-background-secondary transition cursor-pointer'
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          </header>

          {isDesktop ?
            <div className='flex-1 overflow-y-auto bg-zinc-800/90 p-8 flex justify-center'>
              <div className='shadow-2xl rounded-sm overflow-hidden bg-white max-w-[816px] w-full h-fit'>
                <ResumeHtmlDocument config={smartPage.config} data={data} />
              </div>
            </div>
          : pdfUrl ?
            <iframe
              title='Resume PDF preview'
              src={pdfUrl}
              className='h-full w-full border-0 bg-zinc-100 transform-gpu'
            />
          : <div className='flex h-full flex-col items-center justify-center gap-2 text-ink-secondary'>
              <Loader2 className='h-6 w-6 animate-spin text-primary' />
              <p className='text-xs font-medium'>Loading PDF engine...</p>
            </div>
          }
        </div>
      ),
      onClose: closeModal,
    });
  };

  return (
    <>
      <div
        aria-hidden='true'
        className='pointer-events-none fixed left-[-10000px] top-0 opacity-0'
      >
        <ResumeHtmlDocument
          config={smartPage.config}
          data={data}
          pageRef={smartPage.pageRef}
        />
      </div>
      <motion.div
        layoutId={layoutId}
        onClick={openPreview}
        className='group relative aspect-[816/1056] max-h-40 w-full cursor-zoom-in overflow-hidden rounded-xl border border-border bg-[#242424] transform-gpu'
      >
        <div className='pointer-events-none absolute inset-0 overflow-hidden bg-[#1f1f22] flex justify-center'>
          <div className='origin-top scale-[0.19] transform-gpu mt-1'>
            <ResumeHtmlDocument config={smartPage.config} data={data} />
          </div>
        </div>
        {error && (
          <p className='absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-xs text-red-600'>
            {error}
          </p>
        )}
        {isGenerating && (
          <div className='absolute right-2 top-2 rounded bg-white/90 p-1.5 text-ink-secondary shadow-sm'>
            <Loader2 className='size-3 animate-spin' />
          </div>
        )}
        <div className='absolute inset-0 flex items-center justify-center gap-2 bg-zinc-950/55 opacity-0 transition-opacity group-hover:opacity-100'>
          <button
            type='button'
            aria-label='Preview resume PDF'
            onClick={(event) => {
              event.stopPropagation();
              openPreview();
            }}
            className='flex h-9 w-9 items-center justify-center rounded-md bg-white text-zinc-900 hover:bg-zinc-100 cursor-pointer'
          >
            <Maximize2 className='h-4 w-4' />
          </button>
          <button
            type='button'
            aria-label='Download resume PDF'
            onClick={(event) => {
              event.stopPropagation();
              download();
            }}
            className='flex h-9 w-9 items-center justify-center rounded-md bg-white text-zinc-900 hover:bg-zinc-100 cursor-pointer disabled:opacity-50'
            disabled={!pdfUrl}
          >
            <Download className='h-4 w-4' />
          </button>
        </div>
        <div className='absolute bottom-2 left-2 flex items-center gap-1 rounded bg-zinc-950/75 px-2 py-1 text-[10px] text-white backdrop-blur-xs'>
          <FileText className='h-3 w-3' />
          {pages ?? 1} page{pages === 1 ? '' : 's'}
          {fileSize ? ` • ${formatBytes(fileSize)}` : ''}
        </div>
      </motion.div>
    </>
  );
}
