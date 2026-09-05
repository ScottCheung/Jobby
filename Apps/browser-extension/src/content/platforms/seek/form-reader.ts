import type { FormInspection } from "../../../shared/contracts/form-inspection";

import { readApplicationForm } from "../../dom/form-inspector";
import type { FormScope } from "../../dom/form-inspector";
import { findActiveFormScope } from "../../dom/form-scope";
import { adaptRegisteredFormFields } from "../form-field-adapter";
import {
  getSeekApplicationAction,
  getSeekApplicationActionKind,
  getSeekApplicationActionLabel,
} from "./adapter";

function findVisibleSeekApplicationRoot(): HTMLElement | null {
  const modalSelectors = [
    "[data-automation='applicationForm']",
    "[data-automation='application-form']",
    "[data-automation='applyForm']",
    "[data-automation='apply-form']",
    "[data-automation='apply-container']",
    "[data-testid='application-form']",
    "[data-testid='apply-form']",
    "[data-automation='job-application-modal']",
    "[data-testid='job-application-modal']",
    "form[action*='/apply']",
  ];
  for (const selector of modalSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], dialog"));
  for (const dialog of dialogs) {
    const text = (dialog.textContent || "").replace(/\s+/g, " ").trim();
    if (/application|personal details|resume|cover letter/i.test(text)) {
      return dialog;
    }
  }
  return null;
}

function isApplicationPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (
      /\/apply(?:[/?#]|$)/i.test(parsed.pathname) ||
      /\/application(?:[/?#]|$)/i.test(parsed.pathname)
    ) {
      return true;
    }
  } catch {
    if (
      /\/apply(?:[/?#]|$)/i.test(url) ||
      /\/application(?:[/?#]|$)/i.test(url)
    ) {
      return true;
    }
  }
  return Boolean(findVisibleSeekApplicationRoot());
}

function isSeekJobPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (
      /\/apply(?:[/?#]|$)/i.test(parsed.pathname) ||
      /\/application(?:[/?#]|$)/i.test(parsed.pathname)
    ) {
      return false;
    }
    return (
      /\/job\/\d+/i.test(parsed.pathname) ||
      /^\d+$/.test(parsed.searchParams.get("jobId") || "")
    );
  } catch {
    return false;
  }
}

function hasQuickApplyLink(): boolean {
  return Boolean(
    document.querySelector(
      "a[href*='/apply'], [data-automation='job-detail-apply'], [data-testid='job-detail-apply']",
    ),
  );
}

export function getSeekApplicationScope(): FormScope | null {
  const modal = findVisibleSeekApplicationRoot();
  if (modal) return modal;
  if (isApplicationPage(window.location.href)) {
    return findActiveFormScope() || document;
  }
  return null;
}

export function readSeekFormPage(): FormInspection {
  const url = window.location.href;
  const isApp = isApplicationPage(url);
  if (!isApp) {
    const isJob = isSeekJobPage(url);
    return {
      kind: "not_application_form",
      platform: "seek",
      url,
      reason: isJob
        ? hasQuickApplyLink()
          ? "Click SEEK Quick apply to open the application form, then inspect the form again."
          : "Open the SEEK application form, then inspect the form again."
        : "No visible SEEK form was found.",
    };
  }

  const scope = getSeekApplicationScope() || document;
  let inspection = readApplicationForm(
    url,
    "seek",
    isApp,
    getSeekApplicationActionLabel(),
    scope,
    getSeekApplicationActionKind(),
    Boolean(getSeekApplicationAction("previous")),
    (fields) => adaptRegisteredFormFields("seek", fields, scope),
  );
  if (
    inspection.kind === "application_form" &&
    inspection.fields.length === 0 &&
    scope !== document
  ) {
    const docInspection = readApplicationForm(
      url,
      "seek",
      isApp,
      getSeekApplicationActionLabel(),
      document,
      getSeekApplicationActionKind(),
      Boolean(getSeekApplicationAction("previous")),
      (fields) => adaptRegisteredFormFields("seek", fields, document),
    );
    if (docInspection.kind === "application_form" && docInspection.fields.length > 0) {
      inspection = docInspection;
    }
  }
  return inspection;
}
