import type { ProviderJobSelection } from "../platform-definition";
import {
  createStandardJobSelection,
  isElementVisible,
} from "../shared/job-selection";

export const LINKEDIN_CARD_SELECTORS = [
  ".jobs-search-results-list .job-card-container",
  "li[data-occludable-job-id] .job-card-container",
  ".scaffold-layout__list-container .job-card-container",
  ".job-card-container",
] as const;

export const LINKEDIN_SELECTED_CARD_SELECTORS = [
  ".jobs-search-results-list__list-item--active",
  ".scaffold-layout__list-item--active",
  "[data-occludable-job-id].active",
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isLinkedInListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const host = parsed.hostname.toLowerCase();
    if (!/(?:^|\.)linkedin\.com$/i.test(host)) return false;
    const pathname = parsed.pathname;
    if (/^\/jobs\/view\/\d+/i.test(pathname)) return false;
    return (
      /^\/jobs\/search/i.test(pathname) ||
      /^\/jobs\/collections/i.test(pathname) ||
      /^\/jobs\/?(?:\?.*)?$/i.test(pathname)
    );
  } catch {
    return false;
  }
}

export const linkedinJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isLinkedInListingPage,
  cardSelectors: LINKEDIN_CARD_SELECTORS,
  selectedSelectors: LINKEDIN_SELECTED_CARD_SELECTORS,
  targetIdParams: ["currentJobId", "jobId"],
  findTargetJobCard: (root: ParentNode, targetId: string) => {
    const selector = `li[data-occludable-job-id='${targetId}'], [data-job-id='${targetId}'], a[href*='/jobs/view/${targetId}']`;
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isElementVisible) || null;
  },
  cardClickSelector:
    "a[href*='/jobs/view/'], .job-card-container, [data-occludable-job-id]",
});
