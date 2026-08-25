import { handleContentCommand, startContentFormDiscovery } from "./command-handler";
import { initializeFloatingBall } from "./dom/floating-ball";
import { observeIndeedJobDom } from "./indeed-page-change-observer";
import { classifyCurrentPage } from "./page-classifier";
import { observeSeekJobDom } from "./seek-page-change-observer";

type ContentMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];

declare global {
  interface Window {
    __jobbyContentMessageListener?: ContentMessageListener;
    __jobbyContentBootstrapCleanup?: () => void;
    __jobbyFormObserverCleanup?: () => void;
    __jobbyFormDiscoveryCleanup?: () => void;
  }
}

window.__jobbyContentBootstrapCleanup?.();
window.__jobbyContentBootstrapCleanup = undefined;

function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

// Backward-compatible cleanup for a page that was injected by an older build
// before the unified teardown hook existed.
if (window.__jobbyContentMessageListener && isExtensionContextValid() && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.removeListener(window.__jobbyContentMessageListener);
  } catch {
    // Ignore
  }
}
window.__jobbyFormObserverCleanup?.();
window.__jobbyFormDiscoveryCleanup?.();

const cleanupCallbacks: Array<() => void> = [];

const listener: ContentMessageListener = (message, _sender, sendResponse) => {
  if (!isExtensionContextValid()) return false;
  void handleContentCommand(message)
    .then((response) => {
      sendResponse(response !== undefined ? { ok: true, ...response } : { ok: true });
    })
    .catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : "Could not inspect the current page.";
      sendResponse({ ok: false, error: reason });
    });
  return true;
};

