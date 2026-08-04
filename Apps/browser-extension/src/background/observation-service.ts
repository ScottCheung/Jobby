import type { FormFieldObservation, FormInspection } from "../shared/contracts/form-inspection";

import { apiClient } from "./api-client";
import { inspectActiveTab } from "./content-bridge";

export async function recordManualFormObservations(
  form: FormInspection,
  fields: FormFieldObservation[],
): Promise<void> {
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") return;
  const page = await inspectActiveTab().catch(() => null);
  const company = page?.kind === "job" ? page.snapshot.company : undefined;
  await Promise.allSettled(
    fields
      .filter((field) => !field.sensitive && Boolean(field.currentValue?.trim()))
      .map((field) => apiClient.recordFormObservation(form.platform, company, field)),
  );
}
