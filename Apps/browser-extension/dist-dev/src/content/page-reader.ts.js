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
let lastLinkedInRead = null;
export function readCurrentPage() {
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
    const inspection = readSeekPage();
    return inspection.kind === "job" ? inspection : fallbackToGenericJob(inspection);
  }
  if (isLinkedInHost(hostname)) {
    const inspection = readLinkedInPage();
    return inspection.kind === "job" ? inspection : fallbackToGenericJob(inspection);
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
  if (inspection.kind === "job") return inspection;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    inspection = readCurrentPage();
    if (inspection.kind === "job") return inspection;
  }
  return inspection;
}
function fallbackToGenericJob(preferredInspection) {
  const genericInspection = readGenericJobPage();
  if (genericInspection.kind === "job") return genericInspection;
  if (preferredInspection.kind === "not_job_page" && preferredInspection.reason.includes("URL does not identify")) {
    return genericInspection;
  }
  return preferredInspection;
}
async function readLinkedInPageWhenReady() {
  let observedUrl = window.location.href;
  let previousSignature = "";
  let inspection = readCurrentPage();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const currentUrl = window.location.href;
    if (currentUrl !== observedUrl) {
      observedUrl = currentUrl;
      previousSignature = "";
    }
    inspection = readCurrentPage();
    if (inspection.kind === "job") {
      const signature = `${inspection.snapshot.externalId}:${inspection.snapshot.title}:${inspection.snapshot.company}`;
      const routeChanged = !lastLinkedInRead || lastLinkedInRead.url !== observedUrl;
      const previousReadSignature = lastLinkedInRead ? `${lastLinkedInRead.externalId}:${lastLinkedInRead.title}:${lastLinkedInRead.company}` : "";
      const contentChanged = signature !== previousReadSignature;
      const descriptionReady = Boolean(inspection.snapshot.description);
      if (descriptionReady && (!lastLinkedInRead || !routeChanged || contentChanged && previousSignature === signature)) {
        lastLinkedInRead = {
          url: observedUrl,
          externalId: inspection.snapshot.externalId,
          title: inspection.snapshot.title,
          company: inspection.snapshot.company
        };
        return inspection;
      }
      previousSignature = signature;
    } else {
      previousSignature = "";
    }
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
  if (inspection.kind === "job") {
    lastLinkedInRead = {
      url: observedUrl,
      externalId: inspection.snapshot.externalId,
      title: inspection.snapshot.title,
      company: inspection.snapshot.company
    };
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
