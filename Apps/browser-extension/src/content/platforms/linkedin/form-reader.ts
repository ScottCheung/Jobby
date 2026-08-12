import type { FormInspection } from "../../../shared/contracts/form-inspection";

import { readApplicationForm } from "../../dom/form-inspector";
import { findActiveFormScope, hasGenericBackAction, readGenericAction } from "../../dom/form-scope";
import { linkedinAdapter } from "./adapter";

function isLikelyLinkedInApplicationScope(scope: HTMLElement): boolean {
  const action = readGenericAction(scope);
  if (action.action || hasGenericBackAction(scope)) return true;

  const text = (scope.textContent || "").replace(/\s+/g, " ").trim();
  return /easy apply|application questions|additional questions|review your application|contact information|work experience|resume|cover letter/i.test(text);
}

export function readLinkedInFormPage(): FormInspection {
  const url = window.location.href;
  // Step transitions replace action buttons asynchronously. Read fresh
  // controls whenever the side panel asks for the form state.
  linkedinAdapter.invalidateApplicationActionCache();
  const adapterRoot = linkedinAdapter.getApplicationRoot();
  const genericFallback = adapterRoot ? null : findActiveFormScope();
  // LinkedIn keeps unrelated upload inputs in its global UI (messaging,
  // composer, etc.). A plain form/input match is not enough to classify it as
  // an Easy Apply form.
  const applicationRoot =
    adapterRoot ||
    (genericFallback instanceof HTMLElement && isLikelyLinkedInApplicationScope(genericFallback)
      ? genericFallback
      : null);
  const genericAction = applicationRoot ? readGenericAction(applicationRoot) : {};
  const actionLabel = linkedinAdapter.getCurrentApplicationActionLabel() || genericAction.label;
  const actionKind = linkedinAdapter.getCurrentApplicationActionKind() || genericAction.action;
  const inspection = readApplicationForm(
    url,
    "linkedin",
    Boolean(applicationRoot),
    actionLabel,
    applicationRoot,
    actionKind,
    Boolean(linkedinAdapter.getCurrentApplicationAction("previous")) ||
      Boolean(applicationRoot && hasGenericBackAction(applicationRoot)),
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
