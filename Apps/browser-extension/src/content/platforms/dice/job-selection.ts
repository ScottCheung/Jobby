import type { ProviderJobSelection } from "../platform-definition";
import { createStandardJobSelection } from "../shared/job-selection";

export const DICE_CARD_SELECTORS = [
  "dhi-search-card",
  "[data-cy='card-title-link']",
] as const;

export const DICE_SELECTED_CARD_SELECTORS = [
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isDiceListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    if (/\/job-detail\//i.test(parsed.pathname)) return false;
    return /\/jobs(?:\/|$|\?)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export const diceJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isDiceListingPage,
  cardSelectors: DICE_CARD_SELECTORS,
  selectedSelectors: DICE_SELECTED_CARD_SELECTORS,
  targetIdParams: ["jobId", "id"],
  cardClickSelector: "dhi-search-card, [data-cy='card-title-link']",
});
