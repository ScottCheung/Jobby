export function canonicalLinkedInJobUrl(jobId) {
  return `https://www.linkedin.com/jobs/view/${jobId}/`;
}
export function linkedInSearchResultJobUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (!(hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) || !/^\/jobs\/search-results\/?$/i.test(parsed.pathname)) {
      return null;
    }
    const jobId = parsed.searchParams.get("currentJobId");
    return jobId && /^\d+$/.test(jobId) ? canonicalLinkedInJobUrl(jobId) : null;
  } catch {
    return null;
  }
}
