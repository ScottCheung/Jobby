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
  Defs,
  Document,
  LinearGradient,
  Link,
  Page,
  Path,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';
import { Button } from '../Button';
import { defaultResumeTemplate } from './registry';
import { ResumeHtmlDocument } from './resume-html-document';
import { scaleResumeTemplate } from './scale';
import { formatResumeFilename, resumeContactItems } from './helpers';
import {
  createResumeHighlightRules,
  tokenizeResumeText,
  type ResumeHighlightRules,
} from './highlights';
import { useSmartOnePage } from './use-smart-one-page';
import type {
  MasterResumeData,
  ResumeSectionKey,
  ResumeTemplateConfig,
} from './types';

export type ResumePdfPreviewProps = {
  data: MasterResumeData;
  filename?: string;
  coreCompetencies?: string[];
  keyQualifications?: string[];
  company?: string;
  jobTitle?: string;
  showSectionHeader?: boolean;
  onOpenModal?: (content: ReactNode) => void;
  onPreview?: () => void;
  onNewWindow?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
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
      lineHeight: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contactLink: {
      color: template.colors.muted,
      textDecoration: 'none',
      fontSize: template.typography.contactSize,
      lineHeight: 1,
    },
    contactText: {
      color: template.colors.muted,
      fontSize: template.typography.contactSize,
      lineHeight: 1,
    },
    contactDivider: {
      marginHorizontal: 4,
      color: template.colors.rule,
      fontSize: template.typography.contactSize,
      lineHeight: 1,
    },
    section: { marginTop: template.spacing.sectionGap },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: template.spacing.sectionRuleWidth,
      borderBottomColor: template.colors.rule,
      paddingBottom: template.spacing.sectionTitlePadding,
    },
    sectionTitleBlock: {
      width: 7.5,
      height: 7.5,
      marginRight: 5,
      borderRadius: 1.8,
      overflow: 'hidden',
    },
    sectionTitle: {
      fontFamily: 'Helvetica-Bold',
      fontSize: template.typography.sectionTitleSize,
      lineHeight: 1,
      textTransform: 'uppercase',
      color: '#784508',
      letterSpacing: 1.2,
    },
    skillPillContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    skillPill: {
      backgroundColor: '#FAF5EC',
      borderWidth: 0.6,
      borderColor: '#DEC8A0',
      borderRadius: 3.5,
      paddingHorizontal: 7,
      paddingTop: 2,
      paddingBottom: 2.5,
      marginRight: 6,
      marginBottom: 5,
    },
    skillPillText: {
      fontSize: template.typography.metaSize,
      color: '#784508',
      fontFamily: 'Helvetica-Bold',
      lineHeight: 1,
    },
    entry: { marginTop: template.spacing.entryGap },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: template.spacing.rowGap,
    },
    entryTitle: {
      flexGrow: 1,
      fontSize: template.typography.bodySize,
    },
    companyTitle: {
      fontFamily: 'Helvetica-Bold',
      color: template.colors.ink,
    },
    titleSeparator: {
      fontFamily: 'Helvetica',
      color: template.colors.muted,
    },
    jobTitle: {
      fontFamily: 'Helvetica',
      color: template.colors.primary || '#8A6220',
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
    bullet: {
      flexDirection: 'row',
      marginTop: template.spacing.bulletGap,
      paddingLeft: template.spacing.bulletIndent ?? 10,
    },
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
      color: template.colors.ink,
    },
    highlightMetric: {
      fontFamily: 'Helvetica-Bold',
      color: template.colors.ink,
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
  items?: string[] | null;
  styles: PdfStyles;
  rules: ResumeHighlightRules;
}) {
  return (
    <>
      {(items ?? []).filter(Boolean).map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletMark}>•</Text>
          <PdfHighlightedText
            value={item!}
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
  technologies?: string[] | null;
  styles: PdfStyles;
  template: ResumeTemplateConfig;
}) {
  if (!technologies?.length) return null;
  return (
    <Text style={styles.technologies} wrap={false}>
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
      <View style={styles.sectionTitleRow} wrap={false} minPresenceAhead={40}>
        <Svg
          width={7.5}
          height={7.5}
          viewBox='0 0 24 24'
          style={styles.sectionTitleBlock}
        >
          <Defs>
            <LinearGradient id='goldLightGradPdf' x1='0' y1='0' x2='1' y2='1'>
              <Stop offset='0%' stopColor='#F5CB72' />
              <Stop offset='100%' stopColor='#DE992E' />
            </LinearGradient>
            <LinearGradient id='goldDarkGradPdf' x1='0' y1='0' x2='1' y2='1'>
              <Stop offset='0%' stopColor='#BA751A' />
              <Stop offset='100%' stopColor='#8A510A' />
            </LinearGradient>
          </Defs>
          <Rect width={24} height={24} rx={4.5} fill='url(#goldLightGradPdf)' />
          <Path d='M 0,0 L 24,24 L 0,24 Z' fill='url(#goldDarkGradPdf)' />
        </Svg>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
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
    case 'summary': {
      const effectiveCompetencies =
        coreCompetencies.length ? coreCompetencies
        : keyQualifications.length ? keyQualifications
        : (((data as any).core_competencies?.length ?
            (data as any).core_competencies
          : (data as any).key_qualifications) ?? []);
      return data.summary || effectiveCompetencies.length ?
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
            {effectiveCompetencies.length ?
              <PdfSection title='Core Competencies' styles={styles}>
                <View
                  style={[
                    styles.skillPillContainer,
                    { marginTop: template.spacing.contentInset },
                  ]}
                >
                  {effectiveCompetencies.map((item: string, idx: number) => (
                    <View key={idx} style={styles.skillPill} wrap={false}>
                      <Text style={styles.skillPillText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </PdfSection>
            : null}
          </>
        : null;
    }
    case 'experience':
      return data.experience?.length ?
          <PdfSection title={template.sectionLabels.experience} styles={styles}>
            {data.experience.map((item, index) => (
              <View key={`${item.company}-${index}`} style={styles.entry}>
                <View wrap={false} minPresenceAhead={32}>
                  <View style={styles.row}>
                    <Text style={styles.entryTitle}>
                      {item.company ?
                        <Text style={styles.companyTitle}>{item.company}</Text>
                      : null}
                      {item.company && item.title ?
                        <Text style={styles.titleSeparator}>
                          {template.separators.inline}
                        </Text>
                      : null}
                      {item.title ?
                        <Text style={styles.jobTitle}>{item.title}</Text>
                      : null}
                    </Text>
                    <Text style={styles.date}>
                      {dateRange(item.start_date, item.end_date)}
                    </Text>
                  </View>
                  {item.location && (
                    <Text style={styles.detail}>{item.location}</Text>
                  )}
                </View>
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
            {data.education.map((item, index) => {
              const hasDegreeInfo = Boolean(item.degree || item.field_of_study);
              const subInfo =
                hasDegreeInfo ?
                  [item.institution, item.location]
                    .filter(Boolean)
                    .join(template.separators.inline)
                : item.location;

              return (
                <View key={`${item.institution}-${index}`} style={styles.entry}>
                  <View wrap={false} minPresenceAhead={32}>
                    <View style={styles.row}>
                      <Text style={styles.entryTitle}>
                        {item.degree ?
                          <Text style={styles.companyTitle}>{item.degree}</Text>
                        : null}
                        {item.degree && item.field_of_study ?
                          <Text style={styles.titleSeparator}>
                            {template.separators.inline}
                          </Text>
                        : null}
                        {item.field_of_study ?
                          <Text style={styles.jobTitle}>
                            {item.field_of_study}
                          </Text>
                        : null}
                        {!hasDegreeInfo && item.institution ?
                          <Text style={styles.companyTitle}>
                            {item.institution}
                          </Text>
                        : null}
                      </Text>
                      <Text style={styles.date}>
                        {dateRange(item.start_date, item.end_date)}
                      </Text>
                    </View>
                    {subInfo ?
                      <Text style={styles.detail}>{subInfo}</Text>
                    : null}
                  </View>
                  <PdfBullets
                    items={item.highlights}
                    styles={styles}
                    rules={rules}
                  />
                </View>
              );
            })}
          </PdfSection>
        : null;
    case 'projects':
      return data.projects?.length ?
          <PdfSection title={template.sectionLabels.projects} styles={styles}>
            {data.projects.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.entry}>
                <View wrap={false} minPresenceAhead={32}>
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
                </View>
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
              <View
                key={`${group.type}-${index}`}
                style={styles.skillGroup}
                wrap={false}
              >
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
                  wrap={false}
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
              wrap={false}
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
            {data.other.map((item, index) => {
              const itemLocation = (item as any).location;
              return (
                <View key={`${item.title}-${index}`} style={styles.entry}>
                  <View wrap={false} minPresenceAhead={32}>
                    <Text style={styles.entryTitle}>
                      {[item.title, item.organization]
                        .filter(Boolean)
                        .join(template.separators.inline) ||
                        item.type ||
                        template.sectionLabels.other}
                    </Text>
                    {(itemLocation || item.date) && (
                      <Text style={styles.detail}>
                        {[itemLocation, item.date]
                          .filter(Boolean)
                          .join(template.separators.inline)}
                      </Text>
                    )}
                  </View>
                  <PdfBullets
                    items={item.description}
                    styles={styles}
                    rules={rules}
                  />
                </View>
              );
            })}
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
        <Svg viewBox='0 0 24 24' style={svgStyle}>
          <Path
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6'
          />
        </Svg>
      );
    case 'phone':
      return (
        <Svg viewBox='0 0 24 24' style={svgStyle}>
          <Path
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'
          />
        </Svg>
      );
    case 'location':
      return (
        <Svg viewBox='0 0 24 24' style={svgStyle}>
          <Path
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
          />
        </Svg>
      );
    case 'linkedin':
      return (
        <Svg viewBox='0 0 24 24' style={svgStyle}>
          <Path
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
          />
        </Svg>
      );
    case 'portfolio':
      return (
        <Svg viewBox='0 0 24 24' style={svgStyle}>
          <Path
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'
          />
        </Svg>
      );
    case 'website':
      return (
        <Svg viewBox='0 0 24 24' style={svgStyle}>
          <Path
            fill='none'
            stroke={color}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z M2 12h20'
          />
        </Svg>
      );
    default:
      return null;
  }
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
  const contactItems = resumeContactItems(data);

  return (
    <Document
      title={fullName(data)}
      author={fullName(data)}
      creator='Jobby'
      producer='Jobby'
    >
      <Page size={template.paper.format} style={styles.page}>
        <View style={styles.header} wrap={false}>
          <Text style={styles.name}>{fullName(data)}</Text>
          {basics.headline && (
            <Text style={styles.headline}>{basics.headline}</Text>
          )}
          {contactItems.length > 0 && (
            <View style={styles.contact}>
              {contactItems.map((item, index) => (
                <View key={index} style={styles.contactItem}>
                  {index > 0 && <Text style={styles.contactDivider}>|</Text>}
                  <PdfContactIcon
                    type={item.type}
                    color={template.colors.primary || '#8A6220'}
                  />
                  {item.href ?
                    <Link src={item.href} style={styles.contactLink}>
                      {item.text}
                    </Link>
                  : <Text style={styles.contactText}>{item.text}</Text>}
                </View>
              ))}
            </View>
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

export async function renderResumePdfOnce(
  data: MasterResumeData,
  scale: number,
  coreCompetencies: string[] = [],
  keyQualifications: string[] = [],
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

export function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ResumePdfPreview({
  data,
  filename,
  coreCompetencies = [],
  keyQualifications = [],
  company,
  jobTitle,
  showSectionHeader = false,
  onOpenModal,
  onPreview,
  onNewWindow,
  onEdit,
  onDownload,
}: ResumePdfPreviewProps) {
  const activeUrlRef = useRef<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState<number | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const smartPage = useSmartOnePage(defaultResumeTemplate, data);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pageWidth = smartPage.config.paper.widthPx || 816;
  const pageHeight = smartPage.config.paper.heightPx || 1056;

  const thumbnailScale = useMemo(() => {
    if (!containerSize.width || !containerSize.height) {
      return 0.165;
    }
    const availableWidth = Math.max(80, containerSize.width - 24);
    const availableHeight = Math.max(80, containerSize.height - 20);
    return Math.min(availableWidth / pageWidth, availableHeight / pageHeight);
  }, [containerSize.width, containerSize.height, pageWidth, pageHeight]);

  const resolvedFilename =
    filename || formatResumeFilename(data, company, jobTitle);
  const downloadName = `${resolvedFilename.replace(/\.pdf$/i, '') || 'resume'}.pdf`;
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
      onOpenModal(
        <div className='flex h-full flex-col bg-background'>
          <header className='flex shrink-0 items-center justify-between border-b border-primary/60 px-6 py-3.5 bg-panel/80 backdrop-blur-md'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <FileText className='h-4.5 w-4.5' />
              </div>
              <div className='min-w-0'>
                <p className='label font-semibold text-ink-primary truncate'>
                  {downloadName}
                </p>
                <div className='flex items-center gap-2 text-xs text-ink-secondary mt-0.5 truncate'>
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
              <Button
                variant='secondary'
                size='sm'
                Icon={Download}
                onClick={download}
                disabled={!pdfUrl || isGenerating}
              >
                {isGenerating ? 'Compiling PDF...' : 'Download PDF'}
              </Button>
            </div>
          </header>

          {isDesktopApp() ?
            <div className='flex-1 overflow-y-auto bg-background-secondary/80 p-8 flex justify-center'>
              <div className='shadow-2xl rounded-sm overflow-hidden bg-panel max-w-[816px] w-full h-fit'>
                <ResumeHtmlDocument
                  config={smartPage.config}
                  data={data}
                  coreCompetencies={coreCompetencies}
                  keyQualifications={keyQualifications}
                />
              </div>
            </div>
          : pdfUrl ?
            <iframe
              title='Resume PDF preview'
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
    }
  };

  return (
    <div className='flex flex-col gap-2 w-full min-w-0'>
      {showSectionHeader && (
        <div className='flex items-center justify-between border-b border-primary/40 pb-3'>
          <div>
            <h3 className='text-sm font-bold text-ink-primary'>
              Resume Preview
            </h3>
          </div>
        </div>
      )}

      {/* Hidden offscreen reference for smart one-page measurements */}
      <div
        aria-hidden='true'
        className='pointer-events-none fixed left-[-10000px] top-0 opacity-0'
      >
        <ResumeHtmlDocument
          config={smartPage.config}
          data={data}
          coreCompetencies={coreCompetencies}
          keyQualifications={keyQualifications}
          pageRef={smartPage.pageRef}
        />
      </div>

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
              <ResumeHtmlDocument
                config={smartPage.config}
                data={data}
                coreCompetencies={coreCompetencies}
                keyQualifications={keyQualifications}
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
          <div className='absolute right-2 top-2 rounded-full bg-white/90 dark:bg-slate-900/90 p-1 text-ink-secondary shadow-sm'>
            <Loader2 className='size-2.5 animate-spin text-primary' />
          </div>
        )}

        {/* Hover overlay */}
        <div className='absolute inset-0 z-20 flex items-center justify-center gap-1.5 bg-slate-950/20 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-xs'>
          <button
            type='button'
            title='In-Page Preview'
            aria-label='Preview resume PDF'
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
              aria-label='Edit resume'
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
            aria-label='Download resume PDF'
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
            {pages ?? 1} page{pages === 1 ? '' : 's'}
            {fileSize ? ` · ${formatBytes(fileSize)}` : ''}
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
                    <div className='flex items-center gap-2'>
                      <p className='label font-semibold text-ink-primary truncate'>
                        {downloadName}
                      </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-1 text-[10px] text-ink-secondary '>
                      <span>
                        {pages ?? 1} page{pages === 1 ? '' : 's'}
                      </span>
                      {fileSize ?
                        <>
                          <span className='opacity-40'>•</span>
                          <span>{formatBytes(fileSize)}</span>
                        </>
                      : null}
                      {generatedAt ?
                        <>
                          <span className='opacity-40'>•</span>
                          <span>{formatTime(generatedAt)} Generated</span>
                        </>
                      : null}
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  <Button
                    // variant='primary'
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
              {isDesktopApp() ?
                <div className='flex-1 overflow-y-auto bg-background-secondary/80 p-8 flex justify-center'>
                  <div className='shadow-2xl rounded-sm overflow-hidden bg-panel max-w-[816px] w-full h-fit'>
                    <ResumeHtmlDocument
                      config={smartPage.config}
                      data={data}
                      coreCompetencies={coreCompetencies}
                      keyQualifications={keyQualifications}
                    />
                  </div>
                </div>
              : pdfUrl ?
                <iframe
                  title='Resume PDF preview'
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
