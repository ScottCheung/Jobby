import type { FormInspection } from "../shared/contracts/form-inspection";
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

function hasObservableFields(form: FormInspection): boolean {
  return form.kind === "application_form" || form.kind === "page_input_fields";
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
  let lastSignature = signature(initialForm || readForm());
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
    if (nextSignature === lastSignature) return;
    lastSignature = nextSignature;
    void chrome.runtime.sendMessage({ type: "content.form-changed", form }).catch(() => undefined);
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

  const scheduleValueChange = () => schedule();
  const scheduleAfterFocus = () => schedule(true);

  const listenForValueChanges = (root: Document | HTMLElement | ShadowRoot): void => {
    root.addEventListener("input", scheduleValueChange, true);
    root.addEventListener("change", scheduleValueChange, true);
    eventRoots.push(root);
  };

  function observeRoot(root: ShadowRoot): void {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    if (!(scope instanceof Document)) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-hidden", "aria-disabled", "disabled"],
      });
    }
    listenForValueChanges(root);
    observeShadowRootsIn(root, observeRoot);
  }

  // A full-document MutationObserver is costly on large application pages.
  // Document-scoped forms still receive capture-phase input/change events for
  // live two-way value sync; structural changes are handled by the action
  // commands and lightweight discovery observer instead.
  if (!(scope instanceof Document)) {
    observer.observe(scope, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-disabled", "disabled"],
    });
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
