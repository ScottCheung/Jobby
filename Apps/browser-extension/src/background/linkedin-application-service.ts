import type { ValidatedApplicationPlanResponse } from "../shared/contracts/backend";
import type { LinkedInApplicationResult } from "../shared/contracts/linkedin";

import { apiClient } from "./api-client";
import { clickLinkedInApplicationAction } from "./content-bridge";

export async function submitLinkedInApplication(applicationId: string): Promise<{
  application: LinkedInApplicationResult;
  plan: ValidatedApplicationPlanResponse;
}> {
  let currentPlan = await apiClient.getApplicationPlan(applicationId);
  // A user can reach LinkedIn's final step with the debug controls rather
  // than Auto Apply. Reconcile the durable plan here, beside the actual
  // submission, so stale side-panel state cannot leave it at "preparing".
  if (["planned", "awaiting_user_review"].includes(currentPlan.plan.state)) {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "prepare");
  }
  if (currentPlan.plan.state === "preparing") {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "mark_prepared");
  }
  if (currentPlan.plan.state === "awaiting_user_review") {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "approve");
  }
  if (currentPlan.plan.state !== "ready_to_submit") {
    throw new Error(`Application plan could not be prepared for submission (current state: ${currentPlan.plan.state}).`);
  }

  await apiClient.applyApplicationPlanAction(applicationId, "begin_submission");
  try {
    const application = await clickLinkedInApplicationAction("submit");
    if (application.status !== "clicked") {
      throw new Error(application.message);
    }
    const plan = await apiClient.applyApplicationPlanAction(applicationId, "mark_submitted");
    return { application, plan };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "LinkedIn submission failed.";
    await apiClient.applyApplicationPlanAction(applicationId, "mark_failed", reason).catch(() => undefined);
    throw error;
  }
}
