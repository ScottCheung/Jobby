import type { FormInspection } from "../../../shared/contracts/form-inspection";

import { readPageInputFields, readSeekForm } from "../../dom/form-inspector";
import type { FormScope } from "../../dom/form-inspector";
import { findActiveFormScope } from "../../dom/form-scope";
import {
  getSeekApplicationAction,
  getSeekApplicationActionKind,
  getSeekApplicationActionLabel,
} from "./adapter";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
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
  const bodyText = cleanText(document.body?.textContent);
  return (
    /application|personal details|resume|cover letter/i.test(bodyText) &&
    Boolean(getSeekApplicationActionLabel())
  );
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

export function getSeekApplicationScope(): FormScope {
  return (
    document.querySelector<HTMLElement>(
      [
        "[data-automation='applicationForm']",
        "[data-automation='application-form']",
        "[data-automation='applyForm']",
        "[data-automation='apply-form']",
        "[data-automation='apply-container']",
        "[data-testid='application-form']",
        "[data-testid='apply-form']",
        "form[action*='/apply']",
        "[role='dialog'][aria-modal='true']",
      ].join(", "),
    ) ||
    findActiveFormScope() ||
    document
  );
}

export function readSeekFormPage(): FormInspection {
  const url = window.location.href;
  const isApp = isApplicationPage(url);
  const scope = getSeekApplicationScope();
  let inspection = readSeekForm(
    url,
    isApp,
    getSeekApplicationActionLabel(),
    getSeekApplicationActionKind(),
    Boolean(getSeekApplicationAction("previous")),
    scope,
  );
  if (
    inspection.kind === "application_form" &&
    inspection.fields.length === 0 &&
    scope !== document
  ) {
    const docInspection = readSeekForm(
      url,
      isApp,
      getSeekApplicationActionLabel(),
      getSeekApplicationActionKind(),
      Boolean(getSeekApplicationAction("previous")),
      document,
    );
    if (docInspection.kind === "application_form" && docInspection.fields.length > 0) {
      inspection = docInspection;
    }
  }
  if (inspection.kind === "not_application_form") {
    const pageInputs = readPageInputFields(url, "seek");
    if (pageInputs) return pageInputs;
  }
  if (inspection.kind === "not_application_form" && isSeekJobPage(url)) {
    return {
      ...inspection,
      reason: hasQuickApplyLink()
        ? "Click SEEK Quick apply to open the application form, then inspect the form again."
        : "Open the SEEK application form, then inspect the form again.",
    };
  }
  return inspection;
}
