import type { FormFieldObservation, FormInspection } from "../shared/contracts/form-inspection";
import type { FormScope } from "./dom/form-inspector";

import { linkedinAdapter } from "./platforms/linkedin/adapter";
import { getCurrentFormScope } from "./page-reader";

declare global {
  interface Window {
    __jobbyFormObserverCleanup?: () => void;
    __jobbyFormDiscoveryCleanup?: () => void;
  }
}

const DISCOVERY_SELECTOR = [
  "form",
  "dialog",
  "[role='dialog']",
  "[aria-modal='true']",
  "[data-modal]",
  "[data-testid*='modal' i]",
  "button[data-live-test-easy-apply-next-button]",
  "button[aria-label*='Continue']",
  "button[aria-label*='Next']",
  "input:not([type='hidden'])",
  "select",
  "textarea",
].join(", ");

const FORM_RELEVANT_SELECTOR = [
  "form",
  "fieldset",
  "label",
  "input",
  "select",
  "textarea",
  "button",
  "[role='button']",
  "[role='combobox']",
  "[role='dialog']",
  "[aria-modal='true']",
].join(", ");

const FORM_OBSERVER_DEBOUNCE_MS = 150;
const FORM_SETTLE_MS = 300;
const FORM_STABILITY_RECHECK_MS = 120;

type ObservableFormInspection = Extract<
  FormInspection,
  { kind: "application_form" | "page_input_fields" }
>;

const FORM_ACTION_NOTICE_ID = "__jobby_form_action_notice";

const THEME_PRIMARY_MAP: Record<
  string,
  { primary: string; primaryFg: string; gradientStop: string }
> = {
  green: {
    primary: "oklch(0.45 0.15 160)",
    primaryFg: "#ffffff",
    gradientStop: "oklch(0.38 0.13 160)",
  },
  "green-dark": {
    primary: "oklch(0.8 0.15 160)",
    primaryFg: "oklch(0.2 0.05 160)",
    gradientStop: "oklch(0.7 0.14 160)",
  },
  blue: {
    primary: "oklch(0.4 0.15 250)",
    primaryFg: "#ffffff",
    gradientStop: "oklch(0.33 0.13 250)",
  },
  "blue-dark": {
    primary: "oklch(0.75 0.14 250)",
    primaryFg: "oklch(0.2 0.05 250)",
    gradientStop: "oklch(0.65 0.13 250)",
  },
  purple: {
    primary: "oklch(0.45 0.2 300)",
    primaryFg: "#ffffff",
    gradientStop: "oklch(0.38 0.18 300)",
  },
  "purple-dark": {
    primary: "oklch(0.75 0.16 300)",
    primaryFg: "oklch(0.2 0.05 300)",
    gradientStop: "oklch(0.65 0.15 300)",
  },
  orange: {
    primary: "oklch(0.55 0.18 40)",
    primaryFg: "#ffffff",
    gradientStop: "oklch(0.48 0.16 40)",
  },
  "orange-dark": {
    primary: "oklch(0.78 0.14 40)",
    primaryFg: "oklch(0.25 0.05 40)",
    gradientStop: "oklch(0.68 0.13 40)",
  },
  rose: {
    primary: "oklch(0.5 0.2 20)",
    primaryFg: "#ffffff",
    gradientStop: "oklch(0.43 0.18 20)",
  },
  "rose-dark": {
    primary: "oklch(0.76 0.15 20)",
    primaryFg: "oklch(0.25 0.05 20)",
    gradientStop: "oklch(0.66 0.14 20)",
  },
};

async function getNoticeTheme(): Promise<{
  isDark: boolean;
  primary: string;
  primaryFg: string;
  gradientStop: string;
}> {
  let color = "green";
  let mode = "system";
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      const items = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(["auto-job-ui-theme-color", "auto-job-ui-theme"], (res) => {
          resolve((res as Record<string, unknown>) || {});
        });
      });
      if (typeof items["auto-job-ui-theme-color"] === "string") {
        color = items["auto-job-ui-theme-color"];
      }
      if (typeof items["auto-job-ui-theme"] === "string") {
        mode = items["auto-job-ui-theme"];
      }
    } catch {
      // Fallback to defaults
    }
  }

  const isDark =
    mode === "dark" ||
    (mode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const themeKey = isDark ? `${color}-dark` : color;
  const fallback = isDark ? THEME_PRIMARY_MAP["green-dark"]! : THEME_PRIMARY_MAP["green"]!;
  const themeConfig = THEME_PRIMARY_MAP[themeKey] || fallback;

  return { isDark, ...themeConfig };
}

