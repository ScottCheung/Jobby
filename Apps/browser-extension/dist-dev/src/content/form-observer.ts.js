import { linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
import { getCurrentFormScope } from "/src/content/page-reader.ts.js";
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
  "textarea"
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
  "[aria-modal='true']"
].join(", ");
const FORM_OBSERVER_DEBOUNCE_MS = 150;
const FORM_SETTLE_MS = 300;
const FORM_STABILITY_RECHECK_MS = 120;
function hasObservableFields(form) {
  return form.kind === "application_form" || form.kind === "page_input_fields";
}
function signature(form) {
  return JSON.stringify({
    kind: form.kind,
    url: form.url,
    ...form.kind === "application_form" ? {
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
        upload: field.upload
      }))
    } : form.kind === "page_input_fields" ? {
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
        upload: field.upload
      }))
    } : {}
  });
}
function observeShadowRootsIn(node, observe) {
  if (node instanceof ShadowRoot || node instanceof Document) {
    node.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) observe(element.shadowRoot);
    });
    return;
  }
  if (!(node instanceof Element)) return;
  if (node.shadowRoot) observe(node.shadowRoot);
  node.querySelectorAll("*").forEach((element) => {
    if (element.shadowRoot) observe(element.shadowRoot);
  });
}
function nodeHasFormSignal(node) {
  if (node instanceof Text) {
    const parent = node.parentElement;
    return Boolean(parent?.closest(FORM_RELEVANT_SELECTOR));
  }
  if (!(node instanceof Element)) return false;
  return node.matches(FORM_RELEVANT_SELECTOR) || Boolean(node.querySelector(FORM_RELEVANT_SELECTOR));
}
function hasRelevantFormMutation(records) {
  return records.some((record) => {
    if (record.type === "attributes") return true;
    return Array.from(record.addedNodes).some(nodeHasFormSignal) || Array.from(record.removedNodes).some(nodeHasFormSignal);
  });
}
export function watchFormScope(scope, readForm, initialForm) {
  window.__jobbyFormObserverCleanup?.();
  window.__jobbyFormDiscoveryCleanup?.();
  if (!scope) return;
  let timer;
  let stabilityTimer;
  let revision = 0;
  let lastSignature = signature(initialForm || readForm());
  const observedRoots = /* @__PURE__ */ new WeakSet();
  const eventRoots = [];
  const scopeParent = scope instanceof HTMLElement ? scope.parentNode : null;
  let schedule;
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot));
    });
    if (hasRelevantFormMutation(records)) schedule(true);
  });
  const publishForm = (form) => {
    const currentScope = getCurrentFormScope();
    if (currentScope && currentScope !== scope) {
      watchFormScope(currentScope, readForm, form);
      return;
    }
    const nextSignature = signature(form);
    if (nextSignature === lastSignature) return;
    lastSignature = nextSignature;
    void chrome.runtime.sendMessage({ type: "content.form-changed", form }).catch(() => void 0);
    if (!hasObservableFields(form)) {
      window.__jobbyFormObserverCleanup?.();
      startFormDiscovery(readForm);
    }
  };
  schedule = (waitForStableDom = false) => {
    const scheduledRevision = ++revision;
    if (timer !== void 0) window.clearTimeout(timer);
    if (stabilityTimer !== void 0) window.clearTimeout(stabilityTimer);
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
  const listenForValueChanges = (root) => {
    root.addEventListener("input", scheduleValueChange, true);
    root.addEventListener("change", scheduleValueChange, true);
    eventRoots.push(root);
  };
  function observeRoot(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    if (!(scope instanceof Document)) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-hidden", "aria-disabled", "disabled"]
      });
    }
    listenForValueChanges(root);
    observeShadowRootsIn(root, observeRoot);
  }
  if (!(scope instanceof Document)) {
    observer.observe(scope, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-disabled", "disabled"]
    });
  }
  const parentObserver = scopeParent ? new MutationObserver(() => {
    if (!scope.isConnected) schedule();
  }) : null;
  if (parentObserver && scopeParent instanceof Node) {
    parentObserver.observe(scopeParent, { childList: true });
  }
  listenForValueChanges(scope);
  observeShadowRootsIn(scope, observeRoot);
  window.addEventListener("focus", scheduleAfterFocus, true);
  window.__jobbyFormObserverCleanup = () => {
    observer.disconnect();
    parentObserver?.disconnect();
    eventRoots.forEach((root) => {
      root.removeEventListener("input", scheduleValueChange, true);
      root.removeEventListener("change", scheduleValueChange, true);
    });
    window.removeEventListener("focus", scheduleAfterFocus, true);
    if (timer !== void 0) window.clearTimeout(timer);
    if (stabilityTimer !== void 0) window.clearTimeout(stabilityTimer);
  };
}
export function startFormDiscovery(readForm) {
  window.__jobbyFormDiscoveryCleanup?.();
  const observedRoots = /* @__PURE__ */ new WeakSet();
  let timer;
  let stabilityTimer;
  let revision = 0;
  const scheduleDiscovery = () => {
    const scheduledRevision = ++revision;
    if (timer !== void 0) window.clearTimeout(timer);
    if (stabilityTimer !== void 0) window.clearTimeout(stabilityTimer);
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
        void chrome.runtime.sendMessage({ type: "content.form-changed", form: verifiedForm }).catch(() => void 0);
        watchFormScope(scope, readForm, verifiedForm);
      }, FORM_STABILITY_RECHECK_MS);
    }, FORM_SETTLE_MS);
  };
  const discovery = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot)));
    if (!records.some(hasDiscoveryMutation)) return;
    scheduleDiscovery();
  });
  function observeRoot(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    discovery.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "style", "class", "disabled"]
    });
    observeShadowRootsIn(root, observeRoot);
  }
  discovery.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-hidden", "hidden", "style", "class", "disabled"]
  });
  observeShadowRootsIn(document, observeRoot);
  const onFocus = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("input, select, textarea, [contenteditable='true']")) return;
    scheduleDiscovery();
  };
  document.addEventListener("focusin", onFocus, true);
  window.__jobbyFormDiscoveryCleanup = () => {
    discovery.disconnect();
    document.removeEventListener("focusin", onFocus, true);
    if (timer !== void 0) window.clearTimeout(timer);
    if (stabilityTimer !== void 0) window.clearTimeout(stabilityTimer);
  };
}
function hasDiscoverySignal(node) {
  if (!(node instanceof Element)) return false;
  return node.matches(DISCOVERY_SELECTOR) || Boolean(node.querySelector(DISCOVERY_SELECTOR));
}
function hasDiscoveryMutation(record) {
  if (record.type === "attributes") return hasDiscoverySignal(record.target);
  return Array.from(record.addedNodes).some(hasDiscoverySignal);
}
