import type { FormFieldTarget } from "../../../shared/contracts/form-actions";
import { queryAllInScope, type FormScope } from "../../dom/form-inspector";

export type AshbyChoiceGroup = {
  container: HTMLElement;
  options: HTMLInputElement[];
  label: string;
};

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalized(value: string): string {
  return cleanText(value).toLowerCase();
}

function groupLabel(container: HTMLElement): string {
  const entry = container.closest<HTMLElement>(".ashby-application-form-field-entry");
  return cleanText(
    entry?.querySelector<HTMLElement>(".ashby-application-form-question-title")?.textContent ||
      container.querySelector("legend")?.textContent,
  ).replace(/\s*\*+\s*$/, "");
}

export function findAshbyChoiceGroup(
  target: FormFieldTarget,
  scope: FormScope,
  type: "radio" | "multiselect",
): AshbyChoiceGroup | null {
  if (target.type !== type) return null;
  const inputType = type === "radio" ? "radio" : "checkbox";
  const selector = type === "radio"
    ? ".ashby-application-form-input-radio-group"
    : ".ashby-application-form-input-checkbox-group";
  const targetLabel = normalized(target.label);

  for (const container of queryAllInScope<HTMLElement>(scope, selector)) {
    const options = Array.from(
      container.querySelectorAll<HTMLInputElement>(`input[type='${inputType}']`),
    ).filter((option) => !option.disabled && option.getAttribute("aria-disabled") !== "true");
    if (options.length < 2) continue;

    const label = groupLabel(container);
    const currentLabel = normalized(label);
    const fieldWrapper = container.closest<HTMLElement>("[data-field-path]");
    const keyMatch = target.key === fieldWrapper?.dataset.fieldPath ||
      target.key === fieldWrapper?.dataset.fieldEntryId;
    const labelMatch = currentLabel === targetLabel ||
      (currentLabel.length > 3 && targetLabel.length > 3 &&
        (currentLabel.includes(targetLabel) || targetLabel.includes(currentLabel)));
    const idMatch = Boolean(
      target.id && (container.id === target.id || options.some((option) => option.id === target.id)),
    );
    const nameMatch = Boolean(target.name && options.some((option) => option.name === target.name));
    if (keyMatch || labelMatch || idMatch || nameMatch) return { container, options, label };
  }
  return null;
}
