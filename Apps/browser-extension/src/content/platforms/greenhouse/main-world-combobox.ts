import type {
  FieldFillInstruction,
  FieldFillResult,
  FormFieldTarget,
} from "../../../shared/contracts/form-actions";

export async function selectGreenhouseCombobox(
  target: FormFieldTarget,
  value: FieldFillInstruction["value"],
  commandId: string,
  context: { tabId: number },
): Promise<FieldFillResult | null> {
  if (target.type !== "select" || typeof value !== "string" || !target.id) return null;

  try {
    const executions = await chrome.scripting.executeScript({
      target: { tabId: context.tabId, frameIds: [target.frameId ?? 0] },
      world: "MAIN",
      func: selectGreenhouseComboboxInPage,
      args: [target.id, value],
    });
    const selection = executions[0]?.result;
    if (!selection?.handled) return null;

    if (selection.status === "filled" || selection.status === "already_filled") {
      return {
        commandId,
        key: target.key,
        status: selection.status,
        message: selection.status === "filled" ? "Dropdown value updated." : "Dropdown already has the requested value.",
      };
    }
    return null;
  } catch {
    return null;
  }
}

function selectGreenhouseComboboxInPage(
  elementId: string,
  requestedValue: string,
): Promise<{
  handled: boolean;
  status?: "filled" | "already_filled" | "rejected";
}> {
  type Option = { label: string; value: string | number };
  type SelectInstance = {
    props?: { options?: unknown; value?: unknown };
    selectOption?: (option: unknown) => void;
  };
  type Fiber = { return?: Fiber | null; stateNode?: unknown };

  const clean = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
  const normalized = (value: unknown) => clean(value).toLowerCase();
  const countryDialAliases: Record<string, string> = {
    australia: "+61",
    au: "+61",
    "+61": "+61",
    "61": "+61",
    "new zealand": "+64",
    nz: "+64",
    "+64": "+64",
    "64": "+64",
    "united kingdom": "+44",
    uk: "+44",
    gb: "+44",
    "+44": "+44",
    "44": "+44",
    "united states": "+1",
    usa: "+1",
    us: "+1",
    "+1": "+1",
    "1": "+1",
    canada: "+1",
    china: "+86",
    cn: "+86",
    "+86": "+86",
    india: "+91",
    in: "+91",
    "+91": "+91",
    singapore: "+65",
    sg: "+65",
    "+65": "+65",
    "hong kong": "+852",
    hk: "+852",
    "+852": "+852",
  };
  const countryAlias = (value: unknown): string => {
    const text = normalized(value)
      .replace(/[()\-]/g, "")
      .replace(/\s+/g, " ");
    return countryDialAliases[text] || text;
  };
  const element = document.getElementById(elementId);
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
      document.querySelector("#grnhse_app, .job-post-container, form.application--form, form[action*='greenhouse.io']")),
  );
  if (!(element instanceof HTMLInputElement) || (element.getAttribute("role") !== "combobox" && !isGreenhouseLoc)) {
    return Promise.resolve({ handled: false });
  }

  const findInstance = (): SelectInstance | null => {
    const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
    let fiber = key ? ((element as unknown as Record<string, unknown>)[key] as Fiber) : null;
    for (let depth = 0; fiber && depth < 32; depth += 1) {
      const instance = fiber.stateNode as SelectInstance | undefined;
      if (instance && typeof instance.selectOption === "function" && Array.isArray(instance.props?.options)) {
        return instance;
      }
      fiber = fiber.return || null;
    }
    return null;
  };

  const optionsFor = (instance: SelectInstance): Option[] => {
    if (!Array.isArray(instance.props?.options)) return [];
    return instance.props.options
      .map((option) => option as Partial<Option>)
      .filter((option): option is Option => Boolean(clean(option.label)) && option.value !== undefined)
      .map((option) => ({ label: clean(option.label), value: option.value }));
  };

  const currentValue = (instance: SelectInstance, options: Option[]): string => {
    const selected = (Array.isArray(instance.props?.value) ? instance.props.value[0] : instance.props?.value) as Partial<Option> | undefined;
    if (!selected || selected.value === undefined) return "";
    return options.find((option) => String(option.value) === String(selected.value))?.label || clean(selected.label);
  };

  const renderedCurrentValue = (): string => {
    const container = element.closest<HTMLElement>(".select-shell, [class*='select' i]");
    if (element.id === "country") {
      const flag = Array.from(container?.querySelector<HTMLElement>("[class*='iti__flag']")?.classList || []).find((name) => /^iti__[a-z]{2}$/i.test(name));
      const code = flag?.slice("iti__".length).toUpperCase();
      if (code && typeof Intl.DisplayNames === "function") {
        return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || "";
      }
    }
    return clean(container?.querySelector<HTMLElement>(".select__single-value, [class*='single-value' i], [class*='singleValue' i]")?.textContent);
  };

  const matches = (actual: string, expected: string): boolean => {
    const left = normalized(actual);
    const right = normalized(expected);
    const leftAlias = countryAlias(actual);
    const rightAlias = countryAlias(expected);
    return Boolean(left && (left === right || leftAlias === rightAlias || (right.length > 1 && (left.includes(right) || right.includes(left)))));
  };

  const visible = (candidate: HTMLElement): boolean => {
    const style = window.getComputedStyle(candidate);
    const rect = candidate.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const renderedOption = (expected: string): HTMLElement | null => {
    const target = normalized(expected);
    const expectedFirstToken = target.split(/[,，\s]+/)[0] || target;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[role='option'], [role='listbox'] button, [role='listbox'] li, [data-value], [data-option-value], [class*='option' i], [class*='item' i], [class*='suggestion' i], [class*='result' i], .ui-menu-item, .ui-menu-item-wrapper, .pac-item",
      ),
    ).filter(
      (candidate) =>
        visible(candidate) && candidate.getAttribute("aria-disabled") !== "true" && !(candidate instanceof HTMLInputElement) && !(candidate instanceof HTMLSelectElement),
    );

    const matched = candidates.find((candidate) => {
      const candidateValue = normalized(
        candidate.getAttribute("data-value") || candidate.getAttribute("data-option-value") || candidate.getAttribute("aria-label") || candidate.textContent,
      );
      return (
        candidateValue === target ||
        countryAlias(candidateValue) === countryAlias(expected) ||
        (target.length > 1 && (candidateValue.includes(target) || target.includes(candidateValue))) ||
        (expectedFirstToken.length > 1 && candidateValue.includes(expectedFirstToken))
      );
    });
    if (matched) return matched;
    return candidates[0] || null;
  };

  const waitForRenderedOption = (expected: string): Promise<HTMLElement | null> =>
    new Promise((resolve) => {
      const startedAt = Date.now();
      const find = () => {
        const option = renderedOption(expected);
        if (option || Date.now() - startedAt >= 900) {
          resolve(option);
          return;
        }
        window.setTimeout(find, 40);
      };
      find();
    });

  const selectRenderedCombobox = async (): Promise<{
    handled: boolean;
    status?: "filled" | "already_filled" | "rejected";
  }> => {
    if (matches(renderedCurrentValue(), requestedValue)) {
      return { handled: true, status: "already_filled" };
    }
    element.focus({ preventScroll: true });
    element.click();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(element, requestedValue);
    else element.value = requestedValue;
    const inputEventOpts = { bubbles: true, composed: true };
    try {
      element.dispatchEvent(
        new InputEvent("input", {
          ...inputEventOpts,
          inputType: "insertText",
          data: requestedValue,
        }),
      );
    } catch {
      element.dispatchEvent(new Event("input", inputEventOpts));
    }
    const char = requestedValue.slice(-1) || "a";
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: char,
        code: `Key${char.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
      }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: char,
        code: `Key${char.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
      }),
    );
    element.dispatchEvent(new Event("change", inputEventOpts));

    const option = await waitForRenderedOption(requestedValue);
    if (!option) return { handled: false };
    const eventOpts = { bubbles: true, cancelable: true, composed: true };
    option.dispatchEvent(new MouseEvent("mousedown", eventOpts));
    option.dispatchEvent(new MouseEvent("mouseup", eventOpts));
    option.click();

    const startedAt = Date.now();
    let enterSent = false;
    return new Promise((resolve) => {
      const verify = () => {
        const currentVal = renderedCurrentValue() || clean(element.value);
        const hasHiddenId = Boolean(
          (document.getElementById("job_application_location_id") as HTMLInputElement)?.value || (document.querySelector("input[name*='location_id']") as HTMLInputElement)?.value,
        );
        const expectedFirstToken = normalized(requestedValue).split(/[,，\s]+/)[0] || "";
        if (matches(currentVal, requestedValue) || hasHiddenId || (expectedFirstToken.length > 1 && currentVal.toLowerCase().includes(expectedFirstToken))) {
          resolve({ handled: true, status: "filled" });
          return;
        }
        if (!enterSent && Date.now() - startedAt >= 120) {
          enterSent = true;
          const keyOptions = {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
          };
          element.dispatchEvent(new KeyboardEvent("keydown", keyOptions));
          element.dispatchEvent(new KeyboardEvent("keyup", keyOptions));
        }
        if (Date.now() - startedAt >= 900) {
          resolve({ handled: hasHiddenId || Boolean(element.value) });
          return;
        }
        window.setTimeout(verify, 40);
      };
      verify();
    });
  };

  const instance = findInstance();
  if (!instance) return selectRenderedCombobox();
  const options = optionsFor(instance);
  const requested = normalized(requestedValue);
  const requestedFirstToken = requested.split(/[,，\s]+/)[0] || requested;
  const option =
    options.find((candidate) => {
      const label = normalized(candidate.label);
      const value = normalized(String(candidate.value));
      return (
        label === requested ||
        countryAlias(label) === countryAlias(requestedValue) ||
        countryAlias(value) === countryAlias(requestedValue) ||
        value === requested ||
        (requested.length > 1 && (label.includes(requested) || requested.includes(label))) ||
        (requested.length > 1 && (value.includes(requested) || requested.includes(value))) ||
        (requestedFirstToken.length > 1 && (label.includes(requestedFirstToken) || value.includes(requestedFirstToken)))
      );
    }) || (options.length > 0 ? options[0] : undefined);
  if (!option) return selectRenderedCombobox();
  if (normalized(currentValue(instance, options)) === normalized(option.label)) {
    return Promise.resolve({ handled: true, status: "already_filled" });
  }

  instance.selectOption?.(option);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const updated = findInstance();
      const selected = updated ? currentValue(updated, optionsFor(updated)) : "";
      resolve({
        handled: normalized(selected) === normalized(option.label),
        status: normalized(selected) === normalized(option.label) ? "filled" : undefined,
      });
    }, 0);
  });
}

