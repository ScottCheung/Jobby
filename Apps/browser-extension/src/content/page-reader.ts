import type { PageInspection } from "../shared/contracts/page-inspection";
import type { FormInspection } from "../shared/contracts/form-inspection";
import type { FormScope } from "./dom/form-inspector";

import { readSeekPage } from "./platforms/seek/job-reader";
import { readSeekFormPage } from "./platforms/seek/form-reader";
import { readLinkedInPage } from "./platforms/linkedin/job-reader";
import { readLinkedInFormPage } from "./platforms/linkedin/form-reader";
import { readGenericFormPage } from "./platforms/generic/form-reader";
import { readGenericJobPage } from "./platforms/generic/job-reader";
import { readIndeedJobPage } from "./platforms/indeed/job-reader";
import { findActiveFormScope } from "./dom/form-scope";
import { linkedinAdapter } from "./platforms/linkedin/adapter";
import { classifyCurrentPage } from "./page-classifier";
import type { PageClass } from "./page-classifier";

/** Last classification result — consumed by the sidepanel debug banner. */
let lastPageClass: PageClass | null = null;

/** Returns the most recent page classification result (may be null before first call). */
export function getLastPageClass(): PageClass | null {
  return lastPageClass;
}

/**
 * Re-run the classifier on the current page and return the result.
 * Called explicitly by the sidepanel to get fresh debug info.
 */
export function classifyPage(): PageClass {
  lastPageClass = classifyCurrentPage();
  return lastPageClass;
}

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

/** Matches indeed.com, au.indeed.com, ca.indeed.com, etc. */
function isIndeedHost(hostname: string): boolean {
  return hostname === "indeed.com" || /\.indeed\.com$/.test(hostname);
}

export function readCurrentPage(apiData?: import('./platforms/linkedin/api-client').LinkedInJobApiData | null): PageInspection {
  const url = window.location.href;
  const hostname = window.location.hostname;

  // Run the lightweight classifier first. Pages classified as non-job pages
  // (e.g. help center, feeds, user profiles, salary tools) are rejected here
  // before any DOM parsing or generic fallback begins.
  lastPageClass = classifyCurrentPage();
  if (!lastPageClass.isJobPage) {
    return {
      kind: "unsupported_page",
      url,
      reason: lastPageClass.skipReason,
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

export async function readCurrentPageWhenReady(): Promise<PageInspection> {
  if (isLinkedInHost(window.location.hostname)) return readLinkedInPageWhenReady();

  let inspection = readCurrentPage();

  // Job boards (like SEEK) and ATS pages often render their content asynchronously.
  // Retry briefly (up to 600ms) if the page isn't ready or datePosted is missing.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (inspection.kind === "job" && inspection.snapshot.title && inspection.snapshot.datePosted) {
      return inspection;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    inspection = readCurrentPage();
  }
  return inspection;
}

function fallbackToGenericJob(preferredInspection: PageInspection): PageInspection {
  if (lastPageClass && !lastPageClass.isJobPage) {
    return preferredInspection;
  }
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
  let previousSnapshotSignature = "";

  // ── Fire API fetch in parallel with DOM polling ───────────────────────────
  // We start the API call immediately (it doesn't wait for the DOM to settle).
  // The Voyager API returns an exact posting timestamp, making the fragile DOM
  // date extraction unnecessary for logged-in users.
  const jobIdNow = linkedinAdapter.jobIdFromUrl(observedUrl);
  let cachedApiData: import('./platforms/linkedin/api-client').LinkedInJobApiData | null = null;
  let apiResolved = false;

  const apiDataPromise: Promise<import('./platforms/linkedin/api-client').LinkedInJobApiData | null> =
    jobIdNow
      ? import('./platforms/linkedin/api-client').then(({ fetchLinkedInJobPosting }) =>
          fetchLinkedInJobPosting(jobIdNow),
        )
      : Promise.resolve(null);

  apiDataPromise
    .then((data) => {
      cachedApiData = data;
      apiResolved = true;
    })
    .catch(() => {
      apiResolved = true;
    });

  let inspection = readCurrentPage();

  // LinkedIn mounts the top-card metadata independently from the title and
  // description during client-side navigation.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const currentUrl = window.location.href;
    if (currentUrl !== observedUrl) {
      observedUrl = currentUrl;
      previousSnapshotSignature = "";
    }

    inspection = readCurrentPage(apiResolved ? cachedApiData : undefined);
    if (inspection.kind === "job") {
      const snapshotSignature = [
        inspection.snapshot.externalId,
        inspection.snapshot.title,
        inspection.snapshot.company,
        inspection.snapshot.datePosted || "",
      ].join(":");
      const descriptionReady = Boolean(inspection.snapshot.description);

      if (apiResolved && cachedApiData) {
        // API data is available — merge and return immediately.
        const enriched = readLinkedInPage(cachedApiData);
        if (enriched.kind === "job" && enriched.snapshot.description) {
          return enriched;
        }
      }

      const dateReady = Boolean(inspection.snapshot.datePosted);
      const metadataReady = dateReady || attempt >= 19;
      const snapshotStable = snapshotSignature === previousSnapshotSignature;
      if (descriptionReady && metadataReady && (snapshotStable || attempt >= 19)) {
        const resolvedApiData = await apiDataPromise.catch(() => null);
        if (resolvedApiData) {
          const enriched = readLinkedInPage(resolvedApiData);
          if (enriched.kind === "job") return enriched;
        }
        return inspection;
      }
      previousSnapshotSignature = snapshotSignature;
    } else {
      previousSnapshotSignature = "";
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
  }

  // Final attempt — await API one last time
  const resolvedApiData = await apiDataPromise.catch(() => null);
  if (resolvedApiData) {
    const enriched = readLinkedInPage(resolvedApiData);
    if (enriched.kind === "job") return enriched;
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
