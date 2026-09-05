import type { ProviderJobSelection } from "../platform-definition";
import { createStandardJobSelection } from "../shared/job-selection";

export const JORA_CARD_SELECTORS = [
  ".job-card[data-job-card='true']",
  ".job-card",
  "#jobresults .job-card",
  ".job-card a.show-job-description",
] as const;

export const JORA_SELECTED_CARD_SELECTORS = [
  ".job-card[data-active='true']",
  "[data-active='true']",
  "[data-selected='true']",
] as const;

export function isJoraListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const host = parsed.hostname.toLowerCase();
    if (!/(?:^|\.)jora\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i.test(host)) {
      return false;
    }
    const pathname = parsed.pathname;
    if (/^\/job\/(?:[^-/]+-)*[a-f0-9]{24,32}/i.test(pathname)) {
      return false;
    }
    if (/^\/(?:cms|users|login|salary|reviews)(?:\/|$)/i.test(pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const joraJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isJoraListingPage,
  cardSelectors: JORA_CARD_SELECTORS,
  selectedSelectors: JORA_SELECTED_CARD_SELECTORS,
  targetIdParams: ["job_id", "job", "jl", "jk"],
  cardClickSelector: ".job-card, [data-job-card], .show-job-description",
});
