import type {
  FormFieldObservation,
  FormInspection,
  FormPlatform,
} from "../../shared/contracts/form-inspection";
import { canonicalizeFormFields } from "../../shared/utils/form-field-resolution";

import {
  cleanLabel,
  cleanText,
  isAuxiliaryFieldLabel,
  isHoneypotField,
  isVisibleElement,
  queryAllInScope,
  scopeFor,
  visibleControlsInScope,
  type FormScope,
} from "./form-inspector/visibility";
import {
  isPlaceholderOption,
  optionLabelFor,
  type FormOption,
} from "./form-inspector/option-reader";
import { labelFor, requiredFor } from "./form-inspector/label-resolver";
import {
  ariaCheckboxElementsInScope,
  ariaCheckboxIsChecked,
  ariaCheckboxLabel,
  ariaRadioGroups,
  buttonChoiceGroups,
  checkboxChoiceGroupFor,
  currentCheckboxChoiceValue,
  currentValue,
  documentOptionsFor,
  fieldKeyFor,
  fieldType,
  fileRequiredFor,
  fileUploadLabelFor,
  isDocumentSelectionRadio,
  isFilled,
  isPresentedFileInput,
  optionsFor,
  radioGroupForElement,
  selectedChoice,
  selectedDocumentFor,
  uploadObservationFor,
} from "./form-inspector/field-classifier";

export type { FormScope, QueryScope } from "./form-inspector/visibility";
export {
  cleanText,
  cleanLabel,
  isAuxiliaryFieldLabel,
  isHoneypotField,
  isLikelyHelperText,
  isValidationElement,
  composedParent,
  closestComposed,
  scopeFor,
  isVisibleElement,
  isDropdownSearchFilter,
  isAuxiliaryApplicationControl,
  isInspectableControl,
  queryAllInScope,
  elementsInScope,
  controlsInScope,
  hasVisibleChoiceLabel,
  visibleControlsInScope,
  CONTROL_SELECTOR,
  BUTTON_CHOICE_VALUE,
  NOISY_LABEL_TAGS,
  extractTextWithoutControls,
  labelTextWithoutControl,
} from "./form-inspector/visibility";

export type { FormOption } from "./form-inspector/option-reader";
export {
  PLACEHOLDER_OPTION_LABELS,
  normalizedOptionLabel,
  isPlaceholderOption,
  observedOptionValue,
  controlledListboxFor,
  openComboboxValueIsCommitted,
  comboboxContainerFor,
  isSelectableCombobox,
  isPhoneCountryElement,
  comboboxCurrentValue,
  liveComboboxOptions,
  COUNTRY_CODES,
  countryOptions,
  comboboxOptionsFor,
  optionLabelFor,
  parentTextIsDistinct,
  isOptionLabelElement,
} from "./form-inspector/option-reader";

export {
  precedingQuestionLabel,
  cleanPlaceholderLabel,
  containerLabelFor,
  shadowHostLabelFor,
  labelledByText,
  labelFor,
  requiredFor,
} from "./form-inspector/label-resolver";

export type {
  CheckboxChoiceGroup,
  ButtonChoiceGroup,
  AriaRadioGroup,
} from "./form-inspector/field-classifier";
export {
  checkboxPresentationElements,
  checkboxIsChecked,
  ariaCheckboxElementsInScope,
  ariaCheckboxLabel,
  ariaCheckboxIsChecked,
  isDocumentSelectionRadio,
  radioGroupForElement,
  fieldType,
  optionsFor,
  currentValue,
  isFilled,
  fileUploadGroupFor,
  composedUploadAttributeHint,
  composedUploadContainer,
  semanticFileKey,
  isUploadHelperText,
  labelledByTextFrom,
  labelFromAttribute,
  fileUploadLabelFor,
  selectedDocumentFor,
  uploadErrorFor,
  uploadObservationFor,
  documentOptionsFor,
  fileRequiredFor,
  isPresentedFileInput,
  isAutofillResumeInput,
  fieldKeyFor,
  checkboxChoiceGroupFor,
  currentCheckboxChoiceValue,
  ariaRadioGroups,
  visibleChoiceButtons,
  choiceGroupContainer,
  choiceGroupLabel,
  buttonChoiceGroups,
  selectedChoice,
  findButtonChoiceOption,
} from "./form-inspector/field-classifier";

