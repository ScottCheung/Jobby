/** @format */

import type { ReactNode, Ref } from "react";
import type { MasterResumeData } from "@/lib/types";
import {
  resumeContactItems,
  resumeDateRange,
  resumeFullName,
  templateCssVariables,
} from "../../templates/helpers";
import type {
  ResumeSectionKey,
  ResumeTemplateConfig,
} from "../../templates/types";
import {
  createResumeHighlightRules,
  tokenizeResumeText,
  type ResumeHighlightRules,
} from "../../templates/highlights";

type ResumeHtmlDocumentProps = {
  config: ResumeTemplateConfig;
  data: MasterResumeData;
  pageRef?: Ref<HTMLElement>;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-[var(--resume-section-gap)] break-inside-avoid">
      <h2 className="border-b-[length:var(--resume-section-rule-width)] border-[var(--resume-rule)] pb-[var(--resume-section-title-padding)] text-[length:var(--resume-section-title-size)] font-bold uppercase text-[var(--resume-ink)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HighlightedText({
  value,
  rules,
}: {
  value: string;
  rules: ResumeHighlightRules;
}) {
  return tokenizeResumeText(value, rules).map((token, index) =>
    token.kind === "plain" ? (
      token.value
    ) : (
      <mark
        key={`${token.value}-${index}`}
        className={
          token.kind === "skill"
            ? "bg-transparent font-bold text-[var(--resume-skill)]"
            : "bg-transparent font-bold text-[var(--resume-metric)]"
        }
      >
        {token.value}
      </mark>
    ),
  );
}

function stringItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function Bullets({
  items,
  rules,
}: {
  items?: string[] | string;
  rules: ResumeHighlightRules;
}) {
  const values = stringItems(items);
  return (
    <ul className="m-0 list-none p-0">
      {values.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="mt-[var(--resume-bullet-gap)] flex text-[var(--resume-body)]"
        >
          <span className="w-[var(--resume-bullet-mark-width)] shrink-0">
            -
          </span>
          <span className="min-w-0 flex-1">
            <HighlightedText value={item} rules={rules} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Technologies({
  items,
  separator,
}: {
  items?: string[] | string;
  separator: string;
}) {
  const values = stringItems(items);
  if (!values.length) return null;
  return (
    <p className="mt-[var(--resume-technology-gap)] text-[length:var(--resume-meta-size)] text-[var(--resume-muted)]">
      <span className="text-[var(--resume-body)]">Technologies: </span>
      {values.join(separator)}
    </p>
  );
}

export function ResumeHtmlDocument({
  config,
  data,
  pageRef,
}: ResumeHtmlDocumentProps) {
  const basics = data.basics ?? {};
  const contactItems = resumeContactItems(data);
  const inline = config.separators.inline;
  const highlightRules = createResumeHighlightRules(data);

  const sections: Record<ResumeSectionKey, ReactNode | null> = {
    summary: data.summary ? (
      <Section title={config.sectionLabels.summary}>
        <p className="mt-[var(--resume-content-inset)] text-[var(--resume-body)]">
          <HighlightedText value={data.summary} rules={highlightRules} />
        </p>
      </Section>
    ) : null,
    experience: data.experience?.length ? (
      <Section title={config.sectionLabels.experience}>
        {data.experience.map((item, index) => (
          <article
            key={`${item.company}-${index}`}
            className="mt-[var(--resume-entry-gap)] break-inside-avoid"
          >
            <div className="flex items-start justify-between gap-[var(--resume-row-gap)]">
              <h3 className="min-w-0 flex-1 font-bold text-[var(--resume-ink)]">
                {[item.title, item.company].filter(Boolean).join(inline)}
              </h3>
              <span className="shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
                {resumeDateRange(item.start_date, item.end_date)}
              </span>
            </div>
            {item.location && (
              <p className="mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
                {item.location}
              </p>
            )}
            <Bullets items={item.description} rules={highlightRules} />
            <Technologies
              items={item.technologies}
              separator={config.separators.technologies}
            />
          </article>
        ))}
      </Section>
    ) : null,
    education: data.education?.length ? (
      <Section title={config.sectionLabels.education}>
        {data.education.map((item, index) => (
          <article
            key={`${item.institution}-${index}`}
            className="mt-[var(--resume-entry-gap)] break-inside-avoid"
          >
            <h3 className="font-bold text-[var(--resume-ink)]">
              {[item.degree, item.field_of_study].filter(Boolean).join(inline)}
            </h3>
            <p className="mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
              {[
                item.institution,
                item.location,
                resumeDateRange(item.start_date, item.end_date),
              ]
                .filter(Boolean)
                .join(inline)}
            </p>
            <Bullets items={item.highlights} rules={highlightRules} />
          </article>
        ))}
      </Section>
    ) : null,
    projects: data.projects?.length ? (
      <Section title={config.sectionLabels.projects}>
        {data.projects.map((item, index) => (
          <article
            key={`${item.name}-${index}`}
            className="mt-[var(--resume-entry-gap)] break-inside-avoid"
          >
            <div className="flex items-start justify-between gap-[var(--resume-row-gap)]">
              <h3 className="min-w-0 flex-1 font-bold text-[var(--resume-ink)]">
                {item.name}
              </h3>
              <span className="shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
                {resumeDateRange(item.start_date, item.end_date)}
              </span>
            </div>
            {item.url && (
              <a
                className="mt-[var(--resume-bullet-gap)] block text-[length:var(--resume-url-size)] text-[var(--resume-muted)] underline"
                href={item.url}
              >
                {item.url}
              </a>
            )}
            <Bullets items={item.description} rules={highlightRules} />
            <Technologies
              items={item.technologies}
              separator={config.separators.technologies}
            />
          </article>
        ))}
      </Section>
    ) : null,
    skills: data.skills?.length ? (
      <Section title={config.sectionLabels.skills}>
        {data.skills.map((group, index) => (
          <div
            key={`${group.type}-${index}`}
            className="mt-[var(--resume-skill-gap)] flex break-inside-avoid"
          >
            {group.type && (
              <span className="w-[var(--resume-skill-label-width)] shrink-0 text-[length:var(--resume-date-size)] font-bold text-[var(--resume-ink)]">
                {group.type}
              </span>
            )}
            <span className="min-w-0 flex-1 text-[var(--resume-body)]">
              {stringItems(group.skills).join(inline)}
            </span>
          </div>
        ))}
      </Section>
    ) : null,
    certifications: data.certifications?.length ? (
      <Section title={config.sectionLabels.certifications}>
        {data.certifications
          .flatMap((group) => group.certifications ?? [])
          .map((item, index) => (
            <p
              key={`${item.name}-${index}`}
              className="mt-[var(--resume-skill-gap)]"
            >
              {[
                item.name,
                item.issuer,
                resumeDateRange(item.issue_date, item.expiry_date),
              ]
                .filter(Boolean)
                .join(inline)}
            </p>
          ))}
      </Section>
    ) : null,
    languages: data.languages?.length ? (
      <Section title={config.sectionLabels.languages}>
        <p className="mt-[var(--resume-skill-gap)]">
          {data.languages
            .map((item) =>
              [item.name, item.proficiency].filter(Boolean).join(" - "),
            )
            .join(inline)}
        </p>
      </Section>
    ) : null,
    other: data.other?.length ? (
      <Section title={config.sectionLabels.other}>
        {data.other.map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            className="mt-[var(--resume-entry-gap)] break-inside-avoid"
          >
            <h3 className="font-bold text-[var(--resume-ink)]">
              {[item.title, item.organization].filter(Boolean).join(inline) ||
                item.type ||
                config.sectionLabels.other}
            </h3>
            {(item.location || item.date) && (
              <p className="mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
                {[item.location, item.date].filter(Boolean).join(inline)}
              </p>
            )}
            <Bullets items={item.description} rules={highlightRules} />
          </article>
        ))}
      </Section>
    ) : null,
  };

  return (
    <article
      ref={pageRef}
      data-resume-template={config.id}
      className="relative shrink-0 overflow-hidden bg-[var(--resume-paper)] text-[length:var(--resume-body-size)] leading-[var(--resume-line-height)] text-[var(--resume-body)] shadow-[0_18px_60px_rgba(24,24,27,0.18)] print:shadow-none"
      style={{
        ...templateCssVariables(config),
        width: config.paper.widthPx,
        minHeight: config.paper.heightPx,
        paddingTop: config.paper.paddingTop * config.paper.cssPixelsPerPoint,
        paddingRight:
          config.paper.paddingRight * config.paper.cssPixelsPerPoint,
        paddingBottom:
          config.paper.paddingBottom * config.paper.cssPixelsPerPoint,
        paddingLeft: config.paper.paddingLeft * config.paper.cssPixelsPerPoint,
        fontFamily: "var(--resume-font)",
      }}
    >
      <div data-resume-content>
        <header
          className="border-b-[length:var(--resume-header-rule-width)] border-[var(--resume-header-rule)]"
          style={{
            paddingBottom:
              config.spacing.headerPaddingBottom *
              config.paper.cssPixelsPerPoint,
          }}
        >
          <h1 className="text-[length:var(--resume-name-size)] font-bold leading-[1.1] text-[var(--resume-ink)]">
            {resumeFullName(data)}
          </h1>
          {basics.headline && (
            <p className="mt-[var(--resume-headline-gap)] text-[length:var(--resume-headline-size)] text-[var(--resume-muted)]">
              {basics.headline}
            </p>
          )}
          {contactItems.length > 0 && (
            <p className="mt-[var(--resume-contact-gap)] text-[length:var(--resume-contact-size)] text-[var(--resume-muted)]">
              {contactItems.join(config.separators.contact)}
            </p>
          )}
        </header>

        {config.sectionOrder.map((section) => (
          <div key={section}>{sections[section]}</div>
        ))}
      </div>

      {config.showPageNumbers && (
        <footer className="absolute bottom-[var(--resume-footer-bottom)] left-[var(--resume-footer-inset)] right-[var(--resume-footer-inset)] text-right text-[length:var(--resume-footer-size)] text-[var(--resume-subtle)]">
          Page 1 of 1
        </footer>
      )}
    </article>
  );
}
