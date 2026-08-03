export const resumeSectionKeys = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "languages",
  "other",
] as const;

export type ResumeSectionKey = (typeof resumeSectionKeys)[number];

export type ResumeTemplateConfig = {
  id: string;
  name: string;
  paper: {
    format: "LETTER" | "A4";
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
