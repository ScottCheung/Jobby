import type { FieldFillResult, FormFieldTarget } from "../../../shared/contracts/form-actions";
import type { FormScope } from "../../dom/form-inspector";
import { findFormElement } from "../../dom/form-driver";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalized(value: string | null | undefined): string {
  return cleanText(value).toLowerCase();
}

function visible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function exactOption(option: HTMLElement, requested: string): boolean {
  const optionText = normalized(option.textContent || option.getAttribute("aria-label"));
  const expected = normalized(requested);
  return optionText === expected || optionText.startsWith(`${expected} (`);
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

function pressKey(element: HTMLElement, key: string, code = key): void {
  element.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    code,
    bubbles: true,
    composed: true,
  }));
  element.dispatchEvent(new KeyboardEvent("keyup", {
    key,
    code,
    bubbles: true,
    composed: true,
  }));
}

function isWorkdayMultiSelect(element: HTMLElement): boolean {
  return element instanceof HTMLInputElement &&
    (element.getAttribute("data-uxi-widget-type") === "selectinput" ||
      Boolean(element.closest("[data-automation-id='multiSelectContainer']")));
}

function hasSelectedValue(element: HTMLElement, value: string): boolean {
  const field = element.closest<HTMLElement>("[data-automation-id^='formField-']") ||
    element.closest<HTMLElement>("[data-automation-id='multiSelectContainer']") ||
    element.parentElement;
  if (!field) return false;
  return Array.from(
    field.querySelectorAll<HTMLElement>(
      "[data-automation-id='selectedItem'] [data-automation-id='promptOption'], [data-automation-id='selectedItem']",
    ),
  ).some((selected) => exactOption(selected, value));
}

function availableWorkdayOptions(combobox: HTMLElement): HTMLElement[] {
  return Array.from(
    optionScope(combobox).querySelectorAll<HTMLElement>(
      "[role='option'][data-automation-id='menuItem']",
    ),
  ).filter((option) =>
    visible(option) &&
    !option.closest("[data-automation-id='selectedItemList']") &&
    normalized(option.textContent) !== "no items.",
  );
}

function hasWorkdayNoItems(combobox: HTMLElement): boolean {
  return Array.from(
    optionScope(combobox).querySelectorAll<HTMLElement>(
      "[role='option'][data-automation-id='menuItem']",
    ),
  ).some((option) => visible(option) && normalized(option.textContent) === "no items.");
}

function workdayKeyboardTarget(input: HTMLInputElement): HTMLElement {
  return document.activeElement instanceof HTMLElement ? document.activeElement : input;
}

function highlightedWorkdayOption(options: HTMLElement[]): HTMLElement | undefined {
  return options.find((option) =>
    option.getAttribute("aria-selected") === "true" ||
    option.getAttribute("data-automation-selected") === "true",
  );
}

function clickWorkdayOption(option: HTMLElement): void {
  const target = option.querySelector<HTMLElement>("[data-automation-id='promptLeafNode']") || option;
  target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
  target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
  target.click();
}

function finishWorkdaySearch(input: HTMLInputElement): void {
  setInputValue(input, "");
  pressKey(input, "Escape");
}

function comboboxFor(target: FormFieldTarget, scope: FormScope): HTMLElement | null {
  const native = findFormElement(target, scope);
  if (native instanceof HTMLSelectElement) return null;
  if (native?.getAttribute("role") === "combobox") return native;
  if (
    native instanceof HTMLInputElement &&
    (native.id === "skills--skills" ||
      native.getAttribute("data-uxi-widget-type") === "selectinput" ||
      Boolean(native.closest("[data-automation-id='multiSelectContainer']")))
  ) {
    return native;
  }
  const workdayField = native?.closest<HTMLElement>("[data-automation-id^='formField-']");
  const workdayListboxButton = workdayField?.querySelector<HTMLElement>(
    "button[aria-haspopup='listbox']",
  );
  if (workdayListboxButton) return workdayListboxButton;
  const escapedId = target.id ? CSS.escape(target.id) : "";
  const escapedName = target.name ? CSS.escape(target.name) : "";
  return (
    (escapedId ? scope.querySelector<HTMLElement>(`[role='combobox']#${escapedId}`) : null) ||
    (escapedName ? scope.querySelector<HTMLElement>(`[role='combobox'][name='${escapedName}']`) : null) ||
    native?.closest<HTMLElement>("[role='combobox']") ||
    null
  );
}

function optionScope(combobox: HTMLElement): ParentNode {
  const controls = cleanText(combobox.getAttribute("aria-controls"));
  return (controls && document.getElementById(controls)) || document;
}

