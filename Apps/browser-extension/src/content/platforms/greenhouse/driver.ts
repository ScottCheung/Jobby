/** @format */

import type {
  FieldFillInstruction,
  FieldFillResult,
  FormFieldTarget,
} from "../../../shared/contracts/form-actions";
import type { FormScope } from "../../dom/form-inspector";
import type { ProviderDriverOverride } from "../platform-definition";
import { findFormElement } from "../../dom/form-driver/element-finder";
import { fillCheckboxChoiceGroup } from "../../dom/form-driver/choice-driver";
import { fillCombobox } from "../../dom/form-driver/select-combobox";
import { normalized, result } from "../../dom/form-driver/events";
import { isGreenhouseLocation } from "./form-field-adapter";
import { selectGreenhouseCombobox } from "./main-world-combobox";

function fieldsetForTarget(
  target: FormFieldTarget,
  scope: FormScope,
): HTMLInputElement | null {
  if (target.type !== "radio") return null;
  const expectedLabel = normalized(target.label);
  return Array.from(scope.querySelectorAll<HTMLInputElement>("input[type='checkbox'][name^='question_'][name$='[]']"))
    .find((element) => {
      const fieldset = element.closest("fieldset");
      const label = normalized(fieldset?.querySelector("legend")?.textContent || "");
      return (
        (target.name && element.name === target.name) ||
        (target.id && fieldset?.id === target.id) ||
        label === expectedLabel ||
        (label.length > 3 && expectedLabel.length > 3 &&
          (label.includes(expectedLabel) || expectedLabel.includes(label)))
      );
    }) || null;
}

async function fillGreenhouseField(
  instruction: FieldFillInstruction,
  scope: FormScope,
): Promise<FieldFillResult | null> {
  if (instruction.target.type === "radio" && typeof instruction.value === "string") {
    const checkbox = fieldsetForTarget(instruction.target, scope);
    if (checkbox) {
      return result(
        instruction,
        fillCheckboxChoiceGroup(checkbox, instruction.value, scope) ? "filled" : "rejected",
        "Choice selected.",
      );
    }
  }
  if (instruction.target.type !== "select" || typeof instruction.value !== "string") return null;
  const element = findFormElement(instruction.target, scope);
  if (!element || !isGreenhouseLocation(element)) return null;
  return result(
    instruction,
    await fillCombobox(element, instruction.value, scope) ? "filled" : "rejected",
    "Dropdown value updated.",
  );
}

export const greenhouseDriverOverride: ProviderDriverOverride = {
  fillField: (instruction, scope) => fillGreenhouseField(instruction, scope as FormScope),
  selectCombobox: (target, value, commandId, context) =>
    selectGreenhouseCombobox(target, value, commandId, context),
  isComboboxCommitted: (
    element: HTMLInputElement,
    scope: FormScope,
  ): boolean => {
    const root = element.getRootNode();
    const searchScope =
      root instanceof Document || root instanceof ShadowRoot ? root : scope;
    return Boolean(
      (
        searchScope.querySelector(
          "#job_application_location_id, input[name*='location_id']",
        ) as HTMLInputElement
      )?.value,
    );
  },
};
