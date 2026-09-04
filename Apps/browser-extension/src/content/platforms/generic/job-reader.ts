import type { GenericJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";

import { extractTechnologyKeywords } from "../../technology-keywords";
import { extractStructuredText } from "../../text-utils";
import { capturedJobDateFields } from '@jobby/ui/lib/date-formatter';
import {
  type QueryRoot,
  type StructuredJobPosting,
  cleanText,
  isElementVisible as isVisible,
  isUsefulJobTitle,
  jobPostingFromStructuredData,
  jobPostingFromMicrodata,
  datePostedFromDom,
  stableId,
} from "../shared/job-metadata";

export type { QueryRoot, StructuredJobPosting };
export {
  jobPostingFromStructuredData,
  jobPostingFromMicrodata,
  datePostedFromDom,
  stableId,
};

const JOB_TITLE_SELECTORS = [
  "main[itemtype*='JobPosting' i] [itemprop='title']",
  "[itemtype*='JobPosting' i] [itemprop='title']",
  "[itemprop='title']",
  "[data-testid*='job-title' i]",
  "[data-qa*='job-title' i]",
  "[data-test*='job-title' i]",
  "[data-automation*='job-title' i]",
  "[class*='job-title' i]",
  "[class*='jobtitle' i]",
  "[class*='job__title' i] h1",
  "[class*='job__title' i]",
  "[class*='posting-headline'] h2",
  "[class*='posting-headline']",
  "#app_body h1",
  ".posting-headline h2",
  ".app-title",
  "main h1",
  "article h1",
  "[role='main'] h1",
  "h1",
] as const;

const DESCRIPTION_SELECTORS = [
  "[data-testid*='job-description' i]",
  "[data-qa*='job-description' i]",
  "[data-automation*='job-description' i]",
  "[class*='job-description' i]",
  "[class*='jobdescription' i]",
  "[class*='job__description' i]",
  "[id*='job-description' i]",
  "[id*='jobdescription' i]",
  "#job_description",
  "#jobDescriptionText",
  ".posting-description",
  "[class*='posting-description']",
  "section[class*='description']",
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

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function queryRoots(): QueryRoot[] {
  const roots: QueryRoot[] = [document];
  const seen = new Set<QueryRoot>(roots);

  for (let index = 0; index < roots.length && roots.length < 40; index += 1) {
    const root = roots[index];
    if (!root) continue;
    const candidates = Array.from(root.querySelectorAll<HTMLElement>("*:not(style):not(script)")).slice(0, 1000);
    for (const element of candidates) {
      if (element.shadowRoot && !seen.has(element.shadowRoot)) {
        seen.add(element.shadowRoot);
        roots.push(element.shadowRoot);
      }
    }
  }
  return roots;
}

function jobTitleFromPage(roots: readonly QueryRoot[]): string {
  for (const selector of JOB_TITLE_SELECTORS) {
    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector)).slice(0, 15);
      const primaryCandidates = candidates.filter((candidate) =>
        !candidate.closest("aside, nav, footer, [role='complementary']"),
      );
      const list = primaryCandidates.length > 0 ? primaryCandidates : candidates;
      for (const candidate of list) {
        const title = cleanText(candidate.textContent);
        if (isUsefulJobTitle(title) && isVisible(candidate)) return title;
      }
    }
  }
  return "";
}

function labelledValue(labels: readonly string[], roots: readonly QueryRoot[]): string {
  const labelPattern = new RegExp(`^\\s*(?:${labels.join("|")})\\s*:?\\s*$`, "i");
  for (const root of roots) {
    const elements = Array.from(root.querySelectorAll<HTMLElement>("dt, th, label, strong, b, span, div, p")).slice(0, 300);
    for (const element of elements) {
      const text = cleanText(element.textContent);
      if (!text || text.length > 60 || !labelPattern.test(text)) continue;
      if (!isVisible(element)) continue;
      const sibling = element.nextElementSibling as HTMLElement | null;
      const siblingText = cleanText(sibling?.textContent);
      if (siblingText && siblingText.length <= 180 && (!sibling || isVisible(sibling))) return siblingText;
      const parentText = cleanText(element.parentElement?.textContent);
      const match = parentText.match(new RegExp(`(?:${labels.join("|")})\\s*:\\s*([^|·•\\n]{2,120})`, "i"));
      if (match?.[1]) return cleanText(match[1]);
    }
  }
  return "";
}

function companyFromBranding(roots: readonly QueryRoot[]): string {
  for (const root of roots) {
    for (const image of Array.from(root.querySelectorAll<HTMLElement>("img[alt]")).slice(0, 20)) {
      const alt = cleanText(image.getAttribute("alt"));
      const match = alt.match(/^(.+?)\s+(?:logo|careers?)$/i);
      if (match?.[1] && isVisible(image)) return cleanText(match[1]);
    }
  }
  return "";
}

function locationFromPage(roots: readonly QueryRoot[]): string {
  for (const root of roots) {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>(
        "[class*='job__location' i], [class*='job-location' i], [data-testid*='job-location' i]",
      ),
    ).slice(0, 10);
    for (const candidate of candidates) {
      const text = cleanText(candidate.textContent);
      if (text.length >= 2 && text.length <= 180 && isVisible(candidate)) {
        return text;
      }
    }
  }
  return labelledValue(["location", "work location", "location type"], roots);
}

function descriptionFromPage(roots: readonly QueryRoot[]): string {
  for (const selector of DESCRIPTION_SELECTORS) {
    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
        .filter((element) => !element.closest("aside, nav, footer, [role='complementary']"))
        .slice(0, 10);
      for (const element of candidates) {
        const text = extractStructuredText(element);
        if (text.length >= 120 && isVisible(element)) {
          return truncate(text, 18_000);
        }
      }
    }
  }

  for (const root of roots) {
    const headings = Array.from(root.querySelectorAll<HTMLElement>("h2, h3, h4")).slice(0, 30);
    const heading = headings.find((element) => JOB_HEADING_PATTERN.test(cleanText(element.textContent)));
    if (heading) {
      const parentText = extractStructuredText(heading.parentElement);
      if (parentText.length >= 120 && isVisible(heading)) return truncate(parentText, 18_000);
    }
  }
  return "";
}

function hasApplyAction(roots: readonly QueryRoot[]): boolean {
  for (const root of roots) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(APPLY_SELECTOR)).slice(0, 150);
    for (const element of candidates) {
      const text = cleanText(
        element.getAttribute("aria-label") ||
          element.getAttribute("value") ||
          element.textContent,
      );
      if (text && APPLY_PATTERN.test(text) && isVisible(element)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Detect a job page from its visible content. The threshold deliberately
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
  const hasJobHeading = roots.some((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("h2, h3, h4"))
      .slice(0, 30)
      .some((element) => JOB_HEADING_PATTERN.test(cleanText(element.textContent)) && isVisible(element)),
  );
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
    technologies: extractTechnologyKeywords([title, description].filter(Boolean).join("\n\n")),
  };
  return { kind: "job", snapshot };
}
