import { findActiveFormScope, readGenericAction } from "/src/content/dom/form-scope.ts.js";
import { readApplicationForm, readPageInputFields } from "/src/content/dom/form-inspector.ts.js";
export function readGenericFormPage() {
  const url = window.location.href;
  const scope = findActiveFormScope();
  if (!scope) {
    const pageInputs = readPageInputFields(url, "generic");
    if (pageInputs) return pageInputs;
    return {
      kind: "not_application_form",
      platform: "generic",
      url,
      reason: "No visible form dialog or form fields were found."
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
    false
  );
}
