import type { FormFieldObservation, FormInspection } from "../../../shared/contracts/form-inspection";

import { findActiveFormScope, readGenericAction } from "../../dom/form-scope";
import { inspectVisibleFormFields, readApplicationForm, readPageInputFields } from "../../dom/form-inspector";
import { detectAtsPlatform } from './ats-platform';
import { adaptAtsFormFields } from './ats-field-adapter';
import { ensureSmartRecruitersResumeField } from './smartrecruiters-file-adapter';

export function readGenericFormPage(): FormInspection {
  const url = window.location.href;
  const platform = detectAtsPlatform();
  const adaptFields = (fields: FormFieldObservation[]) =>
    ensureSmartRecruitersResumeField(
      platform,
      adaptAtsFormFields(platform, fields),
    );
  const activeScope = findActiveFormScope();
  // Some ATSs place the required privacy/terms checkbox in a sibling panel
  // while the question fields live in the active wizard container. Inspecting
  // only the narrowest container drops that first field and makes it
  // impossible for autofill to target. Widen the scope when a consent field
  // is visible elsewhere on the same page.
  const documentFields = activeScope && activeScope !== document
    ? inspectVisibleFormFields(document)
    : [];
  const activeFields = activeScope && activeScope !== document
    ? inspectVisibleFormFields(activeScope)
    : [];
  const hasConsentOutsideScope = activeScope && activeScope !== document &&
    documentFields.some((field) =>
      field.type === "checkbox" &&
      /(?:privacy|consent|terms|conditions|agree|accept|acknowledge)/i.test(field.label) &&
      !activeFields.some((scoped) => scoped.key === field.key),
    );
  const hasFileOutsideScope = activeScope && activeScope !== document &&
    documentFields.some((field) => field.type === "file" && !activeFields.some((scoped) => scoped.key === field.key));
  const scope = hasConsentOutsideScope || hasFileOutsideScope ? document : activeScope;
  if (!scope) {
    const pageInputs = readPageInputFields(url, platform, adaptFields);
    if (pageInputs) return pageInputs;
    return {
      kind: "not_application_form",
      platform,
      url,
      reason: "No visible form dialog or form fields were found.",
    };
  }

  const action = readGenericAction(scope);
  return readApplicationForm(
    url,
    platform,
    true,
    action.label,
    scope,
    action.action,
    false,
    adaptFields,
  );
}
