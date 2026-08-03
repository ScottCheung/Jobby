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
