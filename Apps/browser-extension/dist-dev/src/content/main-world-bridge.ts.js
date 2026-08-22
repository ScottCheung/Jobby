const REQUEST_EVENT = "jobby.combobox-request";
const RESPONSE_EVENT = "jobby.combobox-response";
function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
function normalized(value) {
  return cleanText(value).toLowerCase();
}
function findSelectInstance(element) {
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? element[fiberKey] : null;
  for (let depth = 0; fiber && depth < 32; depth += 1) {
    const instance = fiber.stateNode;
    if (instance && typeof instance.selectOption === "function" && Array.isArray(instance.props?.options)) {
      return instance;
    }
    fiber = fiber.return;
  }
  return null;
}
function optionsFor(instance) {
  if (!Array.isArray(instance.props?.options)) return [];
  return instance.props.options.map((option) => option).filter((option) => Boolean(cleanText(option.label)) && option.value !== void 0).map((option) => ({ label: cleanText(option.label), value: option.value }));
}
function currentValueFor(instance, options) {
  const value = Array.isArray(instance.props?.value) ? instance.props?.value[0] : instance.props?.value;
  const selected = value;
  if (!selected || selected.value === void 0) return "";
  return options.find((option) => String(option.value) === String(selected.value))?.label || cleanText(selected.label);
}
function respond(requestId, payload) {
  document.dispatchEvent(
    new CustomEvent(RESPONSE_EVENT, {
      detail: { requestId, ...payload }
    })
  );
}
window.__jobbyMainWorldBridge?.dispose();
const onBridgeRequest = (event) => {
  if (!(event instanceof CustomEvent)) return;
  const request = event.detail;
  if (typeof request.requestId !== "string") return;
  const requestId = request.requestId;
  if (request.action === "create-pdf-blob-url") {
    if (typeof request.dataUrl !== "string") {
      respond(requestId, { ok: false });
      return;
    }
    try {
      const base64 = request.dataUrl.split(",")[1] || request.dataUrl;
      const bytes = atob(base64);
      const buffer = new Uint8Array(bytes.length);
      for (let index = 0; index < bytes.length; index += 1)
        buffer[index] = bytes.charCodeAt(index);
      respond(requestId, {
        ok: true,
        blobUrl: URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }))
      });
    } catch {
      respond(requestId, { ok: false });
    }
    return;
  }
  if (typeof request.elementId !== "string") return;
  const element = document.getElementById(request.elementId);
  if (!(element instanceof HTMLInputElement) || element.getAttribute("role") !== "combobox") {
    respond(requestId, { ok: false });
    return;
  }
  const instance = findSelectInstance(element);
  if (!instance) {
    respond(requestId, { ok: false });
    return;
  }
  const options = optionsFor(instance);
  if (request.action === "inspect") {
    respond(requestId, {
      ok: true,
      options: options.map((option2) => ({ label: option2.label, value: String(option2.value) })),
      currentValue: currentValueFor(instance, options)
    });
    return;
  }
  if (request.action !== "select" || typeof request.value !== "string") {
    respond(requestId, { ok: false });
    return;
  }
  const target = normalized(request.value);
  const option = options.find((candidate) => {
    const label = normalized(candidate.label);
    const value = normalized(String(candidate.value));
    return label === target || value === target || target.length > 1 && (label.includes(target) || target.includes(label)) || target.length > 1 && (value.includes(target) || target.includes(value));
  });
  if (!option) {
    respond(requestId, { ok: false, options: options.map((candidate) => ({ label: candidate.label, value: String(candidate.value) })) });
    return;
  }
  instance.selectOption?.(option);
  window.setTimeout(() => {
    const updatedInstance = findSelectInstance(element);
    const updatedOptions = updatedInstance ? optionsFor(updatedInstance) : options;
    const currentValue = updatedInstance ? currentValueFor(updatedInstance, updatedOptions) : "";
    respond(requestId, {
      ok: normalized(currentValue) === normalized(option.label),
      currentValue
    });
  }, 0);
};
document.addEventListener(REQUEST_EVENT, onBridgeRequest);
const hostname = window.location.hostname.toLowerCase();
const shouldTrackSpaNavigation = window.top === window && (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com") || hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au") || hostname === "indeed.com" || hostname.endsWith(".indeed.com"));
const rawPushState = shouldTrackSpaNavigation ? window.history.pushState : void 0;
const rawReplaceState = shouldTrackSpaNavigation ? window.history.replaceState : void 0;
const dispatchUrlChanged = () => {
  try {
    document.dispatchEvent(new CustomEvent("jobby.url-changed", { detail: { url: window.location.href } }));
  } catch {
  }
};
const onPopState = () => dispatchUrlChanged();
let patchedPushState;
let patchedReplaceState;
if (rawPushState && rawReplaceState) {
  patchedPushState = function(...args) {
    const result = rawPushState.apply(this, args);
    dispatchUrlChanged();
    return result;
  };
  patchedReplaceState = function(...args) {
    const result = rawReplaceState.apply(this, args);
    dispatchUrlChanged();
    return result;
  };
  window.history.pushState = patchedPushState;
  window.history.replaceState = patchedReplaceState;
  window.addEventListener("popstate", onPopState);
}
window.__jobbyMainWorldBridge = {
  dispose: () => {
    document.removeEventListener(REQUEST_EVENT, onBridgeRequest);
    if (rawPushState && patchedPushState && window.history.pushState === patchedPushState) {
      window.history.pushState = rawPushState;
    }
    if (rawReplaceState && patchedReplaceState && window.history.replaceState === patchedReplaceState) {
      window.history.replaceState = rawReplaceState;
    }
    window.removeEventListener("popstate", onPopState);
  }
};
