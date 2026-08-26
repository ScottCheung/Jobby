import type { LinkedInJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";

import { extractTechnologyKeywords, mergeSkills } from "../../technology-keywords";
import { canonicalLinkedInJobUrl, linkedinAdapter } from "./adapter";
import type { LinkedInJobApiData } from "./api-client";

function extractLinkedInExplicitSkills(): string[] {
  const panel = document.querySelector<HTMLElement>(
    ".jobs-search-two-pane__job-details, .jobs-search-results-list__detail, .scaffold-layout__detail, .jobs-details, main",
  );
  if (!panel) return [];
  const skills: string[] = [];
  const elements = Array.from(
    panel.querySelectorAll<HTMLElement>(
      "[class*='job-details-preferences-and-skills'] li, [class*='job-details-how-you-match'] li, [class*='job-details-skill'], [class*='skills-item'], [data-test-job-details-skills] li",
    ),
  );
  for (const el of elements) {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (
      text &&
      text.length >= 2 &&
      text.length <= 40 &&
      !text.includes("?") &&
      !/^(?:skills|see all|easy apply|apply)$/i.test(text)
    ) {
      skills.push(text);
    }
  }
  return skills;
}

export function readLinkedInPage(apiData?: LinkedInJobApiData | null): PageInspection {
  const url = window.location.href;
  const jobId = linkedinAdapter.jobIdFromUrl(url);
  if (!jobId) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The URL does not identify a LinkedIn job." };
  }

  const job = linkedinAdapter.readJob(url, apiData);
  if (!job) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The LinkedIn job title is not available yet." };
  }

  const explicitSkills = extractLinkedInExplicitSkills();
  const textKeywords = extractTechnologyKeywords([job.title, job.description].filter(Boolean).join("\n\n"));

  const snapshot: LinkedInJobSnapshot = {
    platform: "linkedin",
    externalId: job.externalId,
    url: canonicalLinkedInJobUrl(job.externalId),
    title: job.title,
    company: job.company,
    location: job.location,
    firstPostedAt: job.firstPostedAt,
    lastPostedAt: job.lastPostedAt,
    postingObservedAt: job.postingObservedAt,
    isReposted: job.isReposted,
    postingDateRaw: job.postingDateRaw,
    description: job.description,
    technologies: mergeSkills(explicitSkills, textKeywords),
    easyApply: job.easyApply,
    // API-enriched fields (undefined when API is unavailable)
    workType: job.workType,
    experienceLevel: job.experienceLevel,
  };
  return { kind: "job", snapshot };
}
