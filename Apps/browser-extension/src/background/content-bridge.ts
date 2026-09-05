import { bindTabJobInspection, getTabJobInspection } from "./job-binding-service";
import { cacheProviderJobInspection, getCachedProviderJobInspection } from "./session-store";
import { z } from "zod";

import { pageInspectionSchema, type PageInspection } from "../shared/contracts/page-inspection";
import { formInspectionSchema, type FormInspection } from "../shared/contracts/form-inspection";
import { fieldFillResultSchema, formFocusResultSchema, type FieldFillInstruction, type FieldFillResult, type FileUploadInstruction, type FormFieldTarget, type FormFocusResult } from "../shared/contracts/form-actions";
import type { MasterResumeData } from "../shared/contracts/tailored-resume";
import { isAtsJobConfig } from "../content/platforms/platform-definition";
import { findProviderDefinitionForUrl } from "../content/platforms/registry";

const contentResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), inspection: pageInspectionSchema }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

const fillResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), fillResult: fieldFillResultSchema }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

const fillResultsResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), fillResults: z.array(fieldFillResultSchema) }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

const focusResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), focusResult: formFocusResultSchema }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

const formResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), form: formInspectionSchema }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

const highlightResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    highlighted: z.boolean(),
    matchCount: z.number().optional(),
    currentIndex: z.number().optional(),
  }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

let targetedTabId: number | undefined;
const activeFormFrameByTab = new Map<number, number>();
const inFlightJobInspections = new Map<string, Promise<PageInspection>>();
const CONTENT_SCRIPT_STARTUP_RETRY_MS = 100;
const CONTENT_SCRIPT_STARTUP_ATTEMPTS = 30;

export function setTargetedTabId(tabId: number | undefined): void {
  targetedTabId = tabId;
}

