import type { FieldFillResult, FormFieldTarget } from "../shared/contracts/form-actions";
import type { FormInspection } from "../shared/contracts/form-inspection";
import type { ProviderAutofillPolicy } from "../content/platforms/platform-definition";
import { findProviderDefinition } from "../content/platforms/registry";

import {
  autofillStructuredActiveTab,
  cancelStructuredActiveTab,
  inspectActiveTab,
  inspectFormActiveTab,
  fillActiveTabField,
  uploadActiveTabFile,
} from "./content-bridge";
import { apiClient } from "./api-client";
import { logDiagnostic } from "./diagnostics";
import { getAutofillSessionId } from "./session-store";

let activeAutofillRunId: string | undefined;
const cancelledAutofillRuns = new Set<string>();

function isAutofillCancelled(runId: string): boolean {
  return cancelledAutofillRuns.has(runId);
}

export async function cancelActiveAutofill(): Promise<void> {
  const runId = activeAutofillRunId;
  if (!runId) return;
  cancelledAutofillRuns.add(runId);
  await cancelStructuredActiveTab(runId).catch(() => undefined);
}

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

function isResumeField(
  field: {
    type: string;
    label: string;
    key?: string;
    id?: string;
    name?: string;
    semanticFeatures?: string[];
  },
  platform?: string,
): boolean {
  if (field.type !== "file") return false;
  const provider = findProviderDefinition(platform);
  if (provider?.autofill?.treatsAllFileInputsAsResume) return true;
  const identity = [
    field.label,
    field.key,
    field.id,
    field.name,
    ...(field.semanticFeatures || []),
  ].filter(Boolean).join(" ");
  return /resume|curriculum vitae|\bcv\b|简历|履历|upload.*resume|attach.*resume/i.test(identity);
}

function isReactiveAddressCountryField(
  instruction: { target: { id?: string; name?: string; label?: string; type: string } },
  field?: { id?: string; name?: string; label: string; type: string },
): boolean {
  if (instruction.target.type !== "select" && field?.type !== "select") return false;
  const identity = `${instruction.target.id || ""} ${instruction.target.name || ""} ${instruction.target.label || ""} ${field?.id || ""} ${field?.name || ""} ${field?.label || ""}`.trim();
  return /(?:^|\s)country(?:\s|$)/i.test(identity);
}

