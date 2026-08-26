import type {
  FormFieldObservation,
  FormInspection,
} from "../../../shared/contracts/form-inspection";
import type { SharedFormPlatform } from "../../../shared/contracts/platform";
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
import { adaptRegisteredFormFields } from "../form-field-adapter";
import { getApplicationRoots } from "../registry";

export type DedicatedFormPlatform = SharedFormPlatform;

function adaptFields(
  platform: DedicatedFormPlatform,
  fields: FormFieldObservation[],
  scope: FormScope,
): FormFieldObservation[] {
  return adaptRegisteredFormFields(platform, fields, scope);
}

/**
 * Resolve only roots owned by the selected provider. This prevents a search
 * box or sign-in control elsewhere on the page from outranking the active
 * application form. Open shadow roots are included by queryAllInScope.
 */
export function findDedicatedApplicationScope(
  platform: DedicatedFormPlatform,
): FormScope | null {
  const selector = getApplicationRoots(platform).join(", ");
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
