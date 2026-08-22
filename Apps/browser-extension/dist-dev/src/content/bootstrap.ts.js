import { handleContentCommand, startContentFormDiscovery } from "/src/content/command-handler.ts.js";
import { initializeFloatingBall } from "/src/content/dom/floating-ball.ts.js";
import { classifyCurrentPage } from "/src/content/page-classifier.ts.js";
window.__jobbyContentBootstrapCleanup?.();
window.__jobbyContentBootstrapCleanup = void 0;
if (window.__jobbyContentMessageListener) {
  chrome.runtime.onMessage.removeListener(window.__jobbyContentMessageListener);
}
window.__jobbyFormObserverCleanup?.();
window.__jobbyFormDiscoveryCleanup?.();
const cleanupCallbacks = [];
const listener = (message, _sender, sendResponse) => {
  void handleContentCommand(message).then((response) => {
    if (response !== void 0) sendResponse({ ok: true, ...response });
  }).catch((error) => {
    const reason = error instanceof Error ? error.message : "Could not inspect the current page.";
    sendResponse({ ok: false, error: reason });
  });
  return true;
};
window.__jobbyContentMessageListener = listener;
chrome.runtime.onMessage.addListener(listener);
cleanupCallbacks.push(() => chrome.runtime.onMessage.removeListener(listener));
const onThemeMessage = (event) => {
  if (event.source === window && event.data && event.data.source === "jobby-web-app" && event.data.type === "JOBBY_THEME_CHANGE") {
    const { theme, themeColor } = event.data;
    const updatePayload = {};
    if (theme) updatePayload["auto-job-ui-theme"] = theme;
    if (themeColor) updatePayload["auto-job-ui-theme-color"] = themeColor;
    if (Object.keys(updatePayload).length > 0 && typeof chrome !== "undefined" && chrome.storage?.local) {
      void chrome.storage.local.set(updatePayload);
    }
  }
};
window.addEventListener("message", onThemeMessage);
cleanupCallbacks.push(() => window.removeEventListener("message", onThemeMessage));
if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  const onStorageChanged = (changes, areaName) => {
    if (areaName !== "local") return;
    const newTheme = changes["auto-job-ui-theme"]?.newValue;
    const newColor = changes["auto-job-ui-theme-color"]?.newValue;
    if (newTheme !== void 0 || newColor !== void 0) {
      window.postMessage(
        {
          source: "jobby-extension",
          type: "JOBBY_EXTENSION_THEME_CHANGE",
          theme: newTheme,
          themeColor: newColor
        },
        "*"
      );
    }
  };
  chrome.storage.onChanged.addListener(onStorageChanged);
  cleanupCallbacks.push(() => chrome.storage.onChanged.removeListener(onStorageChanged));
}
const hostname = window.location.hostname.toLowerCase();
const isTopLevelFrame = window.top === window;
const isAutoObservedHost = hostname === "linkedin.com" || hostname.endsWith(".linkedin.com") || hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au") || hostname === "indeed.com" || hostname.endsWith(".indeed.com");
if (isTopLevelFrame) {
  initializeFloatingBall();
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
    let pageChangeTimer;
    const notifyPageChanged = () => {
      if (pageChangeTimer !== void 0) window.clearTimeout(pageChangeTimer);
      pageChangeTimer = window.setTimeout(() => {
        pageChangeTimer = void 0;
        syncDiscoveryState();
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: "content.page-changed" }).catch(() => void 0);
        }
      }, 100);
    };
    document.addEventListener("jobby.url-changed", notifyPageChanged);
    window.addEventListener("popstate", notifyPageChanged);
    cleanupCallbacks.push(() => {
      document.removeEventListener("jobby.url-changed", notifyPageChanged);
      window.removeEventListener("popstate", notifyPageChanged);
      if (pageChangeTimer !== void 0) window.clearTimeout(pageChangeTimer);
    });
    const onJobCardClick = (event) => {
      const target = event.target;
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
