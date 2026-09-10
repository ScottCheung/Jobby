import { atsJobPlatforms } from "../shared/contracts/platform";
import type { PageInspection } from "../shared/contracts/page-inspection";
import {
  applicationSessionSchema,
  type ApplicationSession,
  type ApplicationSubmission,
  type JobIdentity,
} from "../shared/contracts/application-session";
import type { JobSnapshot } from "../shared/contracts/page-inspection";

const APPLICATION_SESSIONS_KEY = "jobby.application.sessions";
const APPLICATION_TAB_BINDINGS_KEY = "jobby.application.tab-bindings";

type TabBinding = {
  sessionId: string;
  inherited?: boolean;
};

const memoryStore: Record<string, unknown> = {};
let writeQueue: Promise<void> = Promise.resolve();

function serializeWrite(operation: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(operation, operation);
  return writeQueue;
}

function sessionStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome === "undefined" || !chrome.storage?.session) return null;
  return chrome.storage.session;
}

async function readStorage(key: string): Promise<unknown> {
  const storage = sessionStorage();
  if (!storage) return memoryStore[key];
  const stored = await storage.get(key);
  return stored[key];
}

async function writeStorage(key: string, value: unknown): Promise<void> {
  const storage = sessionStorage();
  if (!storage) {
    memoryStore[key] = value;
    return;
  }
  await storage.set({ [key]: value });
}

async function readSessions(): Promise<Record<string, ApplicationSession>> {
  const stored = await readStorage(APPLICATION_SESSIONS_KEY);
  if (!stored || typeof stored !== "object") return {};
  const sessions: Record<string, ApplicationSession> = {};
  for (const [id, value] of Object.entries(stored)) {
    const parsed = applicationSessionSchema.safeParse(value);
    if (parsed.success) sessions[id] = parsed.data;
  }
  return sessions;
}

async function readBindings(): Promise<Record<string, TabBinding>> {
  const stored = await readStorage(APPLICATION_TAB_BINDINGS_KEY);
  if (!stored || typeof stored !== "object") return {};
  const bindings: Record<string, TabBinding> = {};
  for (const [tabId, value] of Object.entries(stored)) {
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as { sessionId?: unknown }).sessionId === "string"
    ) {
      bindings[tabId] = {
        sessionId: (value as { sessionId: string }).sessionId,
        inherited: Boolean((value as { inherited?: unknown }).inherited),
      };
    }
  }
  return bindings;
}

function now(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizedUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, "");
  }
}

