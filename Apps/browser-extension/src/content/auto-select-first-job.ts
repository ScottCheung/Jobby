/** @format */

const PLATFORM_CARD_SELECTORS = [
  // SEEK card containers
  "article[data-automation='normalJob']",
  "article[data-automation='premiumJob']",
  "article[data-automation='standOutJob']",
  "article[data-automation='featuredJob']",
  "article[data-job-id]",
  "[data-automation='job-card']",
  "[data-testid='job-card']",
  "article[data-card-type='JobCard']",

  // LinkedIn card containers
  ".jobs-search-results-list .job-card-container",
  "li[data-occludable-job-id] .job-card-container",
  ".scaffold-layout__list-container .job-card-container",
  ".job-card-container",

  // Indeed card containers
  ".job_seen_beacon",
  "#mosaic-provider-jobcards .cardOutline",
  "#mosaic-provider-jobcards [data-testid='job-card']",

  // Glassdoor card containers
  "[data-test='jobListing']",
  ".JobsList_jobListItem__JBkBU",

  // Jora card containers
  ".job-card[data-job-card='true']",
  ".job-card",
  "#jobresults .job-card",
  ".job-card a.show-job-description",

  // ZipRecruiter card containers
  ".job_result",
  "[data-testid='job-listing']",

  // Adzuna card containers
  ".results-container article",
  "[data-aid]",

  // Wellfound card containers
  "[data-test='JobListing']",
  "[class*='styles_jobListing']",

  // Dice card containers
  "dhi-search-card",
  "[data-cy='card-title-link']",

  // SimplyHired card containers
  "[data-testid='searchSerpJob']",
  ".SerpJob-jobCard",
];

const SEARCH_OR_LIST_PAGE_PATTERNS = [
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
      if (
        /^\/(?:profile|career-advice|companies|saved-searches|saved-jobs|applied-jobs|employer|support|help)(?:\/|$)/i.test(
          pathname,
        )
      ) {
        return false;
      }
      return true;
    }

    // Dedicated Jora platform check
    if (/(?:^|\.)jora\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i.test(host)) {
      if (/^\/job\/(?:[^-/]+-)*[a-f0-9]{24,32}/i.test(pathname)) {
        return false;
      }
      if (/^\/(?:cms|users|login|salary|reviews)(?:\/|$)/i.test(pathname)) {
        return false;
      }
      return true;
    }

    return SEARCH_OR_LIST_PAGE_PATTERNS.some((pattern) =>
      pattern.test(pathAndSearch),
    );
  } catch {
    return false;
  }
}

function isElementVisible(element: HTMLElement): boolean {
  if (element.hasAttribute('hidden')) return false;
  if (element.style.display === 'none' || element.style.visibility === 'hidden')
    return false;
  return true;
}

export function isJobAlreadySelected(root: ParentNode = document): boolean {
  const selected = root.querySelector<HTMLElement>(
    "[data-automation='job-card'][data-selected='true'], [data-automation='job-card'][aria-current='true'], [data-testid='job-card'][aria-selected='true'], [data-testid='job-card'][data-selected='true'], [data-selected='true'], [aria-selected='true'], [data-active='true'], .job-card[data-active='true'], .jobs-search-results-list__list-item--active, [data-occludable-job-id].active",
  );
  return Boolean(selected);
}

export function findFirstJobCard(
  root: ParentNode = document,
): HTMLElement | null {
  const combinedSelector = PLATFORM_CARD_SELECTORS.join(', ');
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>(combinedSelector),
  );
  for (const element of elements) {
    if (isElementVisible(element)) {
      return element;
    }
  }
  return null;
}

export function triggerJobCardClick(element: HTMLElement): void {
  const isLink = element.tagName.toLowerCase() === 'a';
  const targetAttr = element.getAttribute('target');

  // If element is a link with target="_blank", temporarily remove target to avoid opening a new tab
  if (isLink && targetAttr === '_blank') {
    element.removeAttribute('target');
  }

  if (typeof element.click === 'function') {
    try {
      element.click();
    } catch {
      element.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  } else {
    element.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  }

  if (isLink && targetAttr === '_blank') {
    element.setAttribute('target', targetAttr);
  }
}

let lastAutoSelectedUrl = '';

export function autoSelectFirstJobCard(
  root: ParentNode = document,
  options: { maxWaitMs?: number; intervalMs?: number; url?: string } = {},
): () => void {
  const currentUrl = options.url || window.location.href;
  if (!isSearchOrListingPage(currentUrl)) {
    return () => undefined;
  }

  if (lastAutoSelectedUrl === currentUrl) {
    return () => undefined;
  }

  if (isJobAlreadySelected(root)) {
    lastAutoSelectedUrl = currentUrl;
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
      window.clearTimeout(timerId);
      timerId = undefined;
    }
    if (observer) {
      observer.disconnect();
      observer = undefined;
    }
  };

  const trySelect = (): boolean => {
    if (hasHandled) return true;
    if (isJobAlreadySelected(root)) {
      lastAutoSelectedUrl = currentUrl;
      cleanup();
      return true;
    }
    const firstCard = findFirstJobCard(root);
    if (firstCard) {
      lastAutoSelectedUrl = currentUrl;
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
  if (trySelect()) {
    return cleanup;
  }

  // MutationObserver for dynamic page loads
  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => {
      trySelect();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Polling fallback
  const poll = () => {
    if (hasHandled) return;
    const handled = trySelect();
    if (!handled) {
      timerId = window.setTimeout(poll, intervalMs);
    }
  };
  timerId = window.setTimeout(poll, intervalMs);

  return cleanup;
}
