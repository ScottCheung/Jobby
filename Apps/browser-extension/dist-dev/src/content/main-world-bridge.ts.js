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
document.addEventListener(REQUEST_EVENT, (event) => {
  if (!(event instanceof CustomEvent)) return;
  const request = event.detail;
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
});
const CASCADE_EVENT = "jobby.network-cascade-complete";
(function setupNetworkCascadeInterception() {
  try {
    const rawFetch = window.fetch;
    if (typeof rawFetch === "function") {
      window.fetch = async function(...args) {
        const response = await rawFetch.apply(this, args);
        try {
          if (response && (response.ok || response.status >= 200 && response.status < 300)) {
            const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
            document.dispatchEvent(
              new CustomEvent(CASCADE_EVENT, {
                detail: { url, status: response.status, timestamp: Date.now() }
              })
            );
          }
        } catch {
        }
        return response;
      };
    }
    const RawXHR = window.XMLHttpRequest;
    if (RawXHR && RawXHR.prototype) {
      const rawOpen = RawXHR.prototype.open;
      const rawSend = RawXHR.prototype.send;
      RawXHR.prototype.open = function(method, url, ...rest) {
        this._jobbyUrl = String(url);
        return rawOpen.apply(this, [method, url, ...rest]);
      };
      RawXHR.prototype.send = function(...args) {
        this.addEventListener("load", () => {
          try {
            if (this.status >= 200 && this.status < 300) {
              const url = this._jobbyUrl || "";
              document.dispatchEvent(
                new CustomEvent(CASCADE_EVENT, {
                  detail: { url, status: this.status, timestamp: Date.now() }
                })
              );
            }
          } catch {
          }
        });
        return rawSend.apply(this, args);
      };
    }
  } catch {
  }
})();
