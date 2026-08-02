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
const initializedContentTabs = new Set<number>();
const activeFormFrameByTab = new Map<number, number>();

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

  await ensureContentScript(activeTab.id);
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
  const rawResponse = await sendToActiveTab(instruction, instruction.target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid field fill response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
}

export async function editActiveTabField(target: FormFieldTarget, value: string | boolean): Promise<FieldFillResult> {
  const rawResponse = await sendToActiveTab({ type: "content.edit-form-field", target, value }, target.frameId);
  const parsed = fillResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid form edit response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);
  return parsed.data.fillResult;
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

  await ensureContentScript(activeTab.id);
  return sendToTab(activeTab.id, message, frameId);
}

async function ensureContentScript(tabId: number): Promise<void> {
  // Initialize each tab once per service-worker lifetime. This keeps the
  // current content-script version after an extension update without paying
  // the injection cost for every button click.
  if (!initializedContentTabs.has(tabId)) {
    await injectContentScript(tabId).catch(() => undefined);
    initializedContentTabs.add(tabId);
  }
}

async function sendToTab(tabId: number, message: unknown, frameId?: number): Promise<unknown> {
  // A freshly injected standalone bundle may need a short moment to register
  // its listener. Retry quickly instead of adding a fixed delay to every call.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      // With all_frames enabled, omitting frameId broadcasts the request and
      // Chrome can resolve it with an auxiliary iframe's response. All
      // top-level page actions must explicitly target frame 0.
      return await chrome.tabs.sendMessage(tabId, message, { frameId: frameId ?? 0 });
    } catch {
      if (attempt === 0) {
        await injectContentScript(tabId).catch(() => undefined);
      }
      if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error("与网页中插件脚本通讯中断，请手动刷新当前网页 (F5 / Cmd+R) 后再次尝试。");
}

async function injectContentScript(tabId: number): Promise<void> {
  const files = (chrome.runtime.getManifest().content_scripts || [])
    .flatMap((entry) => entry.js || [])
    .filter((file): file is string => Boolean(file));
  if (!files.length) throw new Error("The extension content script is not configured.");
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files });
}
