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

function comboboxFor(target: FormFieldTarget, scope: FormScope): HTMLElement | null {
  const native = findFormElement(target, scope);
  if (native instanceof HTMLSelectElement) return null;
  if (native?.getAttribute("role") === "combobox") return native;
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
    : combobox.querySelector<HTMLInputElement>("input");
  combobox.click();
  input?.focus();
  if (input) setInputValue(input, value);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const option = Array.from(
      optionScope(combobox).querySelectorAll<HTMLElement>("[role='option'], [data-automation-id='promptOption']"),
    ).find((candidate) => visible(candidate) && exactOption(candidate, value));
    if (option) {
      option.click();
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      return { commandId, key: target.key, status: "filled", message: "Exact Workday option selected." };
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
