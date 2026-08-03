import type { PageInspection } from "../shared/contracts/page-inspection";
import type { ValidatedApplicationPlanResponse } from "../shared/contracts/backend";

import { apiClient } from "./api-client";
import { inspectActiveTab } from "./content-bridge";

export async function createApplicationPlanFromActiveTab(fallbackInspection?: PageInspection): Promise<{
  inspection: PageInspection;
  plan: ValidatedApplicationPlanResponse;
}> {
  const activeInspection = await inspectActiveTab().catch(() => null);
  // LinkedIn can replace the visible job card with an Easy Apply form before
  // the side panel acts. The inspected job snapshot belongs to that same
  // user-initiated flow and lets form filling retain its application context.
  const inspection = activeInspection?.kind === "job"
    ? activeInspection
    : fallbackInspection?.kind === "job"
      ? fallbackInspection
      : activeInspection;
  if (!inspection || inspection.kind !== "job") {
    throw new Error("Inspect a job page before creating an application plan.");
  }

  const { snapshot } = inspection;
  const plan = await apiClient.createApplicationPlan({
    candidate: {
      platform: snapshot.platform,
      external_id: snapshot.externalId,
      title: snapshot.title,
      company: snapshot.company,
      description: snapshot.description || null,
      easy_apply: snapshot.easyApply,
    },
    job_description: snapshot.description || null,
    job_link: snapshot.url,
    work_location: snapshot.location || null,
  });

  return { inspection, plan };
}
