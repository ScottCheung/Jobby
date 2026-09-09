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

export function resumeContactItems(
  data: MasterResumeData,
): ResumeContactItem[] {
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
    const href =
      handle ? `https://www.linkedin.com/in/${handle}/`
      : basics.linkedin_id.startsWith('http') ? basics.linkedin_id
      : `https://${basics.linkedin_id}`;
    const text =
      handle ||
      basics.linkedin_id.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    items.push({ type: 'linkedin', text, href });
  }

  if (basics.portfolio_url) {
    const href =
      basics.portfolio_url.startsWith('http') ?
        basics.portfolio_url
      : `https://${basics.portfolio_url}`;
    const cleanDisplay = basics.portfolio_url
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '');
    items.push({ type: 'portfolio', text: cleanDisplay, href });
  }

  if (basics.website) {
    const href =
      basics.website.startsWith('http') ?
        basics.website
      : `https://${basics.website}`;
    const cleanDisplay = basics.website
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '');
    items.push({ type: 'website', text: cleanDisplay, href });
  }

  return items;
}

export function sanitizeFilenameSegment(segment?: string | null): string {
  if (!segment) return '';
  return segment
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[^\p{L}\p{N}\s._()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^-+|-+$/g, '')
    .trim();
}

function filenameCompany(company?: string | null): string {
  const cleanCompany = sanitizeFilenameSegment(company);
  return cleanCompany.toLocaleLowerCase() === 'company' ? '' : cleanCompany;
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

  const cleanName = sanitizeFilenameSegment(fullName) || 'Resume';
  const cleanCompany = filenameCompany(company);
  const cleanTitle = sanitizeFilenameSegment(jobTitle);

  const parts = [cleanName, 'CV', cleanCompany, cleanTitle].filter(Boolean);
  return `${parts.join(' - ')}.pdf`;
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
      .join(' ') || 'Cover Letter';

  const cleanName = sanitizeFilenameSegment(fullName) || 'Cover Letter';
  const cleanCompany = filenameCompany(company);
  const cleanTitle = sanitizeFilenameSegment(jobTitle);

  const parts = [cleanName, 'CL', cleanCompany, cleanTitle].filter(Boolean);
  return `${parts.join(' - ')}.pdf`;
}

