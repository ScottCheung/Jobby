import { readSeekPage } from "/src/content/platforms/seek/job-reader.ts.js";
import { readSeekFormPage } from "/src/content/platforms/seek/form-reader.ts.js";
import { readLinkedInPage } from "/src/content/platforms/linkedin/job-reader.ts.js";
import { readLinkedInFormPage } from "/src/content/platforms/linkedin/form-reader.ts.js";
import { readGenericFormPage } from "/src/content/platforms/generic/form-reader.ts.js";
import { readGenericJobPage } from "/src/content/platforms/generic/job-reader.ts.js";
import { readIndeedJobPage } from "/src/content/platforms/indeed/job-reader.ts.js";
import { findActiveFormScope } from "/src/content/dom/form-scope.ts.js";
import { linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
import { classifyCurrentPage } from "/src/content/page-classifier.ts.js";
let lastPageClass = null;
export function getLastPageClass() {
  return lastPageClass;
}
export function classifyPage() {
  lastPageClass = classifyCurrentPage();
  return lastPageClass;
}
function isLinkedInHost(hostname) {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}
function isSeekHost(hostname) {
  return hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
}
function isIndeedHost(hostname) {
  return hostname === "indeed.com" || /\.indeed\.com$/.test(hostname);
}
export function readCurrentPage(apiData) {
  const url = window.location.href;
  const hostname = window.location.hostname;
  lastPageClass = classifyCurrentPage();
  if (!lastPageClass.isJobPage) {
    return {
      kind: "unsupported_page",
      url,
      reason: lastPageClass.skipReason
    };
  }
  if (isSeekHost(hostname)) {
    return readSeekPage();
  }
  if (isLinkedInHost(hostname)) {
    return readLinkedInPage(apiData);
  }
  if (isIndeedHost(hostname)) {
    const inspection = readIndeedJobPage();
    return inspection.kind === "job" ? inspection : fallbackToGenericJob(inspection);
  }
  return readGenericJobPage();
}
export async function readCurrentPageWhenReady() {
  if (isLinkedInHost(window.location.hostname)) return readLinkedInPageWhenReady();
  let inspection = readCurrentPage();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (inspection.kind === "job" && inspection.snapshot.title && inspection.snapshot.datePosted) {
      return inspection;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    inspection = readCurrentPage();
  }
  return inspection;
}
function fallbackToGenericJob(preferredInspection) {
  if (lastPageClass && !lastPageClass.isJobPage) {
    return preferredInspection;
  }
  const genericInspection = readGenericJobPage();
  if (genericInspection.kind === "job") return genericInspection;
  if (preferredInspection.kind === "not_job_page" && preferredInspection.reason.includes("URL does not identify")) {
    return genericInspection;
  }
  return preferredInspection;
}
async function readLinkedInPageWhenReady() {
  let observedUrl = window.location.href;
  let previousSnapshotSignature = "";
  const jobIdNow = linkedinAdapter.jobIdFromUrl(observedUrl);
  let cachedApiData = null;
  let apiResolved = false;
  const apiDataPromise = jobIdNow ? import("/src/content/platforms/linkedin/api-client.ts.js").then(
    ({ fetchLinkedInJobPosting }) => fetchLinkedInJobPosting(jobIdNow)
  ) : Promise.resolve(null);
  apiDataPromise.then((data) => {
    cachedApiData = data;
    apiResolved = true;
  }).catch(() => {
    apiResolved = true;
  });
  let inspection = readCurrentPage();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const currentUrl = window.location.href;
    if (currentUrl !== observedUrl) {
      observedUrl = currentUrl;
      previousSnapshotSignature = "";
    }
    inspection = readCurrentPage(apiResolved ? cachedApiData : void 0);
    if (inspection.kind === "job") {
      const snapshotSignature = [
        inspection.snapshot.externalId,
        inspection.snapshot.title,
        inspection.snapshot.company,
        inspection.snapshot.datePosted || ""
      ].join(":");
      const descriptionReady = Boolean(inspection.snapshot.description);
      if (apiResolved && cachedApiData) {
        const enriched = readLinkedInPage(cachedApiData);
        if (enriched.kind === "job" && enriched.snapshot.description) {
          return enriched;
        }
      }
      const dateReady = Boolean(inspection.snapshot.datePosted);
      const metadataReady = dateReady || attempt >= 19;
      const snapshotStable = snapshotSignature === previousSnapshotSignature;
      if (descriptionReady && metadataReady && (snapshotStable || attempt >= 19)) {
        const resolvedApiData2 = await apiDataPromise.catch(() => null);
        if (resolvedApiData2) {
          const enriched = readLinkedInPage(resolvedApiData2);
          if (enriched.kind === "job") return enriched;
        }
        return inspection;
      }
      previousSnapshotSignature = snapshotSignature;
    } else {
      previousSnapshotSignature = "";
    }
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
  const resolvedApiData = await apiDataPromise.catch(() => null);
  if (resolvedApiData) {
    const enriched = readLinkedInPage(resolvedApiData);
    if (enriched.kind === "job") return enriched;
  }
  return inspection;
}
export function readCurrentForm() {
  if (isSeekHost(window.location.hostname)) return readSeekFormPage();
  if (isLinkedInHost(window.location.hostname)) return readLinkedInFormPage();
  return readGenericFormPage();
}
export function getCurrentFormScope() {
  if (isSeekHost(window.location.hostname)) return findActiveFormScope() || document;
  if (isLinkedInHost(window.location.hostname)) return linkedinAdapter.getApplicationRoot() || findActiveFormScope();
  return findActiveFormScope() || document;
}
