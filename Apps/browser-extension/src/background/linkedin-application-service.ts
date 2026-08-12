import type { ValidatedApplicationPlanResponse } from "../shared/contracts/backend";
import type { LinkedInApplicationResult } from "../shared/contracts/linkedin";

import { apiClient } from "./api-client";
import { clickLinkedInApplicationAction } from "./content-bridge";

export async function submitLinkedInApplication(applicationId: string): Promise<{
  application: LinkedInApplicationResult;
  plan: ValidatedApplicationPlanResponse;
}> {
  let currentPlan = await apiClient.getApplicationPlan(applicationId);
  // A user can reach the final step with debug/manual controls rather than Auto
  // Apply. Reconcile the durable plan here, beside the actual submission, so
  // stale side-panel state cannot block submission.
  if (["planned", "awaiting_user_review"].includes(currentPlan.plan.state)) {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "prepare").catch(() => currentPlan);
  }
  if (currentPlan.plan.state === "preparing") {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "mark_prepared").catch(() => currentPlan);
  }
  if (currentPlan.plan.state === "awaiting_user_review") {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "approve").catch(() => currentPlan);
  }

  if (currentPlan.plan.state === "ready_to_submit") {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "begin_submission").catch(() => currentPlan);
  }

  try {
    const application = await clickLinkedInApplicationAction("submit");
    if (application.status !== "clicked") {
      throw new Error(application.message);
    }
    const plan = currentPlan.plan.state !== "submitted"
      ? await apiClient.applyApplicationPlanAction(applicationId, "mark_submitted").catch(() => currentPlan)
      : currentPlan;
    return { application, plan };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Submission failed.";
    if (currentPlan.plan.state !== "submitted") {
      await apiClient.applyApplicationPlanAction(applicationId, "mark_failed", reason).catch(() => undefined);
    }
    throw error;
  }
}
