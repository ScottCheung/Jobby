/** @format */

import type { CSSProperties } from 'react';
import type { MasterResumeData, ResumeTemplateConfig } from './types';

export function resumeFullName(data: MasterResumeData) {
  const basics = data.basics ?? {};
  return (
    [basics.first_name, basics.middle_name, basics.last_name]
      .filter(Boolean)
      .join(' ') || 'Resume'
  );
}

export function resumeDateRange(start?: string | null, end?: string | null) {
  return [start, end].filter(Boolean).join(' - ');
}

export type ResumeContactItem = {
  type: 'email' | 'phone' | 'location' | 'linkedin' | 'portfolio' | 'website';
  text: string;
  href?: string;
};

export function resumeContactItems(data: MasterResumeData): ResumeContactItem[] {
  const basics = data.basics ?? {};
  const items: ResumeContactItem[] = [];

  if (basics.email) {
    items.push({
      type: 'email',
      text: basics.email,
      href: `mailto:${basics.email}`,
    });
  }
  if (basics.phone) {
    items.push({
      type: 'phone',
      text: basics.phone,
      href: `tel:${basics.phone.replace(/[^+\d]/g, '')}`,
    });
  }
  const locationStr = [
    basics.location?.city,
    basics.location?.state,
    basics.location?.country,
  ]
    .filter(Boolean)
    .join(', ');
  if (locationStr) {
    items.push({ type: 'location', text: locationStr });
  }

  if (basics.linkedin_id) {
    const handle = basics.linkedin_id
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
      .replace(/^\/+|\/+$/g, '');
    const href = handle
      ? `https://www.linkedin.com/in/${handle}/`
      : basics.linkedin_id.startsWith('http')
        ? basics.linkedin_id
        : `https://${basics.linkedin_id}`;
    const text =
      handle ||
      basics.linkedin_id.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    items.push({ type: 'linkedin', text, href });
  }

  if (basics.portfolio_url) {
    const href = basics.portfolio_url.startsWith('http')
      ? basics.portfolio_url
      : `https://${basics.portfolio_url}`;
    const cleanDisplay = basics.portfolio_url
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '');
    items.push({ type: 'portfolio', text: cleanDisplay, href });
  }

  if (basics.website) {
    const href = basics.website.startsWith('http')
      ? basics.website
      : `https://${basics.website}`;
    const cleanDisplay = basics.website
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '');
    items.push({ type: 'website', text: cleanDisplay, href });
  }

  return items;
}

