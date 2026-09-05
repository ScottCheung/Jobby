import type { FormFieldObservation } from "../../shared/contracts/form-inspection";
import type { FormScope } from "../dom/form-inspector/visibility";
import type {
  ProviderDriverOverride,
  ProviderFormRoot,
} from "./platform-definition";
import { jobAdderFormAdapter } from "./jobadder/form-adapter";

const specializedFormAdapters = [jobAdderFormAdapter] as const;

function findSpecializedFormAdapter(root: ProviderFormRoot) {
  return specializedFormAdapters.find((adapter) => adapter.matches(root));
}

export function adaptSpecializedFormFields(
  fields: FormFieldObservation[],
  root: ProviderFormRoot,
): FormFieldObservation[] {
  return findSpecializedFormAdapter(root)?.adaptFormFields(fields, root) || fields;
}

export function specializedFormDriver(
  scope: FormScope,
): ProviderDriverOverride | undefined {
  return findSpecializedFormAdapter(scope)?.driver;
}
