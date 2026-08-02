import { handleContentCommand, startContentFormDiscovery } from "./command-handler";

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
// LinkedIn includes auxiliary same-origin frames. They do not host the Easy
// Apply modal, but starting discovery inside them can create noisy updates and
// surface page-owned errors in the extension's bootstrap stack.
if (isTopLevelFrame && isAutoObservedHost) startContentFormDiscovery();
