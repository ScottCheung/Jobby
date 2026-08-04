import {
  DEFAULT_RUNTIME_SNAPSHOT,
  type DiagnosticEntry,
  type RuntimeSnapshot,
} from "../shared/contracts/execution";
import { authSessionSchema, type AuthSession, type AuthStatus } from "../shared/contracts/auth";
import { runtimeSnapshotSchema } from "../shared/contracts/messages";

const RUNTIME_KEY = "jobby.runtime.snapshot";
const DIAGNOSTICS_KEY = "jobby.runtime.diagnostics";
const AUTH_KEY = "jobby.auth.session";
const AUTOFILL_SESSIONS_KEY = "jobby.autofill.sessions";
const MAX_DIAGNOSTIC_ENTRIES = 200;

let writeQueue: Promise<void> = Promise.resolve();

function serializeWrite(operation: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(operation, operation);
  return writeQueue;
}

export async function getRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  const stored = await chrome.storage.session.get(RUNTIME_KEY);
  const parsed = runtimeSnapshotSchema.safeParse(stored[RUNTIME_KEY]);
  return parsed.success ? parsed.data : DEFAULT_RUNTIME_SNAPSHOT;
}

export async function updateRuntimeSnapshot(
  updates: Partial<Omit<RuntimeSnapshot, "updatedAt">>,
): Promise<RuntimeSnapshot> {
  let nextSnapshot = DEFAULT_RUNTIME_SNAPSHOT;

  await serializeWrite(async () => {
    const current = await getRuntimeSnapshot();
    nextSnapshot = { ...current, ...updates, updatedAt: new Date().toISOString() };
    await chrome.storage.session.set({ [RUNTIME_KEY]: nextSnapshot });
  });

  return nextSnapshot;
}

export async function listDiagnostics(): Promise<DiagnosticEntry[]> {
  const stored = await chrome.storage.session.get(DIAGNOSTICS_KEY);
  const entries = stored[DIAGNOSTICS_KEY];
  return Array.isArray(entries) ? (entries as DiagnosticEntry[]) : [];
}

export async function appendDiagnostic(entry: DiagnosticEntry): Promise<void> {
  await serializeWrite(async () => {
    const entries = await listDiagnostics();
    await chrome.storage.session.set({
      [DIAGNOSTICS_KEY]: [...entries, entry].slice(-MAX_DIAGNOSTIC_ENTRIES),
    });
  });
}

export async function clearDiagnostics(): Promise<void> {
  await serializeWrite(async () => {
    await chrome.storage.session.set({ [DIAGNOSTICS_KEY]: [] });
  });
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  const parsed = authSessionSchema.safeParse(stored[AUTH_KEY]);
  return parsed.success ? parsed.data : null;
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  const parsed = authSessionSchema.parse(session);
  await chrome.storage.local.set({ [AUTH_KEY]: parsed });
}

export async function clearAuthSession(): Promise<void> {
  await chrome.storage.local.remove(AUTH_KEY);
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const session = await getAuthSession();
  if (!session) return { connected: false };
  return {
    connected: true,
    expiresAt: session.expiresAt,
    user: session.user,
  };
}

export async function getAutofillSessionId(tabId: number): Promise<string> {
  const stored = await chrome.storage.session.get(AUTOFILL_SESSIONS_KEY);
  const sessions = stored[AUTOFILL_SESSIONS_KEY] as Record<string, unknown> | undefined;
  const existing = sessions?.[String(tabId)];
  if (typeof existing === "string" && existing.length > 0) return existing;
  const sessionId = crypto.randomUUID();
  await chrome.storage.session.set({
    [AUTOFILL_SESSIONS_KEY]: { ...(sessions || {}), [String(tabId)]: sessionId },
  });
  return sessionId;
}

export async function clearAutofillSession(tabId: number): Promise<void> {
  const stored = await chrome.storage.session.get(AUTOFILL_SESSIONS_KEY);
  const sessions = { ...((stored[AUTOFILL_SESSIONS_KEY] as Record<string, unknown> | undefined) || {}) };
  delete sessions[String(tabId)];
  await chrome.storage.session.set({ [AUTOFILL_SESSIONS_KEY]: sessions });
}
