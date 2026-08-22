import { Mail, Phone, MapPin, FolderGit2, Globe } from "lucide-react";
import { Fragment, type ReactNode, type Ref } from "react";
import type { MasterResumeData } from "@/lib/types";
import {
  resumeContactItems,
  resumeDateRange,
  resumeFullName,
  templateCssVariables,
  type ResumeContactItem,
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
  coreCompetencies?: string[];
  keyQualifications?: string[];
  pageRef?: Ref<HTMLElement>;
};

function LinkedinIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function ContactIcon({ type }: { type: ResumeContactItem['type'] }) {
  const iconStyle = { width: '0.9em', height: '0.9em' };
  const className = "shrink-0 text-[var(--resume-primary)] -translate-y-[0.5px]";
  switch (type) {
    case 'email':
      return <Mail className={className} style={iconStyle} />;
    case 'phone':
      return <Phone className={className} style={iconStyle} />;
    case 'location':
      return <MapPin className={className} style={iconStyle} />;
    case 'linkedin':
      return <LinkedinIcon className={className} style={iconStyle} />;
    case 'portfolio':
      return <FolderGit2 className={className} style={iconStyle} />;
    case 'website':
      return <Globe className={className} style={iconStyle} />;
    default:
      return null;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-[var(--resume-section-gap)]">
      <h2
        className="flex items-center gap-2 border-[var(--resume-rule)] pb-[var(--resume-section-title-padding)] text-[length:var(--resume-section-title-size)] font-extrabold uppercase tracking-[0.14em] leading-none break-inside-avoid break-after-avoid"
        style={{
          borderBottomWidth: "var(--resume-section-rule-width)",
          borderBottomStyle: "solid",
          breakAfter: "avoid",
          pageBreakAfter: "avoid",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[0.72em] w-[0.72em] shrink-0 rounded-[2.5px] shadow-xs overflow-hidden"
          style={{ display: "inline-block" }}
        >
          <defs>
            <linearGradient id="goldLightGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F5CB72" />
              <stop offset="100%" stopColor="#DE992E" />
            </linearGradient>
            <linearGradient id="goldDarkGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#BA751A" />
              <stop offset="100%" stopColor="#8A510A" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="4.5" fill="url(#goldLightGrad)" />
          <path d="M 0,0 L 24,24 L 0,24 Z" fill="url(#goldDarkGrad)" />
        </svg>
        <span
          className="leading-none"
          style={{
            backgroundImage: "linear-gradient(135deg, #6E4006 0%, #A86D16 28%, #D4962C 50%, #9E6412 75%, #573103 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {title}
        </span>
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
        className="bg-transparent font-bold text-[var(--resume-ink)]"
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
    <ul className="m-0 list-none p-0 pl-[var(--resume-bullet-indent,0.75rem)]">
      {values.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="mt-[var(--resume-bullet-gap)] flex text-[var(--resume-body)] break-inside-avoid"
          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        >
          <span className="w-[var(--resume-bullet-mark-width)] shrink-0">
            •
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
    <p
      className="mt-[var(--resume-technology-gap)] text-[length:var(--resume-meta-size)] text-[var(--resume-muted)] break-inside-avoid"
      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
    >
      <span className="text-[var(--resume-body)]">Technologies: </span>
      {values.join(separator)}
    </p>
  );
}

export function ResumeHtmlDocument({
  config,
  data,
  coreCompetencies = [],
  keyQualifications = [],
  pageRef,
}: ResumeHtmlDocumentProps) {
  const basics = data.basics ?? {};
  const contactItems = resumeContactItems(data);
  const inline = config.separators.inline;
  const highlightRules = createResumeHighlightRules(data);
  const effectiveCompetencies =
    coreCompetencies.length ? coreCompetencies : (
      keyQualifications.length ? keyQualifications : (
        ((data as any).core_competencies?.length ? (data as any).core_competencies : (data as any).key_qualifications) ?? []
      )
    );

  const sections: Record<ResumeSectionKey, ReactNode | null> = {
    summary:
      (data.summary || effectiveCompetencies.length) ? (
        <>
          {data.summary ? (
            <Section title={config.sectionLabels.summary}>
              <p className="mt-[var(--resume-content-inset)] text-[var(--resume-body)]">
                <HighlightedText value={data.summary} rules={highlightRules} />
              </p>
            </Section>
          ) : null}
          {effectiveCompetencies.length ? (
            <Section title="Core Competencies">
              <div className="mt-[var(--resume-content-inset)] flex flex-wrap items-center gap-2">
                {(effectiveCompetencies as string[]).map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center justify-center rounded-md px-2.5 pt-[3px] pb-[3.5px] text-[length:var(--resume-meta-size)] font-bold leading-none"
                    style={{
                      background: "linear-gradient(135deg, rgba(243, 195, 99, 0.22) 0%, rgba(217, 147, 39, 0.10) 50%, rgba(138, 81, 10, 0.16) 100%)",
                      border: "1px solid rgba(186, 117, 26, 0.35)",
                      color: "#784508",
                      boxShadow: "0 1px 2px rgba(120, 69, 8, 0.06)",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      ) : null,
    experience: data.experience?.length ? (
      <Section title={config.sectionLabels.experience}>
        {data.experience.map((item, index) => (
          <article
            key={`${item.company}-${index}`}
            className="mt-[var(--resume-entry-gap)]"
          >
            <div
              className="break-inside-avoid break-after-avoid"
              style={{
                breakInside: "avoid",
                breakAfter: "avoid",
                pageBreakInside: "avoid",
                pageBreakAfter: "avoid",
              }}
            >
              <div className="flex items-baseline justify-between gap-[var(--resume-row-gap)]">
                <h3 className="min-w-0 flex-1 text-[length:var(--resume-body-size)]">
                  {item.company && (
                    <span className="font-bold text-[var(--resume-ink)]">
                      {item.company}
                    </span>
                  )}
                  {item.company && item.title && (
                    <span className="mx-1.5 text-[var(--resume-muted)] font-normal">{inline}</span>
                  )}
                  {item.title && (
                    <span className="font-normal text-[var(--resume-primary)]">
                      {item.title}
                    </span>
                  )}
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
            </div>
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
        {data.education.map((item, index) => {
          const hasDegreeInfo = Boolean(item.degree || item.field_of_study);
          const subInfo = hasDegreeInfo
            ? [item.institution, item.location].filter(Boolean).join(inline)
            : item.location;

          return (
            <article
              key={`${item.institution}-${index}`}
              className="mt-[var(--resume-entry-gap)]"
            >
              <div
                className="break-inside-avoid break-after-avoid"
                style={{
                  breakInside: "avoid",
                  breakAfter: "avoid",
                  pageBreakInside: "avoid",
                  pageBreakAfter: "avoid",
                }}
              >
                <div className="flex items-baseline justify-between gap-[var(--resume-row-gap)]">
                  <h3 className="min-w-0 flex-1 text-[length:var(--resume-body-size)]">
                    {item.degree && (
                      <span className="font-bold text-[var(--resume-ink)]">
                        {item.degree}
                      </span>
                    )}
                    {item.degree && item.field_of_study && (
                      <span className="mx-1.5 font-normal text-[var(--resume-muted)]">
                        {inline}
                      </span>
                    )}
                    {item.field_of_study && (
                      <span className="font-medium text-[var(--resume-primary)]">
                        {item.field_of_study}
                      </span>
                    )}
                    {!hasDegreeInfo && item.institution && (
                      <span className="font-bold text-[var(--resume-ink)]">
                        {item.institution}
                      </span>
                    )}
                  </h3>
                  <span className="shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
                    {resumeDateRange(item.start_date, item.end_date)}
                  </span>
                </div>
                {subInfo && (
                  <p className="mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
                    {subInfo}
                  </p>
                )}
              </div>
              <Bullets items={item.highlights} rules={highlightRules} />
            </article>
          );
        })}
      </Section>
    ) : null,
    projects: data.projects?.length ? (
      <Section title={config.sectionLabels.projects}>
        {data.projects.map((item, index) => (
          <article
            key={`${item.name}-${index}`}
            className="mt-[var(--resume-entry-gap)]"
          >
            <div
              className="break-inside-avoid break-after-avoid"
              style={{
                breakInside: "avoid",
                breakAfter: "avoid",
                pageBreakInside: "avoid",
                pageBreakAfter: "avoid",
              }}
            >
              <div className="flex items-baseline justify-between gap-[var(--resume-row-gap)]">
                <h3 className="min-w-0 flex-1 font-bold text-[var(--resume-ink)]">
                  {item.name}
                </h3>
                <span className="shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]">
                  {resumeDateRange(item.start_date, item.end_date)}
                </span>
              </div>
              {item.url && (
                <a
                  className="mt-[var(--resume-bullet-gap)] block text-[length:var(--resume-url-size)] text-[var(--resume-muted)] hover:text-[var(--resume-ink)]"
                  href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.url.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                </a>
              )}
            </div>
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
            className="mt-[var(--resume-skill-gap)] flex items-baseline break-inside-avoid"
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
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
              className="mt-[var(--resume-skill-gap)] break-inside-avoid"
              style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
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
        <p
          className="mt-[var(--resume-skill-gap)] break-inside-avoid"
          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        >
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
            className="mt-[var(--resume-entry-gap)]"
          >
            <div
              className="break-inside-avoid break-after-avoid"
              style={{
                breakInside: "avoid",
                breakAfter: "avoid",
                pageBreakInside: "avoid",
                pageBreakAfter: "avoid",
              }}
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
            </div>
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
          className="border-[var(--resume-header-rule)]"
          style={{
            borderBottomWidth: "var(--resume-header-rule-width)",
            borderBottomStyle: "solid",
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
            <div className="mt-[var(--resume-contact-gap)] flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[length:var(--resume-contact-size)] leading-none text-[var(--resume-muted)]">
              {contactItems.map((item, index) => (
                <Fragment key={index}>
                  <span className="inline-flex items-center gap-1 leading-none">
                    <ContactIcon type={item.type} />
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="no-underline text-[var(--resume-muted)] hover:text-[var(--resume-primary)] transition-colors leading-none"
                      >
                        {item.text}
                      </a>
                    ) : (
                      <span className="leading-none">{item.text}</span>
                    )}
                  </span>
                  {index < contactItems.length - 1 && (
                    <span className="select-none text-[var(--resume-rule)] leading-none">|</span>
                  )}
                </Fragment>
              ))}
            </div>
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
