import { initializeJobBindingListeners } from "./job-binding-service";
import { logDiagnostic } from "./diagnostics";
import { handleRuntimeMessage } from "./message-router";
import { getRuntimeSnapshot } from "./session-store";
import { acceptsFormChange } from "./content-bridge";
import { finalizeManualFormAction, prepareManualFormAction, recordManualFormObservations } from "./observation-service";
import { formFieldObservationSchema, formInspectionSchema } from "../shared/contracts/form-inspection";

initializeJobBindingListeners();

const activeSidepanelPorts = new Map<chrome.runtime.Port, number>();

export function isSidepanelOpenForWindow(windowId: number): boolean {
  return Array.from(activeSidepanelPorts.values()).includes(windowId);
}

type SidePanelWithClose = typeof chrome.sidePanel & {
  close?: (options: { windowId: number }) => Promise<void>;
};

/** Close the native panel before the page-embedded panel is shown. */
export async function closeSidepanelForWindow(windowId: number): Promise<boolean> {
  const sidePanel = chrome.sidePanel as SidePanelWithClose;
  if (typeof sidePanel.close === "function") {
    await sidePanel.close({ windowId });
    return true;
  }

  // Chrome 140 and older have no sidePanel.close(). Ask the side-panel page
  // itself to close, retaining the same mutual-exclusion contract.
  const ports = Array.from(activeSidepanelPorts.entries()).filter(
    ([, portWindowId]) => portWindowId === windowId,
  );
  for (const [port] of ports) {
    port.postMessage({ type: "sidepanel.close" });
  }
  return ports.length > 0;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "jobby-sidepanel") {
    port.onMessage.addListener((message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === "sidepanel.init"
      ) {
        const windowId = (message as { windowId?: unknown }).windowId;
        if (typeof windowId === "number") {
          activeSidepanelPorts.set(port, windowId);
          broadcastSidepanelState(windowId, true);
        }
      }
    });

    port.onDisconnect.addListener(() => {
      const windowId = activeSidepanelPorts.get(port);
      activeSidepanelPorts.delete(port);
      if (windowId !== undefined) {
        const stillOpen = Array.from(activeSidepanelPorts.values()).includes(windowId);
        if (!stillOpen) {
          broadcastSidepanelState(windowId, false);
        }
      }
    });
  }
});

function broadcastSidepanelState(windowId: number, isOpen: boolean) {
  // Only broadcast to tabs in normal (non-popup) windows.
  // Popup windows have their own windowId and cannot host the native side panel,
  // so they must never receive the host-window's sidepanel state — otherwise
  // the floating ball (which is the only way to open the iframe sidepanel in a
  // popup) would be hidden whenever the native sidepanel is open in the parent window.
  chrome.windows.get(windowId, (win) => {
    if (chrome.runtime.lastError || win.type !== "normal") return;
    chrome.tabs.query({ windowId }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          chrome.tabs.sendMessage(tab.id, { type: "sidepanel.state-changed", isOpen }).catch(() => {});
        }
      }
    });
  });
}

type FormChurnState = {
  windowStartedAt: number;
  lastAt: number;
  eventCount: number;
  distinctSnapshotCount: number;
  lastSignature: string;
  lastLoggedAt: number;
};

const formChurnByTab = new Map<number, FormChurnState>();

chrome.runtime.onInstalled.addListener(() => {
  void logDiagnostic("info", "service-worker", "Jobby extension installed or updated.");
});