export function templateCssVariables(config: ResumeTemplateConfig) {
  const px = (points: number) => `${points * config.paper.cssPixelsPerPoint}px`;

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

export function mergeResumeData(
  tailored?: MasterResumeData | null,
  fallback?: MasterResumeData | null,
): MasterResumeData {
  if (!tailored && !fallback) return {};
  if (!tailored) return fallback || {};
  if (!fallback) return tailored;
  return {
    ...fallback,
    ...tailored,
    basics: tailored.basics || fallback.basics,
    summary: tailored.summary || fallback.summary,
    core_competencies:
      tailored.core_competencies?.length ?
        tailored.core_competencies
      : fallback.core_competencies,
    experience:
      tailored.experience?.length ?
        tailored.experience
      : fallback.experience,
    education:
      tailored.education?.length ?
        tailored.education
      : fallback.education,
    projects:
      tailored.projects?.length ? tailored.projects : fallback.projects,
    skills: tailored.skills?.length ? tailored.skills : fallback.skills,
    certifications:
      tailored.certifications?.length ?
        tailored.certifications
      : fallback.certifications,
    languages:
      tailored.languages?.length ?
        tailored.languages
      : fallback.languages,
    other: tailored.other?.length ? tailored.other : fallback.other,
  };
}

export function formatResumeAsPlainText(
  resume: MasterResumeData,
  competencies?: string[],
): string {
  const parts: string[] = [];
  const basics = resume.basics;

  if (basics) {
    const name =
      [basics.first_name, basics.middle_name, basics.last_name]
        .filter(Boolean)
        .join(' ') || (basics as any).full_name || (basics as any).name;
    if (name) parts.push(name);
    if (basics.headline) parts.push(basics.headline);

    const locationStr =
      typeof basics.location === 'string' ?
        basics.location
      : basics.location ?
        [
          basics.location.address,
          basics.location.city,
          basics.location.state,
          basics.location.postal_code,
          basics.location.country,
        ]
          .filter(Boolean)
          .join(', ')
      : '';
    const contacts = [
      basics.email,
      basics.phone,
      locationStr,
      basics.linkedin_id,
      basics.portfolio_url,
      basics.website,
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
    ...((resume as any).key_qualifications || []),
  ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);

  if (allCompetencies.length > 0) {
    parts.push(`\nCORE COMPETENCIES\n${allCompetencies.join(' • ')}`);
  }

  if (resume.experience && resume.experience.length > 0) {
    const expStrings = resume.experience.map((exp) => {
      const header = [exp.title, exp.company].filter(Boolean).join(' at ');
      const endDate = exp.end_date || (exp.is_current ? 'Present' : '');
      const dates = [exp.start_date, endDate].filter(Boolean).join(' - ');
      const loc = exp.location ? ` (${exp.location})` : '';
      const top = [header, dates].filter(Boolean).join(' | ') + loc;
      const descList =
        Array.isArray(exp.description) ? exp.description
        : typeof exp.description === 'string' ? [exp.description]
        : [];
      const bullets = descList
        .filter(Boolean)
        .map((h) => (h.trim().startsWith('•') ? h.trim() : `• ${h.trim()}`))
        .join('\n');
      const techs =
        Array.isArray(exp.technologies) && exp.technologies.length > 0 ?
          `Technologies: ${exp.technologies.join(', ')}`
        : typeof exp.technologies === 'string' && exp.technologies ?
          `Technologies: ${exp.technologies}`
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
      const meta = [dates, proj.url].filter(Boolean).join(' | ');
      const top = [title, meta].filter(Boolean).join(' | ');
      const descList =
        Array.isArray(proj.description) ? proj.description
        : typeof proj.description === 'string' ? [proj.description]
        : [];
      const bullets = descList
        .filter(Boolean)
        .map((h) => (h.trim().startsWith('•') ? h.trim() : `• ${h.trim()}`))
        .join('\n');
      const techs =
        Array.isArray(proj.technologies) && proj.technologies.length > 0 ?
          `Technologies: ${proj.technologies.join(', ')}`
        : typeof proj.technologies === 'string' && proj.technologies ?
          `Technologies: ${proj.technologies}`
        : '';
      return [top, bullets, techs].filter(Boolean).join('\n');
    });
    parts.push(`\nPROJECTS\n${projStrings.join('\n\n')}`);
  }

  if (resume.skills && resume.skills.length > 0) {
    const skillStrings = resume.skills.map((cat: any) => {
      if (typeof cat === 'string') return cat;
      const skills = (Array.isArray(cat.skills) ? cat.skills : [cat.skills])
        .filter(Boolean)
        .join(', ');
      const categoryName = cat.type || cat.name || cat.category;
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
      const loc = edu.location ? ` (${edu.location})` : '';
      const top = [header, dates].filter(Boolean).join(' | ') + loc;
      const rawBullets = edu.highlights || (edu as any).description || [];
      const bulletList =
        Array.isArray(rawBullets) ? rawBullets
        : typeof rawBullets === 'string' ? [rawBullets]
        : [];
      const bullets = bulletList
        .filter(Boolean)
        .map((h) => (h.trim().startsWith('•') ? h.trim() : `• ${h.trim()}`))
        .join('\n');
      return [top, bullets].filter(Boolean).join('\n');
    });
    parts.push(`\nEDUCATION\n${eduStrings.join('\n\n')}`);
  }

  if (resume.certifications && resume.certifications.length > 0) {
    const certItems: Array<{
      name?: string | null;
      issuer?: string | null;
      issue_date?: string | null;
      expiry_date?: string | null;
      url?: string | null;
      credential_url?: string | null;
    }> = resume.certifications.flatMap((group: any) =>
      Array.isArray(group.certifications) ? group.certifications
      : group.name ? [group]
      : []
    );
    const certStrings = certItems
      .map((c: any) => {
        const dates = [c.issue_date || c.date, c.expiry_date]
          .filter(Boolean)
          .join(' - ');
        const url = c.credential_url || c.url;
        return [c.name, c.issuer, dates, url].filter(Boolean).join(' - ');
      })
      .filter(Boolean);
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

  if (resume.other && resume.other.length > 0) {
    const otherStrings = resume.other.map((item) => {
      const title =
        [item.title, item.organization].filter(Boolean).join(' - ') ||
        item.type ||
        'Other';
      const loc = (item as any).location;
      const details = [loc, item.date].filter(Boolean).join(' | ');
      const top = [title, details].filter(Boolean).join(' | ');
      const descList =
        Array.isArray(item.description) ? item.description
        : typeof item.description === 'string' ? [item.description]
        : [];
      const bullets = descList
        .filter(Boolean)
        .map((h) => (h.trim().startsWith('•') ? h.trim() : `• ${h.trim()}`))
        .join('\n');
      return [top, bullets].filter(Boolean).join('\n');
    });
    parts.push(`\nOTHER\n${otherStrings.join('\n\n')}`);
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

export const COVER_LETTER_SIGNATURE_STYLE = {
  fontFamily: "'Sacramento', 'Segoe Script', cursive",
  fontStyle: 'normal',
  fontWeight: 400,
} as const;

export function formatCoverLetterPdfFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
