/**
 * Indeed-specific job page reader.
 *
 * Indeed's pages are rendered server-side with well-known class patterns and
 * a rich `JobPosting` JSON-LD block. We first try the structured data
 * (already handled by the generic reader's `jobPostingFromStructuredData`)
 * then fall back to Indeed-specific DOM selectors.
 */
import type { IndeedJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";
import { capturedJobDateFields } from "../../../shared/utils/date-formatter";
import { extractTechnologyKeywords, mergeSkills } from "../../technology-keywords";
import { extractStructuredText } from "../../text-utils";
import {
  clearJobDescriptionRoot,
  rememberJobDescriptionRoot,
} from "../../dom/job-description-root";

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

function selectedIndeedCard(root: ParentNode = document): HTMLElement | null {
  const selectors = [
    "[data-jk][aria-selected='true']",
    "[data-jk][aria-current='true']",
    "[data-jk][data-selected='true']",
    "[data-jk][aria-pressed='true']",
    "[data-jk]:has(a[aria-current='true'])",
    "[data-jk].resultWithShelf",
    "[data-jk][class~='selected']",
    ".job_seen_beacon.selected",
  ];
  for (const selector of selectors) {
    const card = root.querySelector<HTMLElement>(selector);
    if (card) return card.closest<HTMLElement>(".job_seen_beacon") || card;
  }
  return null;
}

function indeedJobKey(root: ParentNode | null): string {
  if (!root) return "";
  return cleanText(
    (root as HTMLElement).getAttribute?.("data-jk") ||
      root.querySelector<HTMLElement>("[data-jk]")?.getAttribute("data-jk"),
  );
}

function getIndeedTargetJobKey(url: string): string | undefined {
  // Indeed frequently keeps the previous `vjk` in the URL while replacing the
  // selected card and detail pane. In split view, the selected card is the
  // current source of truth; preferring the URL here re-reads the old job.
  const selectedCard = selectedIndeedCard(document);
  const cardKey = indeedJobKey(selectedCard);
  if (cardKey) return cardKey;

  const match = url.match(/[?&](?:jk|vjk|jobkey)=([^&#]+)/i);
  if (match?.[1]) return match[1];

  const detail = document.querySelector<HTMLElement>(
    ".jobsearch-RightPane, .jobsearch-ViewJobPaneWrapper, #jobsearch-ViewjobPane, #viewJobSSRRoot, .jobsearch-JobComponent, .fastviewjob, [data-testid='jobsearch-ViewjobPane']",
  );
  const detailKey =
    cleanText(detail?.getAttribute("data-jk")) ||
    cleanText(detail?.querySelector<HTMLElement>("[data-jk]")?.getAttribute("data-jk")) ||
    cleanText(detail?.querySelector<HTMLElement>("[data-mobtk]")?.getAttribute("data-mobtk"));
  if (detailKey) return detailKey;

  return undefined;
}

function getDetailPaneJobKey(detailRoot: HTMLElement): string | undefined {
  const directKey = cleanText(detailRoot.getAttribute("data-jk"));
  if (directKey) return directKey;

  const innerKey = cleanText(
    detailRoot.querySelector<HTMLElement>("[data-jk]")?.getAttribute("data-jk") ||
    detailRoot.querySelector<HTMLElement>("[data-job-id]")?.getAttribute("data-job-id") ||
    detailRoot.querySelector<HTMLElement>("[data-mobtk]")?.getAttribute("data-mobtk"),
  );
  if (innerKey) return innerKey;

  const linkWithKey = detailRoot.querySelector<HTMLAnchorElement>(
    "a[href*='jk='], a[href*='vjk='], a[href*='fromjk=']",
  );
  if (linkWithKey) {
    const match = linkWithKey.href.match(/[?&](?:jk|vjk|fromjk|jobkey)=([^&#]+)/i);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

function getIndeedDetailRoot(): HTMLElement | null {
  const pane = document.querySelector<HTMLElement>(
    ".jobsearch-RightPane, .jobsearch-ViewJobPaneWrapper, #jobsearch-ViewjobPane, #viewJobSSRRoot, .jobsearch-JobComponent, .fastviewjob, [data-testid='jobsearch-ViewjobPane']",
  );
  if (pane) return pane;

  const isMultiCardPage = document.querySelectorAll(".job_seen_beacon, [data-jk]").length > 1;
  if (!isMultiCardPage) {
    const mainEl = document.querySelector<HTMLElement>("main, #main, [role='main']");
    if (mainEl) return mainEl;
  }
  return null;
}

function firstTextIn(root: ParentNode, ...selectors: string[]): string {
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    if (el && isVisible(el)) {
      const text = cleanText(el.textContent);
      if (text) return text;
    }
  }
  return "";
}

function structuredJobPosting(targetExternalId?: string): {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  externalId?: string;
  datePosted?: string;
} | null {
  const isMultiCardPage = document.querySelectorAll(".job_seen_beacon, [data-jk]").length > 1;
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
      const externalId =
        cleanText(
          typeof identifier === "string" ? identifier : String(identifier?.value || ""),
        ) || undefined;

      // JSON-LD on an Indeed search page can describe the server-rendered
      // previous job. Use it only when it explicitly identifies the selected
      // job; otherwise the visible card/detail pane is authoritative.
      if (isMultiCardPage && (!targetExternalId || externalId !== targetExternalId)) {
        continue;
      }

      // Indeed embeds the full HTML description. Parse it structurally to preserve newlines.
      const tmpDiv = document.createElement("div");
      tmpDiv.innerHTML = String(posting.description || "");
      const rawDesc = extractStructuredText(tmpDiv);

      // Build location string from address parts
      const addressParts = [
        address?.addressLocality,
        address?.addressRegion,
        address?.addressCountry,
      ].filter((v) => typeof v === "string" && String(v).trim());
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
        externalId,
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
function datePostedFromDom(root: ParentNode): string | undefined {
  // Try <time> elements first — most reliable
  const timeEl = root.querySelector<HTMLElement>("time[datetime]");
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }

  const datePattern =
    /\b(?:posted\s+)?(?:\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|[dhwmy]|mo)\s*(?:ago)?|today|yesterday|just\s+(?:now|posted))\b/i;

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
  clearJobDescriptionRoot("indeed");
  const url = window.location.href;
  const targetKey = getIndeedTargetJobKey(url);
  const detailRoot = getIndeedDetailRoot();

  // Find the selected card, matching targetKey if present
  let selectedCard: HTMLElement | null = null;
  if (targetKey) {
    const matchingElement = document.querySelector<HTMLElement>(
      `[data-jk='${targetKey}'], .job_seen_beacon:has(a[href*='${targetKey}'])`,
    );
    selectedCard = matchingElement?.closest<HTMLElement>(".job_seen_beacon") || matchingElement;
  }
  if (!selectedCard) {
    selectedCard = selectedIndeedCard(document);
  }

  // Check if detail pane matches the target key
  const detailKey = detailRoot ? getDetailPaneJobKey(detailRoot) : undefined;
  const isDetailMismatch = Boolean(
    targetKey && detailKey && targetKey !== detailKey,
  );

  // 1. Try structured data first (only if it matches target key)
  const structured = structuredJobPosting(targetKey);

  // 2. Extract from detail pane if not mismatched, otherwise fall back to selected card
  const primaryRoot = (!isDetailMismatch && detailRoot) ? detailRoot : selectedCard;
  const fallbackRoot = isDetailMismatch ?
    selectedCard || document.body
  : detailRoot || selectedCard || document.body;

  const title =
    structured?.title ||
    (primaryRoot ?
      firstTextIn(
        primaryRoot,
        "[data-testid='jobsearch-JobInfoHeader-title']",
        ".jobsearch-JobInfoHeader-title",
        "h1[class*='jobsearch-JobInfoHeader-title']",
        "h2[class*='jobsearch-JobInfoHeader-title']",
        "[class*='jobsearch-JobInfoHeader-title']",
        "h1[class*='job-title']",
        "h2.jobTitle",
        "[data-testid='job-title']",
        "h1",
      )
    : "") ||
    firstTextIn(
      fallbackRoot,
      "[data-testid='jobsearch-JobInfoHeader-title']",
      ".jobsearch-JobInfoHeader-title",
      "h1[class*='jobsearch-JobInfoHeader-title']",
      "h2[class*='jobsearch-JobInfoHeader-title']",
      "[class*='jobsearch-JobInfoHeader-title']",
      "h1[class*='job-title']",
      "h2.jobTitle",
      "[data-testid='job-title']",
      "h1",
    );

  const company =
    structured?.company ||
    (primaryRoot ?
      firstTextIn(
        primaryRoot,
        "[data-testid='inlineHeader-companyName'] a",
        "[data-testid='inlineHeader-companyName']",
        ".jobsearch-InlineCompanyRating-companyHeader a",
        ".jobsearch-InlineCompanyRating-companyHeader",
        "[data-company-name='true']",
        "[data-testid='company-name']",
        "[class*='jobsearch-CompanyInfoContainer'] a",
        "[class*='companyName']",
      )
    : "") ||
    firstTextIn(
      fallbackRoot,
      "[data-testid='inlineHeader-companyName'] a",
      "[data-testid='inlineHeader-companyName']",
      ".jobsearch-InlineCompanyRating-companyHeader a",
      ".jobsearch-InlineCompanyRating-companyHeader",
      "[data-company-name='true']",
      "[data-testid='company-name']",
      "[class*='jobsearch-CompanyInfoContainer'] a",
      "[class*='companyName']",
    );

  const location =
    structured?.location ||
    (primaryRoot ?
      firstTextIn(
        primaryRoot,
        "[data-testid='job-location']",
        "[data-testid='inlineHeader-companyLocation']",
        "[class*='inlineHeader-companyLocation']",
        "[data-testid='text-location']",
        "[data-testid='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
        "[class*='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
        "[class*='companyLocation']",
        "[data-testid='jobsearch-JobInfoHeader-subtitle'] div",
        "[class*='jobsearch-JobInfoHeader-subtitle'] div",
      )
    : undefined) ||
    undefined;

  const descriptionElement = !isDetailMismatch && detailRoot ?
    detailRoot.querySelector<HTMLElement>("#jobDescriptionText") ||
      detailRoot.querySelector<HTMLElement>("[class*='jobsearch-jobDescriptionText']") ||
      detailRoot.querySelector<HTMLElement>("[data-testid='jobsearch-jobDescriptionText']") ||
      detailRoot.querySelector<HTMLElement>("#jobDescriptionSection") ||
      detailRoot.querySelector<HTMLElement>("[data-testid='jobDescriptionText']")
  : null;
  if (descriptionElement) rememberJobDescriptionRoot("indeed", descriptionElement);

  let description = structured?.description || "";
  if (!description && descriptionElement) {
    description = truncate(extractStructuredText(descriptionElement), 18_000);
  }

  const externalId =
    structured?.externalId ||
    targetKey ||
    detailKey ||
    stableId(`${url}|${title}|${company}`);

  const datePosted =
    structured?.datePosted ||
    (primaryRoot ? datePostedFromDom(primaryRoot) : undefined) ||
    datePostedFromDom(fallbackRoot);

  const enoughEvidence =
    Boolean(title) &&
    (Boolean(structured) || description.length >= 10 || Boolean(company));
  if (!enoughEvidence) {
    return {
      kind: "unsupported_page",
      url,
      reason: "No Indeed job posting could be confirmed from the visible page content.",
    };
  }

  const extractIndeedExplicitSkills = (root: ParentNode | null): string[] => {
    if (!root) return [];
    const skills: string[] = [];
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>(
        "#qualificationsSection li, [data-testid='qualificationsSection'] li, [class*='jobsearch-ReqAndQual'] li, [data-testid='attributes-section'] [class*='tag']",
      ),
    );
    for (const el of elements) {
      const text = cleanText(el.textContent);
      if (
        text &&
        text.length >= 2 &&
        text.length <= 40 &&
        !text.includes("?") &&
        !/^(?:qualifications|full-time|part-time|permanent|contract)$/i.test(text)
      ) {
        skills.push(text);
      }
    }
    return skills;
  };

  const explicitSkills = extractIndeedExplicitSkills(detailRoot || primaryRoot || fallbackRoot);
  const textKeywords = extractTechnologyKeywords([title, description].filter(Boolean).join("\n\n"));

  const snapshot: IndeedJobSnapshot = {
    platform: "indeed",
    externalId,
    url,
    title,
    company: company || "Unknown company",
    location: location || undefined,
    ...capturedJobDateFields(datePosted),
    description: description || undefined,
    technologies: mergeSkills(explicitSkills, textKeywords),
  };
  return { kind: "job", snapshot };
}