export async function inspectActiveTab(
  targetTabId?: number,
): Promise<PageInspection> {
  const activeTab = await findActiveTab(targetTabId).catch(() => undefined);
  if (!activeTab?.id) {
    throw new Error("No active browser tab detected. Please switch to the web page you want to inspect.");
  }

  if (!isSupportedUrl(activeTab.url)) {
    return {
      kind: "unsupported_page",
      url: activeTab.url || "",
      reason: "This browser page cannot be inspected.",
    };
  }

  const activeUrl = activeTab.url || "";
  const provider = findProviderDefinitionForUrl(activeUrl);
  const jobInspection = provider?.background?.jobInspection;
  const activePageUrl = new URL(activeUrl);
  const isApplicationPage = Boolean(jobInspection?.isApplicationUrl?.(activePageUrl));
  const externalId = provider && isAtsJobConfig(provider.job)
    ? provider.job.idFromUrl(activePageUrl)
    : "";
  if (provider && jobInspection?.cacheInspection && externalId) {
    const cachedInspection = await getCachedProviderJobInspection(provider.platform, externalId);
    if (cachedInspection) {
      const resolvedInspection: PageInspection = {
        kind: "job",
        snapshot: {
          ...cachedInspection.snapshot,
          url: activeUrl,
        },
      };
      bindTabJobInspection(activeTab.id, resolvedInspection);
      return resolvedInspection;
    }
  }

  const rawResponse = await sendToTab(activeTab.id, { type: "content.inspect" });
  const parsed = contentResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid inspection response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);

  const inspection = parsed.data.inspection;
  const resolvedActiveUrl = activeUrl || (inspection.kind === "job" ? inspection.snapshot.url : inspection.url);

  if (
    activeTab.id &&
    inspection.kind !== "job" &&
    jobInspection?.inspectDetailsFromApplication &&
    isApplicationPage
  ) {
    const boundInspection = getTabJobInspection(activeTab.id, resolvedActiveUrl);
    if (boundInspection) return boundInspection;

    const detailInspection = await inspectJobUrl(resolvedActiveUrl).catch(() => undefined);
    if (detailInspection?.kind === "job") {
      const resolvedInspection: PageInspection = {
        kind: "job",
        snapshot: {
          ...detailInspection.snapshot,
          url: resolvedActiveUrl,
        },
      };
      if (jobInspection.cacheInspection) await cacheProviderJobInspection(resolvedInspection);
      bindTabJobInspection(activeTab.id, resolvedInspection);
      return resolvedInspection;
    }
  }

  if (activeTab?.id && inspection.kind === "job") {
    const boundInspection = getTabJobInspection(activeTab.id, resolvedActiveUrl);
    if (
      boundInspection?.kind === "job" &&
      boundInspection.snapshot.platform === inspection.snapshot.platform &&
      boundInspection.snapshot.externalId === inspection.snapshot.externalId
    ) {
      return boundInspection;
    }

    let resolvedInspection = inspection;
    const shouldReadDetailPage =
      !inspection.snapshot.description?.trim() &&
      jobInspection?.inspectDetailsFromApplication &&
      isApplicationPage;

    if (shouldReadDetailPage) {
      const detailInspection = await inspectJobUrl(resolvedActiveUrl).catch(() => undefined);
      if (
        detailInspection?.kind === "job" &&
        detailInspection.snapshot.externalId === inspection.snapshot.externalId
      ) {
        resolvedInspection = {
          kind: "job",
          snapshot: {
            ...detailInspection.snapshot,
            ...inspection.snapshot,
            url: resolvedActiveUrl,
            location:
              inspection.snapshot.location || detailInspection.snapshot.location,
            firstPostedAt:
              inspection.snapshot.firstPostedAt ||
              detailInspection.snapshot.firstPostedAt,
            lastPostedAt:
              inspection.snapshot.lastPostedAt ||
              detailInspection.snapshot.lastPostedAt,
            postingObservedAt:
              inspection.snapshot.postingObservedAt ||
              detailInspection.snapshot.postingObservedAt,
            isReposted:
              inspection.snapshot.isReposted ??
              detailInspection.snapshot.isReposted,
            postingDateRaw:
              inspection.snapshot.postingDateRaw ||
              detailInspection.snapshot.postingDateRaw,
            description: detailInspection.snapshot.description,
            technologies: Array.from(
              new Set([
                ...detailInspection.snapshot.technologies,
                ...inspection.snapshot.technologies,
              ]),
            ),
          },
        };
      }
    }

    if (jobInspection?.cacheInspection) await cacheProviderJobInspection(resolvedInspection);
    bindTabJobInspection(activeTab.id, resolvedInspection);
    return resolvedInspection;
  }

  // If the active page does not identify a job directly (e.g. an external ATS
  // child tab opened from a job posting), check if this tab inherited a job binding.
  if (activeTab?.id) {
    const inherited = getTabJobInspection(activeTab.id, activeTab.url);
    if (inherited) {
      return inherited;
    }
  }

  return inspection;
}

export function jobInspectionUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  return findProviderDefinitionForUrl(rawUrl)?.background?.jobInspection
    ?.canonicalizeUrl?.(url) || url.toString();
}

export async function inspectJobUrl(
  rawUrl: string,
  restoreTabId?: number,
): Promise<PageInspection> {
  const inspectionUrl = jobInspectionUrl(rawUrl);
  const inFlight = inFlightJobInspections.get(inspectionUrl);
  if (inFlight) return inFlight;

  const inspection = inspectJobUrlOnce(inspectionUrl, restoreTabId);
  inFlightJobInspections.set(inspectionUrl, inspection);
  try {
    return await inspection;
  } finally {
    inFlightJobInspections.delete(inspectionUrl);
  }
}

