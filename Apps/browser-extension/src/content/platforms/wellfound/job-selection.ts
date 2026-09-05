import type { ProviderJobSelection } from "../platform-definition";
import { createStandardJobSelection } from "../shared/job-selection";

export const WELLFOUND_CARD_SELECTORS = [
  "[data-test='JobListing']",
  "[class*='styles_jobListing']",
] as const;

export const WELLFOUND_SELECTED_CARD_SELECTORS = [
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isWellfoundListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return /\/jobs(?:\/|$)/i.test(parsed.pathname) || /\/role\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export const wellfoundJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isWellfoundListingPage,
  cardSelectors: WELLFOUND_CARD_SELECTORS,
  selectedSelectors: WELLFOUND_SELECTED_CARD_SELECTORS,
  targetIdParams: ["job_listing_id", "jobId"],
  cardClickSelector: "[data-test='JobListing'], [class*='styles_jobListing']",
});
