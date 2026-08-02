import { readSeekForm } from "/src/content/dom/form-inspector.ts.js";
const ACTION_SELECTORS = [
  "button[type='submit']",
  "input[type='submit']",
  "button",
  "[role='button']"
];
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function submitActionLabel() {
  for (const selector of ACTION_SELECTORS) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const label = cleanText(element.textContent || element.getAttribute("aria-label"));
      if (/submit|continue|next|review|apply/i.test(label)) return label;
    }
  }
  return "";
}
function isApplicationPage(url) {
  if (/\/apply(?:\/|$)|\/application(?:\/|$)/i.test(url)) return true;
  const bodyText = cleanText(document.body?.textContent);
  return /application|personal details|resume|cover letter/i.test(bodyText) && Boolean(submitActionLabel());
}
function isSeekJobPage(url) {
  try {
    const parsed = new URL(url);
    return /\/job\/\d+/i.test(parsed.pathname) || /^\d+$/.test(parsed.searchParams.get("jobId") || "");
  } catch {
    return false;
  }
}
function hasQuickApplyLink() {
  return Boolean(
    document.querySelector(
      "a[href*='/apply'], [data-automation='job-detail-apply'], [data-testid='job-detail-apply']"
    )
  );
}
export function readSeekFormPage() {
  const url = window.location.href;
  const submitLabel = submitActionLabel();
  const inspection = readSeekForm(url, isApplicationPage(url), submitLabel || void 0);
  if (inspection.kind === "not_application_form" && isSeekJobPage(url)) {
    return {
      ...inspection,
      reason: hasQuickApplyLink() ? "Click SEEK Quick apply to open the application form, then inspect the form again." : "Open the SEEK application form, then inspect the form again."
    };
  }
  return inspection;
}
