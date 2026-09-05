import type { ProviderJobSelection } from "../platform-definition";

export function isElementVisible(element: HTMLElement): boolean {
  if (element.hasAttribute("hidden")) return false;
  if (element.style.display === "none" || element.style.visibility === "hidden") return false;
  return true;
}

export function triggerJobCardClick(element: HTMLElement): void {
  const isLink = element.tagName.toLowerCase() === "a";
  const targetAttr = element.getAttribute("target");

  if (isLink && targetAttr === "_blank") {
    element.removeAttribute("target");
  }

  if (typeof element.click === "function") {
    try {
      element.click();
    } catch {
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  } else {
    element.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  }

  if (isLink && targetAttr === "_blank") {
    element.setAttribute("target", targetAttr);
  }
}

export function extractUrlQueryParam(url: string | URL, ...paramNames: string[]): string | null {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    for (const name of paramNames) {
      const val = parsed.searchParams.get(name);
      if (val) return val;
    }
    return null;
  } catch {
    return null;
  }
}

let lastAutoSelectedUrl = "";

export function resetLastAutoSelectedUrl(): void {
  lastAutoSelectedUrl = "";
}

export function runJobSelectionCycle(
  jobSelection: ProviderJobSelection,
  root: ParentNode = document,
  options: { maxWaitMs?: number; intervalMs?: number; url?: string } = {},
): () => void {
  const currentUrl = options.url || (typeof window !== "undefined" ? window.location.href : "");
  if (!currentUrl) return () => undefined;

  if (jobSelection.isListingPage && !jobSelection.isListingPage(currentUrl, root)) {
    return () => undefined;
  }

  if (lastAutoSelectedUrl === currentUrl) {
    return () => undefined;
  }

  const maxWaitMs = options.maxWaitMs ?? 4000;
  const intervalMs = options.intervalMs ?? 150;
  const startTime = Date.now();
  let timerId: number | undefined;
  let observer: MutationObserver | undefined;
  let hasHandled = false;

  const cleanup = () => {
    hasHandled = true;
    if (timerId !== undefined) {
      if (typeof window !== "undefined") window.clearTimeout(timerId);
      timerId = undefined;
    }
    if (observer) {
      observer.disconnect();
      observer = undefined;
    }
  };

  const trySelect = (): boolean => {
    if (hasHandled) return true;
    const targetJobId = jobSelection.extractTargetJobId
      ? jobSelection.extractTargetJobId(currentUrl)
      : null;

    if (targetJobId) {
      const targetCard = jobSelection.findTargetJobCard
        ? jobSelection.findTargetJobCard(root, targetJobId)
        : null;
      if (targetCard) {
        if (
          targetCard.matches(
            "[data-selected='true'], [aria-selected='true'], [aria-current='true'], [data-active='true']",
          ) ||
          targetCard.closest(
            "[data-selected='true'], [aria-selected='true'], [aria-current='true'], [data-active='true']",
          )
        ) {
          lastAutoSelectedUrl = currentUrl;
          cleanup();
          return true;
        }
        lastAutoSelectedUrl = currentUrl;
        if (jobSelection.selectJob) {
          jobSelection.selectJob(targetCard);
        } else {
          triggerJobCardClick(targetCard);
        }
        cleanup();
        return true;
      }
      if (Date.now() - startTime >= maxWaitMs) {
        cleanup();
        return true;
      }
      return false;
    }

    if (jobSelection.isJobSelected && jobSelection.isJobSelected(root)) {
      lastAutoSelectedUrl = currentUrl;
      cleanup();
      return true;
    }

    const firstCard = jobSelection.findFirstJobCard
      ? jobSelection.findFirstJobCard(root)
      : null;
    if (firstCard) {
      lastAutoSelectedUrl = currentUrl;
      if (jobSelection.selectJob) {
        jobSelection.selectJob(firstCard);
      } else {
        triggerJobCardClick(firstCard);
      }
      cleanup();
      return true;
    }

    if (Date.now() - startTime >= maxWaitMs) {
      cleanup();
      return true;
    }
    return false;
  };

  if (trySelect()) {
    return cleanup;
  }

  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.body) {
    observer = new MutationObserver(() => {
      trySelect();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  const poll = () => {
    if (hasHandled) return;
    const handled = trySelect();
    if (!handled && typeof window !== "undefined") {
      timerId = window.setTimeout(poll, intervalMs);
    }
  };
  if (typeof window !== "undefined") {
    timerId = window.setTimeout(poll, intervalMs);
  }

  return cleanup;
}

export type StandardJobSelectionConfig = {
  isListingPage: (url: string | URL, root?: ParentNode) => boolean;
  cardSelectors: readonly string[];
  selectedSelectors?: readonly string[];
  isExtraJobSelected?: (root: ParentNode) => boolean;
  targetIdParams?: readonly string[];
  findTargetJobCard?: (root: ParentNode, targetId: string) => HTMLElement | null;
  cardClickSelector?: string;
  selectJob?: (element: HTMLElement) => void;
};

export function createStandardJobSelection(config: StandardJobSelectionConfig): ProviderJobSelection {
  const cardCombinedSelector = config.cardSelectors.join(", ");
  const cardClickSelector = config.cardClickSelector || cardCombinedSelector;

  const jobSelection: ProviderJobSelection = {
    isListingPage: config.isListingPage,
    cardSelector: cardClickSelector,
    isJobCardElement: (element: HTMLElement) => Boolean(element.closest(cardClickSelector)),
    findFirstJobCard: (root: ParentNode = document) => {
      const candidates = Array.from(root.querySelectorAll<HTMLElement>(cardCombinedSelector));
      return candidates.find(isElementVisible) || null;
    },
    isJobSelected: (root: ParentNode = document) => {
      if (config.selectedSelectors && config.selectedSelectors.length > 0) {
        const sel = config.selectedSelectors.join(", ");
        if (root.querySelector(sel)) return true;
      }
      if (config.isExtraJobSelected && config.isExtraJobSelected(root)) {
        return true;
      }
      return false;
    },
    extractTargetJobId: (url: string | URL) => {
      if (!config.targetIdParams || config.targetIdParams.length === 0) return null;
      return extractUrlQueryParam(url, ...config.targetIdParams);
    },
    findTargetJobCard: (root: ParentNode = document, targetId: string) => {
      if (config.findTargetJobCard) {
        return config.findTargetJobCard(root, targetId);
      }
      const selector = `[data-job-id='${targetId}'], article[data-job-id='${targetId}'], a[href*='${targetId}']`;
      return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isElementVisible) || null;
    },
    selectJob: config.selectJob || triggerJobCardClick,
    autoSelectFirstJob: (root: ParentNode = document, options) => {
      return runJobSelectionCycle(jobSelection, root, options);
    },
  };

  return jobSelection;
}
