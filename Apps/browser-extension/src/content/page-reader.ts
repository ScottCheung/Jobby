import type { PageInspection } from "../shared/contracts/page-inspection";
import type { FormInspection } from "../shared/contracts/form-inspection";
import type { DedicatedPlatform, AtsJobPlatform } from "../shared/contracts/platform";
import type { FormScope } from "./dom/form-inspector";

import { readGenericFormPage } from "./platforms/generic/form-reader";
import { readGenericJobPage } from "./platforms/generic/job-reader";
import { readAtsJobPage } from "./platforms/ats/job-reader";
import {
  findDedicatedApplicationScope,
  readDedicatedFormPage,
} from "./platforms/ats/form-reader";
import {
  detectDedicatedPlatform,
} from "./platforms/provider-routing";
import {
  findProviderDefinition,
  isSharedFormPlatform,
} from "./platforms/registry";
import { isAtsJobConfig, isDedicatedJobReader } from "./platforms/platform-definition";
import { findActiveFormScope } from "./dom/form-scope";
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

export function readCurrentPage(): PageInspection {
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
  const provider = platform ? findProviderDefinition(platform) : undefined;

  if (provider) {
    if (isDedicatedJobReader(provider.job)) {
      const inspection = provider.job.read();
      const canFallback = provider.job.fallback ?? true;
      return inspection.kind === "job" || !canFallback
        ? inspection
        : fallbackToGenericJob(inspection, provider.platform);
    }
    if (isAtsJobConfig(provider.job)) {
      const inspection = readAtsJobPage(provider.platform as AtsJobPlatform);
      return inspection.kind === "job"
        ? inspection
        : fallbackToGenericJob(inspection, provider.platform);
    }
  }

  return readGenericJobPage();
}

function postingDateWaitPolicy(
  inspection: PageInspection,
): { required: boolean; untilAttempt: number } {
  if (inspection.kind !== "job") {
    return { required: false, untilAttempt: 0 };
  }
  const provider = findProviderDefinition(inspection.snapshot.platform);
  if (!provider) {
    return { required: false, untilAttempt: 0 };
  }
  const untilAttempt = isAtsJobConfig(provider.job)
    ? provider.job.postingDateWaitUntilAttempt
    : provider.job?.readiness?.postingDateWaitUntilAttempt;
  return {
    required: untilAttempt !== undefined && !inspection.snapshot.lastPostedAt,
    untilAttempt: untilAttempt || 0,
  };
}

function providerReadinessWaitUntilAttempt(): number {
  const platform = detectDedicatedPlatform(window.location, document);
  if (!platform) return 0;
  const provider = findProviderDefinition(platform);
  if (!provider) return 0;
  if (isAtsJobConfig(provider.job)) {
    return provider.job.readinessWaitUntilAttempt || 0;
  }
  const wait = provider.job?.readiness?.readinessWaitUntilAttempt;
  if (typeof wait === "function") {
    return wait(window.location);
  }
  return wait || 0;
}

export async function readCurrentPageWhenReady(): Promise<PageInspection> {
  const platform = detectDedicatedPlatform(window.location, document);
  const provider = platform ? findProviderDefinition(platform) : undefined;
  if (provider && isDedicatedJobReader(provider.job) && provider.job.readiness?.readWhenReady) {
    return provider.job.readiness.readWhenReady();
  }

  let inspection = readCurrentPage();
  if (lastPageClass && !lastPageClass.isJobPage) {
    return inspection;
  }

  let previousSnapshotSignature = "";
  const readinessWaitAttempts = providerReadinessWaitUntilAttempt();
  const maxAttempts = Math.max(15, readinessWaitAttempts + 1);

  // Split views can replace the selected job after the click while keeping the
  // same URL. Require a short stable window so a previous card's complete DOM
  // is not returned while the new detail pane is still mounting.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (inspection.kind === "job") {
      const snapshotSignature = [
        inspection.snapshot.platform,
        inspection.snapshot.externalId,
        inspection.snapshot.title,
        inspection.snapshot.company,
      ].join(":");
      const postingDateWait = postingDateWaitPolicy(inspection);
      if (
        attempt >= 2 &&
        snapshotSignature === previousSnapshotSignature &&
        !(postingDateWait.required && attempt < postingDateWait.untilAttempt)
      ) {
        return inspection;
      }
      previousSnapshotSignature = snapshotSignature;
    } else {
      previousSnapshotSignature = "";
      const isClassifiedJob = Boolean(lastPageClass?.isJobPage);
      const minAttempts = isClassifiedJob ? 8 : 1;
      if (attempt >= minAttempts && readinessWaitAttempts === 0) {
        return inspection;
      }
    }
    // Preserve the existing readiness window unless the selected
    // provider declares that posting metadata renders in a separate pass.
    const postingDateWait = postingDateWaitPolicy(inspection);
    if (
      attempt >= 5 &&
      attempt >= readinessWaitAttempts &&
      !postingDateWait.required
    ) {
      return inspection;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    inspection = readCurrentPage();
  }
  return inspection;
}

function fallbackToGenericJob(
  preferredInspection: PageInspection,
  platform?: DedicatedPlatform | AtsJobPlatform,
): PageInspection {
  if (lastPageClass && !lastPageClass.isJobPage) {
    return preferredInspection;
  }
  const genericInspection = readGenericJobPage();
  if (genericInspection.kind === "job") {
    if (platform) {
      return {
        ...genericInspection,
        snapshot: {
          ...genericInspection.snapshot,
          platform: platform as AtsJobPlatform,
        },
      };
    }
    return genericInspection;
  }

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


export function readCurrentForm(): FormInspection {
  const platform = detectDedicatedPlatform(window.location, document);
  const provider = platform ? findProviderDefinition(platform) : undefined;
  if (provider?.form?.read) {
    return provider.form.read();
  }
  if (platform && isSharedFormPlatform(platform)) {
    const inspection = readDedicatedFormPage(platform);
    if (inspection) return inspection;
  }
  return readGenericFormPage();
}

export function getCurrentFormScope(): FormScope | null {
  const platform = detectDedicatedPlatform(window.location, document);
  const provider = platform ? findProviderDefinition(platform) : undefined;
  if (provider?.form?.scope) {
    return provider.form.scope();
  }
  if (platform && isSharedFormPlatform(platform)) {
    const scope = findDedicatedApplicationScope(platform);
    if (scope) return scope;
  }
  // Generic pages can expose useful controls outside a semantic <form>.
  // They are inspected on demand only, so document fallback does not create a
  // permanent whole-page observer.
  return findActiveFormScope() || document;
}
