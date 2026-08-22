/** @format */

export const resumeSectionKeys = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'certifications',
  'languages',
  'other',
] as const;

export type ResumeSectionKey = (typeof resumeSectionKeys)[number];

export type ResumeTemplateConfig = {
  id: string;
  name: string;
  paper: {
    format: 'LETTER' | 'A4';
    widthPx: number;
    heightPx: number;
    cssPixelsPerPoint: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
  };
  typography: {
    fontFamily: string;
    pdfFontFamily: string;
    bodySize: number;
    bodyLineHeight: number;
    nameSize: number;
    headlineSize: number;
    contactSize: number;
    sectionTitleSize: number;
    dateSize: number;
    metaSize: number;
    urlSize: number;
    footerSize: number;
  };
  colors: {
    ink: string;
    body: string;
    muted: string;
    subtle: string;
    skill: string;
    metric: string;
    rule: string;
    headerRule: string;
    paper: string;
    primary?: string;
  };
  spacing: {
    headerPaddingBottom: number;
    headerRuleWidth: number;
    headlineGap: number;
    contactGap: number;
    sectionGap: number;
    sectionTitlePadding: number;
    sectionRuleWidth: number;
    entryGap: number;
    rowGap: number;
    detailGap: number;
    bulletGap: number;
    bulletMarkWidth: number;
    bulletIndent?: number;
    technologyGap: number;
    skillGap: number;
    contentInset: number;
    skillLabelWidth: number;
    footerBottom: number;
    footerInset: number;
  };
  sectionOrder: ResumeSectionKey[];
  sectionLabels: Record<ResumeSectionKey, string>;
  separators: {
    contact: string;
    inline: string;
    technologies: string;
  };
  smartOnePage: {
    enabled: boolean;
    minFillRatio: number;
    maxOverflowRatio: number;
    targetFillRatio: number;
    minScale: number;
    maxScale: number;
    tolerance: number;
    maxIterations: number;
  };
  showPageNumbers: boolean;
};

export interface ResumeLocation {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
  postal_code?: string | null;
}

export interface ResumeBasics {
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: ResumeLocation | null;
  website?: string | null;
  linkedin_id?: string | null;
  portfolio_url?: string | null;
}

export interface ResumeExperienceItem {
  company?: string | null;
  title?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  description?: string[] | null;
  technologies?: string[] | null;
}

export interface ResumeEducationItem {
  institution?: string | null;
  degree?: string | null;
  field_of_study?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  highlights?: string[] | null;
}

export interface ResumeProjectItem {
  name?: string | null;
  description?: string[] | null;
  technologies?: string[] | null;
  url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ResumeSkillGroup {
  type?: string | null;
  skills?: string[] | null;
}

export interface ResumeCertificationItem {
  name?: string | null;
  issuer?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  url?: string | null;
  credential_url?: string | null;
}

export interface ResumeCertificationGroup {
  type?: string | null;
  certifications?: ResumeCertificationItem[] | null;
}

export interface ResumeLanguageItem {
  name?: string | null;
  proficiency?: string | null;
}

export interface ResumeOtherItem {
  type?: string | null;
  title?: string | null;
  organization?: string | null;
  date?: string | null;
  description?: string[] | null;
}

export interface MasterResumeData {
  basics?: ResumeBasics | null;
  summary?: string | null;
  core_competencies?: string[] | null;
  experience?: ResumeExperienceItem[] | null;
  education?: ResumeEducationItem[] | null;
  projects?: ResumeProjectItem[] | null;
  skills?: ResumeSkillGroup[] | null;
  certifications?: ResumeCertificationGroup[] | null;
  languages?: ResumeLanguageItem[] | null;
  other?: ResumeOtherItem[] | null;
  [key: string]: unknown;
}
