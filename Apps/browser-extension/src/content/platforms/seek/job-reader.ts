import type { PageInspection, SeekJobSnapshot } from "../../../shared/contracts/page-inspection";

import { extractTechnologyKeywords } from "../../technology-keywords";
import { SEEK_SELECTORS } from "./selectors";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function firstText(selectors: readonly string[]): string {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = cleanText(element?.textContent);
    if (text) return text;
  }
  return "";
}

function jobIdFromUrl(url: string): string {
  const match = url.match(/\/job\/(\d+)/i);
  if (match?.[1]) return match[1];

  try {
    const queryJobId = new URL(url).searchParams.get("jobId") || "";
    return /^\d+$/.test(queryJobId) ? queryJobId : "";
  } catch {
    return "";
  }
}

function hasApplyAction(): boolean {
  return SEEK_SELECTORS.apply.some((selector) => Boolean(document.querySelector(selector)));
}

export function readSeekPage(): PageInspection {
  const url = window.location.href;
  const jobId = jobIdFromUrl(url);
  if (!jobId) {
    return { kind: "not_job_page", platform: "seek", url, reason: "The URL does not identify a SEEK job." };
  }

  const title = firstText(SEEK_SELECTORS.title);
  if (!title) {
    return { kind: "not_job_page", platform: "seek", url, reason: "The job title is not available yet." };
  }

  const description = firstText(SEEK_SELECTORS.description);
  const snapshot: SeekJobSnapshot = {
    platform: "seek",
    externalId: jobId,
    url,
    title,
    company: firstText(SEEK_SELECTORS.company) || "Unknown company",
    location: firstText(SEEK_SELECTORS.location) || undefined,
    description: description || undefined,
    technologies: extractTechnologyKeywords(description),
    easyApply: hasApplyAction(),
  };
  return { kind: "job", snapshot };
}
