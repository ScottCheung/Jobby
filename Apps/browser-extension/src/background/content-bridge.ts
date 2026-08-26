import { bindTabJobInspection, getTabJobInspection } from "./job-binding-service";
import { z } from "zod";

import { pageInspectionSchema, type PageInspection } from "../shared/contracts/page-inspection";
import { formInspectionSchema, type FormInspection } from "../shared/contracts/form-inspection";
import { fieldFillResultSchema, formFocusResultSchema, type FieldFillInstruction, type FieldFillResult, type FileUploadInstruction, type FormFieldTarget, type FormFocusResult } from "../shared/contracts/form-actions";

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
const CONTENT_SCRIPT_STARTUP_RETRY_MS = 100;
const CONTENT_SCRIPT_STARTUP_ATTEMPTS = 30;

export function setTargetedTabId(tabId: number | undefined): void {
  targetedTabId = tabId;
}

export async function inspectActiveTab(): Promise<PageInspection> {
  const activeTab = await findActiveTab().catch(() => undefined);

  const rawResponse = await sendToActiveTab({ type: "content.inspect" });
  const parsed = contentResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new Error("The page returned an invalid inspection response.");
  if (!parsed.data.ok) throw new Error(parsed.data.error);

  const inspection = parsed.data.inspection;
  if (activeTab?.id && inspection.kind === "job") {
    bindTabJobInspection(activeTab.id, inspection);
    return inspection;
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

export async function inspectFormActiveTab(): Promise<FormInspection> {
  const activeTab = await findActiveTab();
  if (!activeTab?.id) throw new Error("No active browser tab detected. Please switch to the web page you want to fill.");
  if (!isSupportedUrl(activeTab.url)) throw new Error("Please switch to a supported web page before inspecting the form.");

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
    // The page-owned instance may expose an internal country code (AU/+61)
    // while the profile supplies the visible country name (Australia). Let
    // the content-world ARIA driver resolve that alias from the rendered
    // option instead of failing before it gets a chance to run.
    return null;
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
  const countryDialAliases: Record<string, string> = {
    australia: "+61", au: "+61", "+61": "+61", "61": "+61",
    "new zealand": "+64", nz: "+64", "+64": "+64", "64": "+64",
    "united kingdom": "+44", uk: "+44", gb: "+44", "+44": "+44", "44": "+44",
    "united states": "+1", usa: "+1", us: "+1", "+1": "+1", "1": "+1",
    canada: "+1", china: "+86", cn: "+86", "+86": "+86", india: "+91", in: "+91", "+91": "+91",
    singapore: "+65", sg: "+65", "+65": "+65", "hong kong": "+852", hk: "+852", "+852": "+852",
  };
  const countryAlias = (value: unknown): string => {
    const text = normalized(value).replace(/[()\-]/g, "").replace(/\s+/g, " ");
    return countryDialAliases[text] || text;
  };
  const element = document.getElementById(elementId);
  const isGreenhouseLoc = Boolean(
    element &&
    element instanceof HTMLInputElement &&
    (element.id === "job_application_location" ||
      element.id === "candidate_location" ||
      element.id === "location" ||
      element.id.includes("location_autocomplete") ||
      element.name === "job_application[location]" ||
      element.name === "candidate[location]" ||
      element.classList.contains("ui-autocomplete-input") ||
      document.getElementById("job_application_location_id") ||
      document.querySelector("input[name*='location_id']") ||
      document.querySelector("#grnhse_app, .job-post-container, form.application--form, form[action*='greenhouse.io']"))
  );
  if (!(element instanceof HTMLInputElement) || (element.getAttribute("role") !== "combobox" && !isGreenhouseLoc)) {
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

  const renderedCurrentValue = (): string => {
    const container = element.closest<HTMLElement>(".select-shell, [class*='select' i]");
    if (element.id === "country") {
      const flag = Array.from(container?.querySelector<HTMLElement>("[class*='iti__flag']")?.classList || [])
        .find((name) => /^iti__[a-z]{2}$/i.test(name));
      const code = flag?.slice("iti__".length).toUpperCase();
      if (code && typeof Intl.DisplayNames === "function") {
        return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || "";
      }
    }
    return clean(container?.querySelector<HTMLElement>(
      ".select__single-value, [class*='single-value' i], [class*='singleValue' i]",
    )?.textContent);
  };

  const matches = (actual: string, expected: string): boolean => {
    const left = normalized(actual);
    const right = normalized(expected);
    const leftAlias = countryAlias(actual);
    const rightAlias = countryAlias(expected);
    return Boolean(left && (left === right || leftAlias === rightAlias || (right.length > 1 && (left.includes(right) || right.includes(left)))));
  };

  const visible = (candidate: HTMLElement): boolean => {
    const style = window.getComputedStyle(candidate);
    const rect = candidate.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const renderedOption = (expected: string): HTMLElement | null => {
    const target = normalized(expected);
    const expectedFirstToken = target.split(/[,，\s]+/)[0] || target;
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      "[role='option'], [role='listbox'] button, [role='listbox'] li, [data-value], [data-option-value], [class*='option' i], [class*='item' i], [class*='suggestion' i], [class*='result' i], .ui-menu-item, .ui-menu-item-wrapper, .pac-item",
    )).filter((candidate) => visible(candidate) && candidate.getAttribute("aria-disabled") !== "true" && !(candidate instanceof HTMLInputElement) && !(candidate instanceof HTMLSelectElement));

    const matched = candidates.find((candidate) => {
      const candidateValue = normalized(
        candidate.getAttribute("data-value") ||
        candidate.getAttribute("data-option-value") ||
        candidate.getAttribute("aria-label") ||
        candidate.textContent,
      );
      return candidateValue === target ||
        countryAlias(candidateValue) === countryAlias(expected) ||
        (target.length > 1 && (candidateValue.includes(target) || target.includes(candidateValue))) ||
        (expectedFirstToken.length > 1 && candidateValue.includes(expectedFirstToken));
    });
    if (matched) return matched;
    return candidates[0] || null;
  };

  const waitForRenderedOption = (expected: string): Promise<HTMLElement | null> => new Promise((resolve) => {
    const startedAt = Date.now();
    const find = () => {
      const option = renderedOption(expected);
      if (option || Date.now() - startedAt >= 900) {
        resolve(option);
        return;
      }
      window.setTimeout(find, 40);
    };
    find();
  });

  const selectRenderedCombobox = async (): Promise<{ handled: boolean; status?: "filled" | "already_filled" | "rejected" }> => {
    if (matches(renderedCurrentValue(), requestedValue)) {
      return { handled: true, status: "already_filled" };
    }
    element.focus({ preventScroll: true });
    element.click();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(element, requestedValue);
    else element.value = requestedValue;
    const inputEventOpts = { bubbles: true, composed: true };
    try {
      element.dispatchEvent(new InputEvent("input", { ...inputEventOpts, inputType: "insertText", data: requestedValue }));
    } catch {
      element.dispatchEvent(new Event("input", inputEventOpts));
    }
    const char = requestedValue.slice(-1) || "a";
    element.dispatchEvent(new KeyboardEvent("keydown", { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", inputEventOpts));

    const option = await waitForRenderedOption(requestedValue);
    if (!option) return { handled: false };
    const eventOpts = { bubbles: true, cancelable: true, composed: true };
    option.dispatchEvent(new MouseEvent("mousedown", eventOpts));
    option.dispatchEvent(new MouseEvent("mouseup", eventOpts));
    option.click();

    const startedAt = Date.now();
    let enterSent = false;
    return new Promise((resolve) => {
      const verify = () => {
        const currentVal = renderedCurrentValue() || clean(element.value);
        const hasHiddenId = Boolean(
          (document.getElementById("job_application_location_id") as HTMLInputElement)?.value ||
          (document.querySelector("input[name*='location_id']") as HTMLInputElement)?.value
        );
        const expectedFirstToken = normalized(requestedValue).split(/[,，\s]+/)[0] || "";
        if (
          matches(currentVal, requestedValue) ||
          hasHiddenId ||
          (expectedFirstToken.length > 1 && currentVal.toLowerCase().includes(expectedFirstToken))
        ) {
          resolve({ handled: true, status: "filled" });
          return;
        }
        if (!enterSent && Date.now() - startedAt >= 120) {
          enterSent = true;
          const keyOptions = { key: "Enter", code: "Enter", bubbles: true, cancelable: true };
          element.dispatchEvent(new KeyboardEvent("keydown", keyOptions));
          element.dispatchEvent(new KeyboardEvent("keyup", keyOptions));
        }
        if (Date.now() - startedAt >= 900) {
          resolve({ handled: hasHiddenId || Boolean(element.value) });
          return;
        }
        window.setTimeout(verify, 40);
      };
      verify();
    });
  };

  const instance = findInstance();
  if (!instance) return selectRenderedCombobox();
  const options = optionsFor(instance);
  const requested = normalized(requestedValue);
  const requestedFirstToken = requested.split(/[,，\s]+/)[0] || requested;
  const option = options.find((candidate) => {
    const label = normalized(candidate.label);
    const value = normalized(String(candidate.value));
    return label === requested ||
      countryAlias(label) === countryAlias(requestedValue) ||
      countryAlias(value) === countryAlias(requestedValue) ||
      value === requested ||
      (requested.length > 1 && (label.includes(requested) || requested.includes(label))) ||
      (requested.length > 1 && (value.includes(requested) || requested.includes(value))) ||
      (requestedFirstToken.length > 1 && (label.includes(requestedFirstToken) || value.includes(requestedFirstToken)));
  }) || (options.length > 0 ? options[0] : undefined);
  if (!option) return selectRenderedCombobox();
  if (normalized(currentValue(instance, options)) === normalized(option.label)) {
    return Promise.resolve({ handled: true, status: "already_filled" });
  }

  instance.selectOption?.(option);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const updated = findInstance();
      const selected = updated ? currentValue(updated, optionsFor(updated)) : "";
      resolve({
        handled: normalized(selected) === normalized(option.label),
        status: normalized(selected) === normalized(option.label) ? "filled" : undefined,
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

export async function highlightJobRequirementInActiveTab(
  searchTerms: string[],
): Promise<{ highlighted: boolean; matchCount: number; currentIndex: number }> {
  const rawResponse = await sendToActiveTab({
    type: 'content.highlight-job-requirement',
    searchTerms,
  });
  const parsed = highlightResponseSchema.safeParse(rawResponse);
  if (!parsed.success)
    throw new Error('The page returned an invalid job requirement response.');
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
      ? `Content script failed to finish loading: ${detail}`
      : "Content script failed to finish loading. Please try again later.",
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
