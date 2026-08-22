import type { FormPlatform } from '../../../shared/contracts/form-inspection';

/**
 * Identify an ATS without making the generic reader depend on a company
 * domain.  This is intentionally conservative: an unknown page remains
 * `generic`, which keeps the generic inspector as the safe fallback.
 */
export function detectAtsPlatform(
  location: Pick<Location, 'hostname' | 'pathname'> = window.location,
  documentRoot: Document = document,
): FormPlatform {
  const hostname = location.hostname.toLowerCase();
  const pathname = location.pathname.toLowerCase();
  const pageHint = `${hostname} ${pathname} ${documentRoot.documentElement?.getAttribute('data-automation-id') || ''}`;

  if (/myworkdayjobs\.com|workday\.com/.test(hostname) || /workday.*candidate-home/i.test(pageHint)) return 'workday';
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(hostname)) return 'greenhouse';
  if (/jobs\.lever\.co|jobs\.eu\.lever\.co/.test(hostname)) return 'lever';
  if (/jobs\.ashbyhq\.com/.test(hostname)) return 'ashby';
  if (/smartrecruiters\.com/.test(hostname) || documentRoot.querySelector('spl-input, spl-autocomplete, spl-dropzone')) return 'smartrecruiters';
  if (/taleo\.net/.test(hostname) || /careersection\//.test(pathname)) return 'taleo';
  return 'generic';
}
