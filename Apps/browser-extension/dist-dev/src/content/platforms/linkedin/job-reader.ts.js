import { extractTechnologyKeywords } from "/src/content/technology-keywords.ts.js";
import { canonicalLinkedInJobUrl, linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
export function readLinkedInPage(apiData) {
  const url = window.location.href;
  const jobId = linkedinAdapter.jobIdFromUrl(url);
  if (!jobId) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The URL does not identify a LinkedIn job." };
  }
  const job = linkedinAdapter.readJob(url, apiData);
  if (!job) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The LinkedIn job title is not available yet." };
  }
  const snapshot = {
    platform: "linkedin",
    externalId: job.externalId,
    url: canonicalLinkedInJobUrl(job.externalId),
    title: job.title,
    company: job.company,
    location: job.location,
    datePosted: job.datePosted,
    description: job.description,
    technologies: extractTechnologyKeywords(job.description),
    easyApply: job.easyApply,
    // API-enriched fields (undefined when API is unavailable)
    workType: job.workType,
    experienceLevel: job.experienceLevel
  };
  return { kind: "job", snapshot };
}