async function showFormActionNotice(
  message: string,
  options: { pendingCount?: number } = {},
): Promise<boolean> {
  const { pendingCount } = options;
  document.getElementById(FORM_ACTION_NOTICE_ID)?.remove();
  const host = document.createElement("div");
  host.id = FORM_ACTION_NOTICE_ID;
  host.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "closed" });

  const theme = await getNoticeTheme();

  const countText = pendingCount === undefined
    ? ""
    : `<span class="jobby-notice-count">${pendingCount} field${pendingCount === 1 ? "" : "s"} changed</span>`;

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .jobby-notice {
        --background: ${theme.isDark ? "rgb(15, 23, 42)" : "rgb(255, 255, 255)"};
        --panel: ${theme.isDark ? "rgb(30, 41, 59)" : "rgb(255, 255, 255)"};
        --foreground: ${theme.isDark ? "rgb(248, 250, 252)" : "rgb(15, 23, 42)"};
        --muted-foreground: ${theme.isDark ? "rgb(148, 163, 184)" : "rgb(100, 116, 139)"};
        --border: ${theme.isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)"};
        --muted: ${theme.isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.05)"};
        --primary: ${theme.primary};
        --primary-foreground: ${theme.primaryFg};
        --primary-gradient: linear-gradient(135deg, ${theme.primary}, ${theme.gradientStop});

        box-sizing: border-box;
        width: min(360px, calc(100vw - 32px));
        padding: 18px;
        background: var(--panel);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: 0 16px 36px -8px rgba(0, 0, 0, ${theme.isDark ? "0.5" : "0.15"}), 0 4px 12px rgba(0, 0, 0, 0.06);
        backdrop-filter: blur(12px);
        animation: jobby-slide-up 0.22s ease-out;
      }
      @keyframes jobby-slide-up {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .jobby-notice-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .jobby-notice-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 7px;
        background: var(--primary);
        color: var(--primary-foreground);
        font-size: 10px;
        font-weight: 700;
        border-radius: 9999px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .jobby-notice-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: var(--foreground);
        line-height: 1.3;
      }
      .jobby-notice-copy {
        margin: 0;
        font-size: 13px;
        color: var(--muted-foreground);
        line-height: 1.45;
      }
      .jobby-notice-count {
        display: inline-flex;
        align-items: center;
        margin-top: 10px;
        padding: 3px 9px;
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        color: var(--primary);
        border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
      }
      .jobby-notice-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 16px;
      }
      button {
        border: 0;
        border-radius: 9999px;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        padding: 8px 14px;
        transition: all 0.15s ease;
        outline: none;
      }
      button:focus-visible {
        box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--primary);
      }
      .jobby-secondary {
        color: var(--foreground);
        background: var(--muted);
        border: 1px solid var(--border);
      }
      .jobby-secondary:hover {
        background: color-mix(in srgb, var(--foreground) 10%, transparent);
      }
      .jobby-primary {
        color: var(--primary-foreground);
        background: var(--primary-gradient);
        box-shadow: 0 2px 6px color-mix(in srgb, var(--primary) 30%, transparent);
      }
      .jobby-primary:hover {
        opacity: 0.94;
        box-shadow: 0 4px 10px color-mix(in srgb, var(--primary) 40%, transparent);
      }
      .jobby-primary:active, .jobby-secondary:active {
        transform: scale(0.97);
      }
      @media (max-width: 480px) {
        :host { top: 12px; right: 12px; }
      }
    </style>
    <section class="jobby-notice" role="dialog" aria-live="polite" aria-label="Jobby form changes">
      <div class="jobby-notice-header">
        <span class="jobby-notice-badge">Jobby</span>
      </div>
      <h2 class="jobby-notice-title">${pendingCount === undefined ? "Jobby Notice" : "Save your form changes?"}</h2>
      <p class="jobby-notice-copy">${message}</p>
      ${countText}
      ${pendingCount === undefined ? "" : `<div class="jobby-notice-actions">
        <button class="jobby-secondary" data-choice="continue" type="button">Continue without saving</button>
        <button class="jobby-primary" data-choice="save" type="button">Save changes</button>
      </div>`}
    </section>`;
  document.documentElement.appendChild(host);
  if (pendingCount === undefined) {
    window.setTimeout(() => host.remove(), 5000);
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    const finish = (save: boolean) => {
      host.remove();
      resolve(save);
    };
    shadow.querySelector<HTMLButtonElement>("[data-choice='save']")?.addEventListener("click", () => finish(true));
    shadow.querySelector<HTMLButtonElement>("[data-choice='continue']")?.addEventListener("click", () => finish(false));
  });
}

function hasObservableFields(form: FormInspection): form is ObservableFormInspection {
  return form.kind === "application_form" || form.kind === "page_input_fields";
}

function fieldElementType(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  const type = element.type.toLowerCase();
  return type === "search" ? "text" : type || "unknown";
}

function fieldElementAliases(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string[] {
  const type = fieldElementType(element);
  const aliases: string[] = [];
  if (element.id) aliases.push(`${type}|id:${element.id}`);
  if (element.name) aliases.push(`${type}|name:${element.name}`);
  return aliases;
}

function fieldObservationAliases(field: FormFieldObservation): string[] {
  const aliases: string[] = [];
  if (field.id) aliases.push(`${field.type}|id:${field.id}`);
  if (field.name) aliases.push(`${field.type}|name:${field.name}`);
  return aliases;
}

function signature(form: FormInspection): string {
  return JSON.stringify({
    kind: form.kind,
    url: form.url,
    ...(form.kind === "application_form"
      ? {
          action: form.action,
          canGoBack: form.canGoBack,
          fields: form.fields.map((field) => ({
            key: field.key,
            id: field.id,
            name: field.name,
            type: field.type,
            label: field.label,
            required: field.required,
            filled: field.filled,
            sensitive: field.sensitive,
            currentValue: field.currentValue || "",
            options: field.options,
            upload: field.upload,
          })),
        }
      : form.kind === "page_input_fields"
        ? {
            fields: form.fields.map((field) => ({
              key: field.key,
              id: field.id,
              name: field.name,
              type: field.type,
              label: field.label,
              required: field.required,
              filled: field.filled,
              sensitive: field.sensitive,
              currentValue: field.currentValue || "",
              options: field.options,
              upload: field.upload,
            })),
          }
        : {}),
  });
}

function observeShadowRootsIn(node: Node, observe: (root: ShadowRoot) => void): void {
  if (node instanceof ShadowRoot || node instanceof Document) {
    node.querySelectorAll<HTMLElement>("*").forEach((element) => {
      if (element.shadowRoot) observe(element.shadowRoot);
    });
    return;
  }
  if (!(node instanceof Element)) return;
  if (node.shadowRoot) observe(node.shadowRoot);
  node.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (element.shadowRoot) observe(element.shadowRoot);
  });
}

function nodeHasFormSignal(node: Node): boolean {
  if (node instanceof Text) {
    const parent = node.parentElement;
    return Boolean(parent?.closest(FORM_RELEVANT_SELECTOR));
  }
  if (!(node instanceof Element)) return false;
  return node.matches(FORM_RELEVANT_SELECTOR) || Boolean(node.querySelector(FORM_RELEVANT_SELECTOR));
}

function hasRelevantFormMutation(records: readonly MutationRecord[]): boolean {
  return records.some((record) => {
    if (record.type === "characterData") return nodeHasFormSignal(record.target);
    if (record.type === "attributes") return true;
    return Array.from(record.addedNodes).some(nodeHasFormSignal) ||
      Array.from(record.removedNodes).some(nodeHasFormSignal);
  });
}

export function watchFormScope(
  scope: FormScope | null,
  readForm: () => FormInspection,
  initialForm?: FormInspection,
): void {
  window.__jobbyFormObserverCleanup?.();
  window.__jobbyFormDiscoveryCleanup?.();
  if (!scope) return;

  let timer: number | undefined;
  let stabilityTimer: number | undefined;
  let revision = 0;
  const startingForm = initialForm || readForm();
  let lastSignature = signature(startingForm);
  const pendingManualFields = new Set<string>();
  const committedManualFields = new Set<string>();
  const changedManualFields = new Set<string>();
  let replayingAction = false;
  const observedRoots = new WeakSet<ShadowRoot>();
  const eventRoots: Array<Document | HTMLElement | ShadowRoot> = [];
  const scopeParent = scope instanceof HTMLElement ? scope.parentNode : null;
  let schedule: (waitForStableDom?: boolean) => void;
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot));
    });
    if (hasRelevantFormMutation(records)) schedule(true);
  });

  const publishForm = (form: FormInspection) => {
    // Native file pickers return focus to the page without emitting an
    // input/change event when the user cancels. LinkedIn may replace the
    // uploader subtree at that point, so reattach the narrow form observer
    // to the current root instead of requiring a Next/Back navigation.
    const currentScope = getCurrentFormScope();
    if (currentScope && currentScope !== scope) {
      watchFormScope(currentScope, readForm, form);
      return;
    }
    const nextSignature = signature(form);
    const manuallyCompleted = hasObservableFields(form)
      ? form.fields.filter((field) => {
          if (!field.filled || !field.currentValue?.trim()) return false;
          return fieldObservationAliases(field).some((alias) => committedManualFields.has(alias));
        })
      : [];
    const formChanged = nextSignature !== lastSignature;
    if (formChanged) {
      lastSignature = nextSignature;
      void chrome.runtime.sendMessage({ type: "content.form-changed", form }).catch(() => undefined);
    }
    if (manuallyCompleted.length > 0) {
      manuallyCompleted.forEach((field) => fieldObservationAliases(field).forEach((alias) => changedManualFields.add(alias)));
      void chrome.runtime.sendMessage({ type: "content.form-observed", form, fields: manuallyCompleted }).catch(() => undefined);
      manuallyCompleted.forEach((field) => {
        fieldObservationAliases(field).forEach((alias) => {
          pendingManualFields.delete(alias);
          committedManualFields.delete(alias);
        });
      });
    }
    if (!formChanged && manuallyCompleted.length === 0) return;
    if (!hasObservableFields(form)) {
      window.__jobbyFormObserverCleanup?.();
      startFormDiscovery(readForm);
    }
  };

  schedule = (waitForStableDom = false) => {
    const scheduledRevision = ++revision;
    if (timer !== undefined) window.clearTimeout(timer);
    if (stabilityTimer !== undefined) window.clearTimeout(stabilityTimer);
    timer = window.setTimeout(() => {
      if (!scope.isConnected) {
        linkedinAdapter.invalidateApplicationRootCache();
      } else {
        linkedinAdapter.invalidateApplicationActionCache();
      }
      const form = readForm();
      if (!waitForStableDom) {
        publishForm(form);
        return;
      }

      // Application frameworks often insert the dialog shell and controls in
      // separate commits. Publish only after the relevant DOM has stayed
      // quiet and two reads agree, rather than briefly showing a partial form.
      const firstSignature = signature(form);
      stabilityTimer = window.setTimeout(() => {
        if (revision !== scheduledRevision) return;
        const verifiedForm = readForm();
        if (signature(verifiedForm) !== firstSignature) {
          schedule(true);
          return;
        }
        publishForm(verifiedForm);
      }, FORM_STABILITY_RECHECK_MS);
    }, waitForStableDom ? FORM_SETTLE_MS : FORM_OBSERVER_DEBOUNCE_MS);
  };

  const scheduleValueChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      schedule();
      return;
    }
    const isJobbyWrite = Boolean(
      target.dataset.jobbyAutofillUntil && Number(target.dataset.jobbyAutofillUntil) > Date.now(),
    );
    if (!event.isTrusted && !isJobbyWrite) {
      schedule();
      return;
    }
    const aliases = fieldElementAliases(target);
    if (aliases.length === 0) return;
    aliases.forEach((alias) => pendingManualFields.add(alias));
    if (event.type === "change") {
      aliases.forEach((alias) => committedManualFields.add(alias));
      schedule(true);
      return;
    }
    schedule();
  };
  const scheduleManualBlur = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    const isJobbyWrite = Boolean(
      target.dataset.jobbyAutofillUntil && Number(target.dataset.jobbyAutofillUntil) > Date.now(),
    );
    if (!event.isTrusted && !isJobbyWrite) return;
    const aliases = fieldElementAliases(target);
    if (aliases.length === 0) return;
    const pendingAliases = aliases.filter((alias) => pendingManualFields.has(alias));
    if (pendingAliases.length === 0) return;
    const inputType = target instanceof HTMLInputElement ? target.type.toLowerCase() : "";
    const hasValue = inputType === "checkbox" || inputType === "radio"
      ? target instanceof HTMLInputElement && target.checked
      : Boolean(target.value.trim());
    pendingAliases.forEach((alias) => {
      pendingManualFields.delete(alias);
      if (hasValue) committedManualFields.add(alias);
      else committedManualFields.delete(alias);
    });
    schedule(true);
  };
  const scheduleAfterFocus = () => schedule(true);

  const interceptFormAction = (event: Event) => {
    if (replayingAction || !(event.target instanceof Element)) return;
    const action = event.target.closest<HTMLElement>("button, input[type='submit'], input[type='button'], [role='button']");
    if (!action) return;
    const label = `${action.textContent || ""} ${action.getAttribute("aria-label") || ""} ${action instanceof HTMLInputElement ? action.value : ""}`.trim();
    if (!/(?:next|continue|review|submit|apply|send|finish|下一步|继续|审核|提交|申请|发送|完成)/i.test(label)) return;
    const form = readForm();
    if (!hasObservableFields(form)) return;
    const changedFields = form.fields.filter((field) =>
      fieldObservationAliases(field).some((alias) => changedManualFields.has(alias) || pendingManualFields.has(alias)),
    );
    if (changedFields.length === 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void (async () => {
      const prepared = await chrome.runtime.sendMessage({
        type: "content.form-action-prepare",
        form,
        fields: changedFields,
      }).catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : "临时修改保存失败。" }));
      if (!prepared?.ok) {
        void showFormActionNotice("We could not prepare these changes. Please try again.");
        return;
      }
      const pendingCount = typeof prepared.pendingCount === "number" ? prepared.pendingCount : changedFields.length;
      const save = await showFormActionNotice(
        "Would you like to save these changes to your Jobby profile?",
        { pendingCount },
      );
      const finalized = await chrome.runtime.sendMessage({ type: "content.form-action-finalize", save })
        .catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : "We could not confirm the changes." }));
      if (!finalized?.ok) {
        void showFormActionNotice("We could not confirm the changes. Please try again.");
        return;
      }
      changedManualFields.clear();
      pendingManualFields.clear();
      committedManualFields.clear();
      replayingAction = true;
      action.click();
      replayingAction = false;
    })();
  };

  const handleGlobalClick = (event: Event) => {
    interceptFormAction(event);
    const target = event.target;
    if (target instanceof Element) {
      const isInteractive = Boolean(
        target.closest(
          "button, [role='button'], [role='option'], [role='combobox'], [role='listbox'], [class*='option' i], [class*='item' i], [class*='select' i], select, input, label, li, [aria-selected]",
        ),
      );
      if (isInteractive) schedule(true);
    }
  };

  const listenForValueChanges = (root: Document | HTMLElement | ShadowRoot): void => {
    root.addEventListener("input", scheduleValueChange, true);
    root.addEventListener("change", scheduleValueChange, true);
    root.addEventListener("focusout", scheduleManualBlur, true);
    root.addEventListener("click", handleGlobalClick, true);
    eventRoots.push(root);
  };

  const observerConfig: MutationObserverInit = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "aria-hidden", "aria-disabled", "disabled", "aria-selected", "aria-checked", "data-state", "value", "class"
    ],
  };

  function observeRoot(root: ShadowRoot): void {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    observer.observe(root, observerConfig);
    listenForValueChanges(root);
    observeShadowRootsIn(root, observeRoot);
  }

  if (scope instanceof HTMLElement) {
    observer.observe(scope, observerConfig);
  } else if (scope instanceof Document) {
    observer.observe(scope.body || scope.documentElement, observerConfig);
  }

  // Observing a modal only observes mutations *inside* it. LinkedIn removes
  // the whole modal from its outlet when it closes, so watch its immediate
  // parent as well and clear the stale form state without a manual Inspect.
  const parentObserver = scopeParent
    ? new MutationObserver(() => {
        if (!scope.isConnected) schedule();
      })
    : null;
  if (parentObserver && scopeParent instanceof Node) {
    parentObserver.observe(scopeParent, { childList: true });
  }
  listenForValueChanges(scope);
  observeShadowRootsIn(scope, observeRoot);
  // Closing a native file chooser normally produces no form event. The
  // browser window regaining focus is the low-cost signal we need to refresh
  // the uploader without observing the whole page.
  window.addEventListener("focus", scheduleAfterFocus, true);

  window.__jobbyFormObserverCleanup = () => {
    observer.disconnect();
    parentObserver?.disconnect();
    eventRoots.forEach((root) => {
      root.removeEventListener("input", scheduleValueChange, true);
      root.removeEventListener("change", scheduleValueChange, true);
      root.removeEventListener("focusout", scheduleManualBlur, true);
      root.removeEventListener("click", handleGlobalClick, true);
    });
    window.removeEventListener("focus", scheduleAfterFocus, true);
    if (timer !== undefined) window.clearTimeout(timer);
    if (stabilityTimer !== undefined) window.clearTimeout(stabilityTimer);
  };
}

export function startFormDiscovery(readForm: () => FormInspection): void {
  window.__jobbyFormDiscoveryCleanup?.();
  const observedRoots = new WeakSet<ShadowRoot>();
  let timer: number | undefined;
  let stabilityTimer: number | undefined;
  let revision = 0;

  const scheduleDiscovery = () => {
    const scheduledRevision = ++revision;
    if (timer !== undefined) window.clearTimeout(timer);
    if (stabilityTimer !== undefined) window.clearTimeout(stabilityTimer);
    timer = window.setTimeout(() => {
      const form = readForm();
      if (!hasObservableFields(form)) return;
      const firstSignature = signature(form);
      stabilityTimer = window.setTimeout(() => {
        if (revision !== scheduledRevision) return;
        const verifiedForm = readForm();
        if (!hasObservableFields(verifiedForm) || signature(verifiedForm) !== firstSignature) {
          scheduleDiscovery();
          return;
        }
        const scope = getCurrentFormScope();
        if (!scope) return;
        void chrome.runtime.sendMessage({ type: "content.form-changed", form: verifiedForm }).catch(() => undefined);
        watchFormScope(scope, readForm, verifiedForm);
      }, FORM_STABILITY_RECHECK_MS);
    }, FORM_SETTLE_MS);
  };

  const discovery = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot)));
    if (!records.some(hasDiscoveryMutation)) return;
    scheduleDiscovery();
  });

  function observeRoot(root: ShadowRoot): void {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    discovery.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "style", "class", "disabled"],
    });
    observeShadowRootsIn(root, observeRoot);
  }

  discovery.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-hidden", "hidden", "style", "class", "disabled"],
  });
  observeShadowRootsIn(document, observeRoot);

  const onFocus = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("input, select, textarea, [contenteditable='true']")) return;
    scheduleDiscovery();
  };
  document.addEventListener("focusin", onFocus, true);

  window.__jobbyFormDiscoveryCleanup = () => {
    discovery.disconnect();
    document.removeEventListener("focusin", onFocus, true);
    if (timer !== undefined) window.clearTimeout(timer);
    if (stabilityTimer !== undefined) window.clearTimeout(stabilityTimer);
  };
}

function hasDiscoverySignal(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches(DISCOVERY_SELECTOR) || Boolean(node.querySelector(DISCOVERY_SELECTOR));
}

function hasDiscoveryMutation(record: MutationRecord): boolean {
  if (record.type === "attributes") return hasDiscoverySignal(record.target);
  return Array.from(record.addedNodes).some(hasDiscoverySignal);
}
