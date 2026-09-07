import type { FormInspection } from "../../../shared/contracts/form-inspection";

import { readApplicationForm } from "../../dom/form-inspector";
import { hasGenericBackAction, readGenericAction } from "../../dom/form-scope";
import { adaptRegisteredFormFields } from "../form-field-adapter";
import { linkedinAdapter } from "./adapter";

export function readLinkedInFormPage(): FormInspection {
  const url = window.location.href;
  // Step transitions replace action buttons asynchronously. Resolve both the
  // active application surface and its current field region on every read.
  linkedinAdapter.invalidateApplicationActionCache();
  const surface = linkedinAdapter.getApplicationSurface();
  const applicationRoot = surface?.root || null;
  const genericAction = applicationRoot ? readGenericAction(applicationRoot) : {};
  const fieldScope = surface?.fieldRoot || null;
  const actionLabel = linkedinAdapter.getCurrentApplicationActionLabel() || genericAction.label;
  const actionKind = linkedinAdapter.getCurrentApplicationActionKind() || genericAction.action;
  const inspection = readApplicationForm(
    url,
    "linkedin",
    Boolean(applicationRoot),
    actionLabel,
    fieldScope,
    actionKind,
    Boolean(linkedinAdapter.getCurrentApplicationAction("previous")) ||
      Boolean(applicationRoot && hasGenericBackAction(applicationRoot)),
    (fields) => adaptRegisteredFormFields("linkedin", fields, fieldScope || document),
  );
  if (inspection.kind === "not_application_form" && linkedinAdapter.isJobPageUrl(url)) {
    const diagnostic = linkedinAdapter.applicationFormDiagnostic();
    const reason = applicationRoot
      ? `Detected LinkedIn application modal, but no visible form fields were found yet. Please wait for the form to load and inspect again. ${diagnostic}`
      : linkedinAdapter.isFullPageApplicationFlow()
        ? `Detected LinkedIn full-page application flow, but no secure application container was found. Please confirm the page has finished loading and inspect again. ${diagnostic}`
      : linkedinAdapter.hasEasyApplyAction()
        ? `Click LinkedIn Easy Apply to open the application form, then inspect the form again. ${diagnostic}`
        : `Open the LinkedIn application form, then inspect the form again. ${diagnostic}`;
    return {
      ...inspection,
      reason,
    };
  }
  return inspection;
}
