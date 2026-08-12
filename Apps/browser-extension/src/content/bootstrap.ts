import { handleContentCommand, startContentFormDiscovery } from "./command-handler";
import { readCurrentPageWhenReady } from "./page-reader";
import { injectInPageScoreCard } from "./dom/score-card-injector";

type ContentMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];

declare global {
  interface Window {
    __jobbyContentMessageListener?: ContentMessageListener;
    __jobbyFormObserverCleanup?: () => void;
    __jobbyFormDiscoveryCleanup?: () => void;
  }
}

if (window.__jobbyContentMessageListener) {
  chrome.runtime.onMessage.removeListener(window.__jobbyContentMessageListener);
}
window.__jobbyFormObserverCleanup?.();
window.__jobbyFormDiscoveryCleanup?.();

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
chrome.runtime.onMessage.addListener(listener);

// Listen for theme changes from the Jobby web app and update chrome.storage.local
window.addEventListener("message", (event) => {
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
});

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
  hostname.endsWith(".seek.com.au");

if (isTopLevelFrame) {
  if (isAutoObservedHost) startContentFormDiscovery();
  void readCurrentPageWhenReady()
    .then((inspection) => {
      if (inspection.kind === "job") {
        injectInPageScoreCard(inspection);
      }
    })
    .catch(() => undefined);
}
