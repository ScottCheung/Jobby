import { readSeekPage } from "/src/content/platforms/seek/job-reader.ts.js";
import { readSeekFormPage } from "/src/content/platforms/seek/form-reader.ts.js";
import { readLinkedInPage } from "/src/content/platforms/linkedin/job-reader.ts.js";
import { readLinkedInFormPage } from "/src/content/platforms/linkedin/form-reader.ts.js";
import { linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
function isLinkedInHost(hostname) {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}
function isSeekHost(hostname) {
  return hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
}
let lastLinkedInRead = null;
export function readCurrentPage() {
  const url = window.location.href;
  if (isSeekHost(window.location.hostname)) return readSeekPage();
  if (isLinkedInHost(window.location.hostname)) return readLinkedInPage();
  return { kind: "unsupported_page", url, reason: "This page is not supported yet." };
}
export async function readCurrentPageWhenReady() {
  if (isLinkedInHost(window.location.hostname)) return readLinkedInPageWhenReady();
  let inspection = readCurrentPage();
  if (inspection.kind !== "not_job_page" || !inspection.reason.includes("title")) return inspection;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    inspection = readCurrentPage();
    if (inspection.kind === "job") return inspection;
  }
  return inspection;
}
async function readLinkedInPageWhenReady() {
  let observedUrl = window.location.href;
  let previousSignature = "";
  let inspection = readCurrentPage();
  for (let attempt = 0; attempt < 8; attempt += 1) {
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
      if (!lastLinkedInRead || !routeChanged || contentChanged && previousSignature === signature) {
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
  const url = window.location.href;
  if (isSeekHost(window.location.hostname)) return readSeekFormPage();
  if (isLinkedInHost(window.location.hostname)) return readLinkedInFormPage();
  return { kind: "unsupported_page", url, reason: "This page is not supported yet." };
}
export function getCurrentFormScope() {
  if (isSeekHost(window.location.hostname)) return document;
  if (isLinkedInHost(window.location.hostname)) return linkedinAdapter.getApplicationRoot();
  return null;
}
