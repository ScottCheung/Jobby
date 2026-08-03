import { z } from "zod";

import { pageInspectionSchema, type PageInspection } from "../shared/contracts/page-inspection";
import { formInspectionSchema, type FormInspection } from "../shared/contracts/form-inspection";
import { fieldFillResultSchema, formFocusResultSchema, type FieldFillInstruction, type FieldFillResult, type FileUploadInstruction, type FormFieldTarget, type FormFocusResult } from "../shared/contracts/form-actions";
import {
  linkedinApplicationActionSchema,
  linkedinApplicationResultSchema,
  type LinkedInApplicationAction,
  type LinkedInApplicationResult,
} from "../shared/contracts/linkedin";

const contentResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), inspection: pageInspectionSchema }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

const fillResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), fillResult: fieldFillResultSchema }),
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

const linkedinApplicationResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), application: linkedinApplicationResultSchema }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

let targetedTabId: number | undefined;
const activeFormFrameByTab = new Map<number, number>();
const CONTENT_SCRIPT_STARTUP_RETRY_MS = 100;
const CONTENT_SCRIPT_STARTUP_ATTEMPTS = 30;

export function setTargetedTabId(tabId: number | undefined): void {
  targetedTabId = tabId;
}

export async function inspectActiveTab(): Promise<PageInspection> {
  const rawResponse = await sendToActiveTab({ type: "content.inspect" });
  const parsed = contentResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid inspection response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.inspection;
}

export async function inspectFormActiveTab(): Promise<FormInspection> {
  const activeTab = await findActiveTab();
  if (!activeTab?.id) throw new Error("未检测到可用的浏览器标签页。请先打开并切换至需要填写的网页。");
  if (!isSupportedUrl(activeTab.url)) throw new Error("请先切换至支持的网页后再检测表单。");

  const rootForm = parseFormResponse(await sendToTab(activeTab.id, { type: "content.inspect-form" }));
  const candidates: Array<{ form: FormInspection; frameId: number }> = [{ form: rootForm, frameId: 0 }];

  // LinkedIn's Easy Apply modal always lives in the top document. Its pages
  // also embed auxiliary frames, some of which contain unrelated forms; do
  // not let a field-count comparison replace the real modal with one of them.
  if (isLinkedInUrl(activeTab.url)) {
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
      const form = parseFormResponse(
        await sendToTab(activeTab.id, { type: "content.inspect-form" }, frame.frameId),
      );
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
 * LinkedIn commonly contains auxiliary iframes whose unrelated mutations
 * otherwise replace the active Easy Apply form snapshot.
 */
export function acceptsFormChange(tabId: number, frameId: number): boolean {
  const selectedFrameId = activeFormFrameByTab.get(tabId);
  return selectedFrameId === undefined ? frameId === 0 : selectedFrameId === frameId;
}

export async function fillActiveTabField(instruction: FieldFillInstruction): Promise<FieldFillResult> {
  const mainWorldResult = await selectGreenhouseCombobox(
    instruction.target,
    instruction.value,
    instruction.commandId,
  );
  if (mainWorldResult) return mainWorldResult;

  const rawResponse = await sendToActiveTab(instruction, instruction.target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid field fill response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
}

export async function editActiveTabField(target: FormFieldTarget, value: string | boolean): Promise<FieldFillResult> {
  const mainWorldResult = await selectGreenhouseCombobox(
    target,
    value,
    `panel-${Date.now()}-${target.key}`,
  );
  if (mainWorldResult) return mainWorldResult;

  const rawResponse = await sendToActiveTab({ type: "content.edit-form-field", target, value }, target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid form edit response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
}

async function selectGreenhouseCombobox(
  target: FormFieldTarget,
  value: string | boolean,
  commandId: string,
): Promise<FieldFillResult | null> {
  if (target.type !== "select" || typeof value !== "string" || !target.id) return null;

  const activeTab = await findActiveTab();
  if (!activeTab?.id || !isSupportedUrl(activeTab.url)) return null;

  try {
    const executions = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, frameIds: [target.frameId ?? 0] },
      world: "MAIN",
      func: selectGreenhouseComboboxInPage,
      args: [target.id, value],
    });
    const selection = executions[0]?.result;
    if (!selection?.handled) return null;

    if (selection.status === "filled" || selection.status === "already_filled") {
      return {
        commandId,
        key: target.key,
        status: selection.status,
        message: selection.status === "filled" ? "Greenhouse dropdown value updated." : "Dropdown already has the requested value.",
      };
    }
    return {
      commandId,
      key: target.key,
      status: "rejected",
      message: "The webpage did not confirm this dropdown selection.",
    };
  } catch {
    // Only Greenhouse-style React Select controls take this path. Keep the
    // existing content-script driver as the fallback for every other site.
    return null;
  }
}

function selectGreenhouseComboboxInPage(
  elementId: string,
  requestedValue: string,
): Promise<{ handled: boolean; status?: "filled" | "already_filled" | "rejected" }> {
  type Option = { label: string; value: string | number };
  type SelectInstance = {
    props?: { options?: unknown; value?: unknown };
    selectOption?: (option: unknown) => void;
  };
  type Fiber = { return?: Fiber | null; stateNode?: unknown };

  const clean = (value: unknown) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const normalized = (value: unknown) => clean(value).toLowerCase();
  const element = document.getElementById(elementId);
  if (!(element instanceof HTMLInputElement) || element.getAttribute("role") !== "combobox") {
    return Promise.resolve({ handled: false });
  }

  const findInstance = (): SelectInstance | null => {
    const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
    let fiber = key ? (element as unknown as Record<string, unknown>)[key] as Fiber : null;
    for (let depth = 0; fiber && depth < 32; depth += 1) {
      const instance = fiber.stateNode as SelectInstance | undefined;
      if (instance && typeof instance.selectOption === "function" && Array.isArray(instance.props?.options)) {
        return instance;
      }
      fiber = fiber.return || null;
    }
    return null;
  };

  const optionsFor = (instance: SelectInstance): Option[] => {
    if (!Array.isArray(instance.props?.options)) return [];
    return instance.props.options
      .map((option) => option as Partial<Option>)
      .filter((option): option is Option => Boolean(clean(option.label)) && option.value !== undefined)
      .map((option) => ({ label: clean(option.label), value: option.value }));
  };

  const currentValue = (instance: SelectInstance, options: Option[]): string => {
    const selected = (Array.isArray(instance.props?.value) ? instance.props.value[0] : instance.props?.value) as Partial<Option> | undefined;
    if (!selected || selected.value === undefined) return "";
    return options.find((option) => String(option.value) === String(selected.value))?.label || clean(selected.label);
  };

  const instance = findInstance();
  if (!instance) return Promise.resolve({ handled: false });
  const options = optionsFor(instance);
  const requested = normalized(requestedValue);
  const option = options.find((candidate) => {
    const label = normalized(candidate.label);
    const value = normalized(String(candidate.value));
    return label === requested ||
      value === requested ||
      (requested.length > 1 && (label.includes(requested) || requested.includes(label))) ||
      (requested.length > 1 && (value.includes(requested) || requested.includes(value)));
  });
  if (!option) return Promise.resolve({ handled: true, status: "rejected" });
  if (normalized(currentValue(instance, options)) === normalized(option.label)) {
    return Promise.resolve({ handled: true, status: "already_filled" });
  }

  instance.selectOption?.(option);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const updated = findInstance();
      const selected = updated ? currentValue(updated, optionsFor(updated)) : "";
      resolve({
        handled: true,
        status: normalized(selected) === normalized(option.label) ? "filled" : "rejected",
      });
    }, 0);
  });
}

