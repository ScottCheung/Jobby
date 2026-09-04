import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { ProviderFormRoot } from "../platform-definition";

const CHOICE_GROUP_SELECTOR = [
  ".ashby-application-form-input-radio-group",
  ".ashby-application-form-input-checkbox-group",
].join(", ");

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cleanQuestion(value: string | null | undefined): string {
  return cleanText(value).replace(/\s*\*+\s*$/, "").trim();
}

function textWithoutInjectedTranslation(element: Element | null | undefined): string {
  if (!element) return "";
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll(".immersive-translate-target-wrapper").forEach((node) => node.remove());
  return cleanText(copy.textContent);
}

function optionLabel(input: HTMLInputElement): string {
  const explicit = input.id
    ? input.ownerDocument.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(input.id)}']`)
    : null;
  return textWithoutInjectedTranslation(explicit || input.closest("label")) || cleanText(input.value);
}

function optionValue(input: HTMLInputElement): string {
  return cleanText(input.getAttribute("value")) || optionLabel(input);
}

function questionLabel(group: HTMLElement): string {
  const entry = group.closest<HTMLElement>(".ashby-application-form-field-entry");
  return cleanQuestion(
    textWithoutInjectedTranslation(
      entry?.querySelector<HTMLElement>(".ashby-application-form-question-title") ||
        group.querySelector("legend"),
    ),
  );
}

function groupKey(group: HTMLElement, inputs: HTMLInputElement[], label: string, index: number): string {
  const fieldWrapper = group.closest<HTMLElement>("[data-field-path]");
  const fieldPath = cleanText(fieldWrapper?.dataset.fieldPath);
  const entryId = cleanText(fieldWrapper?.dataset.fieldEntryId);
  const names = Array.from(new Set(inputs.map((input) => cleanText(input.name)).filter(Boolean)));
  return fieldPath || entryId || cleanText(group.id) || (names.length === 1 ? names[0] || "" : "") ||
    `ashby-multiselect-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`;
}

export function adaptAshbyFormFields(
  fields: FormFieldObservation[],
  root: ProviderFormRoot,
): FormFieldObservation[] {
  const groups = Array.from(root.querySelectorAll<HTMLElement>(CHOICE_GROUP_SELECTOR));
  if (groups.length === 0) return fields;

  const consumedIds = new Set<string>();
  const consumedNames = new Set<string>();
  const choices: FormFieldObservation[] = [];

  groups.forEach((group, index) => {
    const type = group.classList.contains("ashby-application-form-input-radio-group")
      ? "radio"
      : "multiselect";
    const inputs = Array.from(group.querySelectorAll<HTMLInputElement>(`input[type='${type === "radio" ? "radio" : "checkbox"}']`))
      .filter((input) => !input.disabled && input.getAttribute("aria-disabled") !== "true");
    const label = questionLabel(group);
    if (inputs.length < 2 || !label) return;

    inputs.forEach((input) => {
      if (input.id) consumedIds.add(input.id);
      if (input.name) consumedNames.add(input.name);
    });
    const names = Array.from(new Set(inputs.map((input) => cleanText(input.name)).filter(Boolean)));
    const selected = inputs.filter((input) => input.checked).map(optionLabel).filter(Boolean);
    const entry = group.closest<HTMLElement>(".ashby-application-form-field-entry");
    const required = inputs.some((input) => input.required || input.getAttribute("aria-required") === "true") ||
      group.getAttribute("aria-required") === "true" ||
      Boolean(entry?.querySelector("[aria-required='true']"));

    choices.push({
      key: groupKey(group, inputs, label, index),
      id: cleanText(group.id) || undefined,
      name: names.length === 1 ? names[0] : undefined,
      type,
      label,
      required,
      filled: selected.length > 0,
      sensitive: false,
      options: inputs.map((input) => ({ label: optionLabel(input), value: optionValue(input) })),
      semanticFeatures: [
        "provider:ashby",
        type === "radio" ? "control:value-select" : "control:multi-value-select",
      ],
      ...(selected.length > 0 ? { currentValue: type === "radio" ? selected[0] : selected.join(", ") } : {}),
    });
  });

  if (choices.length === 0) return fields;
  return [
    ...fields.filter((field) =>
      !(field.id && consumedIds.has(field.id)) &&
      !(field.name && consumedNames.has(field.name)) &&
      !consumedNames.has(field.key),
    ),
    ...choices,
  ];
}
