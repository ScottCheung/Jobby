import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { ProviderFormRoot } from "../platform-definition";

const MANAGED_SECTION_SELECTOR = [
  "[data-automation-id='workExperienceSection']",
  "[data-automation-id='educationSection']",
  "[data-automation-id='certificationsSection']",
  "[data-automation-id='certificationSection']",
  "[data-automation-id='languagesSection']",
  "[data-automation-id='languageSection']",
  "[data-automation-id='skillsSection']",
  "[data-automation-id='skillSection']",
].join(", ");

const MANAGED_FIELD_IDENTIFIERS = new Set([
  "jobtitle",
  "positiontitle",
  "company",
  "companyname",
  "employer",
  "currentlyworkhere",
  "currentjob",
  "startdate",
  "enddate",
  "roledescription",
  "jobdescription",
  "school",
  "schoolname",
  "institution",
  "degree",
  "degreename",
  "fieldofstudy",
  "firstyearattended",
  "lastyearattended",
  "certificationname",
  "certificatename",
  "issuer",
  "issuedby",
  "issuedate",
  "expirationdate",
  "expirydate",
  "certificationurl",
  "credentialurl",
  "languagename",
  "languageproficiency",
]);

function normalized(value: string | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function fieldElement(
  field: FormFieldObservation,
  root: ProviderFormRoot,
): HTMLElement | null {
  if (field.id) {
    const element = root.querySelector<HTMLElement>(`#${CSS.escape(field.id)}`);
    if (element) return element;
  }
  if (field.name) {
    const element = root.querySelector<HTMLElement>(`[name='${CSS.escape(field.name)}']`);
    if (element) return element;
  }
  return null;
}

export function excludeWorkdayManagedFields(
  fields: FormFieldObservation[],
  root: ProviderFormRoot,
): FormFieldObservation[] {
  return fields.filter((field) => {
    const element = fieldElement(field, root);
    if (element?.closest(MANAGED_SECTION_SELECTOR)) return false;
    if ([field.label, field.name, field.id].some((value) => MANAGED_FIELD_IDENTIFIERS.has(normalized(value)))) {
      return false;
    }
    const hasSkillsSection = Boolean(
      root.querySelector("[data-automation-id='skillsSection'], [data-automation-id='skillSection']"),
    );
    const isSkillsSearch = [field.label, field.name, field.id]
      .filter(Boolean)
      .some((value) => /^(?:skills?|search skills?|add skills?|skillprompt)$/i.test(String(value).trim()));
    return !(hasSkillsSection && isSkillsSearch);
  });
}
