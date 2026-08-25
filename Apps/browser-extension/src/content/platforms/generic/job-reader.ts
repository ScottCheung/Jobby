import type { GenericJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";

import { extractTechnologyKeywords } from "../../technology-keywords";
import { extractStructuredText } from "../../text-utils";
import { capturedJobDateFields } from "../../../shared/utils/date-formatter";

const JOB_TITLE_SELECTORS = [
  // SmartRecruiters exposes schema.org microdata, but also mounts an IE11
  // support overlay whose heading appears first in DOM order. Prefer the
  // JobPosting title over every generic heading.
  "main[itemtype*='JobPosting' i] [itemprop='title']",
  "[itemtype*='JobPosting' i] [itemprop='title']",
  "[itemprop='title']",
  // Generic data attributes used by many ATSs
  "[data-testid*='job-title' i]",
  "[data-qa*='job-title' i]",
  "[data-test*='job-title' i]",
  "[data-automation*='job-title' i]",
  // Class-based patterns
  "[class*='job-title' i]",
  "[class*='jobtitle' i]",
  "[class*='job__title' i] h1",
  "[class*='job__title' i]",
  "[class*='posting-headline'] h2",
  "[class*='posting-headline']",
  // Greenhouse / Lever / Workday headings
  "#app_body h1",
  ".posting-headline h2",
  ".app-title",
  // Fallbacks
  "main h1",
  "article h1",
  "[role='main'] h1",
  "h1",
] as const;

const DESCRIPTION_SELECTORS = [
  // Generic attribute-based
  "[data-testid*='job-description' i]",
  "[data-qa*='job-description' i]",
  "[data-automation*='job-description' i]",
  // Class-based patterns
  "[class*='job-description' i]",
  "[class*='jobdescription' i]",
  "[class*='job__description' i]",
  "[id*='job-description' i]",
  "[id*='jobdescription' i]",
  // Greenhouse / Lever / Workday containers
  "#job_description",
  "#jobDescriptionText",
  ".posting-description",
  "[class*='posting-description']",
  "section[class*='description']",
  // Fallbacks
  "main article",
  "article",
  "[role='main']",
  "main",
] as const;

const APPLY_SELECTOR = "button, a, input[type='submit'], [role='button']";
const JOB_HEADING_PATTERN =
  /\b(job description|about (?:the )?(?:job|role)|position description|role overview|responsibilities|what you(?:'|’)ll do|qualifications|requirements)\b|职位描述|岗位职责|任职要求/i;
const APPLY_PATTERN =
  /\b(apply(?:\s+now)?|quick apply|easy apply|submit application|express interest)\b|立即申请|申请职位|投递简历/i;
const URL_JOB_PATTERN = /(?:^|[/_.-])(job|jobs|career|careers|position|positions|vacancy|vacancies|role|roles|jd|posting|postings|opening|openings|requisition)(?:[/_.?-]|$)/i;
const INVALID_TITLE_PATTERN = /\b(?:internet explorer|browser (?:is )?not supported|unsupported browser|please (?:enable|update) (?:your )?browser|access denied|page not found|something went wrong|maintenance mode)\b/i;

export type QueryRoot = Document | ShadowRoot;

export type StructuredJobPosting = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  externalId?: string;
  datePosted?: string;
};

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function isVisible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.hidden || html.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(html);
  return style.display !== "none" && style.visibility !== "hidden";
}

function queryRoots(): QueryRoot[] {
  const roots: QueryRoot[] = [document];
  const seen = new Set<QueryRoot>(roots);

  for (let index = 0; index < roots.length && roots.length < 80; index += 1) {
    const root = roots[index];
    if (!root) continue;
    for (const element of Array.from(root.querySelectorAll("*"))) {
      if (element.shadowRoot && !seen.has(element.shadowRoot)) {
        seen.add(element.shadowRoot);
        roots.push(element.shadowRoot);
      }
    }
  }
  return roots;
}

function elements(selectors: string, roots: readonly QueryRoot[]): HTMLElement[] {
  return roots.flatMap((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(selectors)).filter(isVisible),
  );
}

function firstUsefulText(candidates: readonly HTMLElement[], minLength = 2, maxLength = 180): string {
  for (const candidate of candidates) {
    const text = cleanText(candidate.textContent);
    if (text.length >= minLength && text.length <= maxLength) return text;
  }
  return "";
}

function isUsefulJobTitle(value: string): boolean {
  const title = cleanText(value);
  if (title.length < 3 || title.length > 180) return false;
  return !INVALID_TITLE_PATTERN.test(title);
}

function jobTitleFromPage(roots: readonly QueryRoot[]): string {
  for (const selector of JOB_TITLE_SELECTORS) {
    const candidates = elements(selector, roots);
    const primaryCandidates = candidates.filter((candidate) =>
      !candidate.closest("aside, nav, footer, [role='complementary']"),
    );
    for (const candidate of primaryCandidates.length > 0 ? primaryCandidates : candidates) {
      const title = cleanText(candidate.textContent);
      if (isUsefulJobTitle(title)) return title;
    }
  }
  return "";
}

function labelledValue(labels: readonly string[], roots: readonly QueryRoot[]): string {
  const labelPattern = new RegExp(`^\\s*(?:${labels.join("|")})\\s*:?\\s*$`, "i");
  for (const element of elements("dt, th, label, strong, b, span, div, p", roots).slice(0, 500)) {
    if (!labelPattern.test(cleanText(element.textContent))) continue;
    const sibling = element.nextElementSibling as HTMLElement | null;
    const siblingText = cleanText(sibling?.textContent);
    if (siblingText && siblingText.length <= 180) return siblingText;
    const parentText = cleanText(element.parentElement?.textContent);
    const match = parentText.match(new RegExp(`(?:${labels.join("|")})\\s*:\\s*([^|·•\\n]{2,120})`, "i"));
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function companyFromBranding(roots: readonly QueryRoot[]): string {
  for (const image of elements("img[alt]", roots)) {
    const alt = cleanText(image.getAttribute("alt"));
    const match = alt.match(/^(.+?)\s+(?:logo|careers?)$/i);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function locationFromPage(roots: readonly QueryRoot[]): string {
  const semanticLocation = firstUsefulText(
    elements("[class*='job__location' i], [class*='job-location' i], [data-testid*='job-location' i]", roots),
    2,
    180,
  );
  return semanticLocation || labelledValue(["location", "work location", "location type"], roots);
}

function descriptionFromPage(roots: readonly QueryRoot[]): string {
  for (const selector of DESCRIPTION_SELECTORS) {
    const candidates = elements(selector, roots)
      .filter((element) => !element.closest("aside, nav, footer, [role='complementary']"))
      .map((element) => extractStructuredText(element))
      .filter((text) => text.length >= 120)
      .sort((left, right) => right.length - left.length);
    if (candidates[0]) return truncate(candidates[0], 18_000);
  }

  const heading = elements("h2, h3, h4", roots).find((element) => JOB_HEADING_PATTERN.test(cleanText(element.textContent)));
  const parentText = extractStructuredText(heading?.parentElement);
  return parentText.length >= 120 ? truncate(parentText, 18_000) : "";
}

function hasApplyAction(roots: readonly QueryRoot[]): boolean {
  return elements(APPLY_SELECTOR, roots).some((element) => {
    const text = cleanText(
      element.getAttribute("aria-label") ||
        element.getAttribute("value") ||
        element.textContent,
    );
    return APPLY_PATTERN.test(text);
  });
}

export function jobPostingFromStructuredData(): StructuredJobPosting | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']")).slice(0, 30);
  const postings: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth = 0): void => {
    if (!value || typeof value !== "object" || depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    const record = value as Record<string, unknown>;
    const type = record["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) {
      postings.push(record);
      return;
    }
    for (const child of Object.values(record)) visit(child, depth + 1);
  };

  for (const script of scripts) {
    try {
      visit(JSON.parse(script.textContent || ""));
    } catch {
      // Invalid third-party structured data should not prevent DOM inspection.
    }
  }
  if (postings.length === 0) return null;

  const currentUrl = window.location.href.toLowerCase();
  const currentIdentityTokens = decodeURIComponent(
    `${window.location.pathname} ${window.location.search}`,
  ).toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
  const activeHeading = cleanText(
    document.querySelector<HTMLElement>("main h1, [role='main'] h1, article h1, h1")?.textContent,
  ).toLowerCase();
  const score = (posting: Record<string, unknown>): number => {
    const identifier = posting.identifier as Record<string, unknown> | string | undefined;
    const externalId = cleanText(
      typeof identifier === "string" ? identifier : String(identifier?.value || ""),
    ).toLowerCase();
    const postingUrl = cleanText(String(posting.url || "")).toLowerCase();
    const title = cleanText(String(posting.title || "")).toLowerCase();
    return (
      (postingUrl && currentUrl.includes(postingUrl) ? 100 : 0) +
      (externalId && currentIdentityTokens.includes(externalId) ? 80 : 0) +
      (title && activeHeading && (title === activeHeading || activeHeading.includes(title)) ? 40 : 0)
    );
  };
  const posting = postings.reduce((best, candidate) =>
    score(candidate) > score(best) ? candidate : best,
  );
  const organization = posting.hiringOrganization as Record<string, unknown> | undefined;
  const location = posting.jobLocation as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  const firstLocation = Array.isArray(location) ? location[0] : location;
  const address = firstLocation?.address as Record<string, unknown> | undefined;
  const identifier = posting.identifier as Record<string, unknown> | string | undefined;
  const tmpDiv = document.createElement("div");
  tmpDiv.innerHTML = String(posting.description || "");
  const rawDesc = extractStructuredText(tmpDiv);
  return {
    title: cleanText(String(posting.title || "")) || undefined,
    company: cleanText(String(organization?.name || "")) || undefined,
    location: cleanText(
      [address?.addressLocality, address?.addressRegion, address?.addressCountry]
        .filter((value) => typeof value === "string")
        .join(", "),
    ) || undefined,
    description: rawDesc || undefined,
    externalId: cleanText(
      typeof identifier === "string" ? identifier : String(identifier?.value || ""),
    ) || undefined,
    datePosted: cleanText(String(posting.datePosted || "")) || undefined,
  };
}

/**
 * Read schema.org microdata used by SmartRecruiters and several company ATS
 * pages. Unlike JSON-LD it is rendered alongside the posting, so it remains
 * available when an ATS has no JSON-LD script at all.
 */
export function jobPostingFromMicrodata(
  roots: readonly QueryRoot[] = [document],
): StructuredJobPosting | null {
  const propertyValue = (scope: ParentNode, property: string): string => {
    const element = scope.querySelector<HTMLElement>(`[itemprop='${property}']`);
    if (!element) return "";
    return cleanText(
      element.getAttribute("content") ||
        element.getAttribute("datetime") ||
        element.getAttribute("href") ||
      element.textContent,
    );
  };
  const postings = elements("[itemscope][itemtype*='JobPosting' i]", roots);
  if (postings.length === 0) return null;
  const currentIdentityTokens = decodeURIComponent(
    `${window.location.pathname} ${window.location.search}`,
  ).toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
  const activeHeading = cleanText(
    document.querySelector<HTMLElement>("main h1, [role='main'] h1, article h1, h1")?.textContent,
  ).toLowerCase();
  const score = (posting: HTMLElement): number => {
    const title = propertyValue(posting, "title").toLowerCase();
    const identifier = propertyValue(posting, "identifier").toLowerCase();
    return (
      (!posting.closest("aside, nav, footer, [role='complementary']") ? 20 : 0) +
      (identifier && currentIdentityTokens.includes(identifier) ? 80 : 0) +
      (title && activeHeading && (title === activeHeading || activeHeading.includes(title)) ? 40 : 0)
    );
  };
  const posting = postings.reduce((best, candidate) =>
    score(candidate) > score(best) ? candidate : best,
  );
  const title = propertyValue(posting, "title");
  const companyScope = posting.querySelector<HTMLElement>("[itemprop='hiringOrganization']");
  const locationScope = posting.querySelector<HTMLElement>("[itemprop='jobLocation']");
  const location = locationScope
    ? [
        propertyValue(locationScope, "streetAddress"),
        propertyValue(locationScope, "addressLocality"),
        propertyValue(locationScope, "addressRegion"),
        propertyValue(locationScope, "addressCountry"),
      ].filter(Boolean).join(", ")
    : "";
  const descriptionElement = posting.querySelector<HTMLElement>("[itemprop='description']");
  const description = extractStructuredText(descriptionElement);

  // A page's URL is only a fallback identifier. It is intentionally kept out
  // of the title/description source so it cannot make two page variants score
  // differently when their posting microdata is otherwise identical.
  return {
    title: isUsefulJobTitle(title) ? title : undefined,
    company: companyScope ? propertyValue(companyScope, "name") || undefined : undefined,
    location: location || undefined,
    description: description || undefined,
    externalId: propertyValue(posting, "identifier") || undefined,
    datePosted: propertyValue(posting, "datePosted") || undefined,
  };
}

/**
 * Generic date-posted scraper for ATS pages.
 * Tries <time datetime> first, then looks for spans/divs containing
 * common relative-date patterns.
 */
export function datePostedFromDom(): string | undefined {
  // 1. Meta tags are common on ATS and company career pages
  const metaSelectors = [
    "meta[property='article:published_time']",
    "meta[name='datePosted']",
    "meta[name='date']",
    "meta[property='og:article:published_time']",
    "meta[itemprop='datePosted']",
    "meta[name='dcterms.created']",
  ];
  for (const selector of metaSelectors) {
    const meta = document.querySelector<HTMLMetaElement>(selector);
    const content = cleanText(meta?.getAttribute("content"));
    if (content) return content;
  }

  // 2. Machine-readable <time> is the most reliable signal
  const timeEl = document.querySelector<HTMLElement>("time[datetime]");
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }

  // 3. Scan candidate elements for relative or standard date text
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "[data-testid*='date' i]",
        "[class*='posted' i]",
        "[class*='date' i]",
        "[class*='age' i]",
        "[id*='date' i]",
      ].join(", "),
    ),
  ).slice(0, 50);

  const datePattern = /\b(?:(?:posted|reposted|over|more\s+than)\s+)*(?:\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|[dhwmy]|mo)\s*(?:ago)?|today|yesterday|just\s+(?:now|posted))\b/i;
  const zhPattern = /(?:(?:发布于|重新发布于)\s*)?(?:\d+\s*\+?\s*(?:个?月|周|天|小时|分钟)前|刚刚|今天|昨天)/;
  const isoPattern = /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?\b/;

  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = cleanText(el.textContent);
    if (text.length > 80) continue; // skip large containers
    const match = text.match(datePattern) || text.match(zhPattern) || text.match(isoPattern);
    if (match?.[0]) {
      return match[0].trim();
    }
  }
  return undefined;
}

