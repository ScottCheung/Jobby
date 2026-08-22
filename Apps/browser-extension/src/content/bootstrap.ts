import { handleContentCommand, startContentFormDiscovery } from "./command-handler";
import { initializeFloatingBall } from "./dom/floating-ball";
import { classifyCurrentPage } from "./page-classifier";

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

// Backward-compatible cleanup for a page that was injected by an older build
// before the unified teardown hook existed.
if (window.__jobbyContentMessageListener && typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime?.onMessage) {
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
  void handleContentCommand(message)
    .then((response) => {
      if (response !== undefined) sendResponse({ ok: true, ...response });
    })
    .catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : "Could not inspect the current page.";
      sendResponse({ ok: false, error: reason });
    });
  return true;
};

window.__jobbyContentMessageListener = listener;
if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(listener);
  cleanupCallbacks.push(() => {
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.onMessage.removeListener(listener);
      }
    } catch {
      // Ignore
    }
  });
}

// Listen for theme changes from the Jobby web app and update chrome.storage.local
const onThemeMessage = (event: MessageEvent) => {
  if (
    event.source === window &&
    event.data &&
    event.data.source === "jobby-web-app" &&
    event.data.type === "JOBBY_THEME_CHANGE"
  ) {
    const { theme, themeColor } = event.data;
    const updatePayload: Record<string, string> = {};
    if (theme) updatePayload["auto-job-ui-theme"] = theme;
    if (themeColor) updatePayload["auto-job-ui-theme-color"] = themeColor;
    if (Object.keys(updatePayload).length > 0 && typeof chrome !== "undefined" && chrome.storage?.local) {
      void chrome.storage.local.set(updatePayload);
    }
  }
};
window.addEventListener("message", onThemeMessage);
cleanupCallbacks.push(() => window.removeEventListener("message", onThemeMessage));

// Broadcast extension theme changes to web app window in real-time
if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
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
  chrome.storage.onChanged.addListener(onStorageChanged);
  cleanupCallbacks.push(() => chrome.storage.onChanged.removeListener(onStorageChanged));
}

// LinkedIn and SEEK are the only sites where Jobby continuously drives an
// application flow. Other pages still support on-demand generic inspection,
// but must not receive a whole-document observer merely because the extension
// is installed.
const hostname = window.location.hostname.toLowerCase();
const isTopLevelFrame = window.top === window;
const isAutoObservedHost =
  hostname === "linkedin.com" ||
  hostname.endsWith(".linkedin.com") ||
  hostname === "seek.com" ||
  hostname.endsWith(".seek.com") ||
  hostname === "seek.com.au" ||
  hostname.endsWith(".seek.com.au") ||
  hostname === "indeed.com" ||
  hostname.endsWith(".indeed.com");

if (isTopLevelFrame) {
  cleanupCallbacks.push(initializeFloatingBall());
  if (isAutoObservedHost) {
    const syncDiscoveryState = () => {
      const pageClass = classifyCurrentPage();
      if (pageClass.isJobPage) {
        startContentFormDiscovery();
      } else {
        window.__jobbyFormDiscoveryCleanup?.();
        window.__jobbyFormObserverCleanup?.();
      }
    };

    syncDiscoveryState();

    let pageChangeTimer: number | undefined;
    const notifyPageChanged = () => {
      if (pageChangeTimer !== undefined) window.clearTimeout(pageChangeTimer);
      pageChangeTimer = window.setTimeout(() => {
        pageChangeTimer = undefined;
        syncDiscoveryState();
        if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime?.sendMessage) {
          try {
            chrome.runtime.sendMessage({ type: "content.page-changed" }).catch(() => undefined);
          } catch {
            // Ignore context invalidation on reload
          }
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

    // Also observe clicks on job listing cards/links on SEEK, LinkedIn, and Indeed
    const onJobCardClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const isJobClick = Boolean(
        target.closest(
          "a[href*='/job/'], a[href*='/jobs/view/'], [data-automation='job-card'], .job-card-container, [data-occludable-job-id], a[href*='vjk='], a[href*='jk='], .job_seen_beacon, [data-jk], [data-mobtk]"
        )
      );
      if (isJobClick) {
        notifyPageChanged();
      }
    };
    document.addEventListener("click", onJobCardClick, { capture: true, passive: true });
    cleanupCallbacks.push(() => document.removeEventListener("click", onJobCardClick, true));
  }
}

window.__jobbyContentBootstrapCleanup = () => {
  cleanupCallbacks.forEach((cleanup) => cleanup());
  window.__jobbyFormObserverCleanup?.();
  window.__jobbyFormDiscoveryCleanup?.();
};
