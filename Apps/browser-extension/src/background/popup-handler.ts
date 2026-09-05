/** @format */

const pendingPopupTabs = new Set<number>();

export function isAuthUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    // Generic auth subdomains & path keywords
    if (host.startsWith('auth.') || host.includes('.auth.')) return true;
    if (path.includes('oauth') || path.includes('authorize')) return true;

    // Common OAuth & Login hosts
    if (host.includes('accounts.google.com')) return true;
    if (host.includes('login.microsoftonline.com') || host.includes('login.live.com')) return true;
    if (host.includes('appleid.apple.com')) return true;
    if (path.includes('login') || path.includes('checkpoint')) return true;
    if (host.includes('facebook.com') && path.includes('oauth')) return true;
    if (host.includes('github.com') && path.includes('login')) return true;
    if (host.includes('okta.com') || host.includes('auth0.com') || host.includes('supabase.co') || host.includes('supabase.com')) return true;
    
    // Local development auth
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      if (path.includes('login') || path.includes('auth')) return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function isPopupWindow(windowId: number): Promise<boolean> {
  try {
    const win = await chrome.windows.get(windowId);
    return win.type === 'popup';
  } catch {
    return false;
  }
}

async function tryConvertPopupToTab(tabId: number, windowId: number, openerTabId?: number, url?: string) {
  if (url && isAuthUrl(url)) {
    return;
  }

  const isPopup = await isPopupWindow(windowId);
  if (!isPopup) return;

  let targetWindowId: number | undefined;
  if (openerTabId !== undefined) {
    try {
      const openerTab = await chrome.tabs.get(openerTabId);
      targetWindowId = openerTab.windowId;
    } catch {
      // Opener tab may have been closed or isn't accessible
    }
  }

  if (targetWindowId === undefined) {
    try {
      const lastFocused = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
      targetWindowId = lastFocused.id;
    } catch {
      // Fallback: no normal window found
    }
  }

  if (targetWindowId !== undefined && targetWindowId !== windowId) {
    try {
      // Move tab to the target window
      await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });
      // Set the tab as active
      await chrome.tabs.update(tabId, { active: true });
      // Bring target window to focus
      await chrome.windows.update(targetWindowId, { focused: true });
    } catch (e) {
      console.error('Failed to convert popup to tab:', e);
    }
  }
}

export function initializePopupListeners(): void {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;

  chrome.tabs.onCreated.addListener(async (tab) => {
    if (tab.id === undefined) return;
    const url = tab.pendingUrl || tab.url;

    if (url) {
      await tryConvertPopupToTab(tab.id, tab.windowId, tab.openerTabId, url);
    } else {
      // If URL is not yet populated, check if the window is a popup
      const isPopup = await isPopupWindow(tab.windowId);
      if (isPopup) {
        pendingPopupTabs.add(tab.id);
      }
    }
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && pendingPopupTabs.has(tabId)) {
      pendingPopupTabs.delete(tabId);
      await tryConvertPopupToTab(tabId, tab.windowId, tab.openerTabId, changeInfo.url);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    pendingPopupTabs.delete(tabId);
  });
}
