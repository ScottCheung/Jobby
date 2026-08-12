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
};

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

document.addEventListener(REQUEST_EVENT, (event) => {
  if (!(event instanceof CustomEvent)) return;
  const request = event.detail as BridgeRequest;
  if (typeof request.requestId !== "string" || typeof request.elementId !== "string") return;
  const requestId = request.requestId;
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
  const option = options.find((candidate) => {
    const label = normalized(candidate.label);
    const value = normalized(String(candidate.value));
    return label === target ||
      value === target ||
      (target.length > 1 && (label.includes(target) || target.includes(label))) ||
      (target.length > 1 && (value.includes(target) || target.includes(value)));
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
      currentValue,
    });
  }, 0);
});

// --- Network Interception for Dynamic SPA Cascade Completion ---
const CASCADE_EVENT = "jobby.network-cascade-complete";

(function setupNetworkCascadeInterception() {
  try {
    const rawFetch = window.fetch;
    if (typeof rawFetch === "function") {
      window.fetch = async function (...args) {
        const response = await rawFetch.apply(this, args);
        try {
          if (response && (response.ok || (response.status >= 200 && response.status < 300))) {
            const url = typeof args[0] === "string" ? args[0] : (args[0] instanceof Request ? args[0].url : "");
            document.dispatchEvent(
              new CustomEvent(CASCADE_EVENT, {
                detail: { url, status: response.status, timestamp: Date.now() },
              }),
            );
          }
        } catch {}
        return response;
      };
    }

    const RawXHR = window.XMLHttpRequest;
    if (RawXHR && RawXHR.prototype) {
      const rawOpen = RawXHR.prototype.open;
      const rawSend = RawXHR.prototype.send;

      RawXHR.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
        (this as unknown as { _jobbyUrl?: string })._jobbyUrl = String(url);
        return rawOpen.apply(this, [method, url, ...rest] as unknown as [string, string | URL, boolean]);
      };

      RawXHR.prototype.send = function (...args) {
        this.addEventListener("load", () => {
          try {
            if (this.status >= 200 && this.status < 300) {
              const url = (this as unknown as { _jobbyUrl?: string })._jobbyUrl || "";
              document.dispatchEvent(
                new CustomEvent(CASCADE_EVENT, {
                  detail: { url, status: this.status, timestamp: Date.now() },
                }),
              );
            }
          } catch {}
        });
        return rawSend.apply(this, args);
      };
    }
  } catch {}
})();
