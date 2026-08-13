import { extractTechnologyKeywords } from "/src/content/technology-keywords.ts.js";
import { extractStructuredText } from "/src/content/text-utils.ts.js";
import { SEEK_SELECTORS } from "/src/content/platforms/seek/selectors.ts.js";
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function firstText(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = cleanText(element?.textContent);
    if (text) return text;
  }
  return "";
}
function firstDescriptionText(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = extractStructuredText(element);
    if (text) return text;
  }
  return "";
}
function jobIdFromUrl(url) {
  const match = url.match(/\/job\/(\d+)/i);
  if (match?.[1]) return match[1];
  try {
    const queryJobId = new URL(url).searchParams.get("jobId") || "";
    return /^\d+$/.test(queryJobId) ? queryJobId : "";
  } catch {
    return "";
  }
}
function hasApplyAction() {
  return SEEK_SELECTORS.apply.some((selector) => Boolean(document.querySelector(selector)));
}
function datePostedFromDom(jobId) {
  const timeEl = document.querySelector("time[datetime]");
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }
  const selectors = [
    "[data-automation='job-detail-date']",
    "[data-automation='jobListingDate']",
    "[data-automation='job-posted-date']",
    "span[class*='date' i]",
    "span[class*='posted' i]"
  ];
  const datePattern = /\b(?:posted\s+)?(?:\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|[dhwmy]|mo)\s*(?:ago)?|today|yesterday|just\s+(?:now|posted))\b/i;
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const text = cleanText(element.textContent);
    if (text && datePattern.test(text)) {
      return text;
    }
  }
  if (jobId) {
    const links = Array.from(document.querySelectorAll(`a[href*='/job/${jobId}']`));
    for (const link of links) {
      let container = link;
      for (let depth = 0; container && depth < 5; depth += 1) {
        const dateEl = container.querySelector("[data-automation='jobListingDate'], time");
        if (dateEl) {
          const dt = dateEl.getAttribute("datetime");
          if (dt) return cleanText(dt);
          const txt = cleanText(dateEl.textContent);
          if (txt) return txt;
        }
        const containerText = cleanText(container.textContent);
        const match = containerText.match(datePattern);
        if (match?.[0]) return match[0];
        container = container.parentElement;
      }
    }
  }
  return void 0;
}
export function readSeekPage() {
  const url = window.location.href;
  const jobId = jobIdFromUrl(url);
  if (!jobId) {
    return { kind: "not_job_page", platform: "seek", url, reason: "The URL does not identify a SEEK job." };
  }
  const title = firstText(SEEK_SELECTORS.title);
  if (!title) {
    return { kind: "not_job_page", platform: "seek", url, reason: "The job title is not available yet." };
  }
  const description = firstDescriptionText(SEEK_SELECTORS.description);
  const snapshot = {
    platform: "seek",
    externalId: jobId,
    url,
    title,
    company: firstText(SEEK_SELECTORS.company) || "Unknown company",
    location: firstText(SEEK_SELECTORS.location) || void 0,
    datePosted: datePostedFromDom(jobId),
    description: description || void 0,
    technologies: extractTechnologyKeywords(description),
    easyApply: hasApplyAction()
  };
  return { kind: "job", snapshot };
}