export function inspectVisibleFormFields(scope: FormScope = document): FormFieldObservation[] {
  const visibleControls = visibleControlsInScope(scope);
  const seenRadioNames = new Set<string>();
  const seenCheckboxGroupNames = new Set<string>();
  const result: FormFieldObservation[] = [];

  for (let index = 0; index < visibleControls.length && result.length < 200; index += 1) {
    const element = visibleControls[index];
    if (!element) continue;
    const type = fieldType(element);

    if (element instanceof HTMLInputElement && isDocumentSelectionRadio(element)) continue;
    // File controls need composed-tree label, required-state, and upload
    // inspection. Always handle them in the dedicated file pass below.
    if (type === "file") continue;

    if (element instanceof HTMLInputElement) {
      const checkboxGroup = checkboxChoiceGroupFor(element);
      if (checkboxGroup) {
        if (seenCheckboxGroupNames.has(checkboxGroup.groupKey)) continue;
        seenCheckboxGroupNames.add(checkboxGroup.groupKey);
        const value = currentCheckboxChoiceValue(checkboxGroup, scope);
        result.push({
          key: checkboxGroup.groupKey,
          id: cleanText(checkboxGroup.container.id) || undefined,
          name: checkboxGroup.name || undefined,
          type: checkboxGroup.type,
          label: checkboxGroup.label,
          required: checkboxGroup.required,
          filled: Boolean(value),
          sensitive: false,
          options: checkboxGroup.options.map((option) => ({
            label: optionLabelFor(option, scope),
            value: option.value,
          })),
          ...(value ? { currentValue: value } : {}),
        });
        continue;
      }
    }

    if (type === "radio" && element instanceof HTMLInputElement) {
      const radioGroup = radioGroupForElement(element, scope);
      const groupKey = element.name || radioGroup.map((r) => r.id || r.value).join("-");
      if (seenRadioNames.has(groupKey)) continue;
      seenRadioNames.add(groupKey);
    }

    const elementScope = scopeFor(element, scope);
    const val = currentValue(element, type, elementScope);
    const label = labelFor(element, elementScope);
    if (isAuxiliaryFieldLabel(label)) continue;
    if (isHoneypotField(element, label)) continue;
    result.push({
      key: fieldKeyFor(element, index),
      id: cleanText(element.id) || undefined,
      name: cleanText(element.getAttribute("name")) || undefined,
      type,
      label,
      required: requiredFor(element),
      filled: isFilled(element, type, elementScope),
      sensitive: type === "password",
      options: optionsFor(element, elementScope),
      ...(val ? { currentValue: val } : {}),
    });
  }


  const keys = new Set(result.map((field) => field.key));
  const fileInputs = queryAllInScope<HTMLInputElement>(scope, "input[type='file']");
  for (let index = 0; index < fileInputs.length && result.length < 200; index += 1) {
    const input = fileInputs[index];
    if (!input || input.disabled || input.getAttribute("aria-disabled") === "true") continue;
    if (!isPresentedFileInput(input, scope)) continue;
    const key = fieldKeyFor(input, visibleControls.length + index);
    if (keys.has(key)) continue;
    const selectedDocument = selectedDocumentFor(input, scope);
    const selectedFile = input.files?.[0];
    const upload = uploadObservationFor(input, scope, selectedDocument);
    const label = fileUploadLabelFor(input, scope);
    if (isAuxiliaryFieldLabel(label)) continue;
    result.push({
      key,
      id: cleanText(input.id) || undefined,
      name: cleanText(input.getAttribute("name")) || undefined,
      type: "file",
      label,
      required: fileRequiredFor(input, scope),
      filled: Boolean((selectedFile && selectedFile.size > 0) || selectedDocument?.accepted),
      sensitive: true,
      options: documentOptionsFor(input, scope),
      upload,
      ...(selectedDocument
        ? { currentValue: selectedDocument.name }
        : selectedFile
          ? { currentValue: selectedFile.name }
          : {}),
    });
  }

  // Treat non-input ARIA comboboxes as select fields so they can be classified
  // and filled through the same contract as native selects.
  const ariaComboboxes = queryAllInScope<HTMLElement>(scope, "[role='combobox']");
  for (const combobox of ariaComboboxes) {
    if (result.length >= 200) break;
    if (combobox instanceof HTMLInputElement || combobox.getAttribute("role") !== "combobox")
      continue;
    if (!isVisibleElement(combobox) || combobox.getAttribute("aria-disabled") === "true")
      continue;
    const key = fieldKeyFor(combobox, result.length, scope);
    if (
      result.some((field) => field.key === key || (combobox.id && field.id === combobox.id))
    )
      continue;
    const value = cleanText(combobox.textContent);
    const elementScope = scopeFor(combobox, scope);
    const label = labelFor(combobox, elementScope);

    const controlsId = cleanText(combobox.getAttribute("aria-controls"));
    let options: FormOption[] = [];
    if (controlsId) {
      // React Select and similar libraries portal their listbox to document.body.
      // Resolve aria-controls from the control's document/shadow root rather
      // than the narrow application container.
      const listbox =
        elementScope.querySelector<HTMLElement>(`#${CSS.escape(controlsId)}`) ||
        document.querySelector<HTMLElement>(`#${CSS.escape(controlsId)}`);
      if (listbox) {
        options = Array.from(listbox.querySelectorAll<HTMLElement>("[role='option'], li"))
          .map((opt) => {
            const optLabel = cleanText(opt.textContent || opt.getAttribute("aria-label"));
            return { label: optLabel, value: optLabel };
          })
          .filter((opt) => Boolean(opt.label) && !isPlaceholderOption(opt.label, opt.value));
      }
    }

    result.push({
      key,
      id: cleanText(combobox.id) || undefined,
      name: cleanText(combobox.getAttribute("name")) || undefined,
      type: "select",
      label,
      required: requiredFor(combobox),
      filled: Boolean(value && !isPlaceholderOption(value, "selected")),
      sensitive: false,
      options,
      ...(value && !isPlaceholderOption(value, "selected") ? { currentValue: value } : {}),
    });
  }

  for (const group of ariaRadioGroups(scope)) {
    if (result.length >= 200) break;
    if (
      result.some(
        (field) =>
          field.type === "radio" && cleanLabel(field.label) === cleanLabel(group.label),
      )
    )
      continue;
    const selected = group.options.find(
      (option) =>
        option.getAttribute("aria-checked") === "true" ||
        option.getAttribute("data-state") === "checked" ||
        option.getAttribute("data-state") === "selected",
    );
    result.push({
      key: cleanText(group.container.id) || `aria-radio-${result.length + 1}`,
      id: cleanText(group.container.id) || undefined,
      name: cleanText(group.container.getAttribute("name")) || undefined,
      type: "radio",
      label: group.label,
      required: group.required,
      filled: Boolean(selected),
      sensitive: false,
      options: group.options.map((option) => {
        const value = cleanText(
          option.getAttribute("data-value") ||
            option.getAttribute("value") ||
            option.textContent ||
            option.getAttribute("aria-label"),
        );
        const optionLabel = cleanText(
          option.getAttribute("aria-label") || option.textContent || value,
        );
        return { label: optionLabel, value };
      }),
      ...(selected
        ? {
            currentValue: cleanText(
              selected.getAttribute("aria-label") || selected.textContent,
            ),
          }
        : {}),
    });
  }

  for (const group of buttonChoiceGroups(scope)) {
    if (result.length >= 200) break;
    if (
      result.some(
        (field) =>
          field.type === "radio" && cleanLabel(field.label) === cleanLabel(group.label),
      )
    )
      continue;
    const selected = selectedChoice(group.options);
    result.push({
      key: `button-choice-${result.length + 1}`,
      type: "radio",
      label: group.label,
      required: group.required,
      filled: Boolean(selected),
      sensitive: false,
      options: group.options.map((option) => {
        const value = cleanText(option.textContent || option.getAttribute("aria-label"));
        return { label: value, value };
      }),
      ...(selected
        ? {
            currentValue: cleanText(
              selected.textContent || selected.getAttribute("aria-label"),
            ),
          }
        : {}),
    });
  }

  // Keep ARIA checkboxes in the field model so they can be recognised and
  // autofilled like native checkboxes.
  for (const element of ariaCheckboxElementsInScope(scope)) {
    if (result.length >= 200) break;
    const label = ariaCheckboxLabel(element, scope);
    const key =
      cleanText(element.id) ||
      cleanText(element.getAttribute("name")) ||
      `aria-checkbox-${result.length + 1}`;
    if (
      result.some(
        (field) =>
          field.key === key ||
          (field.type === "checkbox" && cleanLabel(field.label) === cleanLabel(label)),
      )
    )
      continue;
    result.push({
      key,
      id: cleanText(element.id) || undefined,
      name: cleanText(element.getAttribute("name")) || undefined,
      type: "checkbox",
      label,
      required: requiredFor(element),
      filled: ariaCheckboxIsChecked(element),
      sensitive: false,
      options: [],
      ...(ariaCheckboxIsChecked(element) ? { currentValue: "true" } : {}),
    });
  }

  return canonicalizeFormFields(result);
}

