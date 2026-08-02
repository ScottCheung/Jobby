import type { RuntimeMessage, RuntimeMessageResponse } from "../../shared/contracts/messages";

export async function send(message: RuntimeMessage): Promise<RuntimeMessageResponse> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { ok: false, error: "Open this page from the Jobby browser extension side panel." };
  }
  const activeTab = await getActiveTab();
  return chrome.runtime.sendMessage({
    ...message,
    ...(activeTab?.id !== undefined ? { activeTabId: activeTab.id } : {}),
  }) as Promise<RuntimeMessageResponse>;
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return null;
  try {
    const currentWindowTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentWindowTabs[0]) return currentWindowTabs[0];
    const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return lastFocusedTabs[0] ?? null;
  } catch {
    return null;
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
