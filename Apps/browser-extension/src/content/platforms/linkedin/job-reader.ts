import type { LinkedInJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";

import { extractTechnologyKeywords } from "../../technology-keywords";
import { canonicalLinkedInJobUrl, linkedinAdapter } from "./adapter";
import type { LinkedInJobApiData } from "./api-client";

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
    technologies: extractTechnologyKeywords(job.description),
    easyApply: job.easyApply,
    // API-enriched fields (undefined when API is unavailable)
    workType: job.workType,
    experienceLevel: job.experienceLevel,
  };
  return { kind: "job", snapshot };
}
