import { extractTechnologyKeywords } from "/src/content/technology-keywords.ts.js";
import { linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
export function readLinkedInPage() {
  const url = window.location.href;
  const jobId = linkedinAdapter.jobIdFromUrl(url);
  if (!jobId) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The URL does not identify a LinkedIn job." };
  }
  const job = linkedinAdapter.readJob(url);
  if (!job) {
    return { kind: "not_job_page", platform: "linkedin", url, reason: "The LinkedIn job title is not available yet." };
  }
  const snapshot = {
    platform: "linkedin",
    externalId: job.externalId,
    url,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    technologies: extractTechnologyKeywords(job.description),
    easyApply: job.easyApply
  };
  return { kind: "job", snapshot };
}
