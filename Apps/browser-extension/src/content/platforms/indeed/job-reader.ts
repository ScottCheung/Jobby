/**
 * Indeed-specific job page reader.
 *
 * Indeed's pages are rendered server-side with well-known class patterns and
 * a rich `JobPosting` JSON-LD block. We first try the structured data
 * (already handled by the generic reader's `jobPostingFromStructuredData`)
 * then fall back to Indeed-specific DOM selectors.
 */
import type { IndeedJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";
import { extractTechnologyKeywords } from "../../technology-keywords";
import { extractStructuredText } from "../../text-utils";

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

function getIndeedDetailRoot(): ParentNode {
  const pane = document.querySelector<HTMLElement>(
    ".jobsearch-RightPane, .jobsearch-ViewJobPaneWrapper, #jobsearch-ViewjobPane, #viewJobSSRRoot, .jobsearch-JobComponent, .fastviewjob, main"
  );
  if (pane) return pane;
  return document;
}

function firstText(...selectors: string[]): string {
  const root = getIndeedDetailRoot();
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    if (el && isVisible(el)) {
      const text = cleanText(el.textContent);
      if (text) return text;
    }
  }
  if (root !== document) {
    for (const selector of selectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && isVisible(el)) {
        const text = cleanText(el.textContent);
        if (text) return text;
      }
    }
  }
  return "";
}

function structuredJobPosting(): {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  externalId?: string;
  datePosted?: string;
} | null {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']"),
  ).slice(0, 30);
  const visit = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const match = visit(item);
        if (match) return match;
      }
      return null;
    }
    const record = value as Record<string, unknown>;
    const type = record["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return record;
    return visit(record["@graph"]);
  };
  for (const script of scripts) {
    try {
      const posting = visit(JSON.parse(script.textContent || ""));
      if (!posting) continue;
      const organization = posting.hiringOrganization as Record<string, unknown> | undefined;
      const location = posting.jobLocation as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
      const firstLocation = Array.isArray(location) ? location[0] : location;
      const address = firstLocation?.address as Record<string, unknown> | undefined;
      const identifier = posting.identifier as Record<string, unknown> | string | undefined;
      // Indeed embeds the full HTML description. Parse it structurally to preserve newlines.
      const tmpDiv = document.createElement('div');
      tmpDiv.innerHTML = String(posting.description || "");
      const rawDesc = extractStructuredText(tmpDiv);

      // Build location string from address parts
      const addressParts = [
        address?.addressLocality,
        address?.addressRegion,
        address?.addressCountry,
      ].filter((v) => typeof v === "string" && String(v).trim());
      // Some JSON-LD embeds location directly on jobLocation as a string or .name
      const locationStr =
        addressParts.length > 0
          ? cleanText(addressParts.join(", "))
          : cleanText(
              typeof firstLocation === "object" && firstLocation !== null
                ? String((firstLocation as Record<string, unknown>).name || "")
                : typeof location === "string"
                ? location
                : "",
            );

      return {
        title: cleanText(String(posting.title || "")) || undefined,
        company: cleanText(String(organization?.name || "")) || undefined,
        location: locationStr || undefined,
        description: rawDesc || undefined,
        externalId:
          cleanText(
            typeof identifier === "string" ? identifier : String(identifier?.value || ""),
          ) || undefined,
        datePosted: cleanText(String(posting.datePosted || "")) || undefined,
      };
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Extract posting date from Indeed's DOM.
 * Indeed uses relative-date spans near the job header,
 * e.g. "Posted 3 days ago", "Posted today", "30+ days ago".
 */
function datePostedFromDom(_jobKey?: string): string | undefined {
  const root = getIndeedDetailRoot();
  // Try <time> elements first — most reliable
  const timeEl = root.querySelector<HTMLElement>("time[datetime]") || document.querySelector<HTMLElement>("time[datetime]");
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }

  const datePattern = /\b(?:posted\s+)?(?:\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|[dhwmy]|mo)\s*(?:ago)?|today|yesterday|just\s+(?:now|posted))\b/i;

  const selectors = [
    "[data-testid='jobsearch-JobMetadataFooter-item']",
    "[data-testid='myJobsStateDate']",
    "[class*='jobsearch-JobMetadataFooter']",
    "[class*='jobsearch-HiringInsights-date']",
    "span[class*='date' i]",
    "span[class*='posted' i]",
  ];
  for (const selector of selectors) {
    const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
    for (const element of elements) {
      const text = cleanText(element.textContent);
      if (text && datePattern.test(text)) {
        return text;
      }
    }
  }

  if (root !== document) {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
      for (const element of elements) {
        const text = cleanText(element.textContent);
        if (text && datePattern.test(text)) {
          return text;
        }
      }
    }
  }

  return undefined;
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `indeed-${(hash >>> 0).toString(16)}`;
}

