/**
 * Indeed-specific job page reader.
 *
 * Indeed's pages are rendered server-side with well-known class patterns and
 * a rich `JobPosting` JSON-LD block. We first try the structured data
 * (already handled by the generic reader's `jobPostingFromStructuredData`)
 * then fall back to Indeed-specific DOM selectors.
 */
import type { IndeedJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";
import { capturedJobDateFields } from '@jobby/ui/lib/date-formatter';
import { extractTechnologyKeywords, mergeSkills } from "../../technology-keywords";
import { extractStructuredText } from "../../text-utils";
import {
  clearJobDescriptionRoot,
  rememberJobDescriptionRoot,
} from "../../dom/job-description-root";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cleanTitle(value: string | null | undefined): string {
  return cleanText(value)
    .replace(/[-–—\s]+job\s+post(?:ing)?\s*$/i, "")
    .replace(/[-–—\s]+new\s*$/i, "")
    .trim();
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

export function getIndeedTargetJobKey(url: string): string | undefined {
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
  const pathname = (typeof window !== "undefined" ? window.location.pathname : "").toLowerCase();
  const isStandaloneJob =
    pathname.includes("/viewjob") ||
    pathname.includes("/rc/clk") ||
    pathname.includes("/m/viewjob") ||
    pathname.includes("/pagead/clk");
  const isSearchPage =
    !isStandaloneJob &&
    (Boolean(document.querySelector(".jobsearch-LeftPane, .jobsearch-ResultsList, #mosaic-provider-jobcards")) ||
      document.querySelectorAll(".job_seen_beacon").length > 1);

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
      const postingUrl = cleanText(String(posting.url || posting["@id"] || posting.sameAs || ""));

      // JSON-LD on an Indeed search page can describe the server-rendered
      // previous job. Use it on a search page only when it explicitly identifies
      // the selected job; on standalone job pages, the JSON-LD is authoritative.
      if (isSearchPage) {
        const matchesTarget = Boolean(
          targetExternalId && (
            externalId === targetExternalId ||
            (postingUrl && postingUrl.includes(targetExternalId))
          ),
        );
        if (!matchesTarget) {
          continue;
        }
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

interface IndeedMosaicJobData {
  title?: string;
  company?: string;
  location?: string;
  pubDate?: string;
  formattedRelativeTime?: string;
}

function findJobInMosaicObject(obj: unknown, targetJobKey?: string): IndeedMosaicJobData | null {
  if (!obj || typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const match = findJobInMosaicObject(item, targetJobKey);
      if (match) return match;
    }
    return null;
  }

  const record = obj as Record<string, unknown>;
  const jobKey = String(record.jobkey || record.jobKey || record.jk || record.id || "");
  const isMatch = targetJobKey ? jobKey === targetJobKey : Boolean(jobKey);

  if (isMatch && (record.pubDate || record.formattedRelativeTime || record.createDate || record.title)) {
    let pubDateIso: string | undefined = undefined;
    const rawPubDate = record.pubDate || record.createDate;
    if (typeof rawPubDate === "number" || (typeof rawPubDate === "string" && /^\d+$/.test(rawPubDate))) {
      const num = Number(rawPubDate);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) pubDateIso = d.toISOString();
    } else if (typeof rawPubDate === "string") {
      pubDateIso = rawPubDate;
    }

    const relTime =
      typeof record.formattedRelativeTime === "string"
        ? record.formattedRelativeTime
        : typeof record.formattedDate === "string"
        ? record.formattedDate
        : undefined;

    return {
      title: typeof record.title === "string" ? cleanText(record.title) : undefined,
      company: typeof record.company === "string" ? cleanText(record.company) : undefined,
      location: typeof record.formattedLocation === "string" ? cleanText(record.formattedLocation) : undefined,
      pubDate: pubDateIso,
      formattedRelativeTime: relTime ? cleanText(relTime) : undefined,
    };
  }

  // Check nested properties
  const candidateKeys = [
    "results",
    "metaData",
    "mosaicProviderJobCardsModel",
    "jobCards",
    "jobDetail",
    "jobHeader",
    "model",
  ];
  for (const key of candidateKeys) {
    if (record[key]) {
      const match = findJobInMosaicObject(record[key], targetJobKey);
      if (match) return match;
    }
  }

  return null;
}

function extractIndeedMosaicData(targetJobKey?: string): IndeedMosaicJobData | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script:not([src])"));
  for (const script of scripts) {
    const text = script.textContent;
    if (!text) continue;

    // Fast check
    if (
      !text.includes("mosaic") &&
      !text.includes("jobcards") &&
      !text.includes("jobdetail") &&
      !text.includes("pubDate") &&
      !text.includes("formattedRelativeTime")
    ) {
      continue;
    }

    // 1. Try extracting mosaic-provider-jobcards or window.mosaic.providerData assignments
    const mosaicRegexes = [
      /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*({.+?});/s,
      /window\.mosaic\.providerData\["mosaic-provider-jobdetail"\]\s*=\s*({.+?});/s,
      /window\.mosaic\.providerData\["mosaic-provider-jobheader"\]\s*=\s*({.+?});/s,
      /window\.mosaic\.providerData\["mosaic-provider-vjheader"\]\s*=\s*({.+?});/s,
      /window\.mosaic\.providerData\["[^"]+"\]\s*=\s*({.+?});/s,
    ];

    for (const regex of mosaicRegexes) {
      const match = text.match(regex);
      if (!match?.[1]) continue;
      try {
        const parsed = JSON.parse(match[1]);
        const job = findJobInMosaicObject(parsed, targetJobKey);
        if (job) return job;
      } catch {
        // continue
      }
    }

    // 2. Direct JSON script tag
    if (text.startsWith("{") && text.endsWith("}")) {
      try {
        const parsed = JSON.parse(text);
        const job = findJobInMosaicObject(parsed, targetJobKey);
        if (job) return job;
      } catch {
        // continue
      }
    }

    // 3. Fallback regex around targetJobKey
    if (targetJobKey && text.includes(targetJobKey)) {
      const keyIndex = text.indexOf(targetJobKey);
      const slice = text.slice(Math.max(0, keyIndex - 800), Math.min(text.length, keyIndex + 2500));

      const pubDateMatch =
        slice.match(/"pubDate"\s*:\s*(\d{10,13})/i) ||
        slice.match(/"createDate"\s*:\s*(\d{10,13})/i) ||
        slice.match(/"datePosted"\s*:\s*"([^"]+)"/i);

      const relTimeMatch =
        slice.match(/"formattedRelativeTime"\s*:\s*"([^"]+)"/i) ||
        slice.match(/"formattedDate"\s*:\s*"([^"]+)"/i) ||
        slice.match(/"age"\s*:\s*"([^"]+)"/i);

      let pubDateIso: string | undefined = undefined;
      if (pubDateMatch?.[1]) {
        const val = pubDateMatch[1];
        if (/^\d{10,13}$/.test(val)) {
          const ms = val.length === 10 ? Number(val) * 1000 : Number(val);
          const d = new Date(ms);
          if (!Number.isNaN(d.getTime())) pubDateIso = d.toISOString();
        } else {
          pubDateIso = val;
        }
      }

      if (pubDateIso || relTimeMatch?.[1]) {
        return {
          pubDate: pubDateIso,
          formattedRelativeTime: relTimeMatch?.[1]?.trim(),
        };
      }
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
  const timeEl = root.querySelector<HTMLElement>(
    "time[datetime], [data-testid*='date' i] time, [class*='date' i] time, time",
  );
  if (timeEl) {
    const dt = cleanText(timeEl.getAttribute("datetime"));
    if (dt) return dt;
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }

  const datePattern =
    /\b(?:(?:posted|reposted|active|employer\s*active|over|more\s+than)\s+)?(?:\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|[dhwm]|mo)\s+ago|30\+\s*(?:days?|d)\s*(?:ago)?|today|yesterday|just\s+(?:now|posted)|recently\s+posted)\b/i;
  const zhPattern = /(?:(?:发布于|重新发布于|活跃于)\s*)?(?:\d+\s*\+?\s*(?:个?月|周|天|小时|分钟)前|刚刚|今天|昨天)/;
  const jaPattern = /(?:(?:\d+\s*\+?\s*(?:日前|時間前|分前|週間前|ヶ月前))|今日|昨日|たった今)/;
  const isoPattern = /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?\b/;

  const isInsideJobDescription = (el: HTMLElement): boolean => {
    return Boolean(
      el.closest(
        "#jobDescriptionText, [class*='jobDescription'], #qualificationsSection, [data-testid='qualificationsSection'], #jobDescriptionSection, [data-testid='jobsearch-jobDescriptionText'], [class*='JobComponent-description']",
      ),
    );
  };

  const selectors = [
    "[data-testid='jobsearch-JobMetadataFooter-item']",
    "[data-testid='myJobsStateDate']",
    "[data-testid='jobsearch-HiringInsights-date']",
    "[data-testid='job-metadata-date']",
    "[data-testid*='JobMetadataFooter'] *",
    "[class*='jobsearch-JobMetadataFooter'] *",
    "[class*='jobsearch-HiringInsights'] *",
    "[class*='jobCardShelf'] *",
    "[class*='under-title'] *",
    "[data-testid*='date' i]",
    "[data-testid*='posted' i]",
    "span[class*='date' i]",
    "span[class*='posted' i]",
    "span[class*='job-age' i]",
    "span.date",
    "div.date",
    "[class*='jobsearch-JobMetadataFooter']",
    "[class*='jobsearch-HiringInsights']",
  ];
  for (const selector of selectors) {
    const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
    for (const element of elements) {
      if (!isVisible(element) || isInsideJobDescription(element)) continue;
      const text = cleanText(element.textContent);
      if (!text || text.length > 200) continue;
      const match =
        text.match(datePattern) ||
        text.match(zhPattern) ||
        text.match(jaPattern) ||
        text.match(isoPattern);
      if (match?.[0]) {
        return match[0].trim();
      }
    }
  }

  const candidates = Array.from(root.querySelectorAll<HTMLElement>("span, div, p, li")).slice(0, 300);
  for (const element of candidates) {
    if (!isVisible(element) || isInsideJobDescription(element)) continue;
    const text = cleanText(element.textContent);
    if (!text || text.length > 80) continue;
    const match =
      text.match(datePattern) ||
      text.match(zhPattern) ||
      text.match(jaPattern) ||
      text.match(isoPattern);
    if (match?.[0]) {
      return match[0].trim();
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

  const rawTitle =
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
  const title = cleanTitle(rawTitle);

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

  const cardForTarget = targetKey
    ? document
        .querySelector<HTMLElement>(
          `[data-jk='${targetKey}'], .job_seen_beacon:has(a[href*='${targetKey}']), a[href*='jk=${targetKey}'], a[href*='vjk=${targetKey}'], #job_${targetKey}, [data-mobtk='${targetKey}']`,
        )
        ?.closest<HTMLElement>(".job_seen_beacon, li, tr, [data-jk], [class*='jobCard']")
    : null;

  const mosaicData = targetKey ? extractIndeedMosaicData(targetKey) : null;
  const mosaicDate = mosaicData?.pubDate || mosaicData?.formattedRelativeTime;

  const datePosted =
    mosaicDate ||
    structured?.datePosted ||
    (primaryRoot ? datePostedFromDom(primaryRoot) : undefined) ||
    (selectedCard ? datePostedFromDom(selectedCard) : undefined) ||
    (cardForTarget ? datePostedFromDom(cardForTarget) : undefined) ||
    datePostedFromDom(fallbackRoot) ||
    (!isDetailMismatch ? datePostedFromDom(document) : undefined);

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
