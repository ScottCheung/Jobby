import { extractTechnologyKeywords } from "/src/content/technology-keywords.ts.js";
import { extractStructuredText } from "/src/content/text-utils.ts.js";
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}
function isVisible(element) {
  const html = element;
  if (html.hidden || html.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(html);
  return style.display !== "none" && style.visibility !== "hidden";
}
function getIndeedDetailRoot() {
  const pane = document.querySelector(
    ".jobsearch-RightPane, .jobsearch-ViewJobPaneWrapper, #jobsearch-ViewjobPane, #viewJobSSRRoot, .jobsearch-JobComponent, .fastviewjob, main"
  );
  if (pane) return pane;
  return document;
}
function firstText(...selectors) {
  const root = getIndeedDetailRoot();
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el && isVisible(el)) {
      const text = cleanText(el.textContent);
      if (text) return text;
    }
  }
  if (root !== document) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) {
        const text = cleanText(el.textContent);
        if (text) return text;
      }
    }
  }
  return "";
}
function structuredJobPosting() {
  const scripts = Array.from(
    document.querySelectorAll("script[type='application/ld+json']")
  ).slice(0, 30);
  const visit = (value) => {
    if (!value || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const match = visit(item);
        if (match) return match;
      }
      return null;
    }
    const record = value;
    const type = record["@type"];
    if (type === "JobPosting" || Array.isArray(type) && type.includes("JobPosting")) return record;
    return visit(record["@graph"]);
  };
  for (const script of scripts) {
    try {
      const posting = visit(JSON.parse(script.textContent || ""));
      if (!posting) continue;
      const organization = posting.hiringOrganization;
      const location = posting.jobLocation;
      const firstLocation = Array.isArray(location) ? location[0] : location;
      const address = firstLocation?.address;
      const identifier = posting.identifier;
      const tmpDiv = document.createElement("div");
      tmpDiv.innerHTML = String(posting.description || "");
      const rawDesc = extractStructuredText(tmpDiv);
      const addressParts = [
        address?.addressLocality,
        address?.addressRegion,
        address?.addressCountry
      ].filter((v) => typeof v === "string" && String(v).trim());
      const locationStr = addressParts.length > 0 ? cleanText(addressParts.join(", ")) : cleanText(
        typeof firstLocation === "object" && firstLocation !== null ? String(firstLocation.name || "") : typeof location === "string" ? location : ""
      );
      return {
        title: cleanText(String(posting.title || "")) || void 0,
        company: cleanText(String(organization?.name || "")) || void 0,
        location: locationStr || void 0,
        description: rawDesc || void 0,
        externalId: cleanText(
          typeof identifier === "string" ? identifier : String(identifier?.value || "")
        ) || void 0,
        datePosted: cleanText(String(posting.datePosted || "")) || void 0
      };
    } catch {
    }
  }
  return null;
}
function datePostedFromDom(_jobKey) {
  const root = getIndeedDetailRoot();
  const timeEl = root.querySelector("time[datetime]") || document.querySelector("time[datetime]");
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
    "span[class*='posted' i]"
  ];
  for (const selector of selectors) {
    const elements = Array.from(root.querySelectorAll(selector));
    for (const element of elements) {
      const text = cleanText(element.textContent);
      if (text && datePattern.test(text)) {
        return text;
      }
    }
  }
  if (root !== document) {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      for (const element of elements) {
        const text = cleanText(element.textContent);
        if (text && datePattern.test(text)) {
          return text;
        }
      }
    }
  }
  return void 0;
}
function stableId(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `indeed-${(hash >>> 0).toString(16)}`;
}
export function readIndeedJobPage() {
  const url = window.location.href;
  const root = getIndeedDetailRoot();
  const structured = structuredJobPosting();
  const title = structured?.title || firstText(
    "[data-testid='jobsearch-JobInfoHeader-title']",
    ".jobsearch-JobInfoHeader-title",
    "h1[class*='jobsearch-JobInfoHeader-title']",
    "h2[class*='jobsearch-JobInfoHeader-title']",
    "[class*='jobsearch-JobInfoHeader-title']",
    "h1[class*='job-title']",
    ".jobsearch-RightPane h1",
    "h1"
  );
  const company = structured?.company || firstText(
    "[data-testid='inlineHeader-companyName'] a",
    "[data-testid='inlineHeader-companyName']",
    ".jobsearch-InlineCompanyRating-companyHeader a",
    ".jobsearch-InlineCompanyRating-companyHeader",
    "[data-company-name='true']",
    "[class*='jobsearch-CompanyInfoContainer'] a",
    "[class*='companyName']"
  );
  const location = structured?.location || firstText(
    "[data-testid='job-location']",
    "[data-testid='inlineHeader-companyLocation']",
    "[class*='inlineHeader-companyLocation']",
    "[data-testid='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
    "[class*='jobsearch-JobInfoHeader-subtitle'] > div:last-child",
    "[class*='companyLocation']",
    "[data-testid='jobsearch-JobInfoHeader-subtitle'] div",
    "[class*='jobsearch-JobInfoHeader-subtitle'] div"
  ) || void 0;
  let description = structured?.description || "";
  if (!description) {
    const descEl = root.querySelector("#jobDescriptionText") || root.querySelector("[class*='jobsearch-jobDescriptionText']") || root.querySelector("[data-testid='jobsearch-jobDescriptionText']") || root.querySelector("#jobDescriptionSection") || root.querySelector("[data-testid='jobDescriptionText']") || document.querySelector("#jobDescriptionText") || document.querySelector("[class*='jobsearch-jobDescriptionText']");
    if (descEl) {
      description = truncate(extractStructuredText(descEl), 18e3);
    }
  }
  const externalId = structured?.externalId || (() => {
    const match = url.match(/[?&](?:jk|vjk|jobkey)=([a-z0-9]+)/i);
    if (match?.[1]) return match[1];
    const domKey = document.querySelector("[data-jk]")?.getAttribute("data-jk") || document.querySelector("[data-mobtk]")?.getAttribute("data-mobtk");
    if (domKey) return domKey;
    return stableId(`${url}|${title}|${company}`);
  })();
  const datePosted = structured?.datePosted || datePostedFromDom(externalId);
  const enoughEvidence = Boolean(title) && (Boolean(structured) || description.length >= 10 || Boolean(company));
  if (!enoughEvidence) {
    return {
      kind: "unsupported_page",
      url,
      reason: "No Indeed job posting could be confirmed from the visible page content."
    };
  }
  const snapshot = {
    platform: "indeed",
    externalId,
    url,
    title,
    company: company || "Unknown company",
    location: location || void 0,
    datePosted: datePosted || void 0,
    description: description || void 0,
    technologies: extractTechnologyKeywords(description),
    easyApply: Boolean(document.querySelector("[id*='indeedApplyButton'], [class*='indeed-apply-button'], [data-testid='indeedApplyButton'], [aria-label*='Apply with Indeed' i], button.ia-IndeedApplyButton")) || Boolean(document.querySelector("[data-indeed-apply]"))
  };
  return { kind: "job", snapshot };
}
