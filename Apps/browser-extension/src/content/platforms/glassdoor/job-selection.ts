import type { ProviderJobSelection } from "../platform-definition";
import { createStandardJobSelection } from "../shared/job-selection";

export const GLASSDOOR_CARD_SELECTORS = [
  "[data-test='jobListing']",
  ".JobsList_jobListItem__JBkBU",
] as const;

export const GLASSDOOR_SELECTED_CARD_SELECTORS = [
  "[data-test='jobListing'][data-selected='true']",
  "[data-test='jobListing'][aria-selected='true']",
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isGlassdoorListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const pathAndSearch = parsed.pathname + parsed.search;
    return /\/Job\/.*jobs\.htm/i.test(pathAndSearch) || /\/Job\//i.test(pathAndSearch);
  } catch {
    return false;
  }
}

export const glassdoorJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isGlassdoorListingPage,
  cardSelectors: GLASSDOOR_CARD_SELECTORS,
  selectedSelectors: GLASSDOOR_SELECTED_CARD_SELECTORS,
  targetIdParams: ["jl", "jobListingId"],
  cardClickSelector: "[data-test='jobListing'], .JobsList_jobListItem__JBkBU",
});
