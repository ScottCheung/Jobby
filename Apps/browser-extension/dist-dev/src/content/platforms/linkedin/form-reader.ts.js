import { readApplicationForm } from "/src/content/dom/form-inspector.ts.js";
import { findActiveFormScope, hasGenericBackAction, readGenericAction } from "/src/content/dom/form-scope.ts.js";
import { linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
function isLikelyLinkedInApplicationScope(scope) {
  const action = readGenericAction(scope);
  if (action.action || hasGenericBackAction(scope)) return true;
  const text = (scope.textContent || "").replace(/\s+/g, " ").trim();
  return /easy apply|application questions|additional questions|review your application|contact information|work experience|resume|cover letter/i.test(text);
}
export function readLinkedInFormPage() {
  const url = window.location.href;
  linkedinAdapter.invalidateApplicationActionCache();
  const adapterRoot = linkedinAdapter.getApplicationRoot();
  const genericFallback = adapterRoot ? null : findActiveFormScope();
  const applicationRoot = adapterRoot || (genericFallback instanceof HTMLElement && isLikelyLinkedInApplicationScope(genericFallback) ? genericFallback : null);
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
    Boolean(linkedinAdapter.getCurrentApplicationAction("previous")) || Boolean(applicationRoot && hasGenericBackAction(applicationRoot))
  );
  if (inspection.kind === "not_application_form" && linkedinAdapter.isJobPageUrl(url)) {
    const diagnostic = linkedinAdapter.applicationFormDiagnostic();
    const reason = applicationRoot ? `检测到 LinkedIn 申请 modal，但当前没有可见表单字段。请等待表单加载后再次检测。 ${diagnostic}` : linkedinAdapter.isFullPageApplicationFlow() ? `检测到 LinkedIn SDUI 全页申请流，但没有找到可安全绑定的申请表容器。请确认页面已完成加载后再次检测。 ${diagnostic}` : linkedinAdapter.hasEasyApplyAction() ? `Click LinkedIn Easy Apply to open the application form, then inspect the form again. ${diagnostic}` : `Open the LinkedIn application form, then inspect the form again. ${diagnostic}`;
    return {
      ...inspection,
      reason
    };
  }
  return inspection;
}
