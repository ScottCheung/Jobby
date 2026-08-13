import type { FormFillInstructionsResponse, FieldFillResult, FormFieldTarget } from "../shared/contracts/form-actions";
import type { ValidatedApplicationPlanResponse } from "../shared/contracts/backend";
import type { FormInspection } from "../shared/contracts/form-inspection";

import { inspectActiveTab, inspectFormActiveTab, fillActiveTabField, clickLinkedInApplicationAction, uploadActiveTabFile } from "./content-bridge";
import { apiClient } from "./api-client";
import { logDiagnostic } from "./diagnostics";
import { getAutofillSessionId } from "./session-store";

function inferFormScene(form: FormInspection): string {
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") return "job_application";
  const text = `${form.url} ${form.fields.map((field) => field.label).join(" ")}`.toLowerCase();
  if (/(visa|immigration|passport|residency)/i.test(text)) return "visa_application";
  if (/(sign.?up|register|create account)/i.test(text)) return "registration";
  return "job_application";
}

function makeCommandId(prefix: string, key?: string): string {
  const time = Date.now();
  const safeKey = (key || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const raw = safeKey ? `${prefix}-${time}-${safeKey}` : `${prefix}-${time}`;
  return raw.slice(0, 64);
}

function isResumeField(field: { type: string; label: string }, platform?: string): boolean {
  if (field.type !== "file") return false;
  if (platform === "linkedin") return true;
  return /resume|curriculum vitae|\bcv\b|简历|履历|document|upload/i.test(field.label);
}

function isReactiveAddressCountryField(
  instruction: { target: { id?: string; name?: string; label?: string; type: string } },
  field?: { id?: string; name?: string; label: string; type: string },
): boolean {
  if (instruction.target.type !== "select" && field?.type !== "select") return false;
  const identity = `${instruction.target.id || ""} ${instruction.target.name || ""} ${instruction.target.label || ""} ${field?.id || ""} ${field?.name || ""} ${field?.label || ""}`.trim();
  return /(?:^|\s)country(?:\s|$)/i.test(identity);
}

function isAshbyForm(form: FormInspection): boolean {
  try {
    return new URL(form.url).hostname.endsWith("ashbyhq.com");
  } catch {
    return false;
  }
}

function isFillComplete(result: FieldFillResult | undefined): boolean {
  return result?.status === "filled" || result?.status === "already_filled";
}

export async function uploadDefaultResumeToActiveTab(target: FormFieldTarget): Promise<FieldFillResult> {
  const commandId = makeCommandId("default-resume", target.key);
  if (target.type !== "file") {
    return {
      commandId,
      key: target.key,
      status: "rejected",
      message: "Automatic resume upload is only available for file fields.",
    };
  }
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

async function fillFormWithReactiveConvergence<T extends { instructions: Array<{ target: { key: string; type: string; label?: string } }>; unanswered_fields: Array<{ key: string; label: string; reason: string }> }>(
  getForm: () => Promise<FormInspection>,
  getInstructions: (form: FormInspection) => Promise<T>,
  maxPasses = 4,
): Promise<{
  results: FieldFillResult[];
  unansweredFields: Array<{ key: string; label: string; reason: string }>;
}> {
  let form = await getForm();
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") {
    throw new Error("Inspect a supported application form before autofilling.");
  }
  let instructions = await getInstructions(form);
  const resultsMap = new Map<string, FieldFillResult>();
  const attemptsCount = new Map<string, number>();

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    let filledInThisPass = 0;
    let selectOrComboboxFilledInThisPass = false;
    let hitReactiveAddressBarrier = false;
    let fields = form.kind === "application_form" || form.kind === "page_input_fields" ? form.fields : [];
    const ashbyForm = isAshbyForm(form);
    for (const instruction of instructions.instructions) {
      const key = instruction.target.key;
      const field = fields.find((candidate) => candidate.key === key);
      const previousResult = resultsMap.get(key);

      if (previousResult?.status === "filled" || previousResult?.status === "already_filled") {
        continue;
      }

      const attempts = attemptsCount.get(key) || 0;
      if (attempts >= 2) continue;
      attemptsCount.set(key, attempts + 1);

      const res = await fillActiveTabField({
        type: "content.fill-field",
        ...(instruction as any),
        target: {
          label: field?.label || instruction.target.label || "",
          ...instruction.target,
          type: instruction.target.type as FormFieldTarget["type"],
          ...(field?.frameId !== undefined ? { frameId: field.frameId } : {}),
        },
      });

      resultsMap.set(key, res);
      if (isFillComplete(res)) {
        filledInThisPass += 1;
        if (instruction.target.type === "select" || field?.type === "select") {
          selectOrComboboxFilledInThisPass = true;
        }
        // TechnologyOne's Country picklist asynchronously rebuilds the
        // complete address panel. Do not write following fields into the DOM
        // it is about to replace; wait, inspect the new panel, then continue
        // on the next convergence pass.
        if (isReactiveAddressCountryField(instruction, field)) {
          hitReactiveAddressBarrier = true;
          break;
        }

        // Ashby's controlled form fields persist their value asynchronously
        // and can replace the input nodes after every change. A single-field
        // fill naturally gives that update time to settle; batch fill did not,
        // so later writes could target a detached field and end the run early.
        // Re-read the live form before advancing to the next Ashby field.
        if (ashbyForm) {
          await new Promise((resolve) => setTimeout(resolve, 120));
          const refreshedForm = await getForm().catch(() => null);
          if (
            refreshedForm &&
            (refreshedForm.kind === "application_form" || refreshedForm.kind === "page_input_fields")
          ) {
            form = refreshedForm;
            fields = refreshedForm.fields;
          }
        }
      }
    }

    if (filledInThisPass === 0 && pass > 1) {
      break;
    }

    // Wait 400ms for ATS frameworks (T1Cloud, Workday) to resolve asynchronous
    // cascade AJAX requests and render newly unlocked child fields into the DOM
    if (selectOrComboboxFilledInThisPass) {
      await new Promise((resolve) => setTimeout(resolve, hitReactiveAddressBarrier ? 800 : 400));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const updatedForm = await getForm().catch(() => null);
    if (!updatedForm || (updatedForm.kind !== "application_form" && updatedForm.kind !== "page_input_fields")) {
      break;
    }
    const previousKeys = new Set(fields.map((f) => f.key));
    const hasNewFields = updatedForm.fields.some((f) => !previousKeys.has(f.key));

    form = updatedForm;
    if (hasNewFields) {
      instructions = await getInstructions(form);
    }

    const currentFields = form.fields;
    const remainingUnfilled = instructions.instructions.filter((inst) => {
      const field = currentFields.find((f) => f.key === inst.target.key);
      const res = resultsMap.get(inst.target.key);
      return (
        (!res || (res.status !== "filled" && res.status !== "already_filled")) &&
        (field ? !field.filled : true) &&
        (attemptsCount.get(inst.target.key) || 0) < 2
      );
    });

    if (remainingUnfilled.length === 0 && !hasNewFields) {
      break;
    }
  }

  const finalFields = form.kind === "application_form" || form.kind === "page_input_fields" ? form.fields : [];
  const platform = form.kind === "application_form" || form.kind === "page_input_fields" ? form.platform : undefined;
  const results = Array.from(resultsMap.values());
  const resumeFile = finalFields.find((field) => isResumeField(field, platform));
  if (resumeFile && !resumeFile.filled) {
    results.push(
      await uploadDefaultResumeToActiveTab({
        key: resumeFile.key,
        frameId: resumeFile.frameId,
        id: resumeFile.id,
        name: resumeFile.name,
        label: resumeFile.label,
        type: resumeFile.type,
      }),
    );
  }

  return { results, unansweredFields: instructions.unanswered_fields };
}

export async function autofillDetectedFormForActiveTab(): Promise<{
  results: FieldFillResult[];
  unansweredFields: Array<{ key: string; label: string; reason: string }>;
}> {
  const page = await inspectActiveTab().catch(() => null);
  const company = page?.kind === "job" ? page.snapshot.company : undefined;
  const activeTab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const sessionId = activeTab?.id === undefined ? undefined : await getAutofillSessionId(activeTab.id);

  return fillFormWithReactiveConvergence(
    () => inspectFormActiveTab(),
    (form: FormInspection) => {
      const scene = inferFormScene(form);
      const fields = form.kind === "application_form" || form.kind === "page_input_fields" ? form.fields : [];
      const platform = form.kind === "application_form" || form.kind === "page_input_fields" ? form.platform : "generic";
      return apiClient.getFormAutofillInstructions(
        platform,
        fields.map(({ frameId: _frameId, ...field }) => field),
        company,
        scene,
        sessionId,
      );
    },
  );
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

  let instructionsCache: FormFillInstructionsResponse | undefined;
  const filled = await fillFormWithReactiveConvergence(
    () => inspectFormActiveTab(),
    async (form: FormInspection) => {
      const fields = form.kind === "application_form" || form.kind === "page_input_fields" ? form.fields : [];
      instructionsCache = await apiClient.getFormFillInstructions(
        applicationId,
        fields.map(({ frameId: _frameId, ...field }) => field),
      );
      return instructionsCache;
    },
  );

  const instructions = instructionsCache || { application_id: applicationId, instructions: [], unanswered_fields: [] };
  const unresolvedInstructions = instructions.unanswered_fields.filter(
    (item) => !filled.results.some(
      (result) =>
        result.key === item.key &&
        (result.status === "filled" || result.status === "already_filled"),
    ),
  );
  const requiresReview =
    unresolvedInstructions.length > 0 ||
    filled.results.some((item) => item.status !== "filled" && item.status !== "already_filled");

  if (!requiresReview) {
    return {
      instructions: { ...instructions, unanswered_fields: unresolvedInstructions },
      results: filled.results,
    };
  }

  const plan = await apiClient.applyApplicationPlanAction(
    applicationId,
    "request_review",
    "Some application fields need user review before preparation can be marked complete.",
  );
  return { instructions: { ...instructions, unanswered_fields: unresolvedInstructions }, results: filled.results, plan };
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

export async function autofillSingleFieldForActiveTab(
  target: FormFieldTarget,
): Promise<FieldFillResult> {
  const form = await inspectFormActiveTab();
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") {
    return {
      commandId: makeCommandId("autofill-single", target.key),
      key: target.key,
      status: "rejected",
      message: "No autofillable web form detected.",
    };
  }

  const field = form.fields.find(
    (candidate) =>
      candidate.key === target.key ||
      (target.id && candidate.id === target.id) ||
      (target.name && candidate.name === target.name && candidate.type === target.type) ||
      (candidate.label === target.label && candidate.type === target.type),
  );
  if (!field) {
    return {
      commandId: makeCommandId("autofill-single", target.key),
      key: target.key,
      status: "rejected",
      message: "Could not find this form field on the current page.",
    };
  }

  if (isResumeField(field, form.platform)) {
    return uploadDefaultResumeToActiveTab(target);
  }

  const page = await inspectActiveTab().catch(() => null);
  const company = page?.kind === "job" ? page.snapshot.company : undefined;
  const activeTab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const sessionId = activeTab?.id === undefined ? undefined : await getAutofillSessionId(activeTab.id);
  const scene = inferFormScene(form);

  const instructions = await apiClient.getFormAutofillInstructions(
    form.platform,
    [field],
    company,
    scene,
    sessionId,
  );

  const instruction =
    instructions.instructions.find(
      (item) =>
        item.target.key === target.key ||
        item.target.key === field.key ||
        (target.id && item.target.id === target.id) ||
        (target.name && item.target.name === target.name),
    ) || instructions.instructions[0];

  if (!instruction) {
    const unanswered = instructions.unanswered_fields.find(
      (item) => item.key === target.key || item.key === field.key,
    );
    return {
      commandId: makeCommandId("autofill-single", target.key),
      key: target.key,
      status: "rejected",
      message: unanswered?.reason || "Could not find a suitable answer for this field.",
    };
  }

  return fillActiveTabField({
    ...instruction,
    target: {
      ...instruction.target,
      ...(field.frameId !== undefined ? { frameId: field.frameId } : {}),
    },
  });
}