async function inspectJobUrlOnce(
  inspectionUrl: string,
  restoreTabId?: number,
): Promise<PageInspection> {
  const existingTab = await findOpenJobTab(inspectionUrl);
  if (existingTab?.id !== undefined) {
    await waitForTabLoad(existingTab.id);
    return inspectTabForJob(existingTab.id);
  }

  const restoreTab =
    restoreTabId !== undefined
      ? await chrome.tabs.get(restoreTabId).catch(() => undefined)
      : chrome.tabs.query
        ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []))?.[0]
        : undefined;
  const tab = await chrome.tabs.create({ url: inspectionUrl, active: false });
  if (tab.id === undefined) {
    throw new Error("Could not open the job page for inspection.");
  }

  try {
    const requiresForegroundTab = Boolean(
      findProviderDefinitionForUrl(inspectionUrl)?.background?.jobInspection
        ?.requiresForegroundTab,
    );
    if (requiresForegroundTab && chrome.tabs.update) {
      await chrome.tabs.update(tab.id, { active: true });
    }
    if (requiresForegroundTab && tab.windowId !== undefined && chrome.windows?.update) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    await waitForTabLoad(tab.id);
    return inspectTabForJob(tab.id);
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
    if (restoreTab?.id !== undefined) {
      if (chrome.tabs.update) {
        await chrome.tabs.update(restoreTab.id, { active: true }).catch(() => undefined);
      }
      if (restoreTab.windowId !== undefined && chrome.windows?.update) {
        await chrome.windows.update(restoreTab.windowId, { focused: true }).catch(() => undefined);
      }
    }
  }
}

async function findOpenJobTab(inspectionUrl: string): Promise<chrome.tabs.Tab | undefined> {
  if (!chrome.tabs.query) return undefined;
  const tabs = await chrome.tabs.query({}).catch(() => []);
  return tabs.find((tab) => {
    if (tab.id === undefined || !isSupportedUrl(tab.url)) return false;
    try {
      return jobInspectionUrl(tab.url || "") === inspectionUrl;
    } catch {
      return false;
    }
  });
}

async function waitForTabLoad(tabId: number): Promise<void> {
  const current = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!current) throw new Error("The job page closed before it could be inspected.");
  if (current.status === "complete") return;

  const completed = chrome.webNavigation?.onCompleted;
  const failed = chrome.webNavigation?.onErrorOccurred;
  if (!completed?.addListener) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const tab = await chrome.tabs.get(tabId).catch(() => undefined);
      if (!tab) throw new Error("The job page closed before it could be inspected.");
      if (tab.status === "complete") return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    // Some SPA pages keep the top-level document in a loading state while
    // their job data is already readable. Do not make inspection wait for the
    // browser's load event indefinitely; inspectTabForJob has its own
    // readiness retries.
    const timeoutId = setTimeout(() => finish(), 8_000);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      completed.removeListener(onCompleted);
      failed?.removeListener(onError);
      if (error) reject(error);
      else resolve();
    };
    const onCompleted = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (details.tabId === tabId && details.frameId === 0) finish();
    };
    const onError = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (details.tabId === tabId && details.frameId === 0) {
        finish(new Error("The job page failed to load."));
      }
    };
    completed.addListener(onCompleted);
    failed?.addListener(onError);
    void chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch(() => finish(new Error("The job page closed before it could be inspected.")));
  });
}

async function inspectTabForJob(tabId: number): Promise<PageInspection> {
  let lastInspection: PageInspection | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    lastInspection = await settleWithin(inspectActiveTab(tabId), 6_000);
    if (lastInspection?.kind === "job" && lastInspection.snapshot.description?.trim()) {
      return lastInspection;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    lastInspection?.kind === "job"
      ? "The job description did not become available."
      : lastInspection?.kind === "unsupported_page" || lastInspection?.kind === "not_job_page"
        ? lastInspection.reason
        : "The job details did not become available.",
  );
}

function settleWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(undefined), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      () => {
        clearTimeout(timeoutId);
        resolve(undefined);
      },
    );
  });
}