window.__jobbyContentMessageListener = listener;
if (isExtensionContextValid() && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener(listener);
    cleanupCallbacks.push(() => {
      try {
        if (isExtensionContextValid()) {
          chrome.runtime.onMessage.removeListener(listener);
        }
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore
  }
}

// Listen for theme changes from the Jobby web app and update chrome.storage.local
const onThemeMessage = (event: MessageEvent) => {
  if (
    event.source === window &&
    event.data &&
    event.data.source === "jobby-web-app" &&
    event.data.type === "JOBBY_THEME_CHANGE"
  ) {
    if (!isExtensionContextValid()) return;
    const { theme, themeColor } = event.data;
    const updatePayload: Record<string, string> = {};
    if (theme) updatePayload["auto-job-ui-theme"] = theme;
    if (themeColor) updatePayload["auto-job-ui-theme-color"] = themeColor;
    if (Object.keys(updatePayload).length > 0 && chrome.storage?.local) {
      try {
        void chrome.storage.local.set(updatePayload);
      } catch {
        // Ignore
      }
    }
  }
};
window.addEventListener("message", onThemeMessage);
cleanupCallbacks.push(() => window.removeEventListener("message", onThemeMessage));

// Broadcast extension theme changes to web app window in real-time
if (isExtensionContextValid() && chrome.storage?.onChanged) {
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (!isExtensionContextValid()) return;
    if (areaName !== "local") return;
    const newTheme = changes["auto-job-ui-theme"]?.newValue;
    const newColor = changes["auto-job-ui-theme-color"]?.newValue;
    if (newTheme !== undefined || newColor !== undefined) {
      window.postMessage(
        {
          source: "jobby-extension",
          type: "JOBBY_EXTENSION_THEME_CHANGE",
          theme: newTheme,
          themeColor: newColor,
        },
        "*"
      );
    }
  };
  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
    cleanupCallbacks.push(() => {
      try {
        if (isExtensionContextValid()) chrome.storage.onChanged.removeListener(onStorageChanged);
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore
  }
}

// Large job boards are observed continuously for client-side job selection
// and application-step changes. ATS pages still use on-demand inspection so
// the extension does not attach a whole-document observer to every website.
const hostname = window.location.hostname.toLowerCase();
const isTopLevelFrame = window.top === window;
const isSeekObservedHost =
  hostname === "seek.com" ||
  hostname.endsWith(".seek.com") ||
  hostname === "seek.com.au" ||
  hostname.endsWith(".seek.com.au") ||
  hostname === "seek.co.nz" ||
  hostname.endsWith(".seek.co.nz");
const isIndeedObservedHost =
  /(?:^|\.)indeed\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/.test(hostname);
const isAutoObservedHost =
  hostname === "linkedin.com" ||
  hostname.endsWith(".linkedin.com") ||
  isSeekObservedHost ||
  isIndeedObservedHost ||
  /(?:^|\.)glassdoor\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/.test(hostname) ||
  /(?:^|\.)(?:myworkdayjobs|myworkday|workday)\.com$/.test(hostname) ||
  /(?:^|\.)(?:boards|job-boards)\.greenhouse\.io$/.test(hostname) ||
  /(?:^|\.)jobs(?:\.eu)?\.lever\.co$/.test(hostname) ||
  /(?:^|\.)jobs\.ashbyhq\.com$/.test(hostname) ||
  /(?:^|\.)smartrecruiters\.com$/.test(hostname) ||
  hostname === "taleo.net" ||
  hostname.endsWith(".taleo.net") ||
  /(?:^|\.)(?:icims\.com|icims-candidateportal\.com)$/.test(hostname) ||
  /(?:^|\.)(?:successfactors|sapsf)\.(?:com|eu)$/.test(hostname) ||
  /(?:^|\.)(?:oraclecloud|fa\.ocs\.oraclecloud)\.com$/.test(hostname) ||
  /(?:^|\.)(?:apply\.)?workable\.com$/.test(hostname) ||
  /(?:^|\.)bamboohr\.(?:com|co\.uk)$/.test(hostname);

if (isTopLevelFrame && isExtensionContextValid()) {
  cleanupCallbacks.push(initializeFloatingBall());
  if (isAutoObservedHost) {
    const syncDiscoveryState = () => {
      try {
        if (!isExtensionContextValid()) {
          window.__jobbyContentBootstrapCleanup?.();
          return;
        }
        const pageClass = classifyCurrentPage();
        if (pageClass.isJobPage) {
          startContentFormDiscovery();
        } else {
          window.__jobbyFormDiscoveryCleanup?.();
          window.__jobbyFormObserverCleanup?.();
        }
      } catch {
        window.__jobbyContentBootstrapCleanup?.();
      }
    };

    syncDiscoveryState();

    let pageChangeTimer: number | undefined;
    const notifyPageChanged = () => {
      if (pageChangeTimer !== undefined) window.clearTimeout(pageChangeTimer);
      pageChangeTimer = window.setTimeout(() => {
        pageChangeTimer = undefined;
        try {
          if (!isExtensionContextValid()) {
            window.__jobbyContentBootstrapCleanup?.();
            return;
          }
          syncDiscoveryState();
          if (chrome.runtime?.id && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: "content.page-changed" }).catch(() => undefined);
          }
        } catch {
          // Ignore context invalidation on reload
        }
      }, 100);
    };

    document.addEventListener("jobby.url-changed", notifyPageChanged);
    window.addEventListener("popstate", notifyPageChanged);
    cleanupCallbacks.push(() => {
      document.removeEventListener("jobby.url-changed", notifyPageChanged);
      window.removeEventListener("popstate", notifyPageChanged);
      if (pageChangeTimer !== undefined) window.clearTimeout(pageChangeTimer);
    });

    if (isSeekObservedHost) {
      cleanupCallbacks.push(observeSeekJobDom(notifyPageChanged));
    }
    if (isIndeedObservedHost) {
      cleanupCallbacks.push(observeIndeedJobDom(notifyPageChanged));
    }

    // Also observe clicks on job listing cards/links. Glassdoor and some SEEK
    // layouts replace the detail pane without updating history.
    const onJobCardClick = (event: MouseEvent) => {
      try {
        if (!isExtensionContextValid()) {
          window.__jobbyContentBootstrapCleanup?.();
          return;
        }
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const isJobClick = Boolean(
          target.closest(
            "a[href*='/job/'], a[href*='/jobs/view/'], [data-automation='job-card'], [data-automation='normalJob'], [data-testid='job-card'], .job-card-container, [data-occludable-job-id], a[href*='vjk='], a[href*='jk='], .job_seen_beacon, [data-jk], [data-mobtk], [data-test='jobListing'][data-jobid], [data-selected][data-jobid], [id^='requisitionListInterface.reqTitleLinkAction'], [id*='pagerDiv'][id$='.Next'], [id*='pagerDiv'][id$='.Previous']"
          )
        );
        if (isJobClick) {
          notifyPageChanged();
        }
      } catch {
        // Ignore
      }
    };
    document.addEventListener("click", onJobCardClick, { capture: true, passive: true });
    cleanupCallbacks.push(() => document.removeEventListener("click", onJobCardClick, true));
  }
}

window.__jobbyContentBootstrapCleanup = () => {
  cleanupCallbacks.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // Ignore
    }
  });
  window.__jobbyFormObserverCleanup?.();
  window.__jobbyFormDiscoveryCleanup?.();
};