export function readApplicationForm(
  url: string,
  platform: FormPlatform,
  isApplicationPage: boolean,
  submitLabel?: string,
  scope: FormScope | null = document,
  action?: "next" | "submit",
  canGoBack = false,
  adaptFields?: (fields: FormFieldObservation[]) => FormFieldObservation[],
): FormInspection {
  const inspectedFields = scope ? inspectVisibleFormFields(scope) : [];
  const fields = adaptFields ? adaptFields(inspectedFields) : inspectedFields;
  // Some application steps are review/confirmation screens: they have a
  // valid application container and a Next/Back action, but no editable
  // controls at all. Keep them actionable instead of classifying them as
  // "not a form" and disabling the step controls.
  if (!isApplicationPage) {
    return {
      kind: "not_application_form",
      platform,
      url,
      reason: "No visible application form was found.",
    };
  }
  return {
    kind: "application_form",
    platform,
    url,
    fields,
    hasSubmitAction: Boolean(submitLabel),
    canGoBack,
    ...(submitLabel ? { submitLabel } : {}),
    ...(action ? { action } : {}),
  };
}

export function readPageInputFields(
  url: string,
  platform: FormPlatform,
  adaptFields?: (fields: FormFieldObservation[]) => FormFieldObservation[],
): FormInspection | null {
  const inspectedFields = inspectVisibleFormFields(document);
  const fields = adaptFields ? adaptFields(inspectedFields) : inspectedFields;
  if (fields.length === 0) return null;
  return {
    kind: "page_input_fields",
    platform,
    url,
    fields,
  };
}
