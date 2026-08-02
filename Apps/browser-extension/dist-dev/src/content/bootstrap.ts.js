import { handleContentCommand } from "/src/content/command-handler.ts.js";
if (window.__jobbyContentMessageListener) {
  chrome.runtime.onMessage.removeListener(window.__jobbyContentMessageListener);
}
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
