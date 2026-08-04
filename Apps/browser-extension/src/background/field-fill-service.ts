import type { FormFillInstructionsResponse, FieldFillResult, FormFieldTarget } from "../shared/contracts/form-actions";
import type { ValidatedApplicationPlanResponse } from "../shared/contracts/backend";

import { inspectActiveTab, inspectFormActiveTab, fillActiveTabField, clickLinkedInApplicationAction, uploadActiveTabFile } from "./content-bridge";
import { apiClient } from "./api-client";
import { logDiagnostic } from "./diagnostics";

export async function uploadDefaultResumeToActiveTab(target: FormFieldTarget): Promise<FieldFillResult> {
  if (target.type !== "file") {
    return {
      commandId: `default-resume-${Date.now()}-${target.key}`,
      key: target.key,
      status: "rejected",
      message: "Automatic resume upload is only available for file fields.",
    };
  }
  const commandId = `default-resume-${Date.now()}-${target.key}`;
  try {
    const resume = await apiClient.downloadDefaultResume();
    await logDiagnostic("info", "upload", "Starting default resume upload.", {
      commandId,
      fieldKey: target.key,
      fieldLabel: target.label,
      filename: resume.filename,
      mimeType: resume.mimeType,
    });
    const result = await uploadActiveTabFile({
      type: "content.upload-file",
      commandId,
      target,
      ...resume,
    });
    await logDiagnostic(
      result.status === "filled" || result.status === "already_filled" ? "info" : "warn",
      "upload",
      "Default resume upload command completed.",
      {
        commandId,
        fieldKey: target.key,
        fieldLabel: target.label,
        filename: resume.filename,
        status: result.status,
        message: result.message,
      },
    );
    return result;
  } catch (error) {
    const result = {
      commandId,
      key: target.key,
      status: "rejected",
      message: error instanceof Error ? error.message : "Could not load the default Jobby resume.",
    } as const;
    await logDiagnostic("error", "upload", "Default resume upload failed before the webpage accepted it.", {
      commandId,
      fieldKey: target.key,
      fieldLabel: target.label,
      message: result.message,
    });
    return result;
  }
}

export async function autofillDetectedFormForActiveTab(): Promise<{
  results: FieldFillResult[];
  unansweredFields: Array<{ key: string; label: string; reason: string }>;
}> {
  const form = await inspectFormActiveTab();
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") {
    throw new Error("Inspect a supported application form before autofilling.");
  }
  const page = await inspectActiveTab().catch(() => null);
  const company = page?.kind === "job" ? page.snapshot.company : undefined;
  const instructions = await apiClient.getFormAutofillInstructions(
    form.platform,
    form.fields.map(({ frameId: _frameId, ...field }) => field),
    company,
  );
  const results: FieldFillResult[] = [];
  for (const instruction of instructions.instructions) {
    const field = form.fields.find((candidate) => candidate.key === instruction.target.key);
    results.push(await fillActiveTabField({
      ...instruction,
      target: {
        ...instruction.target,
        ...(field?.frameId !== undefined ? { frameId: field.frameId } : {}),
      },
    }));
  }
  const resumeFile = form.fields.find(
    (field) => field.type === "file" && /resume|curriculum vitae|\bcv\b/i.test(field.label),
  );
  if (resumeFile && !resumeFile.filled) {
    results.push(await uploadDefaultResumeToActiveTab({
      key: resumeFile.key,
      frameId: resumeFile.frameId,
      id: resumeFile.id,
      name: resumeFile.name,
      label: resumeFile.label,
      type: resumeFile.type,
    }));
  }
  return { results, unansweredFields: instructions.unanswered_fields };
}

