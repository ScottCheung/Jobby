import type { PageInspection } from "../shared/contracts/page-inspection";
import type { FormInspection } from "../shared/contracts/form-inspection";
import type { FormScope } from "./dom/form-inspector";

import { readSeekPage } from "./platforms/seek/job-reader";
import { getSeekApplicationScope, readSeekFormPage } from "./platforms/seek/form-reader";
import { readLinkedInPage } from "./platforms/linkedin/job-reader";
import { readLinkedInFormPage } from "./platforms/linkedin/form-reader";
import { readGenericFormPage } from "./platforms/generic/form-reader";
import { readGenericJobPage } from "./platforms/generic/job-reader";
import { readIndeedJobPage } from "./platforms/indeed/job-reader";
import { readAtsJobPage } from "./platforms/ats/job-reader";
import {
  findDedicatedApplicationScope,
  readDedicatedFormPage,
} from "./platforms/ats/form-reader";
import {
  detectDedicatedPlatform,
  isJobProviderPlatform,
} from "./platforms/provider-routing";
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

function isIndeedHost(hostname: string): boolean {
  return /(?:^|\.)indeed\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i.test(hostname);
}

export function readCurrentPage(apiData?: import('./platforms/linkedin/api-client').LinkedInJobApiData | null): PageInspection {
  const url = window.location.href;

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

  const platform = detectDedicatedPlatform(window.location, document);
  if (platform === "seek") {
    const inspection = readSeekPage();
    return inspection.kind === "job" ? inspection : fallbackToGenericJob(inspection);
  }
  if (platform === "linkedin") {
    return readLinkedInPage(apiData);
  }
  if (platform === "indeed") {
    return readIndeedJobPage();
  }
  if (platform && isJobProviderPlatform(platform)) {
    const inspection = readAtsJobPage(platform);
    return inspection.kind === "job" ? inspection : fallbackToGenericJob(inspection);
  }
  return readGenericJobPage();
}

export async function readCurrentPageWhenReady(): Promise<PageInspection> {
  if (isLinkedInHost(window.location.hostname)) return readLinkedInPageWhenReady();
  if (isIndeedHost(window.location.hostname)) return readIndeedPageWhenReady();

  let inspection = readCurrentPage();
  let previousSnapshotSignature = "";

  // Split views can replace the selected job after the click while keeping the
  // same URL. Require a short stable window so a previous card's complete DOM
  // is not returned while the new detail pane is still mounting.
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (inspection.kind === "job") {
      const snapshotSignature = [
        inspection.snapshot.platform,
        inspection.snapshot.externalId,
        inspection.snapshot.title,
        inspection.snapshot.company,
      ].join(":");
      const waitingForGlassdoorAge =
        inspection.snapshot.platform === "glassdoor" &&
        !inspection.snapshot.lastPostedAt &&
        attempt < 14;
      if (
        attempt >= 2 &&
        snapshotSignature === previousSnapshotSignature &&
        !waitingForGlassdoorAge
      ) {
        return inspection;
      }
      previousSnapshotSignature = snapshotSignature;
    } else {
      previousSnapshotSignature = "";
    }
    // Preserve the existing six-attempt readiness window for every other
    // platform. Glassdoor renders the selected card age separately from its
    // detail pane, so only that provider waits for the late metadata.
    if (
      attempt >= 5 &&
      !(
        inspection.kind === "job" &&
        inspection.snapshot.platform === "glassdoor" &&
        !inspection.snapshot.lastPostedAt
      )
    ) {
      return inspection;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    inspection = readCurrentPage();
  }
  return inspection;
}

async function readIndeedPageWhenReady(): Promise<PageInspection> {
  let observedUrl = window.location.href;
  let previousSnapshotSignature = "";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const currentUrl = window.location.href;
    if (currentUrl !== observedUrl) {
      observedUrl = currentUrl;
      previousSnapshotSignature = "";
    }

    const inspection = readIndeedJobPage();
    if (inspection.kind === "job") {
      const snapshotSignature = [
        inspection.snapshot.externalId,
        inspection.snapshot.title,
        inspection.snapshot.company,
        Boolean(inspection.snapshot.description),
      ].join(":");

      const descriptionReady = Boolean(
        inspection.snapshot.description && inspection.snapshot.description.length >= 20,
      );
      const snapshotStable = snapshotSignature === previousSnapshotSignature;

      if (descriptionReady && (snapshotStable || attempt >= 15)) {
        return inspection;
      }
      previousSnapshotSignature = snapshotSignature;
    } else {
      previousSnapshotSignature = "";
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
  }

  return readIndeedJobPage();
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
  // Voyager can return an exact posting timestamp. Some responses omit it, so
  // the DOM remains the fallback while the top-card metadata is still mounting.
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
        inspection.snapshot.lastPostedAt || "",
      ].join(":");
      const descriptionReady = Boolean(inspection.snapshot.description);

      if (apiResolved && cachedApiData) {
        // API enrichment may omit timestamps. In that case keep waiting for the
        // independently-mounted top-card date instead of returning Unknown.
        const enriched = readLinkedInPage(cachedApiData);
        if (
          enriched.kind === "job" &&
          enriched.snapshot.description &&
          (enriched.snapshot.lastPostedAt || attempt >= 19)
        ) {
          return enriched;
        }
      }

      const dateReady = Boolean(inspection.snapshot.lastPostedAt);
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
  const platform = detectDedicatedPlatform(window.location, document);
  if (platform === "seek") return readSeekFormPage();
  if (platform === "linkedin") return readLinkedInFormPage();
  if (platform) {
    const inspection = readDedicatedFormPage(platform);
    if (inspection) return inspection;
  }
  return readGenericFormPage();
}

export function getCurrentFormScope(): FormScope | null {
  const platform = detectDedicatedPlatform(window.location, document);
  if (platform === "seek") return getSeekApplicationScope();
  if (platform === "linkedin") return linkedinAdapter.getApplicationRoot() || findActiveFormScope();
  if (platform) {
    const scope = findDedicatedApplicationScope(platform);
    if (scope) return scope;
  }
  // Generic pages can expose useful controls outside a semantic <form>.
  // They are inspected on demand only, so document fallback does not create a
  // permanent whole-page observer.
  return findActiveFormScope() || document;
}