export async function fillExactWorkdayCombobox(
  target: FormFieldTarget,
  value: string,
  scope: FormScope,
  shouldCancel: () => boolean = () => false,
): Promise<FieldFillResult | null> {
  const combobox = comboboxFor(target, scope);
  if (!combobox) return null;
  const commandId = `workday-${Date.now()}-${target.key}`.slice(0, 64);
  const current = normalized(combobox.textContent);
  if (current === normalized(value)) {
    return { commandId, key: target.key, status: "already_filled", message: "Exact Workday option already selected." };
  }

  const input = combobox instanceof HTMLInputElement
    ? combobox
    : combobox.querySelector<HTMLInputElement>("input") ||
      combobox.parentElement?.querySelector<HTMLInputElement>("input");
  combobox.click();
  input?.focus();
  if (input) setInputValue(input, value);

  if (input && isWorkdayMultiSelect(input)) {
    finishWorkdaySearch(input);
    input.focus();
    setInputValue(input, value);
    let stableNoItemsChecks = 0;
    let searchTriggered = false;
    let lastOptionsSignature = "";
    let stableOptionsChecks = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (shouldCancel()) {
        finishWorkdaySearch(input);
        return {
          commandId,
          key: target.key,
          status: "rejected",
          message: "Autofill was cancelled.",
        };
      }
      const options = availableWorkdayOptions(input);
      stableNoItemsChecks = hasWorkdayNoItems(input) ? stableNoItemsChecks + 1 : 0;
      if (stableNoItemsChecks >= 8) break;
      const exactIndex = options.findIndex((option) => exactOption(option, value));
      if (exactIndex >= 0) {
        const exactOptionRow = options[exactIndex];
        if (exactOptionRow?.isConnected) {
          clickWorkdayOption(exactOptionRow);
          await new Promise((resolve) => window.setTimeout(resolve, 200));
        }
        if (hasSelectedValue(input, value)) {
          return {
            commandId,
            key: target.key,
            status: "filled",
            message: "Exact Workday option selected and confirmed.",
          };
        }
        for (let index = 0; index <= options.length; index += 1) {
          if (shouldCancel()) break;
          const currentOptions = availableWorkdayOptions(input);
          const highlighted = highlightedWorkdayOption(currentOptions);
          if (highlighted && exactOption(highlighted, value)) {
            pressKey(workdayKeyboardTarget(input), "Enter");
            await new Promise((resolve) => window.setTimeout(resolve, 160));
            if (hasSelectedValue(input, value)) {
              return {
                commandId,
                key: target.key,
                status: "filled",
                message: "Exact Workday option selected and confirmed.",
              };
            }
            break;
          }
          pressKey(workdayKeyboardTarget(input), "ArrowDown");
          await new Promise((resolve) => window.setTimeout(resolve, 80));
        }
        const exactOptionRowAfterKeyboard = availableWorkdayOptions(input)
          .find((option) => exactOption(option, value));
        if (exactOptionRowAfterKeyboard?.isConnected) {
          clickWorkdayOption(exactOptionRowAfterKeyboard);
          await new Promise((resolve) => window.setTimeout(resolve, 160));
        }
        if (hasSelectedValue(input, value)) {
          return {
            commandId,
            key: target.key,
            status: "filled",
            message: "Exact Workday option selected and confirmed.",
          };
        }
        break;
      }
      const optionsSignature = options.map((option) => normalized(option.textContent)).join("|");
      if (optionsSignature) {
        stableOptionsChecks = optionsSignature === lastOptionsSignature ? stableOptionsChecks + 1 : 0;
        lastOptionsSignature = optionsSignature;
        if (stableOptionsChecks >= 6) break;
      } else {
        stableOptionsChecks = 0;
        lastOptionsSignature = "";
      }
      if (!searchTriggered && attempt >= 4) {
        pressKey(input, "Enter");
        searchTriggered = true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    finishWorkdaySearch(input);
    return {
      commandId,
      key: target.key,
      status: "rejected",
      message: `Workday has no confirmable exact option for “${value}”; skipped to avoid a wrong selection.`,
    };
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (shouldCancel()) {
      if (input) setInputValue(input, "");
      return {
        commandId,
        key: target.key,
        status: "rejected",
        message: "Autofill was cancelled.",
      };
    }
    const option = Array.from(
      optionScope(combobox).querySelectorAll<HTMLElement>("[role='option'], [data-automation-id='promptOption']"),
    ).find((candidate) => visible(candidate) && exactOption(candidate, value));
    if (option) {
      option.click();
      await new Promise((resolve) => window.setTimeout(resolve, 160));
      if (input && isWorkdayMultiSelect(input) && !hasSelectedValue(input, value)) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        continue;
      }
      if (
        exactOption(combobox, value) ||
        (input && normalized(input.value) === normalized(value)) ||
        option.getAttribute("aria-selected") === "true"
      ) {
        return { commandId, key: target.key, status: "filled", message: "Exact Workday option selected." };
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  if (input) setInputValue(input, "");
  return {
    commandId,
    key: target.key,
    status: "rejected",
    message: `Workday has no exact option for “${value}”; skipped to avoid a wrong selection.`,
  };
}
