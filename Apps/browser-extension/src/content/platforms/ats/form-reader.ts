import type {
  FormFieldObservation,
  FormInspection,
  FormPlatform,
} from "../../../shared/contracts/form-inspection";
import type { FormScope } from "../../dom/form-inspector";
import {
  inspectVisibleFormFields,
  isVisibleElement,
  queryAllInScope,
  readApplicationForm,
} from "../../dom/form-inspector";
import {
  hasGenericBackAction,
  readGenericAction,
} from "../../dom/form-scope";
import { adaptAtsFormFields } from "../generic/ats-field-adapter";
import { ensureSmartRecruitersResumeField } from "../generic/smartrecruiters-file-adapter";

export type DedicatedFormPlatform = Exclude<FormPlatform, "generic" | "linkedin" | "seek">;

const APPLICATION_ROOTS: Record<DedicatedFormPlatform, readonly string[]> = {
  indeed: [
    "#ia-container",
    "[data-testid='ia-container']",
    "[data-testid='application-form']",
    "form[action*='indeed']",
  ],
  glassdoor: [
    "[data-test='application-form']",
    "[data-testid='application-form']",
    "[data-test*='easy-apply' i] form",
    "form[action*='/apply']",
  ],
  workday: [
    "[data-automation-id='jobApplicationPage']",
    "[data-automation-id='applicationPage']",
    "[data-automation-id='applyFlow']",
    "[data-automation-id='applicationForm']",
  ],
  greenhouse: [
    "#application-form",
    "form.application--form",
    "#application_form",
    "#grnhse_app form",
    "form[action*='/applications']",
    "[data-testid='application-form']",
  ],
  lever: [
    "#application-form",
    "form.application-form",
    "form[action*='/apply']",
    "[data-qa='application-form']",
  ],
  ashby: [
    ".ashby-application-form-container",
    "#form",
    "[data-testid='application-form']",
    "form[data-testid*='application' i]",
  ],
  smartrecruiters: [
    "oc-application",
    "oc-application-form",
    "[data-test='application-form']",
    "[data-testid='application-form']",
    "form[action*='smartrecruiters']",
  ],
  taleo: [
    "#candidateApplication",
    "#applicationForm",
    "form[action*='careersection']",
    "[id*='application' i][class*='form' i]",
  ],
  icims: [
    "#iCIMS_ApplicationContainer",
    "#iCIMS_JobContent",
    "#iCIMS_SubHeader",
    "form[action*='icims']",
    "[class*='iCIMS_Application']",
    "[data-test='application-form']",
  ],
  successfactors: [
    "#rcm_job_application",
    ".sf-application-form",
    "form[action*='successfactors']",
    "form[id*='jobApply']",
    "[data-qa='application-form']",
  ],
  oracle: [
    ".cx-application-flow",
    "form[action*='oraclecloud']",
    "form[action*='candidateExperience']",
    "[data-qa='application-form']",
    "#job-apply-page",
  ],
  workable: [
    "[data-ui='application-form']",
    "form[data-ui='application-form']",
    "#application-form",
    "form[action*='workable']",
  ],
  bamboohr: [
    "#BambooHR-ATS-Jobs-Apply",
    "#application-form",
    "form.BambooHR-ATS-Jobs-Form",
    "form[action*='bamboohr']",
    ".BambooHR-ATS-Jobs-Item",
  ],
};

function adaptFields(
  platform: DedicatedFormPlatform,
  fields: FormFieldObservation[],
  scope: FormScope,
): FormFieldObservation[] {
  return ensureSmartRecruitersResumeField(
    platform,
    adaptAtsFormFields(platform, fields),
    scope,
  );
}

/**
 * Resolve only roots owned by the selected provider. This prevents a search
 * box or sign-in control elsewhere on the page from outranking the active
 * application form. Open shadow roots are included by queryAllInScope.
 */
export function findDedicatedApplicationScope(
  platform: DedicatedFormPlatform,
): FormScope | null {
  const selector = APPLICATION_ROOTS[platform].join(", ");
  const candidates = queryAllInScope<HTMLElement>(document, selector)
    .filter((candidate) => isVisibleElement(candidate));

  let best: HTMLElement | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const fields = inspectVisibleFormFields(candidate);
    const action = readGenericAction(candidate);
    const score = fields.length * 20 + (action.action ? 5 : 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Returns null only when the provider explicitly has no usable form root. */
export function readDedicatedFormPage(
  platform: DedicatedFormPlatform,
): FormInspection | null {
  const scope = findDedicatedApplicationScope(platform);
  if (!scope) return null;
  const action = readGenericAction(scope);
  return readApplicationForm(
    window.location.href,
    platform,
    true,
    action.label,
    scope,
    action.action,
    hasGenericBackAction(scope),
    (fields) => adaptFields(platform, fields, scope),
  );
}
