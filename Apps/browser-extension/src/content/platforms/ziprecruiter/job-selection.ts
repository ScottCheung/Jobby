import type { ProviderJobSelection } from "../platform-definition";
import { createStandardJobSelection } from "../shared/job-selection";

export const ZIPRECRUITER_CARD_SELECTORS = [
  ".job_result",
  "[data-testid='job-listing']",
] as const;

export const ZIPRECRUITER_SELECTED_CARD_SELECTORS = [
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isZipRecruiterListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return /\/jobs(?:\/|$)/i.test(parsed.pathname) || parsed.searchParams.has("search");
  } catch {
    return false;
  }
}

export const ziprecruiterJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isZipRecruiterListingPage,
  cardSelectors: ZIPRECRUITER_CARD_SELECTORS,
  selectedSelectors: ZIPRECRUITER_SELECTED_CARD_SELECTORS,
  targetIdParams: ["job_id", "mid"],
  cardClickSelector: ".job_result, [data-testid='job-listing']",
});
