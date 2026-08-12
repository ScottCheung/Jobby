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
    description: description || void 0,
    technologies: extractTechnologyKeywords(description),
    easyApply: hasApplyAction()
  };
  return { kind: "job", snapshot };
}
