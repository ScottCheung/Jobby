import type { FormInspection } from "../../../shared/contracts/form-inspection";

import { readPageInputFields, readSeekForm } from "../../dom/form-inspector";
import {
  getSeekApplicationAction,
  getSeekApplicationActionKind,
  getSeekApplicationActionLabel,
} from "./adapter";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isApplicationPage(url: string): boolean {
  if (/\/apply(?:\/|$)|\/application(?:\/|$)/i.test(url)) return true;
  const bodyText = cleanText(document.body?.textContent);
  return /application|personal details|resume|cover letter/i.test(bodyText) && Boolean(getSeekApplicationActionLabel());
}

function isSeekJobPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /\/job\/\d+/i.test(parsed.pathname) || /^\d+$/.test(parsed.searchParams.get("jobId") || "");
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

export function readSeekFormPage(): FormInspection {
  const url = window.location.href;
  const inspection = readSeekForm(
    url,
    isApplicationPage(url),
    getSeekApplicationActionLabel(),
    getSeekApplicationActionKind(),
    Boolean(getSeekApplicationAction("previous")),
  );
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
