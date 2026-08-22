import { extractTechnologyKeywords } from "/src/content/technology-keywords.ts.js";
import { extractStructuredText } from "/src/content/text-utils.ts.js";
import { SEEK_SELECTORS } from "/src/content/platforms/seek/selectors.ts.js";
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function getSeekDetailRoot() {
  const detailPane = document.querySelector(
    "[data-automation='jobDetails'], [data-automation='job-details'], [data-testid='jobDetails'], #job-details, main [data-automation='jobDetails']"
  );
  if (detailPane) return detailPane;
  return document;
}
function firstText(selectors) {
  const root = getSeekDetailRoot();
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const text = cleanText(element?.textContent);
    if (text) return text;
  }
  if (root !== document) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = cleanText(element?.textContent);
      if (text) return text;
    }
  }
  return "";
}
function firstDescriptionText(selectors) {
  const root = getSeekDetailRoot();
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const text = extractStructuredText(element);
    if (text) return text;
  }
  if (root !== document) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = extractStructuredText(element);
      if (text) return text;
    }
  }
  return "";
}
function jobIdFromUrl(url) {
  const match = url.match(/\/job\/(\d+)/i);
  if (match?.[1]) return match[1];
  try {
    const queryJobId = new URL(url).searchParams.get("jobId") || "";
    if (/^\d+$/.test(queryJobId)) return queryJobId;
  } catch {
  }
  const applyEl = document.querySelector(
    "a[data-automation='job-detail-apply'][href*='/job/'], [data-automation='jobDetails'] a[href*='/job/'][data-automation*='apply']"
  );
  if (applyEl instanceof HTMLAnchorElement && applyEl.href) {
    const applyMatch = applyEl.href.match(/\/job\/(\d+)/i);
    if (applyMatch?.[1]) return applyMatch[1];
  }
  const jobContainer = document.querySelector(
    "[data-automation='jobDetails'][data-job-id], [data-automation='job-card'][data-selected='true'] [data-job-id], [data-job-id]"
  );
  if (jobContainer) {
    const attrId = jobContainer.getAttribute("data-job-id");
    if (attrId && /^\d+$/.test(attrId)) return attrId;
  }
  const titleLink = document.querySelector(
    "[data-automation='jobDetails'] a[href*='/job/'], [data-automation='job-detail-title'] a[href*='/job/']"
  );
  if (titleLink) {
    const linkMatch = (titleLink.getAttribute("href") || "").match(/\/job\/(\d+)/i);
    if (linkMatch?.[1]) return linkMatch[1];
  }
  const selectedAnchor = document.querySelector(
    "article[data-automation='job-card'] a[data-automation='jobTitle'][href*='/job/']"
  );
  if (selectedAnchor) {
    const cardMatch = (selectedAnchor.getAttribute("href") || "").match(/\/job\/(\d+)/i);
    if (cardMatch?.[1]) return cardMatch[1];
  }
  return "";
}
function hasApplyAction() {
  const root = getSeekDetailRoot();
  return SEEK_SELECTORS.apply.some((selector) => Boolean(root.querySelector(selector) || document.querySelector(selector)));
}
function datePostedFromDom(jobId) {
  const root = getSeekDetailRoot();
  const STRICT_DATE_PATTERN = /\b(?:(?:posted|listed|published|reposted)\s*(?::|on)?\s*)?(?:\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|mo)\s+ago|\d+\s*[dhwmy]\s*ago|today|yesterday|just\s+(?:now|posted)|刚刚|今天|昨天)\b/i;
  const RELAXED_DATE_PATTERN = /(?:posted|listed|published|reposted)\s*(?::|on)?\s*(?:\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|[dhwmy]|mo)\s*(?:ago)?|today|yesterday|just\s+(?:now|posted))/i;
  if (jobId) {
    const cardSelectors = [
      `article[data-job-id='${jobId}']`,
      `[data-automation='job-card'][data-job-id='${jobId}']`,
      `[data-job-id='${jobId}']`,
      `[data-automation*='${jobId}']`,
      `a[data-automation='jobTitle'][href*='${jobId}']`,
      `a[href*='${jobId}']`
    ];
    for (const selector of cardSelectors) {
      const cardEl = document.querySelector(selector);
      if (!cardEl) continue;
      const cardContainer = cardEl.closest("article, [data-automation='job-card'], li") || cardEl;
      const cardTime = cardContainer.querySelector("[data-automation='jobListingDate'], [data-automation='job-detail-date'], time");
      if (cardTime) {
        const dt = cardTime.getAttribute("datetime");
        if (dt) return cleanText(dt);
        const txt = cleanText(cardTime.textContent);
        if (txt) return txt;
      }
      const elements = Array.from(cardContainer.querySelectorAll("span, div, p, time"));
      for (const el of elements) {
        if (el.children.length > 2) continue;
        const txt = cleanText(el.textContent);
        if (txt && txt.length < 40 && (STRICT_DATE_PATTERN.test(txt) || RELAXED_DATE_PATTERN.test(txt) || /^\d+\s*[dhwmy]$/i.test(txt))) {
          return txt;
        }
      }
    }
  }
  if (root && root !== document) {
    const detailTimeEl = root.querySelector("time[datetime]");
    if (detailTimeEl) {
      const dt = detailTimeEl.getAttribute("datetime");
      if (dt) return cleanText(dt);
      const text = cleanText(detailTimeEl.textContent);
      if (text && (STRICT_DATE_PATTERN.test(text) || RELAXED_DATE_PATTERN.test(text))) return text;
    }
    const dedicatedDetailDate = root.querySelector("[data-automation='job-detail-date'], [data-automation='job-posted-date'], [data-automation='jobListingDate']");
    if (dedicatedDetailDate) {
      const dt = dedicatedDetailDate.getAttribute("datetime");
      if (dt) return cleanText(dt);
      const txt = cleanText(dedicatedDetailDate.textContent);
      if (txt) return txt;
    }
    const detailElements = Array.from(root.querySelectorAll(
      "span[class*='date' i], span[class*='posted' i], p, span"
    ));
    for (const el of detailElements) {
      if (el.children.length > 2) continue;
      const text = cleanText(el.textContent);
      if (text && text.length < 40 && (STRICT_DATE_PATTERN.test(text) || RELAXED_DATE_PATTERN.test(text))) {
        return text;
      }
    }
  }
  if (!root || root === document) {
    const timeEl = document.querySelector("time[datetime]");
    if (timeEl) {
      const dt = timeEl.getAttribute("datetime");
      if (dt) return cleanText(dt);
      const text = cleanText(timeEl.textContent);
      if (text) return text;
    }
    const dedicatedEl = document.querySelector("[data-automation='job-detail-date'], [data-automation='job-posted-date']");
    if (dedicatedEl) {
      const dt = dedicatedEl.getAttribute("datetime");
      if (dt) return cleanText(dt);
      const txt = cleanText(dedicatedEl.textContent);
      if (txt) return txt;
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
