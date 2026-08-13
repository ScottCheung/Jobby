import { handleContentCommand, startContentFormDiscovery } from "/src/content/command-handler.ts.js";
import { readCurrentPageWhenReady } from "/src/content/page-reader.ts.js";
import { injectInPageScoreCard } from "/src/content/dom/score-card-injector.ts.js";
import { initializeFloatingBall } from "/src/content/dom/floating-ball.ts.js";
if (window.__jobbyContentMessageListener) {
  chrome.runtime.onMessage.removeListener(window.__jobbyContentMessageListener);
}
window.__jobbyFormObserverCleanup?.();
window.__jobbyFormDiscoveryCleanup?.();
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
window.addEventListener("message", (event) => {
  if (event.source === window && event.data && event.data.source === "jobby-web-app" && event.data.type === "JOBBY_THEME_CHANGE") {
    const { theme, themeColor } = event.data;
    const updatePayload = {};
    if (theme) updatePayload["auto-job-ui-theme"] = theme;
    if (themeColor) updatePayload["auto-job-ui-theme-color"] = themeColor;
    if (Object.keys(updatePayload).length > 0 && typeof chrome !== "undefined" && chrome.storage?.local) {
      void chrome.storage.local.set(updatePayload);
    }
  }
});
const hostname = window.location.hostname.toLowerCase();
const isTopLevelFrame = window.top === window;
const isAutoObservedHost = hostname === "linkedin.com" || hostname.endsWith(".linkedin.com") || hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
if (isTopLevelFrame) {
  initializeFloatingBall();
  if (isAutoObservedHost) startContentFormDiscovery();
  void readCurrentPageWhenReady().then((inspection) => {
    if (inspection.kind === "job") {
      injectInPageScoreCard(inspection);
    }
  }).catch(() => void 0);
}
