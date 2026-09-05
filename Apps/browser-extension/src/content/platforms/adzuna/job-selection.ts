import type { ProviderJobSelection } from "../platform-definition";
import { createStandardJobSelection } from "../shared/job-selection";

export const ADZUNA_CARD_SELECTORS = [
  ".results-container article",
  "[data-aid]",
] as const;

export const ADZUNA_SELECTED_CARD_SELECTORS = [
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isAdzunaListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    if (/\/details\/\d+/i.test(parsed.pathname)) return false;
    return (
      /\/search\b/i.test(parsed.pathname) ||
      /\/jobs\b/i.test(parsed.pathname) ||
      parsed.searchParams.has("q")
    );
  } catch {
    return false;
  }
}

export const adzunaJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isAdzunaListingPage,
  cardSelectors: ADZUNA_CARD_SELECTORS,
  selectedSelectors: ADZUNA_SELECTED_CARD_SELECTORS,
  targetIdParams: ["id", "aid"],
  cardClickSelector: ".results-container article, [data-aid]",
});