function normalizedText(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function isMeaningful(value: string | undefined): boolean {
  const normalized = normalizedText(value);
  return Boolean(normalized && !/^(?:unknown|unknown company|n\/a)$/i.test(normalized));
}

function identityType(platform: string): JobIdentity["type"] {
  return (atsJobPlatforms as readonly string[]).includes(platform)
    ? "ats"
    : "source";
}

function identityForSnapshot(
  snapshot: JobSnapshot,
  confidence: JobIdentity["confidence"] = "high",
): JobIdentity {
  return {
    platform: snapshot.platform,
    externalId: snapshot.externalId,
    url: snapshot.url,
    type: identityType(snapshot.platform),
    confidence,
  };
}

function identityKey(identity: JobIdentity): string {
  return `${identity.platform.toLowerCase()}:${
    normalizedText(identity.externalId) || normalizedUrl(identity.url)
  }`;
}

function hasMatchingIdentity(
  session: ApplicationSession,
  snapshot: JobSnapshot,
): boolean {
  const platform = normalizedText(snapshot.platform);
  const externalId = normalizedText(snapshot.externalId);
  const url = normalizedUrl(snapshot.url);
  return session.identities.some(
    (identity) =>
      normalizedText(identity.platform) === platform &&
      (externalId && identity.externalId
        ? normalizedText(identity.externalId) === externalId
        : Boolean(url && normalizedUrl(identity.url) === url)),
  );
}

function mergeSnapshot(base: JobSnapshot, next: JobSnapshot): JobSnapshot {
  const description =
    (next.description || "").length > (base.description || "").length
      ? next.description
      : base.description;
  const technologies = Array.from(
    new Set([...(base.technologies || []), ...(next.technologies || [])]),
  );

  return {
    ...base,
    title: isMeaningful(base.title) ? base.title : next.title,
    company: isMeaningful(base.company) ? base.company : next.company,
    location: base.location || next.location,
    firstPostedAt: base.firstPostedAt || next.firstPostedAt,
    lastPostedAt: base.lastPostedAt || next.lastPostedAt,
    postingObservedAt: base.postingObservedAt || next.postingObservedAt,
    isReposted: base.isReposted ?? next.isReposted,
    postingDateRaw: base.postingDateRaw || next.postingDateRaw,
    description,
    technologies,
    ...("easyApply" in next &&
    typeof next.easyApply === "boolean" &&
    !Object.hasOwn(base, "easyApply")
      ? { easyApply: next.easyApply }
      : {}),
    ...("workType" in next && !Object.hasOwn(base, "workType")
      ? { workType: next.workType }
      : {}),
    ...("experienceLevel" in next && !Object.hasOwn(base, "experienceLevel")
      ? { experienceLevel: next.experienceLevel }
      : {}),
  } as JobSnapshot;
}

function withTab(session: ApplicationSession, tabId: number): ApplicationSession {
  return session.tabs.includes(tabId)
    ? session
    : { ...session, tabs: [...session.tabs, tabId] };
}

function sessionInspection(
  session: ApplicationSession,
  currentUrl?: string,
): PageInspection {
  return {
    kind: "job",
    snapshot: {
      ...session.job,
      ...(currentUrl ? { url: currentUrl } : {}),
    },
  };
}

export async function getApplicationSessionForTab(
  tabId: number,
): Promise<ApplicationSession | null> {
  const bindings = await readBindings();
  const binding = bindings[String(tabId)];
  if (!binding) return null;
  const sessions = await readSessions();
  return sessions[binding.sessionId] || null;
}

export async function isInheritedApplicationSessionTab(
  tabId: number,
): Promise<boolean> {
  const bindings = await readBindings();
  return Boolean(bindings[String(tabId)]?.inherited);
}

export async function resolveApplicationSession(
  tabId: number,
  inspection: PageInspection,
  options: { lock?: boolean } = {},
): Promise<{ session: ApplicationSession; inspection: PageInspection }> {
  if (inspection.kind !== "job") {
    const existing = await getApplicationSessionForTab(tabId);
    if (!existing) throw new Error("A job must be detected before starting an application.");
    return {
      session: existing,
      inspection: sessionInspection(existing),
    };
  }

  let result: { session: ApplicationSession; inspection: PageInspection } | undefined;
  await serializeWrite(async () => {
    const sessions = await readSessions();
    const bindings = await readBindings();
    const binding = bindings[String(tabId)];
    const existing = binding ? sessions[binding.sessionId] : undefined;
    const matches = existing ? hasMatchingIdentity(existing, inspection.snapshot) : false;
    const canEnrichExisting = Boolean(
      existing &&
        (matches ||
          binding?.inherited ||
          options.lock),
    );

    const timestamp = now();
    if (existing && canEnrichExisting) {
      const identity = identityForSnapshot(
        inspection.snapshot,
        binding?.inherited || options.lock ? "high" : "medium",
      );
      const identities = existing.identities.some(
        (candidate) => identityKey(candidate) === identityKey(identity),
      )
        ? existing.identities
        : [...existing.identities, identity];
      const session: ApplicationSession = applicationSessionSchema.parse({
        ...existing,
        job: mergeSnapshot(existing.job, inspection.snapshot),
        identities,
        tabs: withTab(existing, tabId).tabs,
        identityLocked: existing.identityLocked || Boolean(options.lock),
        status: existing.status === "submission_unknown" ? "active" : existing.status,
        updatedAt: timestamp,
      });
      sessions[session.id] = session;
      bindings[String(tabId)] = binding || { sessionId: session.id };
      await writeStorage(APPLICATION_SESSIONS_KEY, sessions);
      await writeStorage(APPLICATION_TAB_BINDINGS_KEY, bindings);
      result = {
        session,
        inspection: sessionInspection(session, inspection.snapshot.url),
      };
      return;
    }

    if (existing) {
      const tabs = existing.tabs.filter((candidate) => candidate !== tabId);
      sessions[existing.id] = {
        ...existing,
        tabs,
        status:
          tabs.length === 0 && existing.status === "active"
            ? "abandoned"
            : existing.status,
        updatedAt: timestamp,
      };
    }

    const session = applicationSessionSchema.parse({
      id: randomId(),
      status: "active",
      job: inspection.snapshot,
      sourceJob: inspection.snapshot,
      identities: [identityForSnapshot(inspection.snapshot)],
      tabs: [tabId],
      identityLocked: Boolean(options.lock),
      startedAt: timestamp,
      updatedAt: timestamp,
    });
    sessions[session.id] = session;
    bindings[String(tabId)] = { sessionId: session.id };
    await writeStorage(APPLICATION_SESSIONS_KEY, sessions);
    await writeStorage(APPLICATION_TAB_BINDINGS_KEY, bindings);
    result = {
      session,
      inspection: sessionInspection(session, inspection.snapshot.url),
    };
  });

  if (!result) throw new Error("Could not resolve the application session.");
  return result;
}

export async function bindTabToApplicationSession(
  tabId: number,
  sessionId: string,
  inherited = false,
): Promise<void> {
  await serializeWrite(async () => {
    const sessions = await readSessions();
    const session = sessions[sessionId];
    if (!session) return;
    const bindings = await readBindings();
    bindings[String(tabId)] = { sessionId, inherited };
    sessions[sessionId] = withTab(session, tabId);
    await writeStorage(APPLICATION_SESSIONS_KEY, sessions);
    await writeStorage(APPLICATION_TAB_BINDINGS_KEY, bindings);
  });
}

export async function unbindApplicationSessionTab(tabId: number): Promise<void> {
  await serializeWrite(async () => {
    const bindings = await readBindings();
    const binding = bindings[String(tabId)];
    if (!binding) return;
    delete bindings[String(tabId)];
    const sessions = await readSessions();
    const session = sessions[binding.sessionId];
    if (session) {
      const tabs = session.tabs.filter((candidate) => candidate !== tabId);
      sessions[binding.sessionId] = {
        ...session,
        tabs,
        status:
          tabs.length === 0 && session.status === "active"
            ? "abandoned"
            : session.status,
        updatedAt: now(),
      };
      await writeStorage(APPLICATION_SESSIONS_KEY, sessions);
    }
    await writeStorage(APPLICATION_TAB_BINDINGS_KEY, bindings);
  });
}

export async function lockApplicationSessionForTab(
  tabId: number,
): Promise<ApplicationSession | null> {
  return updateApplicationSessionForTab(tabId, (session) => ({
    ...session,
    identityLocked: true,
    status: session.status === "submission_unknown" ? "active" : session.status,
  }));
}

export async function startApplicationSessionSubmission(
  tabId: number,
): Promise<ApplicationSession | null> {
  return updateApplicationSessionForTab(tabId, (session) => ({
    ...session,
    identityLocked: true,
    status: "submitting",
  }));
}

export async function markApplicationSessionSubmitted(
  tabId: number,
  submission: ApplicationSubmission,
): Promise<ApplicationSession | null> {
  let result: ApplicationSession | null = null;
  await serializeWrite(async () => {
    const bindings = await readBindings();
    const binding = bindings[String(tabId)];
    if (!binding) return;
    const sessions = await readSessions();
    const existing = sessions[binding.sessionId];
    if (!existing) return;
    const session: ApplicationSession = {
      ...existing,
      status: "submitted",
      submittedAt: now(),
      submission,
      updatedAt: now(),
    };
    sessions[session.id] = session;
    for (const [boundTabId, candidate] of Object.entries(bindings)) {
      if (candidate.sessionId === session.id) delete bindings[boundTabId];
    }
    await writeStorage(APPLICATION_SESSIONS_KEY, sessions);
    await writeStorage(APPLICATION_TAB_BINDINGS_KEY, bindings);
    result = session;
  });
  return result;
}

export async function markApplicationSessionUnknown(
  tabId: number,
): Promise<ApplicationSession | null> {
  return updateApplicationSessionForTab(tabId, (session) => ({
    ...session,
    status: "submission_unknown",
    identityLocked: true,
  }));
}

async function updateApplicationSessionForTab(
  tabId: number,
  update: (session: ApplicationSession) => ApplicationSession,
): Promise<ApplicationSession | null> {
  let result: ApplicationSession | null = null;
  await serializeWrite(async () => {
    const bindings = await readBindings();
    const binding = bindings[String(tabId)];
    if (!binding) return;
    const sessions = await readSessions();
    const existing = sessions[binding.sessionId];
    if (!existing) return;
    const next = applicationSessionSchema.parse({
      ...update(existing),
      updatedAt: now(),
    });
    sessions[next.id] = next;
    await writeStorage(APPLICATION_SESSIONS_KEY, sessions);
    result = next;
  });
  return result;
}

export async function getApplicationSessionInspection(
  tabId: number,
  currentUrl?: string,
): Promise<PageInspection | null> {
  const session = await getApplicationSessionForTab(tabId);
  return session ? sessionInspection(session, currentUrl) : null;
}