export async function focusActiveTabField(target: FormFieldTarget): Promise<FormFocusResult> {
  const rawResponse = await sendToActiveTab({ type: "content.focus-form-field", target }, target.frameId);
  const parsed = focusResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid form focus response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.focusResult;
}

export async function uploadActiveTabFile(instruction: FileUploadInstruction): Promise<FieldFillResult> {
  const rawResponse = await sendToActiveTab(instruction, instruction.target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid file upload response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
}

export async function openLinkedInApplicationActiveTab(): Promise<LinkedInApplicationResult> {
  const rawResponse = await sendToActiveTab({ type: "content.linkedin.open-application" });
  const parsed = linkedinApplicationResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid LinkedIn application response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.application;
}

export async function clickLinkedInApplicationAction(
  action: LinkedInApplicationAction,
): Promise<LinkedInApplicationResult> {
  const parsedAction = linkedinApplicationActionSchema.parse(action);
  const rawResponse = await sendToActiveTab({
    type: "content.linkedin.application-action",
    action: parsedAction,
  });
  const parsed = linkedinApplicationResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid LinkedIn application response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.application;
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

function isLinkedInUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

async function findActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  if (targetedTabId !== undefined) {
    const targetedTab = await chrome.tabs.get(targetedTabId).catch(() => undefined);
    if (targetedTab && isSupportedUrl(targetedTab.url)) return targetedTab;
    targetedTabId = undefined;
  }

  const currentWindowTabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (currentWindowTabs[0] && isSupportedUrl(currentWindowTabs[0].url)) {
    return currentWindowTabs[0];
  }

  const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  if (lastFocusedTabs[0] && isSupportedUrl(lastFocusedTabs[0].url)) {
    return lastFocusedTabs[0];
  }

  const allTabs = await chrome.tabs.query({}).catch(() => []);
  const activeSupported = allTabs.find((t) => t.active && isSupportedUrl(t.url));
  if (activeSupported) return activeSupported;

  const anySupported = allTabs.find((t) => isSupportedUrl(t.url));
  if (anySupported) return anySupported;

  return currentWindowTabs[0] || lastFocusedTabs[0];
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
  if (!activeTab?.id) throw new Error("未检测到可用的浏览器标签页。请先打开并切换至需要填写的网页。");

  if (!isSupportedUrl(activeTab.url)) {
    throw new Error("请先切换至支持的网页后再检测表单。");
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
      return await chrome.tabs.sendMessage(tabId, message, { frameId: targetFrameId });
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
  throw new Error(
    detail
      ? `网页插件脚本未能完成加载：${detail}`
      : "网页插件脚本未能完成加载。请稍后重试。",
  );
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
  const files = (chrome.runtime.getManifest().content_scripts || [])
    .flatMap((entry) => entry.js || [])
    .filter((file): file is string => Boolean(file));
  if (!files.length) throw new Error("The extension content script is not configured.");
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files });
}
