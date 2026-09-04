import type { PageInspection } from "../../../shared/contracts/page-inspection";
import { classifyCurrentPage } from "../../page-classifier";
import { getIndeedTargetJobKey, readIndeedJobPage } from "./job-reader";

export async function readIndeedPageWhenReady(): Promise<PageInspection> {
  const currentUrl = window.location.href;
  const pageClass = classifyCurrentPage();
  if (!pageClass.isJobPage) {
    return {
      kind: "unsupported_page",
      url: currentUrl,
      reason: pageClass.skipReason,
    };
  }

  let observedUrl = currentUrl;
  let previousSnapshotSignature = "";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const activeUrl = window.location.href;
    if (activeUrl !== observedUrl) {
      observedUrl = activeUrl;
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
      if (attempt >= 1 && !getIndeedTargetJobKey(activeUrl)) {
        return inspection;
      }
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
  }

  return readIndeedJobPage();
}