function autofillPolicyFor(
  form: FormInspection,
): ProviderAutofillPolicy | undefined {
  if (
    form.kind !== "application_form" &&
    form.kind !== "page_input_fields"
  ) {
    return undefined;
  }
  const provider = findProviderDefinition(form.platform);
  return provider?.autofill;
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

export async function uploadPreparedFileToActiveTab(
  target: FormFieldTarget,
  file: { filename: string; mimeType: string; contentBase64: string },
): Promise<FieldFillResult> {
  const commandId = makeCommandId("selected-resume", target.key);
  if (target.type !== "file") {
    return {
      commandId,
      key: target.key,
      status: "rejected",
      message: "Automatic upload is only available for file fields.",
    };
  }
  const result = await uploadActiveTabFile({
    type: "content.upload-file",
    commandId,
    target,
    ...file,
  });
  await logDiagnostic(
    result.status === "filled" || result.status === "already_filled" ? "info" : "warn",
    "upload",
    "Selected tailored resume upload command completed.",
    {
      commandId,
      fieldKey: target.key,
      fieldLabel: target.label,
      filename: file.filename,
      status: result.status,
      message: result.message,
    },
  );
  return result;
}

async function fillFormWithReactiveConvergence<T extends { instructions: Array<{ target: { key: string; type: string; label?: string } }>; unanswered_fields: Array<{ key: string; label: string; reason: string }> }>(
  getForm: () => Promise<FormInspection>,
  getInstructions: (form: FormInspection) => Promise<T>,
  maxPasses = 4,
  shouldCancel: () => boolean = () => false,
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
    if (shouldCancel()) break;
    let filledInThisPass = 0;
    let selectOrComboboxFilledInThisPass = false;
    let hitReactiveAddressBarrier = false;
    let fields = form.kind === "application_form" || form.kind === "page_input_fields" ? form.fields : [];
    const autofillPolicy = autofillPolicyFor(form);
    for (const instruction of instructions.instructions) {
      if (shouldCancel()) break;
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
        // Some controlled forms rebuild dependent address fields after country
        // selection. Continue from a fresh inspection on the next pass.
        if (isReactiveAddressCountryField(instruction, field)) {
          hitReactiveAddressBarrier = true;
          break;
        }

        // Providers with controlled fields can replace input nodes after each
        // write. Their registered policy re-reads the live form before the
        // next instruction targets a detached field.
        if (autofillPolicy?.mode === "sequential") {
          await new Promise((resolve) =>
            setTimeout(resolve, autofillPolicy.refreshAfterFieldMs),
          );
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

    if (shouldCancel() || (filledInThisPass === 0 && pass > 1)) {
      break;
    }

    // Wait for controlled forms to resolve asynchronous cascades and render
    // newly unlocked child fields into the DOM.
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

  const results = Array.from(resultsMap.values());
  return { results, unansweredFields: instructions.unanswered_fields };
}

export async function autofillDetectedFormForActiveTab(): Promise<{
  results: FieldFillResult[];
  unansweredFields: Array<{ key: string; label: string; reason: string }>;
}> {
  const runId = makeCommandId("autofill-run");
  activeAutofillRunId = runId;
  cancelledAutofillRuns.delete(runId);
  const shouldCancel = () => isAutofillCancelled(runId);
  try {
    let initialForm = await inspectFormActiveTab();
    let structuredResults: FieldFillResult[] = [];
    const provider = findProviderDefinition(
      initialForm.kind === "application_form" || initialForm.kind === "page_input_fields"
        ? initialForm.platform
        : undefined,
    );
    if (
      !shouldCancel() &&
      (initialForm.kind === "application_form" || initialForm.kind === "page_input_fields") &&
      provider?.structuredAutofill?.enabled
    ) {
      const profiles = await apiClient.getCareerProfiles();
      const profile = profiles.find((candidate) => candidate.is_default) || profiles[0];
      if (!shouldCancel() && profile?.resume_data) {
        structuredResults = await autofillStructuredActiveTab(
          profile.resume_data,
          runId,
        );
        if (!shouldCancel()) initialForm = await inspectFormActiveTab();
      }
    }
    if (shouldCancel()) return { results: structuredResults, unansweredFields: [] };
    const autofillPolicy = autofillPolicyFor(initialForm);
    if (autofillPolicy?.mode === "sequential") {
      return autofillFieldsSequentially(initialForm, autofillPolicy, shouldCancel);
    }

    const page = await inspectActiveTab().catch(() => null);
    const company = page?.kind === "job" ? page.snapshot.company : undefined;
    const activeTab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    const sessionId = activeTab?.id === undefined ? undefined : await getAutofillSessionId(activeTab.id);

    const result = await fillFormWithReactiveConvergence(
      () => inspectFormActiveTab(),
      (form: FormInspection) => {
        const scene = inferFormScene(form);
        const fields = form.kind === "application_form" || form.kind === "page_input_fields" ? form.fields : [];
        const platform = form.kind === "application_form" || form.kind === "page_input_fields" ? form.platform : "generic";
        const formProvider = findProviderDefinition(platform);
        const summaryFeature = formProvider?.structuredAutofill?.summaryFeature;
        const eligibleFields = summaryFeature
          ? fields.filter((field) => !field.semanticFeatures?.includes(summaryFeature))
          : fields;
        return apiClient.getFormAutofillInstructions(
          platform,
          eligibleFields.map(({ frameId: _frameId, ...field }) => field),
          company,
          scene,
          sessionId,
        );
      },
      4,
      shouldCancel,
    );
    return {
      ...result,
      results: [...structuredResults, ...result.results],
    };
  } finally {
    cancelledAutofillRuns.delete(runId);
    if (activeAutofillRunId === runId) activeAutofillRunId = undefined;
  }
}

/**
 * Sequential providers persist answers through controlled-field updates. The
 * normal batch endpoint captures a stale form snapshot before the first field
 * changes, so re-inspect after every write.
 */
async function autofillFieldsSequentially(
  initialForm: FormInspection,
  policy: ProviderAutofillPolicy,
  shouldCancel: () => boolean = () => false,
): Promise<{
  results: FieldFillResult[];
  unansweredFields: Array<{ key: string; label: string; reason: string }>;
}> {
  if (initialForm.kind !== "application_form" && initialForm.kind !== "page_input_fields") {
    throw new Error("Inspect a supported application form before autofilling.");
  }

  const results: FieldFillResult[] = [];
  const attempted = new Set<string>();
  let form = initialForm;

  while (form.kind === "application_form" || form.kind === "page_input_fields") {
    if (shouldCancel()) break;
    const field = form.fields.find((candidate) => !candidate.filled && !attempted.has(candidate.key));
    if (!field) break;
    attempted.add(field.key);

    const target: FormFieldTarget = {
      key: field.key,
      id: field.id,
      name: field.name,
      label: field.label,
      type: field.type,
      ...(field.frameId !== undefined ? { frameId: field.frameId } : {}),
    };
    const result = await autofillSingleFieldForActiveTab(target);
    results.push(result);

    await new Promise((resolve) =>
      setTimeout(resolve, policy.settleBetweenFieldsMs),
    );
    const refreshed = await inspectFormActiveTab().catch(() => null);
    if (!refreshed || (refreshed.kind !== "application_form" && refreshed.kind !== "page_input_fields")) {
      break;
    }
    form = refreshed;
  }

  return {
    results,
    unansweredFields: results
      .filter((result) => !isFillComplete(result))
      .map((result) => ({ key: result.key, label: result.key, reason: result.message })),
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
    return {
      commandId: makeCommandId("select-resume", target.key),
      key: target.key,
      status: "requires_user_action",
      message: "Select a resume from Recent Tailor in the Jobby form panel.",
    };
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
