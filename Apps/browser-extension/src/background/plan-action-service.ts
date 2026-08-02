import type { ApplicationPlanAction, ValidatedApplicationPlanResponse } from "../shared/contracts/backend";

import { apiClient } from "./api-client";

export function applyApplicationPlanAction(
  applicationId: string,
  action: ApplicationPlanAction,
  reason?: string,
): Promise<ValidatedApplicationPlanResponse> {
  return apiClient.applyApplicationPlanAction(applicationId, action, reason);
}