export function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `page-${(hash >>> 0).toString(16)}`;
}

/**
 * Detect a job page from its visible content. The threshold deliberately
 * requires multiple independent signals so normal marketing and login pages
 * do not turn into phantom job records.
 */
export function readGenericJobPage(): PageInspection {
  const url = window.location.href;
  const roots = queryRoots();
  const structured = jobPostingFromStructuredData() || jobPostingFromMicrodata(roots);
  const title =
    structured?.title ||
    jobTitleFromPage(roots) ||
    "";
  const description = structured?.description || descriptionFromPage(roots);
  const company =
    structured?.company ||
    labelledValue(["company", "employer", "organisation", "organization"], roots) ||
    companyFromBranding(roots) ||
    "";
  const location =
    structured?.location ||
    locationFromPage(roots) ||
    "";
  const hasJobHeading = elements("h2, h3, h4", roots)
    .some((element) => JOB_HEADING_PATTERN.test(cleanText(element.textContent)));
  const applyAction = hasApplyAction(roots);
  const urlLooksLikeJob = URL_JOB_PATTERN.test(new URL(url).pathname);

  let confidence = 0;
  if (title) confidence += 2;
  if (description.length >= 180) confidence += 3;
  else if (description.length >= 90) confidence += 2;
  if (structured) confidence += 3;
  if (hasJobHeading) confidence += 2;
  if (applyAction) confidence += 2;
  if (company) confidence += 1;
  if (urlLooksLikeJob) confidence += 1;

  const enoughEvidence = Boolean(title) && (
    Boolean(structured) ||
    (description.length >= 90 && (applyAction || hasJobHeading || urlLooksLikeJob)) ||
    (description.length >= 180 && confidence >= 5)
  );
  if (!enoughEvidence) {
    return {
      kind: "unsupported_page",
      url,
      reason: "No job posting could be confirmed from the visible page content.",
    };
  }

  const rawDatePosted = structured?.datePosted || datePostedFromDom();
  const snapshot: GenericJobSnapshot = {
    platform: "generic",
    externalId: structured?.externalId || stableId(`${url}|${title}|${company}`),
    url,
    title,
    company: company || "Unknown company",
    location: location || undefined,
    ...capturedJobDateFields(rawDatePosted),
    description: description || undefined,
    technologies: extractTechnologyKeywords(description),
  };
  return { kind: "job", snapshot };
}
