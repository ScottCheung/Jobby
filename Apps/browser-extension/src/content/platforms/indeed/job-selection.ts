import type { ProviderJobSelection } from "../platform-definition";
import {
  createStandardJobSelection,
  isElementVisible,
} from "../shared/job-selection";

export const INDEED_CARD_SELECTORS = [
  ".job_seen_beacon",
  "#mosaic-provider-jobcards .cardOutline",
  "#mosaic-provider-jobcards [data-testid='job-card']",
] as const;

export const INDEED_SELECTED_CARD_SELECTORS = [
  "[data-jk][aria-selected='true']",
  "[data-jk][aria-current='true']",
  "[data-jk][data-selected='true']",
  "[data-jk][aria-pressed='true']",
  "[data-jk].resultWithShelf",
  "[data-jk][class~='selected']",
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

export function isIndeedListingPage(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const host = parsed.hostname.toLowerCase();
    if (!/(?:^|\.)indeed\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i.test(host)) {
      return false;
    }
    const pathname = parsed.pathname;
    if (/^\/viewjob/i.test(pathname)) return false;
    return (
      /^\/jobs(?:\/|$)/i.test(pathname) ||
      /^\/m\/jobs(?:\/|$)/i.test(pathname) ||
      /\/jobs\?.*q=/i.test(parsed.pathname + parsed.search) ||
      /\/jobs\?.*l=/i.test(parsed.pathname + parsed.search)
    );
  } catch {
    return false;
  }
}

export const indeedJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isIndeedListingPage,
  cardSelectors: INDEED_CARD_SELECTORS,
  selectedSelectors: INDEED_SELECTED_CARD_SELECTORS,
  targetIdParams: ["vjk", "jk"],
  findTargetJobCard: (root: ParentNode, targetId: string) => {
    const selector = `[data-jk='${targetId}'], a[href*='${targetId}'], [data-mobtk*='${targetId}']`;
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isElementVisible) || null;
  },
  cardClickSelector:
    "a[href*='vjk='], a[href*='jk='], .job_seen_beacon, [data-jk], [data-mobtk], #mosaic-provider-jobcards [data-testid='job-card']",
});
