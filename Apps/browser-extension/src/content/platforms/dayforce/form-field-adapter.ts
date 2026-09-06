import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { ProviderFormRoot } from "../platform-definition";

function labelForDayforceField(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (/personalInfo_prefixId$/i.test(id)) return "Prefix";
  if (/personalInfo_preferredContactMethod$/i.test(id)) return "Preferred contact method";
  if (/personalInfo_candidateSource$/i.test(id)) return "How did you hear about this job?";
  if (/(?:personalInfo|workHistory_\d+)_countryCode$/i.test(id)) return "Country";
  if (/(?:personalInfo|workHistory_\d+)_stateCode$/i.test(id)) return "State/Province";
  return undefined;
}

export function adaptDayforceFormFields(
  fields: FormFieldObservation[],
  _root: ProviderFormRoot,
): FormFieldObservation[] {
  return fields.map((field) => {
    const label = labelForDayforceField(field.id);
    return label ? { ...field, label } : field;
  });
}