export function readIndeedJobPage(): PageInspection {
  const url = window.location.href;
  const root = getIndeedDetailRoot();

  // 1. Try structured data first — most reliable on standalone Indeed job views.
  const structured = structuredJobPosting();

  // 2. DOM fallbacks with Indeed-specific selectors.
  const title =
    structured?.title ||
    firstText(
      "[data-testid='jobsearch-JobInfoHeader-title']",
      ".jobsearch-JobInfoHeader-title",
      "h1[class*='jobsearch-JobInfoHeader-title']",
      "h2[class*='jobsearch-JobInfoHeader-title']",
      "[class*='jobsearch-JobInfoHeader-title']",
      "h1[class*='job-title']",
      ".jobsearch-RightPane h1",
      "h1",
    );

  const company =
    structured?.company ||
    firstText(
      "[data-testid='inlineHeader-companyName'] a",
      "[data-testid='inlineHeader-companyName']",
      ".jobsearch-InlineCompanyRating-companyHeader a",
      ".jobsearch-InlineCompanyRating-companyHeader",
      "[data-company-name='true']",
      "[class*='jobsearch-CompanyInfoContainer'] a",
      "[class*='companyName']",
    );

  const location =
    structured?.location ||
    firstText(
      "[data-testid='job-location']",
      "[data-testid='inlineHeader-companyLocation']",
      "[class*='inlineHeader-companyLocation']",
      "[data-testid='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
      "[class*='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
      "[class*='companyLocation']",
      "[data-testid='jobsearch-JobInfoHeader-subtitle'] div",
      "[class*='jobsearch-JobInfoHeader-subtitle'] div",
    ) || undefined;

  let description = structured?.description || "";
  if (!description) {
    const descEl =
      root.querySelector<HTMLElement>("#jobDescriptionText") ||
      root.querySelector<HTMLElement>("[class*='jobsearch-jobDescriptionText']") ||
      root.querySelector<HTMLElement>("[data-testid='jobsearch-jobDescriptionText']") ||
      root.querySelector<HTMLElement>("#jobDescriptionSection") ||
      root.querySelector<HTMLElement>("[data-testid='jobDescriptionText']") ||
      document.querySelector<HTMLElement>("#jobDescriptionText") ||
      document.querySelector<HTMLElement>("[class*='jobsearch-jobDescriptionText']");
    if (descEl) {
      description = truncate(extractStructuredText(descEl), 18_000);
    }
  }

  const externalId =
    structured?.externalId ||
    (() => {
      // Indeed puts the job key in the URL: /viewjob?jk=<key> or ?vjk=<key> or ?jobkey=<key>
      const match = url.match(/[?&](?:jk|vjk|jobkey)=([a-z0-9]+)/i);
      if (match?.[1]) return match[1];

      const domKey =
        document.querySelector<HTMLElement>("[data-jk]")?.getAttribute("data-jk") ||
        document.querySelector<HTMLElement>("[data-mobtk]")?.getAttribute("data-mobtk");
      if (domKey) return domKey;

      return stableId(`${url}|${title}|${company}`);
    })();

  const datePosted = structured?.datePosted || datePostedFromDom(externalId);

  const enoughEvidence = Boolean(title) && (Boolean(structured) || description.length >= 10 || Boolean(company));
  if (!enoughEvidence) {
    return {
      kind: "unsupported_page",
      url,
      reason: "No Indeed job posting could be confirmed from the visible page content.",
    };
  }

  const snapshot: IndeedJobSnapshot = {
    platform: "indeed",
    externalId,
    url,
    title,
    company: company || "Unknown company",
    location: location || undefined,
    datePosted: datePosted || undefined,
    description: description || undefined,
    technologies: extractTechnologyKeywords(description),
    easyApply:
      Boolean(document.querySelector("[id*='indeedApplyButton'], [class*='indeed-apply-button'], [data-testid='indeedApplyButton'], [aria-label*='Apply with Indeed' i], button.ia-IndeedApplyButton")) ||
      Boolean(document.querySelector("[data-indeed-apply]")),
  };
  return { kind: "job", snapshot };
}
