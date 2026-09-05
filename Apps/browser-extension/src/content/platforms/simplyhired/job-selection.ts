import type { ProviderJobSelection } from "../platform-definition";
import { createStandardJobSelection } from "../shared/job-selection";

export const SIMPLYHIRED_CARD_SELECTORS = [
  "[data-testid='searchSerpJob']",
  ".SerpJob-jobCard",
] as const;

export const SIMPLYHIRED_SELECTED_CARD_SELECTORS = [
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isSimplyHiredListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return /\/search/i.test(parsed.pathname) || parsed.searchParams.has("q");
  } catch {
    return false;
  }
}

export const simplyhiredJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isSimplyHiredListingPage,
  cardSelectors: SIMPLYHIRED_CARD_SELECTORS,
  selectedSelectors: SIMPLYHIRED_SELECTED_CARD_SELECTORS,
  targetIdParams: ["job", "id"],
  cardClickSelector: "[data-testid='searchSerpJob'], .SerpJob-jobCard",
});
