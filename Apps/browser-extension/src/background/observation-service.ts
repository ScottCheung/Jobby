import type { FormFieldObservation, FormInspection } from "../shared/contracts/form-inspection";

import { apiClient } from "./api-client";
import { inspectActiveTab } from "./content-bridge";
import { clearAutofillSession, getAutofillSessionId } from "./session-store";

type PendingChange = {
  platform: string;
  company?: string;
  scene: string;
  field: FormFieldObservation;
};

const pendingChangesByTab = new Map<number, Map<string, PendingChange>>();

function inferScene(form: FormInspection): string {
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") return "generic";
  const text = `${form.url} ${form.fields.map((field) => field.label).join(" ")}`.toLowerCase();
  if (/(visa|immigration|passport|residency)/i.test(text)) return "visa_application";
  if (/(sign.?up|register|create account)/i.test(text)) return "registration";
  return "job_application";
}

function pendingKey(field: FormFieldObservation): string {
  return [field.type, field.id || "", field.name || "", field.label].join("|").toLowerCase();
}

export async function recordManualFormObservations(
  form: FormInspection,
  fields: FormFieldObservation[],
  tabId: number,
): Promise<void> {
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") return;
  const page = await inspectActiveTab().catch(() => null);
  const company = page?.kind === "job" ? page.snapshot.company : undefined;
  const scene = inferScene(form);
  const sessionId = await getAutofillSessionId(tabId);
  const pending = pendingChangesByTab.get(tabId) || new Map<string, PendingChange>();
  fields.forEach((field) => {
    const key = pendingKey(field);
    if (field.currentValue?.trim()) pending.set(key, { platform: form.platform, company, scene, field });
    else pending.delete(key);
  });
  pendingChangesByTab.set(tabId, pending);
  await Promise.allSettled(
    fields
      .filter((field) => field.type !== "password" && field.type !== "file" && field.type !== "unknown")
      .map((field) => apiClient.recordFormTempChange(form.platform, company, scene, sessionId, field)),
  );
}

export async function prepareManualFormAction(
  form: FormInspection,
  fields: FormFieldObservation[],
  tabId: number,
): Promise<number> {
  await recordManualFormObservations(form, fields, tabId);
  return pendingChangesByTab.get(tabId)?.size || 0;
}

export async function finalizeManualFormAction(tabId: number, save: boolean): Promise<void> {
  const sessionId = await getAutofillSessionId(tabId);
  const changes = [...(pendingChangesByTab.get(tabId)?.values() || [])];
  await apiClient.finalizeFormTempChanges(sessionId, save, changes);
  pendingChangesByTab.delete(tabId);
  await clearAutofillSession(tabId);
}
