import type { FormFieldObservation } from "../../shared/contracts/form-inspection";
import type { FormPlatform } from "../../shared/contracts/platform";
import { sharedFormPlatforms } from "../../shared/contracts/platform";
import { adaptAtsFormFields } from "./ats/field-adapter";
import type { ProviderFormRoot } from "./platform-definition";
import { getProviderDefinition } from "./registry";

const sharedFormPlatformSet = new Set<FormPlatform>(sharedFormPlatforms);

export function adaptRegisteredFormFields(
  platform: FormPlatform,
  fields: FormFieldObservation[],
  root: ProviderFormRoot = document,
): FormFieldObservation[] {
  const normalized = sharedFormPlatformSet.has(platform)
    ? adaptAtsFormFields(platform, fields)
    : fields;
  if (platform === "generic") return normalized;
  const adapter = getProviderDefinition(platform).adaptFormFields;
  return adapter ? adapter(normalized, root) : normalized;
}
