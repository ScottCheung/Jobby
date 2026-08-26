/** @format */

import type { DedicatedPlatform } from '../../shared/contracts/platform';

const ROOT_ATTRIBUTE = 'data-jobby-job-description-root';

export function clearJobDescriptionRoot(platform: DedicatedPlatform): void {
  for (const element of Array.from(
    document.querySelectorAll<HTMLElement>(`[${ROOT_ATTRIBUTE}]`),
  )) {
    if (element.getAttribute(ROOT_ATTRIBUTE) === platform) {
      element.removeAttribute(ROOT_ATTRIBUTE);
    }
  }
}

export function rememberJobDescriptionRoot(
  platform: DedicatedPlatform,
  element: HTMLElement,
): void {
  clearJobDescriptionRoot(platform);
  element.setAttribute(ROOT_ATTRIBUTE, platform);
}

export function getJobDescriptionRoot(
  platform: DedicatedPlatform,
): HTMLElement | null {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${ROOT_ATTRIBUTE}]`),
  ).find((element) => element.getAttribute(ROOT_ATTRIBUTE) === platform) || null;
}
