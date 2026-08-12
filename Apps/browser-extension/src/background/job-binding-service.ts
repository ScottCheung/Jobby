/** @format */

import type { PageInspection } from '../shared/contracts/page-inspection';

interface BoundJobEntry {
  inspection: PageInspection;
  timestamp: number;
}

const tabJobMap = new Map<number, BoundJobEntry>();
const urlJobMap = new Map<string, BoundJobEntry>();
const MAX_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function cleanExpiredEntries(): void {
  const now = Date.now();
  for (const [tabId, entry] of tabJobMap.entries()) {
    if (now - entry.timestamp > MAX_EXPIRY_MS) {
      tabJobMap.delete(tabId);
    }
  }
  for (const [url, entry] of urlJobMap.entries()) {
    if (now - entry.timestamp > MAX_EXPIRY_MS) {
      urlJobMap.delete(url);
    }
  }
}

export function bindTabJobInspection(
  tabId: number,
  inspection: PageInspection,
): void {
  cleanExpiredEntries();
  if (inspection.kind !== 'job') return;
  const entry: BoundJobEntry = {
    inspection,
    timestamp: Date.now(),
  };
  tabJobMap.set(tabId, entry);
  if (inspection.snapshot.url) {
    urlJobMap.set(inspection.snapshot.url.toLowerCase(), entry);
  }
}

export function getTabJobInspection(tabId: number, currentUrl?: string): PageInspection | null {
  cleanExpiredEntries();
  const direct = tabJobMap.get(tabId);
  if (direct?.inspection) return direct.inspection;

  if (currentUrl) {
    const urlKey = currentUrl.toLowerCase();
    const byUrl = urlJobMap.get(urlKey);
    if (byUrl?.inspection) return byUrl.inspection;
  }
  return null;
}

export function initializeJobBindingListeners(): void {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;

  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id === undefined || tab.openerTabId === undefined) return;
    const parentJob = tabJobMap.get(tab.openerTabId);
    if (parentJob) {
      bindTabJobInspection(tab.id, parentJob.inspection);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabJobMap.delete(tabId);
  });
}
