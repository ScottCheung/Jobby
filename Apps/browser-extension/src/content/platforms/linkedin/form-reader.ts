import type { FormInspection } from "../../../shared/contracts/form-inspection";

import { readApplicationForm } from "../../dom/form-inspector";
import { isVisibleElement } from "../../dom/form-inspector";
import { findActiveFormScope, hasGenericBackAction, readGenericAction } from "../../dom/form-scope";
import { adaptRegisteredFormFields } from "../form-field-adapter";
import { linkedinAdapter } from "./adapter";

function isLikelyLinkedInApplicationScope(scope: HTMLElement): boolean {
  if (scope.matches("nav, header, footer, aside, [role='navigation'], [role='complementary']")) {
    return false;
  }
  const text = (scope.textContent || "").replace(/\s+/g, " ").trim();
  if (/(?:job\s*alert|search\s*alert|create\s*alert|职位提醒|求职提醒)/i.test(text)) {
    return false;
  }
  // Scoped action buttons strictly inside this element
  const localButtons = Array.from(
    scope.querySelectorAll<HTMLElement>(
      "button, [role='button'], input[type='submit'], input[type='button']",
    ),
  );
  const hasLocalAction = localButtons.some((b) => {
    const btnText = (b.textContent || b.getAttribute("aria-label") || "").trim();
    return /(?:continue|next|review|submit|继续|下一步|审核|提交)/i.test(btnText);
  });
  if (!hasLocalAction) return false;

  return /application questions|additional questions|review your application|contact information|work experience|resume|cover letter|提交申请|审核您的申请/i.test(text);
}

function linkedInFieldScope(applicationRoot: HTMLElement): HTMLElement {
  // The Easy Apply modal can keep non-form UI controls alongside the current
  // step. Read its actual form when it is available so those controls are not
  // presented as application questions.
  const forms = Array.from(
    applicationRoot.querySelectorAll<HTMLFormElement>("form.jobs-easy-apply-form, form"),
  );
  return forms.find((form) => isVisibleElement(form)) || applicationRoot;
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
  const fieldScope = applicationRoot ? linkedInFieldScope(applicationRoot) : null;
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