chrome.runtime.onStartup.addListener(() => {
  void logDiagnostic("info", "service-worker", "Chrome started the Jobby extension.");
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Could not configure the side panel.";
  void logDiagnostic("error", "service-worker", message);
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.form-action-prepare"
  ) {
    const candidate = message as { form?: unknown; fields?: unknown };
    const form = formInspectionSchema.safeParse(candidate.form);
    const fields = formFieldObservationSchema.array().safeParse(candidate.fields);
    if (sender.tab?.id === undefined || !form.success || !fields.success) {
      sendResponse({ ok: false, error: "Could not prepare the form changes." });
      return false;
    }
    void prepareManualFormAction(form.data, fields.data, sender.tab.id)
      .then((pendingCount) => sendResponse({ ok: true, pendingCount }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not store form changes." }));
    return true;
  }
  if (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.form-action-finalize"
  ) {
    const save = (message as { save?: unknown }).save;
    if (sender.tab?.id === undefined || typeof save !== "boolean") {
      sendResponse({ ok: false, error: "Could not finalize the form changes." });
      return false;
    }
    void finalizeManualFormAction(sender.tab.id, save)
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not finalize form changes." }));
    return true;
  }
  if (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.form-observed"
  ) {
    const candidate = message as { form?: unknown; fields?: unknown };
    const form = formInspectionSchema.safeParse(candidate.form);
    const fields = formFieldObservationSchema.array().safeParse(candidate.fields);
    if (
      sender.tab?.id !== undefined &&
      acceptsFormChange(sender.tab.id, sender.frameId || 0) &&
      form.success &&
      fields.success
    ) {
      void recordManualFormObservations(form.data, fields.data, sender.tab.id);
    }
    sendResponse({ ok: true });
    return false;
  }
  if (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.form-changed" &&
    sender.tab?.id !== undefined
  ) {
    if (!acceptsFormChange(sender.tab.id, sender.frameId || 0)) {
      sendResponse({ ok: true });
      return false;
    }
    const changedForm = typeof message === "object" && message !== null
      ? (message as { form?: unknown }).form
      : undefined;
    const formWithFrameId =
      changedForm &&
      sender.frameId !== undefined &&
      typeof changedForm === "object" &&
      changedForm !== null &&
      ((changedForm as { kind?: unknown }).kind === "application_form" ||
        (changedForm as { kind?: unknown }).kind === "page_input_fields")
        ? {
            ...changedForm,
            fields: Array.isArray((changedForm as { fields?: unknown }).fields)
              ? (changedForm as { fields: Array<Record<string, unknown>> }).fields.map((field) => ({
                  ...field,
                  ...(sender.frameId ? { frameId: sender.frameId } : {}),
                }))
              : [],
          }
        : changedForm;
    recordFormChurn(sender.tab.id, sender.frameId || 0, formWithFrameId);
    void chrome.runtime.sendMessage({
      type: "sidepanel.form-changed",
      tabId: sender.tab.id,
      ...(formWithFrameId ? { form: formWithFrameId } : {}),
    }).catch(() => undefined);
    sendResponse({ ok: true });
    return false;
  }
  void handleRuntimeMessage(message, sender).then(sendResponse);
  return true;
});

function recordFormChurn(tabId: number, frameId: number, form: unknown): void {
  if (!form || typeof form !== "object") return;
  const candidate = form as {
    kind?: unknown;
    platform?: unknown;
    action?: unknown;
    fields?: unknown;
  };
  const fieldCount = Array.isArray(candidate.fields) ? candidate.fields.length : 0;
  const signature = `${String(candidate.kind || "unknown")}:${String(candidate.platform || "")}:${String(candidate.action || "")}:${fieldCount}`;
  const now = Date.now();
  const previous = formChurnByTab.get(tabId);
  const withinWindow = previous && now - previous.windowStartedAt <= 2_000;
  const state: FormChurnState = withinWindow && previous
    ? {
        ...previous,
        lastAt: now,
        eventCount: previous.eventCount + 1,
        distinctSnapshotCount: previous.distinctSnapshotCount + (previous.lastSignature === signature ? 0 : 1),
        lastSignature: signature,
      }
    : {
        windowStartedAt: now,
        lastAt: now,
        eventCount: 1,
        distinctSnapshotCount: 1,
        lastSignature: signature,
        lastLoggedAt: 0,
      };

  if (
    state.eventCount >= 3 &&
    state.distinctSnapshotCount >= 2 &&
    now - state.lastLoggedAt >= 2_000
  ) {
    state.lastLoggedAt = now;
    void logDiagnostic(
      "warn",
      "form-stability",
      `Rapid form updates detected: ${state.eventCount} events in ${now - state.windowStartedAt}ms.`,
      {
        tabId,
        frameId,
        fieldCount,
        formKind: candidate.kind,
        platform: candidate.platform,
        action: candidate.action,
        distinctSnapshotCount: state.distinctSnapshotCount,
      },
    );
  }
  formChurnByTab.set(tabId, state);
}

void getRuntimeSnapshot().then((snapshot) => {
  void logDiagnostic("debug", "service-worker", "Service worker started.", {
    phase: snapshot.phase,
  });
});
