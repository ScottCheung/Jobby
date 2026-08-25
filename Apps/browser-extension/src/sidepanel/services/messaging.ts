/** @format */

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

export async function sendContentCommandToActiveTab(
  payload: Record<string, unknown>,
): Promise<void> {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    throw new Error('Could not find the active page.');
  }

  let messageSucceeded = false;
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(activeTab.id, payload),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 1500),
      ),
    ]);
    if ((response as { ok?: boolean })?.ok !== false) {
      messageSucceeded = true;
    }
  } catch {
    messageSucceeded = false;
  }

  if (messageSucceeded) return;

  const files = (chrome.runtime.getManifest().content_scripts || [])
    .flatMap((entry) => entry.js || [])
    .filter((file): file is string => Boolean(file));

  if (files.length > 0) {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files,
    });
    await new Promise((res) => setTimeout(res, 80));
    await chrome.tabs.sendMessage(activeTab.id, payload);
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
