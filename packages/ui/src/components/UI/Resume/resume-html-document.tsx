/** @format */

'use client';

import { Mail, Phone, MapPin, FolderGit2, Globe } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import type { MasterResumeData, ResumeSectionKey, ResumeTemplateConfig } from './types';
import {
  resumeContactItems,
  resumeDateRange,
  resumeFullName,
  templateCssVariables,
  type ResumeContactItem,
} from './helpers';
import {
  createResumeHighlightRules,
  tokenizeResumeText,
  type ResumeHighlightRules,
} from './highlights';

type ResumeHtmlDocumentProps = {
  config: ResumeTemplateConfig;
  data: MasterResumeData;
  coreCompetencies?: string[];
  keyQualifications?: string[];
  pageRef?: unknown;
};

function LinkedinIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={{
        width: '0.9em',
        height: '0.9em',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' />
      <rect x='2' y='9' width='4' height='12' />
      <circle cx='4' cy='4' r='2' />
    </svg>
  );
}

function ContactIcon({ type }: { type: ResumeContactItem['type'] }) {
  const iconStyle = {
    width: '0.9em',
    height: '0.9em',
    display: 'inline-block',
    verticalAlign: 'middle',
  };
  const className = 'shrink-0 text-[var(--resume-primary)] -translate-y-[0.5px]';
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
    <section className='mt-[var(--resume-section-gap)]'>
      <h2
        className='flex items-center gap-2 border-[var(--resume-rule)] pb-[var(--resume-section-title-padding)] text-[length:var(--resume-section-title-size)] font-extrabold uppercase tracking-[0.14em] leading-none break-inside-avoid break-after-avoid'
        style={{
          borderBottomWidth: 'var(--resume-section-rule-width)',
          borderBottomStyle: 'solid',
          breakAfter: 'avoid',
          pageBreakAfter: 'avoid',
        }}
      >
        <svg
          viewBox='0 0 24 24'
          width={16}
          height={16}
          className='h-[0.72em] w-[0.72em] min-w-[0.72em] max-w-[0.72em] shrink-0 rounded-[2.5px] shadow-xs overflow-hidden'
          style={{
            display: 'inline-block',
            width: '0.72em',
            height: '0.72em',
            verticalAlign: 'middle',
          }}
        >
          <defs>
            <linearGradient id='goldLightGradShared' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#F5CB72' />
              <stop offset='100%' stopColor='#DE992E' />
            </linearGradient>
            <linearGradient id='goldDarkGradShared' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#BA751A' />
              <stop offset='100%' stopColor='#8A510A' />
            </linearGradient>
          </defs>
          <rect width='24' height='24' rx='4.5' fill='url(#goldLightGradShared)' />
          <path d='M 0,0 L 24,24 L 0,24 Z' fill='url(#goldDarkGradShared)' />
        </svg>
        <span
          className='leading-none'
          style={{
            backgroundImage:
              'linear-gradient(135deg, #6E4006 0%, #A86D16 28%, #D4962C 50%, #9E6412 75%, #573103 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
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
    token.kind === 'plain' ? (
      token.value
    ) : (
      <mark
        key={`${token.value}-${index}`}
        className='bg-transparent font-bold text-[var(--resume-ink)]'
      >
        {token.value}
      </mark>
    ),
  );
}

function stringItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return typeof value === 'string' && value.trim() ? [value.trim()] : [];
}