export function formatResumeFilename(
  data?: MasterResumeData | null,
  company?: string | null,
  jobTitle?: string | null,
): string {
  const basics = data?.basics || {};
  const fullName =
    [basics.first_name, basics.middle_name, basics.last_name]
      .filter(Boolean)
      .join(' ') || 'Resume';

  const cleanName = fullName
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanCompany = (company || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanTitle = (jobTitle || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = [cleanName, 'CV', cleanCompany, cleanTitle].filter(Boolean);
  return `${parts.join('_')}.pdf`;
}

export function formatCoverLetterFilename(
  data?: MasterResumeData | null,
  company?: string | null,
  jobTitle?: string | null,
): string {
  const basics = data?.basics || {};
  const fullName =
    [basics.first_name, basics.middle_name, basics.last_name]
      .filter(Boolean)
      .join(' ') || 'Candidate';

  const cleanName = fullName
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanCompany = (company || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanTitle = (jobTitle || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = [cleanName, 'Cover_Letter', cleanCompany, cleanTitle].filter(
    Boolean,
  );
  return `${parts.join('_')}.pdf`;
}

export function templateCssVariables(config: ResumeTemplateConfig) {
  const px = (points: number) =>
    `${points * config.paper.cssPixelsPerPoint}px`;

  return {
    '--resume-font': config.typography.fontFamily,
    '--resume-body-size': px(config.typography.bodySize),
    '--resume-line-height': config.typography.bodyLineHeight,
    '--resume-name-size': px(config.typography.nameSize),
    '--resume-headline-size': px(config.typography.headlineSize),
    '--resume-contact-size': px(config.typography.contactSize),
    '--resume-section-title-size': px(config.typography.sectionTitleSize),
    '--resume-date-size': px(config.typography.dateSize),
    '--resume-meta-size': px(config.typography.metaSize),
    '--resume-url-size': px(config.typography.urlSize),
    '--resume-footer-size': px(config.typography.footerSize),
    '--resume-primary': config.colors.primary || '#8E5B15',
    '--resume-ink': config.colors.ink,
    '--resume-body': config.colors.body,
    '--resume-muted': config.colors.muted,
    '--resume-subtle': config.colors.subtle,
    '--resume-skill': config.colors.skill || config.colors.ink,
    '--resume-metric': config.colors.metric || config.colors.ink,
    '--resume-rule': config.colors.rule,
    '--resume-header-rule': config.colors.headerRule,
    '--resume-paper': config.colors.paper,
    '--resume-headline-gap': px(config.spacing.headlineGap),
    '--resume-header-rule-width': px(config.spacing.headerRuleWidth),
    '--resume-contact-gap': px(config.spacing.contactGap),
    '--resume-section-gap': px(config.spacing.sectionGap),
    '--resume-section-title-padding': px(config.spacing.sectionTitlePadding),
    '--resume-section-rule-width': px(config.spacing.sectionRuleWidth),
    '--resume-entry-gap': px(config.spacing.entryGap),
    '--resume-row-gap': px(config.spacing.rowGap),
    '--resume-detail-gap': px(config.spacing.detailGap),
    '--resume-bullet-gap': px(config.spacing.bulletGap),
    '--resume-bullet-mark-width': px(config.spacing.bulletMarkWidth),
    '--resume-bullet-indent': px(config.spacing.bulletIndent ?? 10),
    '--resume-technology-gap': px(config.spacing.technologyGap),
    '--resume-skill-gap': px(config.spacing.skillGap),
    '--resume-content-inset': px(config.spacing.contentInset),
    '--resume-skill-label-width': px(config.spacing.skillLabelWidth),
    '--resume-footer-bottom': px(config.spacing.footerBottom),
    '--resume-footer-inset': px(config.spacing.footerInset),
  } as CSSProperties;
}

export function formatResumeAsPlainText(
  resume: MasterResumeData,
  competencies?: string[],
): string {
  const parts: string[] = [];
  const basics = resume.basics;

  if (basics) {
    const name = [basics.first_name, basics.middle_name, basics.last_name]
      .filter(Boolean)
      .join(' ');
    if (name) parts.push(name);
    if (basics.headline) parts.push(basics.headline);

    const locationStr =
      basics.location ?
        [basics.location.city, basics.location.state, basics.location.country]
          .filter(Boolean)
          .join(', ')
      : '';
    const contacts = [
      basics.email,
      basics.phone,
      locationStr,
      basics.website || basics.portfolio_url || basics.linkedin_id,
    ].filter(Boolean);
    if (contacts.length) parts.push(contacts.join(' | '));
  }

  const summary = resume.summary;
  if (summary) {
    parts.push(`\nSUMMARY\n${summary}`);
  }

  const allCompetencies = [
    ...(competencies || []),
    ...(resume.core_competencies || []),
  ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);

  if (allCompetencies.length > 0) {
    parts.push(`\nCORE COMPETENCIES\n${allCompetencies.join(' • ')}`);
  }

  if (resume.experience && resume.experience.length > 0) {
    const expStrings = resume.experience.map((exp) => {
      const header = [exp.title, exp.company].filter(Boolean).join(' at ');
      const dates = [exp.start_date, exp.end_date].filter(Boolean).join(' - ');
      const loc = exp.location ? ` (${exp.location})` : '';
      const top = [header, dates].filter(Boolean).join(' | ') + loc;
      const bullets = (exp.description || []).map((h) => `• ${h}`).join('\n');
      const techs =
        exp.technologies && exp.technologies.length > 0 ?
          `Technologies: ${exp.technologies.join(', ')}`
        : '';
      return [top, bullets, techs].filter(Boolean).join('\n');
    });
    parts.push(`\nWORK EXPERIENCE\n${expStrings.join('\n\n')}`);
  }

  if (resume.projects && resume.projects.length > 0) {
    const projStrings = resume.projects.map((proj) => {
      const title = proj.name || 'Project';
      const dates = [proj.start_date, proj.end_date]
        .filter(Boolean)
        .join(' - ');
      const top = [title, dates].filter(Boolean).join(' | ');
      const bullets = (proj.description || []).map((h) => `• ${h}`).join('\n');
      const techs =
        proj.technologies && proj.technologies.length > 0 ?
          `Technologies: ${proj.technologies.join(', ')}`
        : '';
      return [top, bullets, techs].filter(Boolean).join('\n');
    });
    parts.push(`\nPROJECTS\n${projStrings.join('\n\n')}`);
  }

  if (resume.skills && resume.skills.length > 0) {
    const skillStrings = resume.skills.map((cat) => {
      const skills = (cat.skills || []).filter(Boolean).join(', ');
      const categoryName = cat.type;
      return categoryName ? `${categoryName}: ${skills}` : skills;
    });
    parts.push(`\nSKILLS\n${skillStrings.join('\n')}`);
  }

  if (resume.education && resume.education.length > 0) {
    const eduStrings = resume.education.map((edu) => {
      const degree = [edu.degree, edu.field_of_study]
        .filter(Boolean)
        .join(' in ');
      const inst = edu.institution;
      const header = [degree, inst].filter(Boolean).join(' - ');
      const dates = [edu.start_date, edu.end_date].filter(Boolean).join(' - ');
      const bullets = (edu.highlights || []).map((h) => `• ${h}`).join('\n');
      return [header, dates, bullets].filter(Boolean).join('\n');
    });
    parts.push(`\nEDUCATION\n${eduStrings.join('\n\n')}`);
  }

  if (resume.certifications && resume.certifications.length > 0) {
    const certStrings = resume.certifications.flatMap((group) =>
      (group.certifications || []).map((c) =>
        [c.name, c.issuer, c.issue_date || (c as any).date].filter(Boolean).join(' - '),
      ),
    );
    if (certStrings.length > 0) {
      parts.push(`\nCERTIFICATIONS\n${certStrings.join('\n')}`);
    }
  }

  if (resume.languages && resume.languages.length > 0) {
    const langStrings = resume.languages
      .map((l) => [l.name, l.proficiency].filter(Boolean).join(' - '))
      .filter(Boolean);
    if (langStrings.length > 0) {
      parts.push(`\nLANGUAGES\n${langStrings.join(', ')}`);
    }
  }

  return parts.join('\n');
}

export const defaultMasterResumeData: MasterResumeData = {
  basics: {
    first_name: 'Scott',
    last_name: 'Zhang',
    email: 'scott5443003@gmail.com',
    phone: '+61 400 123 456',
    location: {
      city: 'Brisbane',
      state: 'QLD',
      country: 'Australia',
      postal_code: '4000',
    },
    linkedin_id: 'linkedin.com/in/scottzhang1110',
    website: 'xianzhe.site',
    headline: 'Full-stack Engineer',
  },
  summary:
    'Pragmatic software engineer with strong experience delivering high-performance full-stack web applications and scalable cloud services.',
  core_competencies: [
    'C#/.NET & RESTful API Development',
    'React & Next.js Frontend Development',
    'AWS Cloud Infrastructure & CI/CD',
    'Relational Database Design & Optimization',
    'Full-Stack Application Architecture',
    'Performance Optimization & Reliability',
  ],
  experience: [
    {
      company: 'Northstar Labs',
      title: 'Senior Software Engineer',
      location: 'Brisbane, Australia',
      start_date: '2022',
      end_date: 'Present',
      description: [
        'Led the redesign of a multi-tenant workflow platform used by 40,000 monthly active users, reducing median task completion time by 31%.',
        'Introduced contract testing and progressive delivery across six services, cutting production regressions by 45%.',
      ],
      technologies: ['TypeScript', 'React', 'Next.js', 'PostgreSQL', 'AWS'],
    },
    {
      company: 'Harbour Systems',
      title: 'Software Engineer',
      location: 'Sydney, Australia',
      start_date: '2018',
      end_date: '2022',
      description: [
        'Built event-driven billing services processing more than two million transactions per month.',
        'Improved API p95 latency from 780 ms to 240 ms through query analysis, caching, and background processing.',
      ],
      technologies: ['Python', 'FastAPI', 'Kafka', 'Redis', 'Docker'],
    },
  ],
  education: [
    {
      institution: 'Queensland University of Technology',
      degree: 'Bachelor of Information Technology',
      field_of_study: 'Computer Science',
      location: 'Brisbane, Australia',
      start_date: '2014',
      end_date: '2017',
      highlights: [
        "Dean's List; capstone project awarded best industry solution.",
      ],
    },
  ],
  projects: [
    {
      name: 'Release Lens',
      url: 'https://github.com/example/release-lens',
      start_date: '2023',
      end_date: 'Present',
      description: [
        'Open-source release health dashboard with automated deployment annotations and incident correlation.',
      ],
      technologies: ['TypeScript', 'OpenTelemetry', 'ClickHouse'],
    },
  ],
  skills: [
    { type: 'Languages', skills: ['TypeScript', 'Python', 'SQL', 'C#'] },
    {
      type: 'Platforms',
      skills: ['AWS', 'Docker', 'Kubernetes', 'PostgreSQL'],
    },
    {
      type: 'Practices',
      skills: ['System design', 'Observability', 'Technical leadership'],
    },
  ],
  certifications: [
    {
      type: 'Cloud',
      certifications: [
        {
          name: 'AWS Certified Solutions Architect',
          issuer: 'Amazon Web Services',
          issue_date: '2024',
          expiry_date: '2027',
          credential_url: 'https://aws.amazon.com/verification',
        },
      ],
    },
  ],
  languages: [
    { name: 'English', proficiency: 'Native' },
    { name: 'Mandarin', proficiency: 'Professional' },
  ],
  other: [],
};
