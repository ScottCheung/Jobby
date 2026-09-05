/** @format */

import { detectDedicatedProvider } from "./platforms/provider-routing";
import { providerDefinitions } from "./platforms/registry";
import {
  extractUrlQueryParam,
  isElementVisible,
  runJobSelectionCycle,
  triggerJobCardClick,
} from "./platforms/shared/job-selection";

export { isElementVisible, triggerJobCardClick };

const GENERIC_SEARCH_OR_LIST_PAGE_PATTERNS = [
  /\/jobs\/search/i,
  /\/jobs\/collections/i,
  /\/jobs\/?(?:\?.*)?$/i,
  /\/Job\/.*jobs\.htm/i,
  /\/jobs\?.*q=/i,
  /\/jobs\?.*keywords=/i,
  /-jobs(?:\/|\?|$)/i,
  /\/jobs-in-/i,
  /\/j(?:\?|$)/i,
];

const GENERIC_CARD_SELECTORS = [
  "article[data-job-id]",
  "[data-testid='job-card']",
  "[data-automation='job-card']",
  ".job-card",
  "[data-job-card]",
  "a[href*='/job/']",
  "a[href*='/jobs/view/']",
];

const GENERIC_SELECTED_SELECTORS = [
  "[data-selected='true']",
  "[aria-selected='true']",
  "[data-active='true']",
];

function resolveProvider(urlStr?: string, root: ParentNode = typeof document !== "undefined" ? document : null as unknown as ParentNode) {
  try {
    const parsed = urlStr ? new URL(urlStr) : typeof window !== "undefined" ? window.location : null;
    if (!parsed) return null;
    const docRoot = root instanceof Document ? root : typeof document !== "undefined" ? document : null;
    return detectDedicatedProvider(parsed, docRoot || undefined);
  } catch {
    return null;
  }
}

export function isSearchOrListingPage(url = typeof window !== "undefined" ? window.location.href : ""): boolean {
  try {
    const provider = resolveProvider(url);
    if (provider?.jobSelection?.isListingPage) {
      return provider.jobSelection.isListingPage(url, typeof document !== "undefined" ? document : undefined);
    }

    const parsed = new URL(url);
    const pathAndSearch = parsed.pathname + parsed.search;
    return GENERIC_SEARCH_OR_LIST_PAGE_PATTERNS.some((pattern) => pattern.test(pathAndSearch));
  } catch {
    return false;
  }
}

export function isJobAlreadySelected(root: ParentNode = document): boolean {
  const provider = resolveProvider(undefined, root);
  if (provider?.jobSelection?.isJobSelected) {
    return provider.jobSelection.isJobSelected(root);
  }
  for (const def of providerDefinitions) {
    if (def.jobSelection?.isJobSelected?.(root)) {
      return true;
    }
  }
  const selected = root.querySelector<HTMLElement>(GENERIC_SELECTED_SELECTORS.join(", "));
  return Boolean(selected);
}

export function extractTargetJobId(url: string): string | null {
  const provider = resolveProvider(url);
  if (provider?.jobSelection?.extractTargetJobId) {
    return provider.jobSelection.extractTargetJobId(url);
  }
  return extractUrlQueryParam(url, "jobId", "currentJobId", "vjk", "jk");
}

export function findTargetJobCard(
  root: ParentNode = document,
  targetJobId: string,
): HTMLElement | null {
  const provider = resolveProvider(undefined, root);
  if (provider?.jobSelection?.findTargetJobCard) {
    return provider.jobSelection.findTargetJobCard(root, targetJobId);
  }
  for (const def of providerDefinitions) {
    const card = def.jobSelection?.findTargetJobCard?.(root, targetJobId);
    if (card) return card;
  }
  const selector = `[data-job-id='${targetJobId}'], article[data-job-id='${targetJobId}'], a[href*='${targetJobId}']`;
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return candidates.find(isElementVisible) || null;
}

export function findFirstJobCard(
  root: ParentNode = document,
): HTMLElement | null {
  const provider = resolveProvider(undefined, root);
  if (provider?.jobSelection?.findFirstJobCard) {
    return provider.jobSelection.findFirstJobCard(root);
  }
  for (const def of providerDefinitions) {
    const card = def.jobSelection?.findFirstJobCard?.(root);
    if (card) return card;
  }
  const combined = GENERIC_CARD_SELECTORS.join(", ");
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(combined));
  return candidates.find(isElementVisible) || null;
}

export function autoSelectFirstJobCard(
  root: ParentNode = document,
  options: { maxWaitMs?: number; intervalMs?: number; url?: string } = {},
): () => void {
  const currentUrl = options.url || (typeof window !== "undefined" ? window.location.href : "");
  const provider = resolveProvider(currentUrl, root);
  if (provider?.jobSelection?.autoSelectFirstJob) {
    return provider.jobSelection.autoSelectFirstJob(root, options);
  }

  // Fallback selection engine
  return runJobSelectionCycle(
    {
      isListingPage: (u) => isSearchOrListingPage(typeof u === "string" ? u : u.href),
      findFirstJobCard: (r) => findFirstJobCard(r),
      findTargetJobCard: (r, id) => findTargetJobCard(r, id),
      extractTargetJobId: (u) => extractTargetJobId(typeof u === "string" ? u : u.href),
      isJobSelected: (r) => isJobAlreadySelected(r),
      selectJob: triggerJobCardClick,
    },
    root,
    options,
  );
}
