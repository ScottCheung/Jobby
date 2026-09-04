import type { PageInspection } from "../../../shared/contracts/page-inspection";
import { classifyCurrentPage } from "../../page-classifier";
import { linkedinAdapter } from "./adapter";
import { readLinkedInPage } from "./job-reader";
import type { LinkedInJobApiData } from "./api-client";

export async function readLinkedInPageWhenReady(): Promise<PageInspection> {
  let observedUrl = window.location.href;
  const pageClass = classifyCurrentPage();
  if (!pageClass.isJobPage) {
    return {
      kind: "unsupported_page",
      url: observedUrl,
      reason: pageClass.skipReason,
    };
  }

  let previousSnapshotSignature = "";

  // ── Fire API fetch in parallel with DOM polling ───────────────────────────
  // We start the API call immediately (it doesn't wait for the DOM to settle).
  // Voyager can return an exact posting timestamp. Some responses omit it, so
  // the DOM remains the fallback while the top-card metadata is still mounting.
  const jobIdNow = linkedinAdapter.jobIdFromUrl(observedUrl);
  let cachedApiData: LinkedInJobApiData | null = null;
  let apiResolved = false;

  const apiDataPromise: Promise<LinkedInJobApiData | null> =
    jobIdNow
      ? import("./api-client").then(({ fetchLinkedInJobPosting }) =>
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

  let inspection = readLinkedInPage();

  // LinkedIn mounts the top-card metadata independently from the title and
  // description during client-side navigation.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const currentUrl = window.location.href;
    if (currentUrl !== observedUrl) {
      observedUrl = currentUrl;
      previousSnapshotSignature = "";
    }

    inspection = readLinkedInPage(apiResolved ? cachedApiData : undefined);
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
      const currentJobId = linkedinAdapter.jobIdFromUrl(currentUrl);
      if (attempt >= 1 && !currentJobId) {
        return inspection;
      }
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
