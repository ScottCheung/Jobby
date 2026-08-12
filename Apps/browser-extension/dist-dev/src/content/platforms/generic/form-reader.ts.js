import { findActiveFormScope, readGenericAction } from "/src/content/dom/form-scope.ts.js";
import { inspectVisibleFormFields, readApplicationForm, readPageInputFields } from "/src/content/dom/form-inspector.ts.js";
export function readGenericFormPage() {
  const url = window.location.href;
  const activeScope = findActiveFormScope();
  const documentFields = activeScope && activeScope !== document ? inspectVisibleFormFields(document) : [];
  const activeFields = activeScope && activeScope !== document ? inspectVisibleFormFields(activeScope) : [];
  const hasConsentOutsideScope = activeScope && activeScope !== document && documentFields.some(
    (field) => field.type === "checkbox" && /(?:privacy|consent|terms|conditions|agree|accept|acknowledge)/i.test(field.label) && !activeFields.some((scoped) => scoped.key === field.key)
  );
  const hasFileOutsideScope = activeScope && activeScope !== document && documentFields.some((field) => field.type === "file" && !activeFields.some((scoped) => scoped.key === field.key));
  const scope = hasConsentOutsideScope || hasFileOutsideScope ? document : activeScope;
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
