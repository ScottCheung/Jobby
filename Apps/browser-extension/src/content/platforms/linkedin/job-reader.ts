import type { LinkedInJobSnapshot, PageInspection } from "../../../shared/contracts/page-inspection";

import { extractTechnologyKeywords } from "../../technology-keywords";
import { linkedinAdapter } from "./adapter";

export function readLinkedInPage(): PageInspection {
  const url = window.location.href;
  const jobId = linkedinAdapter.jobIdFromUrl(url);
  if (!jobId) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The URL does not identify a LinkedIn job." };
  }

  const job = linkedinAdapter.readJob(url);
  if (!job) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The LinkedIn job title is not available yet." };
  }

  const snapshot: LinkedInJobSnapshot = {
    platform: "linkedin",
    externalId: job.externalId,
    url,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    technologies: extractTechnologyKeywords(job.description),
    easyApply: job.easyApply,
  };
  return { kind: "job", snapshot };
}
