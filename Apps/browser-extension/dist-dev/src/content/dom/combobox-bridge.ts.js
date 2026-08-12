const REQUEST_EVENT = "jobby.combobox-request";
const RESPONSE_EVENT = "jobby.combobox-response";
let requestSequence = 0;
function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
function parseOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((option) => {
    if (typeof option !== "object" || option === null) return null;
    const candidate = option;
    const label = cleanText(candidate.label);
    const optionValue = typeof candidate.value === "string" ? candidate.value : "";
    return label && optionValue ? { label, value: optionValue } : null;
  }).filter((option) => Boolean(option));
}
function requestBridge(element, action, value) {
  if (!element.id) return null;
  const requestId = `jobby-combobox-${Date.now()}-${requestSequence += 1}`;
  let response = null;
  const onResponse = (event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail;
    if (detail?.requestId === requestId) response = detail;
  };
  document.addEventListener(RESPONSE_EVENT, onResponse, true);
  document.dispatchEvent(
    new CustomEvent(REQUEST_EVENT, {
      detail: { requestId, action, elementId: element.id, ...value !== void 0 ? { value } : {} }
    })
  );
  document.removeEventListener(RESPONSE_EVENT, onResponse, true);
  const resolved = response;
  if (!resolved) return null;
  return {
    ok: resolved.ok === true,
    state: {
      options: parseOptions(resolved.options),
      currentValue: cleanText(resolved.currentValue)
    }
  };
}
export function inspectPageCombobox(element) {
  return requestBridge(element, "inspect")?.state || null;
}
export function selectPageCombobox(element, value) {
  if (!element.id) return Promise.resolve(null);
  const requestId = `jobby-combobox-${Date.now()}-${requestSequence += 1}`;
  return new Promise((resolve) => {
    let timer;
    const finish = (response) => {
      document.removeEventListener(RESPONSE_EVENT, onResponse, true);
      if (timer !== void 0) window.clearTimeout(timer);
      if (!response) {
        resolve(null);
        return;
      }
      resolve({
        ok: response.ok === true,
        currentValue: cleanText(response.currentValue)
      });
    };
    const onResponse = (event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (detail?.requestId === requestId) finish(detail);
    };
    document.addEventListener(RESPONSE_EVENT, onResponse, true);
    document.dispatchEvent(
      new CustomEvent(REQUEST_EVENT, {
        detail: { requestId, action: "select", elementId: element.id, value }
      })
    );
    timer = window.setTimeout(() => finish(null), 700);
  });
}
const CASCADE_EVENT = "jobby.network-cascade-complete";
export function waitForNetworkCascadeOrSettle(maxWaitMs = 350) {
  return new Promise((resolve) => {
    let resolved = false;
    let timer;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener(CASCADE_EVENT, onCascade, true);
      if (timer !== void 0) window.clearTimeout(timer);
      resolve();
    };
    const onCascade = () => {
      window.setTimeout(finish, 40);
    };
    document.addEventListener(CASCADE_EVENT, onCascade, true);
    timer = window.setTimeout(finish, maxWaitMs);
  });
}
