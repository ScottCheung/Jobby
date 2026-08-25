import type { FormPlatform } from '../../../shared/contracts/form-inspection';
import { detectDedicatedPlatform } from '../provider-routing';

/**
 * Identify an ATS without making the generic reader depend on a company
 * domain.  This is intentionally conservative: an unknown page remains
 * `generic`, which keeps the generic inspector as the safe fallback.
 */
export function detectAtsPlatform(
  location: Pick<Location, 'hostname' | 'pathname'> = window.location,
  documentRoot: Document = document,
): FormPlatform {
  return detectDedicatedPlatform(location, documentRoot) || 'generic';
}
