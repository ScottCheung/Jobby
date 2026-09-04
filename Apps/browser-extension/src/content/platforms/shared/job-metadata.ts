import { extractStructuredText } from "../../text-utils";

export const INVALID_TITLE_PATTERN =
  /\b(?:internet explorer|browser (?:is )?not supported|unsupported browser|please (?:enable|update) (?:your )?browser|access denied|page not found|something went wrong|maintenance mode)\b/i;

export type QueryRoot = Document | ShadowRoot;

export type StructuredJobPosting = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  externalId?: string;
  datePosted?: string;
};

export function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function isElementVisible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.hidden || html.getAttribute("aria-hidden") === "true") return false;
  if (html.style.display === "none" || html.style.visibility === "hidden") return false;
  const style = window.getComputedStyle(html);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function isUsefulJobTitle(value: string): boolean {
  const title = cleanText(value);
  if (title.length < 3 || title.length > 180) return false;
  return !INVALID_TITLE_PATTERN.test(title);
}

export function jobPostingFromStructuredData(doc: Document = document): StructuredJobPosting | null {
  const scripts = Array.from(
    doc.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']"),
  ).slice(0, 30);
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
    doc.querySelector<HTMLElement>("main h1, [role='main'] h1, article h1, h1")?.textContent,
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
  const tmpDiv = doc.createElement("div");
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
  const postings = roots.flatMap((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("[itemscope][itemtype*='JobPosting' i]")),
  );
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

  return {
    title: isUsefulJobTitle(title) ? title : undefined,
    company: companyScope ? propertyValue(companyScope, "name") || undefined : undefined,
    location: location || undefined,
    description: description || undefined,
    externalId: propertyValue(posting, "identifier") || undefined,
    datePosted: propertyValue(posting, "datePosted") || undefined,
  };
}

export function datePostedFromDom(doc: Document = document): string | undefined {
  const metaSelectors = [
    "meta[property='article:published_time']",
    "meta[name='datePosted']",
    "meta[name='date']",
    "meta[property='og:article:published_time']",
    "meta[itemprop='datePosted']",
    "meta[name='dcterms.created']",
  ];
  for (const selector of metaSelectors) {
    const meta = doc.querySelector<HTMLMetaElement>(selector);
    const content = cleanText(meta?.getAttribute("content"));
    if (content) return content;
  }

  const timeEl = doc.querySelector<HTMLElement>("time[datetime]");
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }

  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
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
    const text = cleanText(el.textContent);
    if (!text || text.length > 80) continue;
    const match = text.match(datePattern) || text.match(zhPattern) || text.match(isoPattern);
    if (match?.[0] && isElementVisible(el)) {
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
