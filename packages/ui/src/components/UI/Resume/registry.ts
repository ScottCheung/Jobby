/** @format */

import type { ResumeTemplateConfig } from './types';

export const classicResumeTemplate: ResumeTemplateConfig = {
  id: '1',
  name: 'Classic',
  paper: {
    format: 'LETTER',
    widthPx: 816,
    heightPx: 1056,
    cssPixelsPerPoint: 1.333333,
    paddingTop: 28,
    paddingRight: 28,
    paddingBottom: 28,
    paddingLeft: 28,
  },
  typography: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    pdfFontFamily: 'Helvetica',
    bodySize: 9.5,
    bodyLineHeight: 1.42,
    nameSize: 22,
    headlineSize: 11,
    contactSize: 8,
    sectionTitleSize: 10.5,
    dateSize: 8.5,
    metaSize: 8,
    urlSize: 7.5,
    footerSize: 7,
  },
  colors: {
    ink: '#27272a',
    body: '#3f3f46',
    muted: '#52525b',
    subtle: '#71717a',
    skill: '#27272a',
    metric: '#27272a',
    rule: '#d4d4d8',
    headerRule: '#cdaa61',
    paper: '#ffffff',
    primary: '#8E5B15',
  },
  spacing: {
    headerPaddingBottom: 12,
    headerRuleWidth: 1.5,
    headlineGap: 3,
    contactGap: 7,
    sectionGap: 14,
    sectionTitlePadding: 3,
    sectionRuleWidth: 0.7,
    entryGap: 8,
    rowGap: 12,
    detailGap: 1,
    bulletGap: 2,
    bulletMarkWidth: 10,
    bulletIndent: 10,
    technologyGap: 3,
    skillGap: 5,
    contentInset: 7,
    skillLabelWidth: 66,
    footerBottom: 22,
    footerInset: 48,
  },
  sectionOrder: [
    'summary',
    'experience',
    'education',
    'projects',
    'skills',
    'certifications',
    'languages',
    'other',
  ],
  sectionLabels: {
    summary: 'Summary',
    experience: 'Experience',
    education: 'Education',
    projects: 'Projects',
    skills: 'Skills',
    certifications: 'Certifications',
    languages: 'Languages',
    other: 'Other',
  },
  separators: {
    contact: '  |  ',
    inline: ' | ',
    technologies: ' | ',
  },
  smartOnePage: {
    enabled: true,
    minFillRatio: 0.75,
    maxOverflowRatio: 1.25,
    targetFillRatio: 0.98,
    minScale: 0.78,
    maxScale: 1.3,
    tolerance: 0.005,
    maxIterations: 8,
  },
  showPageNumbers: true,
};

export const resumeTemplates = {
  '1': classicResumeTemplate,
} as const;

export const defaultResumeTemplate = resumeTemplates['1'];

export type ResumeTemplateId = keyof typeof resumeTemplates;

export function getResumeTemplate(templateId: string): ResumeTemplateConfig {
  return (
    resumeTemplates[templateId as ResumeTemplateId] || defaultResumeTemplate
  );
}
