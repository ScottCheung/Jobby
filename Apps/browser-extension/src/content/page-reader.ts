import type { PageInspection } from "../shared/contracts/page-inspection";
import type { FormInspection } from "../shared/contracts/form-inspection";
import type { FormScope } from "./dom/form-inspector";

import { readSeekPage } from "./platforms/seek/job-reader";
import { readSeekFormPage } from "./platforms/seek/form-reader";
import { readLinkedInPage } from "./platforms/linkedin/job-reader";
import { readLinkedInFormPage } from "./platforms/linkedin/form-reader";
import { readGenericFormPage } from "./platforms/generic/form-reader";
import { readGenericJobPage } from "./platforms/generic/job-reader";
import { findActiveFormScope } from "./dom/form-scope";
import { linkedinAdapter } from "./platforms/linkedin/adapter";

function isLinkedInHost(hostname: string): boolean {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}

function isSeekHost(hostname: string): boolean {
  return (
    hostname === "seek.com" ||
    hostname.endsWith(".seek.com") ||
    hostname === "seek.com.au" ||
    hostname.endsWith(".seek.com.au")
  );
}

let lastLinkedInRead: { url: string; externalId: string; title: string; company: string } | null = null;

export function readCurrentPage(): PageInspection {
  if (isSeekHost(window.location.hostname)) {
    const inspection = readSeekPage();
    return inspection.kind === "job" ? inspection : fallbackToGenericJob(inspection);
  }
  if (isLinkedInHost(window.location.hostname)) {
    const inspection = readLinkedInPage();
    return inspection.kind === "job" ? inspection : fallbackToGenericJob(inspection);
  }
  return readGenericJobPage();
}

export async function readCurrentPageWhenReady(): Promise<PageInspection> {
  if (isLinkedInHost(window.location.hostname)) return readLinkedInPageWhenReady();

  let inspection = readCurrentPage();
  if (inspection.kind === "job") return inspection;

  // Job boards and ATS pages often render their content shortly after the URL
  // changes. This bounded retry runs only when the user explicitly inspects.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    inspection = readCurrentPage();
    if (inspection.kind === "job") return inspection;
  }
  return inspection;
}

function fallbackToGenericJob(preferredInspection: PageInspection): PageInspection {
  const genericInspection = readGenericJobPage();
  if (genericInspection.kind === "job") return genericInspection;

  // An authentication or application route frequently has no stable job ID.
  // In that situation the useful diagnosis is whether job content is actually
  // visible, rather than an URL-only platform error.
  if (
    preferredInspection.kind === "not_job_page" &&
    preferredInspection.reason.includes("URL does not identify")
  ) {
    return genericInspection;
  }
  return preferredInspection;
}

async function readLinkedInPageWhenReady(): Promise<PageInspection> {
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
      const previousReadSignature = lastLinkedInRead
        ? `${lastLinkedInRead.externalId}:${lastLinkedInRead.title}:${lastLinkedInRead.company}`
        : "";
      const contentChanged = signature !== previousReadSignature;
      const descriptionReady = Boolean(inspection.snapshot.description);
      if (descriptionReady && (!lastLinkedInRead || !routeChanged || (contentChanged && previousSignature === signature))) {
        lastLinkedInRead = {
          url: observedUrl,
          externalId: inspection.snapshot.externalId,
          title: inspection.snapshot.title,
          company: inspection.snapshot.company,
        };
        return inspection;
      }
      previousSignature = signature;
    } else {
      previousSignature = "";
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
  }

  if (inspection.kind === "job") {
    lastLinkedInRead = {
      url: observedUrl,
      externalId: inspection.snapshot.externalId,
      title: inspection.snapshot.title,
      company: inspection.snapshot.company,
    };
  }
  return inspection;
}

export function readCurrentForm(): FormInspection {
  if (isSeekHost(window.location.hostname)) return readSeekFormPage();
  if (isLinkedInHost(window.location.hostname)) return readLinkedInFormPage();
  return readGenericFormPage();
}

export function getCurrentFormScope(): FormScope | null {
  if (isSeekHost(window.location.hostname)) return findActiveFormScope() || document;
  if (isLinkedInHost(window.location.hostname)) return linkedinAdapter.getApplicationRoot() || findActiveFormScope();
  // Generic pages can expose useful controls outside a semantic <form>.
  // They are inspected on demand only, so document fallback does not create a
  // permanent whole-page observer.
  return findActiveFormScope() || document;
}
