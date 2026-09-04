/** @format */

import type {
  FieldFillInstruction,
  FieldFillResult,
  FormFieldTarget,
  FormFocusResult,
} from "../../../shared/contracts/form-actions";
import type { FormScope } from "../../dom/form-inspector";
import type { ProviderDriverOverride } from "../platform-definition";
import { result } from "../../dom/form-driver/events";
import {
  fillMultiSelectGroup,
  fillRadio,
} from "../../dom/form-driver/choice-driver";
import { scrollAndHighlightQuestion } from "../../dom/form-driver/focus-highlighter";
import { findAshbyChoiceGroup } from "./choice-groups";

export const ashbyDriverOverride: ProviderDriverOverride = {
  fillField: async (
    instruction: FieldFillInstruction,
    scope: FormScope,
  ): Promise<FieldFillResult | null> => {
    if (instruction.target.type === "multiselect") {
      if (!Array.isArray(instruction.value)) {
        return result(instruction, "rejected", "Multi-select values must be a list.");
      }
      const group = findAshbyChoiceGroup(instruction.target, scope, "multiselect");
      if (!group) {
        return result(instruction, "not_found", "The targeted multi-select field is no longer visible.");
      }
      const status = fillMultiSelectGroup(group, instruction.value, scope, instruction.source);
      if (status === "unavailable") {
        return result(instruction, "rejected", "One or more requested options are unavailable.");
      }
      if (status === "rejected") {
        return result(instruction, "rejected", "The webpage did not accept the multi-select change.");
      }
      return result(
        instruction,
        status,
        status === "filled" ? "Multi-select options updated." : "Multi-select already has the requested values.",
      );
    }

    if (instruction.target.type === "radio" && typeof instruction.value === "string") {
      const group = findAshbyChoiceGroup(instruction.target, scope, "radio");
      if (group) {
        if (!fillRadio(group.options[0]!, instruction.value, scope)) {
          return result(instruction, "rejected", "The requested radio option is unavailable.");
        }
        return result(instruction, "filled", "Radio option selected.");
      }
    }

    return null;
  },

  focusField: (
    target: FormFieldTarget,
    scope: FormScope,
  ): FormFocusResult | null => {
    if (target.type === "multiselect") {
      const group = findAshbyChoiceGroup(target, scope, "multiselect");
      if (!group) {
        return {
          key: target.key,
          status: "not_found",
          message: "The multi-select field is no longer visible.",
        };
      }
      scrollAndHighlightQuestion(group.container);
      return { key: target.key, status: "focused", message: "Field focused." };
    }
    if (target.type === "radio") {
      const group = findAshbyChoiceGroup(target, scope, "radio");
      if (group) {
        scrollAndHighlightQuestion(group.container);
        return { key: target.key, status: "focused", message: "Field focused." };
      }
    }
    return null;
  },
};
