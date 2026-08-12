import type { ValidatedApplicationPlanResponse } from "../../shared/contracts/backend";
import type { FieldFillResult } from "../../shared/contracts/form-actions";
import type { FormInspection } from "../../shared/contracts/form-inspection";
import { send, wait } from "./messaging";

export interface ApplicationActionResult {
  success: boolean;
  message?: string;
  error?: string;
  plan?: ValidatedApplicationPlanResponse;
  fillResults?: FieldFillResult[];
  unansweredFields?: Array<{ key: string; label: string; reason: string }>;
  autoStatus?: string;
  autoMessage?: string;
}

export async function executeOpenLinkedIn(
  inspectForm: () => Promise<FormInspection | null>,
): Promise<ApplicationActionResult> {
  const response = await send({ type: "application.open-linkedin-active" });
  if (!response.ok) {
    return { success: false, error: `❌ Error opening application: ${response.error}` };
  }
  let form: FormInspection | null = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await wait(attempt === 0 ? 100 : 150);
    form = await inspectForm();
    if (form?.kind === "application_form") break;
  }
  if (form?.kind === "application_form" || response.linkedinApplication?.status === "opened") {
    return {
      success: true,
      message:
        form?.kind === "application_form"
          ? "✅ Easy Apply modal and form fields are ready!"
          : "✅ Easy Apply modal opened, form fields are loading...",
    };
  }
  return {
    success: false,
    error:
      form?.kind === "not_application_form"
        ? form.reason
        : response.linkedinApplication?.message || "No Easy Apply button detected.",
  };
}

export async function executeMoveNext(
  inspectForm: () => Promise<FormInspection | null>,
): Promise<ApplicationActionResult> {
  const response = await send({ type: "application.linkedin-action-active", action: "next" });
  if (!response.ok) {
    return { success: false, error: `❌ Failed to click Next: ${response.error}` };
  }
  await wait(80);
  await inspectForm();
  return { success: true, message: `✅ ${response.linkedinApplication?.message || "Moved to next step."}` };
}

export async function executeMovePrevious(
  inspectForm: () => Promise<FormInspection | null>,
): Promise<ApplicationActionResult> {
  const response = await send({ type: "application.linkedin-action-active", action: "previous" });
  if (!response.ok) {
    return { success: false, error: `❌ Failed to click Previous: ${response.error}` };
  }
  await wait(80);
  await inspectForm();
  return { success: true, message: `✅ ${response.linkedinApplication?.message || "Moved to previous step."}` };
}

export async function executeAutoRun(
  latestPlanId?: string,
): Promise<ApplicationActionResult> {
  const response = await send({
    type: "application.auto-run-linkedin-active",
    ...(latestPlanId ? { applicationId: latestPlanId } : {}),
  });
  if (!response.ok) {
    return { success: false, error: `❌ Auto-apply interrupted: ${response.error}` };
  }
  return {
    success: true,
    plan: response.plan,
    fillResults: response.fillResults,
    unansweredFields: response.unansweredFields,
    autoStatus: response.autoStatus,
    autoMessage: response.autoMessage,
  };
}