export async function fillKnownFieldsForActiveTab(applicationId: string): Promise<{
  instructions: FormFillInstructionsResponse;
  results: FieldFillResult[];
  plan?: ValidatedApplicationPlanResponse;
}> {
  let currentPlan = await apiClient.getApplicationPlan(applicationId);
  if (currentPlan.plan.state === "planned" || currentPlan.plan.state === "awaiting_user_review") {
    currentPlan = await apiClient.applyApplicationPlanAction(applicationId, "prepare");
  } else if (currentPlan.plan.state !== "preparing") {
    throw new Error(`Application plan is ${currentPlan.plan.state}; prepare it before filling fields.`);
  }

  const form = await inspectFormActiveTab();
  if (form.kind !== "application_form") {
    throw new Error("Inspect a supported application form before filling cached fields.");
  }

  // frameId is an extension-only routing detail. Keep the API's field
  // contract stable while retaining the local mapping for the returned
  // instructions below.
  const instructions = await apiClient.getFormFillInstructions(
    applicationId,
    form.fields.map(({ frameId: _frameId, ...field }) => field),
  );
  const results: FieldFillResult[] = [];
  for (const instruction of instructions.instructions) {
    const field = form.fields.find((candidate) => candidate.key === instruction.target.key);
    results.push(await fillActiveTabField({
      ...instruction,
      target: {
        ...instruction.target,
        ...(field?.frameId !== undefined ? { frameId: field.frameId } : {}),
      },
    }));
  }

  const resumeFile = form.fields.find((field) => field.type === "file" && /resume|curriculum vitae|\bcv\b/i.test(field.label));
  if (resumeFile && !resumeFile.filled) {
    results.push(await uploadDefaultResumeToActiveTab({
      key: resumeFile.key,
      frameId: resumeFile.frameId,
      id: resumeFile.id,
      name: resumeFile.name,
      label: resumeFile.label,
      type: resumeFile.type,
    }));
  }

  const unresolvedInstructions = instructions.unanswered_fields.filter(
    (item) => !results.some(
      (result) =>
        result.key === item.key &&
        (result.status === "filled" || result.status === "already_filled"),
    ),
  );
  const requiresReview =
    unresolvedInstructions.length > 0 ||
    results.some((item) => item.status !== "filled" && item.status !== "already_filled");
  if (!requiresReview) {
    return {
      instructions: { ...instructions, unanswered_fields: unresolvedInstructions },
      results,
    };
  }

  const plan = await apiClient.applyApplicationPlanAction(
    applicationId,
    "request_review",
    "Some application fields need user review before preparation can be marked complete.",
  );
  return { instructions: { ...instructions, unanswered_fields: unresolvedInstructions }, results, plan };
}

export async function fillAndNextForActiveTab(applicationId: string): Promise<{
  instructions: FormFillInstructionsResponse;
  results: FieldFillResult[];
  plan?: ValidatedApplicationPlanResponse;
  stepAdvanced: boolean;
  actionLabel?: string;
  unfilledRequiredLabels?: string[];
}> {
  const filled = await fillKnownFieldsForActiveTab(applicationId);
  const form = await inspectFormActiveTab();
  if (form.kind !== "application_form") {
    return { ...filled, stepAdvanced: false, actionLabel: "No active form found" };
  }

  if (form.action === "next") {
    const requiredUnfilled = form.fields.filter((f) => f.required && !f.filled);
    if (requiredUnfilled.length === 0) {
      const actionRes = await clickLinkedInApplicationAction("next");
      if (actionRes.status === "clicked") {
        return {
          ...filled,
          stepAdvanced: true,
          actionLabel: actionRes.actionLabel || "Next step",
        };
      }
    } else {
      const labels = requiredUnfilled.map((f) => f.label);
      return {
        ...filled,
        stepAdvanced: false,
        actionLabel: `Unfilled required: ${labels.join(", ")}`,
        unfilledRequiredLabels: labels,
      };
    }
  }

  return {
    ...filled,
    stepAdvanced: false,
    actionLabel: form.action === "submit" ? "Ready for submission" : "Manual review required",
  };
}
