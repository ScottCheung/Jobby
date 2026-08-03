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

export function resumeContactItems(data: MasterResumeData) {
  const basics = data.basics ?? {};
  return [
    basics.email,
    basics.phone,
    basics.location?.city,
    basics.location?.state,
    basics.location?.country,
    basics.linkedin_id,
    basics.website,
    basics.portfolio_url,
  ].filter((value): value is string => Boolean(value));
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
    "--resume-ink": config.colors.ink,
    "--resume-body": config.colors.body,
    "--resume-muted": config.colors.muted,
    "--resume-subtle": config.colors.subtle,
    "--resume-skill": config.colors.skill,
    "--resume-metric": config.colors.metric,
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
    "--resume-technology-gap": px(config.spacing.technologyGap),
    "--resume-skill-gap": px(config.spacing.skillGap),
    "--resume-content-inset": px(config.spacing.contentInset),
    "--resume-skill-label-width": px(config.spacing.skillLabelWidth),
    "--resume-footer-bottom": px(config.spacing.footerBottom),
    "--resume-footer-inset": px(config.spacing.footerInset),
  } as CSSProperties;
}
