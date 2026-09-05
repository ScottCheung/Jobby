import type { FormScope } from "../dom/form-inspector/visibility";
import type { ProviderDriverOverride } from "./platform-definition";
import { detectDedicatedProvider } from "./provider-routing";
import { specializedFormDriver } from "./specialized-form-adapters";

export function activeProviderDriver(
  scope: FormScope,
): ProviderDriverOverride | undefined {
  return detectDedicatedProvider()?.driver || specializedFormDriver(scope);
}
