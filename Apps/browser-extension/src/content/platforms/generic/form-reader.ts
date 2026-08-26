import type { FormFieldObservation, FormInspection } from "../../../shared/contracts/form-inspection";
import type { FormScope } from "../../dom/form-inspector";

import { findActiveFormScope, readGenericAction } from "../../dom/form-scope";
import { inspectVisibleFormFields, readApplicationForm } from "../../dom/form-inspector";
import { adaptRegisteredFormFields } from '../form-field-adapter';
import { detectFormPlatform } from '../provider-routing';

function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function isLikelyApplicationScope(
  scope: FormScope,
  fields: FormFieldObservation[],
  action: ReturnType<typeof readGenericAction>,
): boolean {
  if (fields.length === 0) return false;
  const urlLooksLikeApplication = /\/(?:apply|application)(?:\/|$)|[?&](?:apply|application)=/i.test(window.location.href);
  const scopeText = cleanText(scope.textContent);
  const hasApplicationCopy = /(?:application questions?|candidate (?:details|information)|resume|curriculum vitae|cover letter|work authori[sz]ation|right to work|sponsorship|employment history|work experience)/i.test(scopeText);
  const applicationAction = /(?:submit application|continue|next|review|finish application|complete application|send application)/i.test(action.label || '');
  const applicantFields = fields.filter((field) =>
    /(?:first name|last name|email|phone|resume|cover letter|work authori[sz]ation|sponsorship|experience)/i.test(field.label),
  ).length;
  if (
    scope instanceof HTMLElement &&
    scope.closest("nav, header, footer, aside, [role='navigation'], [role='complementary']")
  ) {
    return false;
  }
  const semanticContainer = scope instanceof HTMLElement && scope.matches(
    "form, dialog, [role='dialog'], [aria-modal='true'], [class*='application' i], [class*='apply' i], [class*='candidate' i], [class*='wizard' i], [class*='stage' i], [id*='application' i], [id*='apply' i], [id*='wizard' i]",
  );
  return (
    (urlLooksLikeApplication && semanticContainer) ||
    (semanticContainer && applicationAction) ||
    (hasApplicationCopy && Boolean(action.action)) ||
    (semanticContainer && applicantFields >= 2 && Boolean(action.action))
  );
}

export function readGenericFormPage(): FormInspection {
  const url = window.location.href;
  const platform = detectFormPlatform();
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
    documentFields.some((field) =>
      field.type === "file" &&
      /(?:resume|curriculum vitae|\bcv\b|cover letter|document|attachment)/i.test(
        `${field.label} ${field.key} ${field.id || ""} ${field.name || ""}`,
      ) &&
      !activeFields.some((scoped) => scoped.key === field.key),
    );
  const scope = hasConsentOutsideScope || hasFileOutsideScope ? document : activeScope;
  const allowedFieldKeys = new Set([
    ...activeFields.map((field) => field.key),
    ...documentFields
      .filter((field) =>
        (field.type === "checkbox" && /(?:privacy|consent|terms|conditions|agree|accept|acknowledge)/i.test(field.label)) ||
        (field.type === "file" && /(?:resume|curriculum vitae|\bcv\b|cover letter|document|attachment)/i.test(
          `${field.label} ${field.key} ${field.id || ""} ${field.name || ""}`,
        )),
      )
      .map((field) => field.key),
  ]);
  const adaptFields = (fields: FormFieldObservation[]) => {
    const scopedFields = scope === document && activeScope && activeScope !== document
      ? fields.filter((field) => allowedFieldKeys.has(field.key))
      : fields;
    return adaptRegisteredFormFields(platform, scopedFields);
  };
  if (!scope) {
    return {
      kind: "not_application_form",
      platform,
      url,
      reason: "No visible form dialog or form fields were found.",
    };
  }

  const action = readGenericAction(scope);
  const scopedFields = inspectVisibleFormFields(scope);
  const intentScope = activeScope || scope;
  const intentFields = activeFields.length > 0 ? activeFields : scopedFields;
  if (!isLikelyApplicationScope(intentScope, intentFields, action)) {
    return {
      kind: "not_application_form",
      platform,
      url,
      reason: "Visible controls were found, but they do not form a confirmed job application step.",
    };
  }
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
