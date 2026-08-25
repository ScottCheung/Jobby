import type { FormFieldObservation, FormInspection } from "../shared/contracts/form-inspection";
import type { FormScope } from "./dom/form-inspector";
import { queryAllInScope } from "./dom/form-inspector";

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

function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
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
  return node.matches(FORM_RELEVANT_SELECTOR) || queryAllInScope(node as HTMLElement, FORM_RELEVANT_SELECTOR).length > 0;
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
  if (!isExtensionContextValid() || !scope) return;

  let timer: number | undefined;
  let stabilityTimer: number | undefined;
  let revision = 0;
  const startingForm = initialForm || readForm();
  let lastSignature = signature(startingForm);
  const pendingManualFields = new Set<string>();
  const committedManualFields = new Set<string>();
  const changedManualFields = new Set<string>();
  const observedRoots = new WeakSet<ShadowRoot>();
  const eventRoots: Array<Document | HTMLElement | ShadowRoot> = [];
  const scopeParent = scope instanceof HTMLElement ? scope.parentNode : null;
  let schedule: (waitForStableDom?: boolean) => void;
  const observer = new MutationObserver((records) => {
    if (!isExtensionContextValid()) {
      window.__jobbyFormObserverCleanup?.();
      return;
    }
    if (!hasRelevantFormMutation(records)) return;
    records.forEach((record) => {
      record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot));
    });
    schedule(true);
  });

  const publishForm = (form: FormInspection) => {
    if (!isExtensionContextValid()) {
      window.__jobbyFormObserverCleanup?.();
      window.__jobbyFormDiscoveryCleanup?.();
      return;
    }
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
      try {
        void chrome.runtime.sendMessage({ type: "content.form-changed", form }).catch(() => undefined);
      } catch {
        // Ignore
      }
    }
    if (manuallyCompleted.length > 0) {
      manuallyCompleted.forEach((field) => fieldObservationAliases(field).forEach((alias) => changedManualFields.add(alias)));
      try {
        void chrome.runtime.sendMessage({ type: "content.form-observed", form, fields: manuallyCompleted }).catch(() => undefined);
      } catch {
        // Ignore
      }
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
    if (!isExtensionContextValid()) {
      window.__jobbyFormObserverCleanup?.();
      return;
    }
    const scheduledRevision = ++revision;
    if (timer !== undefined) window.clearTimeout(timer);
    if (stabilityTimer !== undefined) window.clearTimeout(stabilityTimer);
    timer = window.setTimeout(() => {
      if (!isExtensionContextValid()) {
        window.__jobbyFormObserverCleanup?.();
        return;
      }
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
      // separate commits. Recheck once for stability, then publish the latest
      // verified form rather than recursing infinitely on active dynamic pages.
      stabilityTimer = window.setTimeout(() => {
        if (!isExtensionContextValid()) {
          window.__jobbyFormObserverCleanup?.();
          return;
        }
        if (revision !== scheduledRevision) return;
        const verifiedForm = readForm();
        publishForm(verifiedForm);
      }, FORM_STABILITY_RECHECK_MS);
    }, waitForStableDom ? FORM_SETTLE_MS : FORM_OBSERVER_DEBOUNCE_MS);
  };

  const scheduleValueChange = (event: Event) => {
    if (!isExtensionContextValid()) return;
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
    if (!isExtensionContextValid()) return;
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

  const prepareFormAction = (event: Event) => {
    if (!isExtensionContextValid() || !(event.target instanceof Element)) return;
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

    changedManualFields.clear();
    pendingManualFields.clear();
    committedManualFields.clear();
    try {
      void chrome.runtime.sendMessage({
        type: "content.form-action-prepare",
        form,
        fields: changedFields,
      }).catch(() => undefined);
    } catch {
      // The application action must continue even if the extension was reloaded.
    }
  };

  const handleGlobalClick = (event: Event) => {
    if (!isExtensionContextValid()) return;
    prepareFormAction(event);
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
    if (eventRoots.includes(root)) return;
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
        if (!isExtensionContextValid()) {
          parentObserver?.disconnect();
          return;
        }
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
  if (!isExtensionContextValid()) return;
  window.__jobbyFormDiscoveryCleanup?.();
  const observedRoots = new WeakSet<ShadowRoot>();
  let timer: number | undefined;
  let stabilityTimer: number | undefined;
  let revision = 0;

  const scheduleDiscovery = () => {
    if (!isExtensionContextValid()) {
      window.__jobbyFormDiscoveryCleanup?.();
      return;
    }
    const scheduledRevision = ++revision;
    if (timer !== undefined) window.clearTimeout(timer);
    if (stabilityTimer !== undefined) window.clearTimeout(stabilityTimer);
    timer = window.setTimeout(() => {
      if (!isExtensionContextValid()) {
        window.__jobbyFormDiscoveryCleanup?.();
        return;
      }
      const form = readForm();
      if (!hasObservableFields(form)) return;
      stabilityTimer = window.setTimeout(() => {
        if (!isExtensionContextValid()) {
          window.__jobbyFormDiscoveryCleanup?.();
          return;
        }
        if (revision !== scheduledRevision) return;
        const verifiedForm = readForm();
        if (!hasObservableFields(verifiedForm)) return;
        const scope = getCurrentFormScope();
        if (!scope) return;
        try {
          void chrome.runtime.sendMessage({ type: "content.form-changed", form: verifiedForm }).catch(() => undefined);
        } catch {
          // Ignore
        }
        watchFormScope(scope, readForm, verifiedForm);
      }, FORM_STABILITY_RECHECK_MS);
    }, FORM_SETTLE_MS);
  };

  const discovery = new MutationObserver((records) => {
    if (!isExtensionContextValid()) {
      window.__jobbyFormDiscoveryCleanup?.();
      return;
    }
    if (!records.some(hasDiscoveryMutation)) return;
    records.forEach((record) => record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot)));
    scheduleDiscovery();
  });

  function observeRoot(root: ShadowRoot): void {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    discovery.observe(root, {
      childList: true,
      subtree: true,
    });
    observeShadowRootsIn(root, observeRoot);
  }

  discovery.observe(document, {
    childList: true,
    subtree: true,
  });

  const onFocus = (event: FocusEvent) => {
    if (!isExtensionContextValid()) {
      window.__jobbyFormDiscoveryCleanup?.();
      return;
    }
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
  return node.matches(DISCOVERY_SELECTOR) || queryAllInScope(node as HTMLElement, DISCOVERY_SELECTOR).length > 0;
}

function hasDiscoveryMutation(record: MutationRecord): boolean {
  if (record.type === "attributes") return hasDiscoverySignal(record.target);
  return Array.from(record.addedNodes).some(hasDiscoverySignal);
}
