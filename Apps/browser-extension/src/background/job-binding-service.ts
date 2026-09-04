/** @format */

import type { PageInspection } from '../shared/contracts/page-inspection';

interface BoundJobEntry {
  inspection: PageInspection;
  originUrl?: string;
  isInheritedChildTab?: boolean;
  timestamp: number;
}

const tabJobMap = new Map<number, BoundJobEntry>();
const MAX_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function cleanExpiredEntries(): void {
  const now = Date.now();
  for (const [tabId, entry] of tabJobMap.entries()) {
    if (now - entry.timestamp > MAX_EXPIRY_MS) {
      tabJobMap.delete(tabId);
    }
  }
}

function isSameSeekJob(currentUrl: string, inspection: PageInspection): boolean {
  if (inspection.kind !== 'job' || inspection.snapshot.platform !== 'seek') return false;
  try {
    const current = new URL(currentUrl);
    const jobId = current.pathname.match(/\/job\/(\d+)/i)?.[1] || current.searchParams.get('jobId');
    return Boolean(jobId && jobId === inspection.snapshot.externalId);
  } catch {
    return false;
  }
}

export function bindTabJobInspection(
  tabId: number,
  inspection: PageInspection,
  isInheritedChildTab = false,
): void {
  cleanExpiredEntries();
  if (inspection.kind !== 'job') {
    tabJobMap.delete(tabId);
    return;
  }
  const entry: BoundJobEntry = {
    inspection,
    originUrl: inspection.snapshot.url,
    isInheritedChildTab,
    timestamp: Date.now(),
  };
  tabJobMap.set(tabId, entry);
}

export function unbindTabJob(tabId: number): void {
  tabJobMap.delete(tabId);
}

export function getTabJobInspection(tabId: number, currentUrl?: string): PageInspection | null {
  cleanExpiredEntries();
  const direct = tabJobMap.get(tabId);
  if (direct) {
    if (direct.isInheritedChildTab) {
      return direct.inspection;
    }
    if (currentUrl && direct.originUrl) {
      try {
        const current = new URL(currentUrl);
        const origin = new URL(direct.originUrl);
        if (current.origin === origin.origin && current.pathname === origin.pathname) {
          return direct.inspection;
        }
      } catch {}
      if (isSameSeekJob(currentUrl, direct.inspection)) return direct.inspection;
    }
    // Stale direct binding after navigating away
    tabJobMap.delete(tabId);
  }

  return null;
}

export function initializeJobBindingListeners(): void {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;

  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id === undefined || tab.openerTabId === undefined) return;
    const parentJob = tabJobMap.get(tab.openerTabId);
    if (parentJob && parentJob.inspection.kind === 'job') {
      bindTabJobInspection(tab.id, parentJob.inspection, true);
    }
  });

  chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      const entry = tabJobMap.get(tabId);
      if (entry && !entry.isInheritedChildTab && entry.originUrl) {
        try {
          const next = new URL(changeInfo.url);
          const prev = new URL(entry.originUrl);
          if (next.origin !== prev.origin || next.pathname !== prev.pathname) {
            tabJobMap.delete(tabId);
          }
        } catch {
          tabJobMap.delete(tabId);
        }
      }
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabJobMap.delete(tabId);
  });
}
