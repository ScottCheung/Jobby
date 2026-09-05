import type {
  DedicatedPlatform,
  FormPlatform,
} from "../../shared/contracts/platform";
import type { ProviderDefinition } from "./platform-definition";
import { providerDefinitions } from "./registry";

export type { DedicatedPlatform } from "../../shared/contracts/platform";

export function detectDedicatedProvider(
  location: Pick<Location, "hostname" | "pathname"> = window.location,
  documentRoot: Document = document,
): ProviderDefinition | null {
  const hostname = location.hostname.toLowerCase();
  const pathname = location.pathname.toLowerCase();

  const hostMatch = providerDefinitions.find(({ detection }) =>
    detection.host.test(hostname) &&
    (!detection.path || detection.path.test(pathname)),
  );
  if (hostMatch) return hostMatch;

  // White-label ATS pages keep their provider-specific DOM even when the
  // employer uses a custom careers hostname. These signals are deliberately
  // limited to dedicated component/root markers, not broad class keywords.
  return (
    providerDefinitions.find(
      ({ detection }) => detection.dom && documentRoot.querySelector(detection.dom),
    ) || null
  );
}

export function detectDedicatedPlatform(
  location: Pick<Location, "hostname" | "pathname"> = window.location,
  documentRoot: Document = document,
): DedicatedPlatform | null {
  return detectDedicatedProvider(location, documentRoot)?.platform || null;
}

export function detectFormPlatform(
  location: Pick<Location, "hostname" | "pathname"> = window.location,
  documentRoot: Document = document,
): FormPlatform {
  return detectDedicatedPlatform(location, documentRoot) || "generic";
}