function Bullets({
  items,
  rules,
}: {
  items?: string[] | string | null;
  rules: ResumeHighlightRules;
}) {
  const list = stringItems(items);
  if (!list.length) return null;

  return (
    <ul className='mt-[var(--resume-bullet-gap)] list-none pl-0'>
      {list.map((item, index) => (
        <li
          key={index}
          className='relative flex items-baseline pl-[var(--resume-bullet-indent)] text-[var(--resume-body)] break-inside-avoid'
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <span
            aria-hidden='true'
            className='absolute left-0 inline-block text-[var(--resume-muted)] select-none'
            style={{ width: 'var(--resume-bullet-mark-width)' }}
          >
            •
          </span>
          <span className='min-w-0 flex-1 leading-normal'>
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
  items?: string[] | null;
  separator: string;
}) {
  const list = (items ?? []).filter((i): i is string => Boolean(i));
  if (!list.length) return null;

  return (
    <p
      className='mt-[var(--resume-technology-gap)] text-[length:var(--resume-meta-size)] text-[var(--resume-muted)] break-inside-avoid'
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      <span className='font-bold text-[var(--resume-ink)]'>Technologies:</span>{' '}
      {list.join(separator)}
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
    coreCompetencies.length > 0
      ? coreCompetencies
      : keyQualifications.length > 0
        ? keyQualifications
        : (data.core_competencies?.length
            ? data.core_competencies
            : ((data as unknown as Record<string, string[]>).key_qualifications ?? []));

  const sections: Record<ResumeSectionKey, ReactNode | null> = {
    summary:
      data.summary || effectiveCompetencies.length ? (
        <>
          {data.summary ? (
            <Section title={config.sectionLabels.summary}>
              <p className='mt-[var(--resume-content-inset)] text-[var(--resume-body)]'>
                <HighlightedText value={data.summary} rules={highlightRules} />
              </p>
            </Section>
          ) : null}
          {effectiveCompetencies.length ? (
            <Section title='Core Competencies'>
              <div className='mt-[var(--resume-content-inset)] flex flex-wrap items-center gap-2'>
                {effectiveCompetencies.map((item, idx) => (
                  <span
                    key={idx}
                    className='inline-flex items-center justify-center rounded-md px-2.5 pt-[3px] pb-[3.5px] text-[length:var(--resume-meta-size)] font-bold leading-none'
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(243, 195, 99, 0.22) 0%, rgba(217, 147, 39, 0.10) 50%, rgba(138, 81, 10, 0.16) 100%)',
                      border: '1px solid rgba(186, 117, 26, 0.35)',
                      color: '#784508',
                      boxShadow: '0 1px 2px rgba(120, 69, 8, 0.06)',
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
            className='mt-[var(--resume-entry-gap)]'
          >
            <div
              className='break-inside-avoid break-after-avoid'
              style={{
                breakInside: 'avoid',
                breakAfter: 'avoid',
                pageBreakInside: 'avoid',
                pageBreakAfter: 'avoid',
              }}
            >
              <div className='flex items-baseline justify-between gap-[var(--resume-row-gap)]'>
                <h3 className='min-w-0 flex-1 text-[length:var(--resume-body-size)]'>
                  {item.company && (
                    <span className='font-bold text-[var(--resume-ink)]'>
                      {item.company}
                    </span>
                  )}
                  {item.company && item.title && (
                    <span className='mx-1.5 text-[var(--resume-muted)] font-normal'>
                      {inline}
                    </span>
                  )}
                  {item.title && (
                    <span className='font-normal text-[var(--resume-primary)]'>
                      {item.title}
                    </span>
                  )}
                </h3>
                <span className='shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]'>
                  {resumeDateRange(item.start_date, item.end_date)}
                </span>
              </div>
              {item.location && (
                <p className='mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]'>
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
              className='mt-[var(--resume-entry-gap)]'
            >
              <div
                className='break-inside-avoid break-after-avoid'
                style={{
                  breakInside: 'avoid',
                  breakAfter: 'avoid',
                  pageBreakInside: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                <div className='flex items-baseline justify-between gap-[var(--resume-row-gap)]'>
                  <h3 className='min-w-0 flex-1 text-[length:var(--resume-body-size)]'>
                    {item.degree && (
                      <span className='font-bold text-[var(--resume-ink)]'>
                        {item.degree}
                      </span>
                    )}
                    {item.degree && item.field_of_study && (
                      <span className='mx-1.5 font-normal text-[var(--resume-muted)]'>
                        {inline}
                      </span>
                    )}
                    {item.field_of_study && (
                      <span className='font-medium text-[var(--resume-primary)]'>
                        {item.field_of_study}
                      </span>
                    )}
                    {!hasDegreeInfo && item.institution && (
                      <span className='font-bold text-[var(--resume-ink)]'>
                        {item.institution}
                      </span>
                    )}
                  </h3>
                  <span className='shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]'>
                    {resumeDateRange(item.start_date, item.end_date)}
                  </span>
                </div>
                {subInfo && (
                  <p className='mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]'>
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
            className='mt-[var(--resume-entry-gap)]'
          >
            <div
              className='break-inside-avoid break-after-avoid'
              style={{
                breakInside: 'avoid',
                breakAfter: 'avoid',
                pageBreakInside: 'avoid',
                pageBreakAfter: 'avoid',
              }}
            >
              <div className='flex items-baseline justify-between gap-[var(--resume-row-gap)]'>
                <h3 className='min-w-0 flex-1 font-bold text-[var(--resume-ink)]'>
                  {item.name}
                </h3>
                <span className='shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]'>
                  {resumeDateRange(item.start_date, item.end_date)}
                </span>
              </div>
              {item.url && (
                <a
                  className='mt-[var(--resume-bullet-gap)] block text-[length:var(--resume-url-size)] text-[var(--resume-muted)] hover:text-[var(--resume-ink)]'
                  href={
                    item.url.startsWith('http')
                      ? item.url
                      : `https://${item.url}`
                  }
                  target='_blank'
                  rel='noreferrer'
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
            className='mt-[var(--resume-skill-gap)] flex items-baseline break-inside-avoid'
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            {group.type && (
              <span className='w-[var(--resume-skill-label-width)] shrink-0 text-[length:var(--resume-date-size)] font-bold text-[var(--resume-ink)]'>
                {group.type}
              </span>
            )}
            <span className='min-w-0 flex-1 text-[var(--resume-body)]'>
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
              className='mt-[var(--resume-skill-gap)] break-inside-avoid'
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
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
          className='mt-[var(--resume-skill-gap)] break-inside-avoid'
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          {data.languages
            .map((item) =>
              [item.name, item.proficiency].filter(Boolean).join(' - '),
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
            className='mt-[var(--resume-entry-gap)]'
          >
            <div
              className='break-inside-avoid break-after-avoid'
              style={{
                breakInside: 'avoid',
                breakAfter: 'avoid',
                pageBreakInside: 'avoid',
                pageBreakAfter: 'avoid',
              }}
            >
              <div className='flex items-baseline justify-between gap-[var(--resume-row-gap)]'>
                <h3 className='min-w-0 flex-1 font-bold text-[var(--resume-ink)]'>
                  {[item.title, item.organization]
                    .filter(Boolean)
                    .join(inline)}
                </h3>
                {item.date && (
                  <span className='shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]'>
                    {item.date}
                  </span>
                )}
              </div>
            </div>
            <Bullets items={item.description} rules={highlightRules} />
          </article>
        ))}
      </Section>
    ) : null,
  };

  return (
    <article
      ref={pageRef as any}
      style={{
        ...templateCssVariables(config),
        width: `${config.paper.widthPx}px`,
        minHeight: `${config.paper.heightPx}px`,
        paddingTop: `calc(${config.paper.paddingTop} * ${config.paper.cssPixelsPerPoint}px)`,
        paddingRight: `calc(${config.paper.paddingRight} * ${config.paper.cssPixelsPerPoint}px)`,
        paddingBottom: `calc(${config.paper.paddingBottom} * ${config.paper.cssPixelsPerPoint}px)`,
        paddingLeft: `calc(${config.paper.paddingLeft} * ${config.paper.cssPixelsPerPoint}px)`,
      }}
      className='box-border bg-white text-[length:var(--resume-body-size)] leading-[var(--resume-line-height)] text-[var(--resume-ink)] shadow-2xs font-[var(--resume-font)] select-text'
    >
      <div data-resume-content='true'>
        <header
          className='border-[var(--resume-header-rule)] pb-[var(--resume-header-rule-width)]'
          style={{
            borderBottomWidth: 'var(--resume-header-rule-width)',
            borderBottomStyle: 'solid',
          }}
        >
          <h1 className='text-[length:var(--resume-name-size)] font-extrabold tracking-tight text-[var(--resume-ink)] leading-none'>
            {resumeFullName(data)}
          </h1>
          {basics.headline && (
            <p className='mt-[var(--resume-headline-gap)] text-[length:var(--resume-headline-size)] font-semibold text-[var(--resume-muted)]'>
              {basics.headline}
            </p>
          )}
          {contactItems.length ? (
            <div className='mt-[var(--resume-contact-gap)] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[length:var(--resume-contact-size)] text-[var(--resume-muted)]'>
              {contactItems.map((item, index) => (
                <Fragment key={`${item.type}-${index}`}>
                  {index > 0 && (
                    <span className='opacity-40 select-none'>•</span>
                  )}
                  <span className='inline-flex items-center gap-1'>
                    <ContactIcon type={item.type} />
                    {item.href ? (
                      <a
                        href={item.href}
                        target='_blank'
                        rel='noreferrer'
                        className='text-[var(--resume-muted)] hover:text-[var(--resume-ink)]'
                      >
                        {item.text}
                      </a>
                    ) : (
                      item.text
                    )}
                  </span>
                </Fragment>
              ))}
            </div>
          ) : null}
        </header>

        {config.sectionOrder.map((key) => (
          <Fragment key={key}>{sections[key]}</Fragment>
        ))}
      </div>
    </article>
  );
}