export async function inspectFormActiveTab(): Promise<FormInspection> {
  const activeTab = await findActiveTab();
  if (!activeTab?.id) throw new Error("No active browser tab detected. Please switch to the web page you want to fill.");
  if (!isSupportedUrl(activeTab.url)) throw new Error("Please switch to a supported web page before inspecting the form.");

  const rootForm = parseFormResponse(await sendToTab(activeTab.id, { type: "content.inspect-form" }));
  const candidates: Array<{ form: FormInspection; frameId: number }> = [{ form: rootForm, frameId: 0 }];

  if (findProviderDefinitionForUrl(activeTab.url)?.background?.keepFormInRootFrame) {
    activeFormFrameByTab.set(activeTab.id, 0);
    return rootForm;
  }

  // Some employers open their ATS inside a cross-origin iframe. The parent
  // document cannot read that DOM, so inspect child frames explicitly and keep
  // the winning frame ID with every field for later focus/edit/upload actions.
  const frames = (await chrome.webNavigation.getAllFrames({ tabId: activeTab.id }).catch(() => [])) || [];
  for (const frame of frames) {
    if (frame.frameId === 0 || !isSupportedUrl(frame.url)) continue;
    try {
      const form = parseFormResponse(await sendToTab(activeTab.id, { type: "content.inspect-form" }, frame.frameId));
      candidates.push({ form, frameId: frame.frameId });
    } catch {
      // Sandboxed or browser-owned frames are expected to reject extension
      // messages. Other frames can still contain the actual application form.
    }
  }

  const best = candidates
    .map(({ form, frameId }) => ({
      form: formWithFrameId(form, frameId),
      frameId,
      score: formScore(form),
    }))
    .sort((left, right) => right.score - left.score)[0];
  if (best) activeFormFrameByTab.set(activeTab.id, best.frameId);
  return best?.form || rootForm;
}

/**
 * Only the frame selected by the last inspection may update the side panel.
 */
export function acceptsFormChange(tabId: number, frameId: number): boolean {
  const selectedFrameId = activeFormFrameByTab.get(tabId);
  return selectedFrameId === undefined ? frameId === 0 : selectedFrameId === frameId;
}

