import type { CSSProperties } from "react";
import type { MasterResumeData } from "@/lib/types";
import type { ResumeTemplateConfig } from "./types";

export function resumeFullName(data: MasterResumeData) {
  const basics = data.basics ?? {};
  return (
    [basics.first_name, basics.middle_name, basics.last_name]
      .filter(Boolean)
      .join(" ") || "Resume"
  );
}

export function resumeDateRange(start?: string | null, end?: string | null) {
  return [start, end].filter(Boolean).join(" - ");
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
    items.push({ type: 'email', text: basics.email, href: `mailto:${basics.email}` });
  }
  if (basics.phone) {
    items.push({ type: 'phone', text: basics.phone, href: `tel:${basics.phone.replace(/[^+\d]/g, '')}` });
  }
  const locationStr = [basics.location?.city, basics.location?.state, basics.location?.country]
    .filter(Boolean)
    .join(', ');
  if (locationStr) {
    items.push({ type: 'location', text: locationStr });
  }

  if (basics.linkedin_id) {
    const handle = basics.linkedin_id
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
      .replace(/^\/+|\/+$/g, '');
    const href = handle ? `https://www.linkedin.com/in/${handle}/` : (basics.linkedin_id.startsWith('http') ? basics.linkedin_id : `https://${basics.linkedin_id}`);
    const text = handle || basics.linkedin_id.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    items.push({ type: 'linkedin', text, href });
  }

  if (basics.portfolio_url) {
    const href = basics.portfolio_url.startsWith('http') ? basics.portfolio_url : `https://${basics.portfolio_url}`;
    const cleanDisplay = basics.portfolio_url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    items.push({ type: 'portfolio', text: cleanDisplay, href });
  }

  if (basics.website) {
    const href = basics.website.startsWith('http') ? basics.website : `https://${basics.website}`;
    const cleanDisplay = basics.website.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    items.push({ type: 'website', text: cleanDisplay, href });
  }

  return items;
}

export function templateCssVariables(config: ResumeTemplateConfig) {
  const px = (points: number) => `${points * config.paper.cssPixelsPerPoint}px`;

  return {
    "--resume-font": config.typography.fontFamily,
    "--resume-body-size": px(config.typography.bodySize),
    "--resume-line-height": config.typography.bodyLineHeight,
    "--resume-name-size": px(config.typography.nameSize),
    "--resume-headline-size": px(config.typography.headlineSize),
    "--resume-contact-size": px(config.typography.contactSize),
    "--resume-section-title-size": px(config.typography.sectionTitleSize),
    "--resume-date-size": px(config.typography.dateSize),
    "--resume-meta-size": px(config.typography.metaSize),
    "--resume-url-size": px(config.typography.urlSize),
    "--resume-footer-size": px(config.typography.footerSize),
    "--resume-primary": config.colors.primary || "#8E5B15",
    "--resume-ink": config.colors.ink,
    "--resume-body": config.colors.body,
    "--resume-muted": config.colors.muted,
    "--resume-subtle": config.colors.subtle,
    "--resume-skill": config.colors.skill || config.colors.ink,
    "--resume-metric": config.colors.metric || config.colors.ink,
    "--resume-rule": config.colors.rule,
    "--resume-header-rule": config.colors.headerRule,
    "--resume-paper": config.colors.paper,
    "--resume-headline-gap": px(config.spacing.headlineGap),
    "--resume-header-rule-width": px(config.spacing.headerRuleWidth),
    "--resume-contact-gap": px(config.spacing.contactGap),
    "--resume-section-gap": px(config.spacing.sectionGap),
    "--resume-section-title-padding": px(config.spacing.sectionTitlePadding),
    "--resume-section-rule-width": px(config.spacing.sectionRuleWidth),
    "--resume-entry-gap": px(config.spacing.entryGap),
    "--resume-row-gap": px(config.spacing.rowGap),
    "--resume-detail-gap": px(config.spacing.detailGap),
    "--resume-bullet-gap": px(config.spacing.bulletGap),
    "--resume-bullet-mark-width": px(config.spacing.bulletMarkWidth),
    "--resume-bullet-indent": px(config.spacing.bulletIndent ?? 10),
    "--resume-technology-gap": px(config.spacing.technologyGap),
    "--resume-skill-gap": px(config.spacing.skillGap),
    "--resume-content-inset": px(config.spacing.contentInset),
    "--resume-skill-label-width": px(config.spacing.skillLabelWidth),
    "--resume-footer-bottom": px(config.spacing.footerBottom),
    "--resume-footer-inset": px(config.spacing.footerInset),
  } as CSSProperties;
}
