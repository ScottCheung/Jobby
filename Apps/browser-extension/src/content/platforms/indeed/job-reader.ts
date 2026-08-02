/**
 * Indeed-specific job page reader.
 *
 * Indeed's pages are rendered server-side with well-known class patterns and
 * a rich `JobPosting` JSON-LD block. We first try the structured data
 * (already handled by the generic reader's `jobPostingFromStructuredData`)
 * then fall back to Indeed-specific DOM selectors.
 */
import type { GenericJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";
import { extractTechnologyKeywords } from "../../technology-keywords";

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

function firstText(...selectors: string[]): string {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && isVisible(el)) {
      const text = cleanText(el.textContent);
      if (text) return text;
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
      // Indeed embeds the full HTML description; strip tags.
      const rawDesc = String(posting.description || "").replace(/<[^>]*>/g, " ");

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
        description: cleanText(rawDesc) || undefined,
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
function datePostedFromDom(): string | undefined {
  // Try <time> elements first — most reliable
  const timeEl = document.querySelector<HTMLElement>(
    "time[datetime], [data-testid*='date'] time, [class*='date'] time",
  );
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }

  // Indeed often wraps the posting date in a span near the header
  const selectors = [
    "[data-testid='jobsearch-JobMetadataFooter-item']",
    "[class*='PostedDate']",
    "[class*='posted-date']",
    "[class*='postedDate']",
    "[class*='date-posted']",
    "[class*='job-age']",
    "span[class*='date']",
  ];
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(selectors.join(", ")),
  );
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = cleanText(el.textContent);
    // Match "Posted 3 days ago", "30+ days ago", "Today", etc.
    if (/\b(posted|today|yesterday|\d+\s*\+?\s*days?\s+ago|just\s+posted|recently\s+posted)\b/i.test(text)) {
      return text;
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

  // 1. Try structured data first — most reliable on Indeed.
  const structured = structuredJobPosting();

  // 2. DOM fallbacks with Indeed-specific selectors.
  const title =
    structured?.title ||
    firstText(
      "[data-testid='jobsearch-JobInfoHeader-title']",
      ".jobsearch-JobInfoHeader-title",
      "[class*='jobsearch-JobInfoHeader-title']",
      "h1[class*='job-title']",
      "h1",
    );

  const company =
    structured?.company ||
    firstText(
      "[data-testid='inlineHeader-companyName'] a",
      "[data-testid='inlineHeader-companyName']",
      ".jobsearch-InlineCompanyRating-companyHeader a",
      "[class*='jobsearch-CompanyInfoContainer'] a",
      "[class*='companyName']",
    );

  // Location: Indeed has moved across many DOM shapes. Try structured data
  // then a wide set of selectors covering both old and new layouts.
  const location =
    structured?.location ||
    firstText(
      // New layout (2024+)
      "[data-testid='job-location']",
      "[data-testid='inlineHeader-companyLocation']",
      "[class*='inlineHeader-companyLocation']",
      // Classic layout subtitle row
      "[data-testid='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
      "[class*='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
      "[class*='companyLocation']",
      // Fallback divs/spans within the subtitle row
      "[data-testid='jobsearch-JobInfoHeader-subtitle'] div",
      "[class*='jobsearch-JobInfoHeader-subtitle'] div",
    ) || undefined;

  // Description: Indeed renders it inside a `#jobDescriptionText` or
  // `[class*='jobsearch-jobDescriptionText']` container.
  let description = structured?.description || "";
  if (!description) {
    const descEl =
      document.querySelector<HTMLElement>("#jobDescriptionText") ||
      document.querySelector<HTMLElement>("[class*='jobsearch-jobDescriptionText']") ||
      document.querySelector<HTMLElement>("[data-testid='jobsearch-jobDescriptionText']");
    if (descEl) {
      description = truncate(cleanText(descEl.textContent), 18_000);
    }
  }

  const externalId =
    structured?.externalId ||
    (() => {
      // Indeed puts the job key in the URL: /viewjob?jk=<key>
      const match = url.match(/[?&]jk=([a-z0-9]+)/i);
      return match?.[1] || stableId(`${url}|${title}|${company}`);
    })();

  // Date posted: prefer JSON-LD datePosted, fall back to DOM scraping
  const datePosted = structured?.datePosted || datePostedFromDom();

  const enoughEvidence = Boolean(title) && (Boolean(structured) || description.length >= 90);
  if (!enoughEvidence) {
    return {
      kind: "unsupported_page",
      url,
      reason: "No Indeed job posting could be confirmed from the visible page content.",
    };
  }

  const snapshot: GenericJobSnapshot = {
    platform: "generic",
    externalId,
    url,
    title,
    company: company || "Unknown company",
    location: location || undefined,
    datePosted: datePosted || undefined,
    description: description || undefined,
    technologies: extractTechnologyKeywords(description),
    easyApply:
      Boolean(document.querySelector("[id*='indeedApplyButton'], [class*='indeed-apply-button']")) ||
      Boolean(document.querySelector("[data-indeed-apply]")),
  };
  return { kind: "job", snapshot };
}
