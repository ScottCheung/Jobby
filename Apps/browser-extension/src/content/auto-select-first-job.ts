/** @format */

const JOB_CARD_SELECTORS = [
  // LinkedIn
  ".jobs-search-results-list .job-card-container",
  ".jobs-search-results-list__list-item a.job-card-list__title",
  ".jobs-search__results-list li a.job-card-list__title",
  "li[data-occludable-job-id] .job-card-container",
  "li[data-occludable-job-id] a.job-card-container__link",
  "li[data-occludable-job-id] a[href*='/jobs/view/']",
  ".scaffold-layout__list-container .job-card-container",

  // SEEK
  "article[data-automation='normalJob'] a[data-automation='jobTitle']",
  "article[data-automation='premiumJob'] a[data-automation='jobTitle']",
  "article[data-automation='standOutJob'] a[data-automation='jobTitle']",
  "article[data-automation='featuredJob'] a[data-automation='jobTitle']",
  "article[data-job-id] a[data-automation='jobTitle']",
  "[data-automation='job-card'] a[data-automation='jobTitle']",
  "article[data-automation='normalJob'] a[href*='/job/']",
  "article[data-automation='premiumJob'] a[href*='/job/']",
  "article[data-job-id] a[href*='/job/']",
  "a[data-automation='jobTitle']",
  "[data-automation='job-card'] a",
  "[data-testid='job-card'] a",
  "article[data-automation='normalJob']",
  "article[data-automation='premiumJob']",
  "article[data-job-id]",

  // Indeed
  ".job_seen_beacon a.jcs-JobTitle",
  ".job_seen_beacon a[data-jk]",
  "#mosaic-provider-jobcards a.jcs-JobTitle",
  "#mosaic-provider-jobcards [data-testid='job-card'] a",
  "a[id^='job_']",

  // Glassdoor
  "[data-test='jobListing'] a[data-test='job-title']",
  "li[data-test='jobListing'] a",
  "[data-test='jobListing']",
  ".JobsList_jobListItem__JBkBU a",

  // Generic / Fallback
  "[data-automation='job-card'] a",
  "[data-testid='job-card'] a",
  "[data-occludable-job-id] a",
  ".job-card-container a",
];

const SEARCH_OR_LIST_PAGE_PATTERNS = [
  /\/jobs\/search/i,
  /\/jobs\/collections/i,
  /\/jobs\/?(?:\?.*)?$/i,
  /\/Job\/.*jobs\.htm/i,
  /\/Job\/?(?:\?.*)?$/i,
  /\/jobs\/.*-jobs/i,
  /\/jobs\?.*q=/i,
  /\/jobs\?.*keywords=/i,
  /-jobs(?:\/|\?|$)/i,
  /\/jobs-in-/i,
  /\/jobs(?:\/|\?|$)/i,
];

export function isSearchOrListingPage(url = window.location.href): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    const pathAndSearch = parsed.pathname + parsed.search;

    // Dedicated SEEK platform check
    if (/^(?:[a-z0-9-]+\.)*seek\.(?:com(?:\.au)?|co\.nz)$/i.test(host)) {
      if (/^\/job\/\d+/i.test(pathname)) {
        return false;
      }
      if (/^\/(?:profile|career-advice|companies|saved-searches|saved-jobs|applied-jobs|employer|support|help)(?:\/|$)/i.test(pathname)) {
        return false;
      }
      return true;
    }

    return SEARCH_OR_LIST_PAGE_PATTERNS.some((pattern) =>
      pattern.test(pathAndSearch)
    );
  } catch {
    return false;
  }
}

function isElementVisible(element: HTMLElement): boolean {
  if (element.hasAttribute("hidden")) return false;
  if (element.style.display === "none" || element.style.visibility === "hidden") return false;
  return true;
}

export function findFirstJobCard(root: ParentNode = document): HTMLElement | null {
  const combinedSelector = JOB_CARD_SELECTORS.join(", ");
  const elements = Array.from(root.querySelectorAll<HTMLElement>(combinedSelector));
  for (const element of elements) {
    if (isElementVisible(element)) {
      return element;
    }
  }
  return null;
}

export function triggerJobCardClick(element: HTMLElement): void {
  const clickTarget =
    (element.querySelector<HTMLElement>("a[data-automation='jobTitle'], a[href*='/job/'], a, button, [role='button']") || element);

  const mouseEvents = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;
  mouseEvents.forEach((eventType) => {
    clickTarget.dispatchEvent(
      new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  });

  if (typeof clickTarget.click === "function") {
    try {
      clickTarget.click();
    } catch {
      // Ignore errors from target.click
    }
  }
}

let lastAutoClickedUrl = "";

export function autoClickFirstJobCard(
  root: ParentNode = document,
  options: { maxWaitMs?: number; intervalMs?: number; url?: string } = {}
): () => void {
  const currentUrl = options.url || window.location.href;
  if (!isSearchOrListingPage(currentUrl)) {
    return () => undefined;
  }

  // Avoid clicking repeatedly on the exact same search URL
  if (lastAutoClickedUrl === currentUrl) {
    return () => undefined;
  }

  const maxWaitMs = options.maxWaitMs ?? 4000;
  const intervalMs = options.intervalMs ?? 200;
  const startTime = Date.now();
  let timerId: number | undefined;
  let observer: MutationObserver | undefined;
  let isCleanedUp = false;

  const cleanup = () => {
    isCleanedUp = true;
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timerId = undefined;
    }
    if (observer) {
      observer.disconnect();
      observer = undefined;
    }
  };

  const tryClick = (): boolean => {
    if (isCleanedUp) return true;
    const firstCard = findFirstJobCard(root);
    if (firstCard) {
      lastAutoClickedUrl = currentUrl;
      triggerJobCardClick(firstCard);
      cleanup();
      return true;
    }
    if (Date.now() - startTime >= maxWaitMs) {
      cleanup();
      return true;
    }
    return false;
  };

  // Immediate attempt
  if (tryClick()) {
    return cleanup;
  }

  // MutationObserver for dynamic page loads
  if (typeof MutationObserver !== "undefined" && document.body) {
    observer = new MutationObserver(() => {
      tryClick();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Polling fallback
  const poll = () => {
    if (isCleanedUp) return;
    const handled = tryClick();
    if (!handled) {
      timerId = window.setTimeout(poll, intervalMs);
    }
  };
  timerId = window.setTimeout(poll, intervalMs);

  return cleanup;
}
