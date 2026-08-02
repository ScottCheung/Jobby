import type { FormInspection } from "../../../shared/contracts/form-inspection";

import { findActiveFormScope, readGenericAction } from "../../dom/form-scope";
import { readApplicationForm, readPageInputFields } from "../../dom/form-inspector";

export function readGenericFormPage(): FormInspection {
  const url = window.location.href;
  const scope = findActiveFormScope();
  if (!scope) {
    const pageInputs = readPageInputFields(url, "generic");
    if (pageInputs) return pageInputs;
    return {
      kind: "not_application_form",
      platform: "generic",
      url,
      reason: "No visible form dialog or form fields were found.",
    };
  }

  const action = readGenericAction(scope);
  return readApplicationForm(
    url,
    "generic",
    true,
    action.label,
    scope,
    action.action,
    false,
  );
}
