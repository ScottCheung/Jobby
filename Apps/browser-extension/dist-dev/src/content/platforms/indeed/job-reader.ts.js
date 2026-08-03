import { extractTechnologyKeywords } from "/src/content/technology-keywords.ts.js";
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
function firstText(...selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && isVisible(el)) {
      const text = cleanText(el.textContent);
      if (text) return text;
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
      const rawDesc = String(posting.description || "").replace(/<[^>]*>/g, " ");
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
        description: cleanText(rawDesc) || void 0,
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
function datePostedFromDom() {
  const timeEl = document.querySelector(
    "time[datetime], [data-testid*='date'] time, [class*='date'] time"
  );
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }
  const selectors = [
    "[data-testid='jobsearch-JobMetadataFooter-item']",
    "[class*='PostedDate']",
    "[class*='posted-date']",
    "[class*='postedDate']",
    "[class*='date-posted']",
    "[class*='job-age']",
    "span[class*='date']"
  ];
  const candidates = Array.from(
    document.querySelectorAll(selectors.join(", "))
  );
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = cleanText(el.textContent);
    if (/\b(posted|today|yesterday|\d+\s*\+?\s*days?\s+ago|just\s+posted|recently\s+posted)\b/i.test(text)) {
      return text;
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
  const structured = structuredJobPosting();
  const title = structured?.title || firstText(
    "[data-testid='jobsearch-JobInfoHeader-title']",
    ".jobsearch-JobInfoHeader-title",
    "[class*='jobsearch-JobInfoHeader-title']",
    "h1[class*='job-title']",
    "h1"
  );
  const company = structured?.company || firstText(
    "[data-testid='inlineHeader-companyName'] a",
    "[data-testid='inlineHeader-companyName']",
    ".jobsearch-InlineCompanyRating-companyHeader a",
    "[class*='jobsearch-CompanyInfoContainer'] a",
    "[class*='companyName']"
  );
  const location = structured?.location || firstText(
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
    "[class*='jobsearch-JobInfoHeader-subtitle'] div"
  ) || void 0;
  let description = structured?.description || "";
  if (!description) {
    const descEl = document.querySelector("#jobDescriptionText") || document.querySelector("[class*='jobsearch-jobDescriptionText']") || document.querySelector("[data-testid='jobsearch-jobDescriptionText']");
    if (descEl) {
      description = truncate(cleanText(descEl.textContent), 18e3);
    }
  }
  const externalId = structured?.externalId || (() => {
    const match = url.match(/[?&]jk=([a-z0-9]+)/i);
    return match?.[1] || stableId(`${url}|${title}|${company}`);
  })();
  const datePosted = structured?.datePosted || datePostedFromDom();
  const enoughEvidence = Boolean(title) && (Boolean(structured) || description.length >= 90);
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
    easyApply: Boolean(document.querySelector("[id*='indeedApplyButton'], [class*='indeed-apply-button']")) || Boolean(document.querySelector("[data-indeed-apply]"))
  };
  return { kind: "job", snapshot };
}
