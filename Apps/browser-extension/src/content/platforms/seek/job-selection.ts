import type { ProviderJobSelection } from "../platform-definition";
import {
  createStandardJobSelection,
  isElementVisible,
} from "../shared/job-selection";

export const SEEK_CARD_SELECTORS = [
  "article[data-automation='normalJob']",
  "article[data-automation='premiumJob']",
  "article[data-automation='standOutJob']",
  "article[data-automation='featuredJob']",
  "article[data-job-id]",
  "[data-automation='job-card']",
  "[data-testid='job-card']",
  "article[data-card-type='JobCard']",
] as const;

export const SEEK_SELECTED_CARD_SELECTORS = [
  "[data-automation='job-card'][data-selected='true']",
  "[data-automation='job-card'][aria-current='true']",
  "[data-testid='job-card'][aria-selected='true']",
  "[data-testid='job-card'][data-selected='true']",
  "[data-selected='true']",
  "[aria-selected='true']",
] as const;

const SEEK_NON_LISTING_PATHS = [
  /^\/job\/\d+/i,
  /^\/apply(?:\/|$)/i,
  /^\/application(?:\/|$)/i,
  /^\/profile(?:\/|$)/i,
  /^\/login(?:\/|$)/i,
  /^\/account(?:\/|$)/i,
  /^\/settings(?:\/|$)/i,
  /^\/saved-jobs(?:\/|$)/i,
  /^\/applied-jobs(?:\/|$)/i,
  /^\/career-advice(?:\/|$)/i,
  /^\/companies(?:\/|$)/i,
  /^\/explore-companies(?:\/|$)/i,
  /^\/salary(?:\/|$)/i,
];

export function isSeekListingPage(
  url: string | URL,
  root: ParentNode = typeof document !== "undefined" ? document : null as unknown as ParentNode,
): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const host = parsed.hostname.toLowerCase();
    if (!/^(?:[a-z0-9-]+\.)*seek\.(?:com(?:\.au)?|co\.nz)$/i.test(host)) {
      return false;
    }
    const pathname = parsed.pathname;

    for (const pattern of SEEK_NON_LISTING_PATHS) {
      if (pattern.test(pathname)) return false;
    }

    if (pathname === "/" || pathname === "") return false;

    // Positive detection of known SEEK listing / search routes
    if (
      /^\/jobs(?:\/|$)/i.test(pathname) ||
      /^\/jobs-in-/i.test(pathname) ||
      /^\/[a-z0-9-]+-jobs(?:\/|$)/i.test(pathname)
    ) {
      return true;
    }

    // Default to false for unknown routes unless reliable DOM evidence exists
    if (root && typeof root.querySelector === "function") {
      return Boolean(
        root.querySelector(
          "article[data-automation='normalJob'], article[data-automation='premiumJob'], article[data-automation='standOutJob'], [data-automation='job-card']",
        ),
      );
    }
    return false;
  } catch {
    return false;
  }
}

export const seekJobSelection: ProviderJobSelection = createStandardJobSelection({
  isListingPage: isSeekListingPage,
  cardSelectors: SEEK_CARD_SELECTORS,
  selectedSelectors: SEEK_SELECTED_CARD_SELECTORS,
  isExtraJobSelected: (root: ParentNode) => {
    const details = root.querySelector<HTMLElement>("[data-automation='jobAdDetails']");
    return Boolean(details && isElementVisible(details));
  },
  targetIdParams: ["jobId"],
  cardClickSelector:
    "a[href*='/job/'], [data-automation='job-card'], [data-automation='normalJob'], [data-testid='job-card'], article[data-card-type='JobCard']",
});
