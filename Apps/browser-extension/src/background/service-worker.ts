import { logDiagnostic } from "./diagnostics";
import { handleRuntimeMessage } from "./message-router";
import { getRuntimeSnapshot } from "./session-store";
import { acceptsFormChange } from "./content-bridge";

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
