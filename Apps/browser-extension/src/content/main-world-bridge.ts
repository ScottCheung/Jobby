type SelectOption = {
  label: string;
  value: string | number;
};

type SelectInstance = {
  props?: {
    options?: unknown;
    value?: unknown;
  };
  selectOption?: (option: unknown) => void;
};

type BridgeRequest = {
  requestId?: unknown;
  action?: unknown;
  elementId?: unknown;
  value?: unknown;
  dataUrl?: unknown;
};

type MainWorldBridgeState = {
  dispose: () => void;
};

interface Window {
  __jobbyMainWorldBridge?: MainWorldBridgeState;
}

const REQUEST_EVENT = "jobby.combobox-request";
const RESPONSE_EVENT = "jobby.combobox-response";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalized(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function findSelectInstance(element: HTMLElement): SelectInstance | null {
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey
    ? (element as unknown as Record<string, unknown>)[fiberKey] as { return?: unknown; stateNode?: unknown }
    : null;

  for (let depth = 0; fiber && depth < 32; depth += 1) {
    const instance = fiber.stateNode as SelectInstance | undefined;
    if (instance && typeof instance.selectOption === "function" && Array.isArray(instance.props?.options)) {
      return instance;
    }
    fiber = fiber.return as { return?: unknown; stateNode?: unknown } | null;
  }
  return null;
}

function optionsFor(instance: SelectInstance): SelectOption[] {
  if (!Array.isArray(instance.props?.options)) return [];
  return instance.props.options
    .map((option) => option as Partial<SelectOption>)
    .filter((option): option is SelectOption => Boolean(cleanText(option.label)) && option.value !== undefined)
    .map((option) => ({ label: cleanText(option.label), value: option.value }));
}

function currentValueFor(instance: SelectInstance, options: SelectOption[]): string {
  const value = Array.isArray(instance.props?.value) ? instance.props?.value[0] : instance.props?.value;
  const selected = value as Partial<SelectOption> | null | undefined;
  if (!selected || selected.value === undefined) return "";
  return options.find((option) => String(option.value) === String(selected.value))?.label ||
    cleanText(selected.label);
}

function respond(requestId: string, payload: Record<string, unknown>): void {
  document.dispatchEvent(
    new CustomEvent(RESPONSE_EVENT, {
      detail: { requestId, ...payload },
    }),
  );
}

// Extension updates and development HMR can reinject a main-world script into
// the same document. Remove its page-global hooks before installing this copy.
window.__jobbyMainWorldBridge?.dispose();

const onBridgeRequest = (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const request = event.detail as BridgeRequest;
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
        blobUrl: URL.createObjectURL(new Blob([buffer], { type: "application/pdf" })),
      });
    } catch {
      respond(requestId, { ok: false });
    }
    return;
  }

  if (typeof request.elementId !== "string") return;
  const element = document.getElementById(request.elementId);
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
      options: options.map((option) => ({ label: option.label, value: String(option.value) })),
      currentValue: currentValueFor(instance, options),
    });
    return;
  }

  if (request.action !== "select" || typeof request.value !== "string") {
    respond(requestId, { ok: false });
    return;
  }

  const target = normalized(request.value);
  const targetFirstToken = target.split(/[,，\s]+/)[0] || target;
  const option = options.find((candidate) => {
    const label = normalized(candidate.label);
    const value = normalized(String(candidate.value));
    return label === target ||
      value === target ||
      (target.length > 1 && (label.includes(target) || target.includes(label))) ||
      (target.length > 1 && (value.includes(target) || target.includes(value))) ||
      (targetFirstToken.length > 1 && (label.includes(targetFirstToken) || value.includes(targetFirstToken)));
  }) || (options.length > 0 ? options[0] : undefined);
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
      currentValue,
    });
  }, 0);
};
document.addEventListener(REQUEST_EVENT, onBridgeRequest);

const hostname = window.location.hostname.toLowerCase();
const shouldTrackSpaNavigation = window.top === window && (
  hostname === "linkedin.com" || hostname.endsWith(".linkedin.com") ||
  hostname === "seek.com" || hostname.endsWith(".seek.com") ||
  hostname === "seek.com.au" || hostname.endsWith(".seek.com.au") ||
  hostname === "seek.co.nz" || hostname.endsWith(".seek.co.nz") ||
  /(?:^|\.)indeed\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/.test(hostname) ||
  /(?:^|\.)glassdoor\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/.test(hostname)
);
const rawPushState = shouldTrackSpaNavigation ? window.history.pushState : undefined;
const rawReplaceState = shouldTrackSpaNavigation ? window.history.replaceState : undefined;
const dispatchUrlChanged = () => {
  try {
    document.dispatchEvent(new CustomEvent("jobby.url-changed", { detail: { url: window.location.href } }));
  } catch {}
};
const onPopState = () => dispatchUrlChanged();
let patchedPushState: History["pushState"] | undefined;
let patchedReplaceState: History["replaceState"] | undefined;

if (rawPushState && rawReplaceState) {
  patchedPushState = function (this: History, ...args) {
    const result = rawPushState.apply(this, args);
    dispatchUrlChanged();
    return result;
  };
  patchedReplaceState = function (this: History, ...args) {
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
  },
};