export async function fillActiveTabField(instruction: FieldFillInstruction): Promise<FieldFillResult> {
  const providerResult = await selectProviderCombobox(
    instruction.target,
    instruction.value,
    instruction.commandId,
  );
  if (providerResult) return providerResult;

  const rawResponse = await sendToActiveTab(instruction, instruction.target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid field fill response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
}

export async function autofillStructuredActiveTab(resume: MasterResumeData, runId: string, skills: string[] = []): Promise<FieldFillResult[]> {
  const rawResponse = await sendToActiveTab({
    type: "content.autofill-structured",
    runId,
    resume,
    skills,
  });
  const parsed = fillResultsResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned invalid structured autofill results.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResults;
}

export async function cancelStructuredActiveTab(runId: string): Promise<void> {
  await sendToActiveTab({ type: "content.cancel-structured", runId });
}

export async function editActiveTabField(target: FormFieldTarget, value: FieldFillInstruction["value"]): Promise<FieldFillResult> {
  const providerResult = await selectProviderCombobox(target, value, `panel-${Date.now()}-${target.key}`);
  if (providerResult) return providerResult;

  const rawResponse = await sendToActiveTab({ type: "content.edit-form-field", target, value }, target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid form edit response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
}

async function selectProviderCombobox(
  target: FormFieldTarget,
  value: FieldFillInstruction["value"],
  commandId: string,
): Promise<FieldFillResult | null> {
  const activeTab = await findActiveTab();
  if (!activeTab?.id || !isSupportedUrl(activeTab.url)) return null;
  const selectCombobox = findProviderDefinitionForUrl(activeTab.url)?.driver?.selectCombobox;
  return selectCombobox?.(target, value, commandId, { tabId: activeTab.id }) || null;
}


export async function focusActiveTabField(target: FormFieldTarget): Promise<FormFocusResult> {
  const rawResponse = await sendToActiveTab({ type: "content.focus-form-field", target }, target.frameId);
  const parsed = focusResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid form focus response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.focusResult;
}

export async function highlightJobRequirementInActiveTab(searchTerms: string[]): Promise<{ highlighted: boolean; matchCount: number; currentIndex: number }> {
  const rawResponse = await sendToActiveTab({
    type: "content.highlight-job-requirement",
    searchTerms,
  });
  const parsed = highlightResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid job requirement response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return {
    highlighted: parsed.data.highlighted,
    matchCount: parsed.data.matchCount ?? (parsed.data.highlighted ? 1 : 0),
    currentIndex: parsed.data.currentIndex ?? (parsed.data.highlighted ? 1 : 0),
  };
}

export async function uploadActiveTabFile(instruction: FileUploadInstruction): Promise<FieldFillResult> {
  const rawResponse = await sendToActiveTab(instruction, instruction.target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid file upload response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
}

function isSupportedUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function findActiveTab(preferredTabId?: number): Promise<chrome.tabs.Tab | undefined> {
  const requestedTabId = preferredTabId ?? targetedTabId;
  if (requestedTabId !== undefined) {
    const targetedTab = await chrome.tabs.get(requestedTabId).catch(() => undefined);
    if (targetedTab) return targetedTab;
    if (preferredTabId === undefined) targetedTabId = undefined;
  }

  const currentWindowTabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (currentWindowTabs[0]) {
    return currentWindowTabs[0];
  }

  const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  if (lastFocusedTabs[0]) {
    return lastFocusedTabs[0];
  }

  const allTabs = await chrome.tabs.query({ active: true }).catch(() => []);
  if (allTabs[0]) return allTabs[0];

  return undefined;
}

function parseFormResponse(rawResponse: unknown): FormInspection {
  const parsed = formResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid form inspection response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.form;
}

function formScore(form: FormInspection): number {
  if (form.kind === "application_form") return 10_000 + form.fields.length;
  if (form.kind === "page_input_fields") return 1_000 + form.fields.length;
  return 0;
}

function formWithFrameId(form: FormInspection, frameId: number): FormInspection {
  if (form.kind !== "application_form" && form.kind !== "page_input_fields") return form;
  return {
    ...form,
    fields: form.fields.map((field) => ({
      ...field,
      ...(frameId !== 0 ? { frameId } : {}),
    })),
  };
}

async function sendToActiveTab(message: unknown, frameId?: number): Promise<unknown> {
  const activeTab = await findActiveTab();
  if (!activeTab?.id) throw new Error("No active browser tab detected. Please switch to the web page you want to fill.");

  if (!isSupportedUrl(activeTab.url)) {
    throw new Error("Please switch to a supported web page before inspecting the form.");
  }

  return sendToTab(activeTab.id, message, frameId);
}

async function sendToTab(tabId: number, message: unknown, frameId?: number): Promise<unknown> {
  const targetFrameId = frameId ?? 0;
  let injectedFallback = false;
  let lastError: unknown;

  // Development content scripts load Vite's HMR client before registering the
  // message listener. Send to an existing listener first; only inject when
  // Chrome confirms there is no receiver, then give that loader time to start.
  for (let attempt = 0; attempt < CONTENT_SCRIPT_STARTUP_ATTEMPTS; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message, {
        frameId: targetFrameId,
      });
    } catch (error) {
      lastError = error;
      if (!isRecoverableContentScriptError(error)) throw error;

      if (!injectedFallback && isMissingContentScriptReceiver(error)) {
        await injectContentScript(tabId, targetFrameId).catch((injectionError: unknown) => {
          lastError = injectionError;
        });
        injectedFallback = true;
      }
      if (attempt < CONTENT_SCRIPT_STARTUP_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, CONTENT_SCRIPT_STARTUP_RETRY_MS));
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "";
  throw new Error(detail ? `Content script failed to finish loading: ${detail}` : "Content script failed to finish loading. Please try again later.");
}

function isMissingContentScriptReceiver(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Receiving end does not exist|Could not establish connection/i.test(message);
}

function isRecoverableContentScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return isMissingContentScriptReceiver(error) || /message port closed/i.test(message);
}

async function injectContentScript(tabId: number, frameId: number): Promise<void> {
  const files = (chrome.runtime.getManifest().content_scripts || []).flatMap((entry) => entry.js || []).filter((file): file is string => Boolean(file));
  if (!files.length) throw new Error("The extension content script is not configured.");
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    files,
  });
}
