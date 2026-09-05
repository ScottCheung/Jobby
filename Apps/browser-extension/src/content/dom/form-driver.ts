/** @format */

import type {
  FieldFillInstruction,
  FieldFillResult,
  FormFieldTarget,
} from '../../shared/contracts/form-actions';
import type { FormFieldType } from '../../shared/contracts/form-inspection';

import {
  checkboxIsChecked,
  comboboxCurrentValue,
  findButtonChoiceOption,
  inspectVisibleFormFields,
  isSelectableCombobox,
  jobAdderPhoneCountryControls,
  type FormScope,
} from './form-inspector';
import { providerDefinitions } from '../platforms/registry';
import {
  clickControl,
  emitChange,
  markAutofillWrite,
  normalized,
  restoreScrollAfterRerender,
  result,
  setValue,
} from './form-driver/events';
import {
  ariaCheckboxIsChecked,
  checkboxChoiceGroupFor,
  fieldType,
  findAriaCheckbox,
  findAriaCombobox,
  findFormElement,
  matchesTarget,
} from './form-driver/element-finder';
import {
  fillCheckboxChoiceGroup,
  fillRadio,
  updateCheckbox,
} from './form-driver/choice-driver';
import {
  fillAriaCombobox,
  fillCombobox,
  fillSelect,
} from './form-driver/select-combobox';
import {
  clearFormFile,
  findFileInput,
  selectExistingDocument,
  uploadFormFile,
} from './form-driver/file-uploader';
import {
  focusFormField,
  type FormFocusResult,
} from './form-driver/focus-highlighter';

// Re-export submodules for backward compatibility
export {
  findFormElement,
  uploadFormFile,
  clearFormFile,
  focusFormField,
  type FormFocusResult,
};

function findJobAdderPhoneCountryControl(
  target: FormFieldTarget,
  scope: FormScope,
) {
  return jobAdderPhoneCountryControls(scope).find((control) =>
    target.key === control.countryCode.id ||
    target.key === control.countryCode.name ||
    (target.id && target.id === control.countryCode.id) ||
    (target.name && target.name === control.countryCode.name),
  ) || null;
}

function fillJobAdderPhoneCountry(
  instruction: FieldFillInstruction,
  scope: FormScope,
): FieldFillResult | null {
  if (instruction.target.type !== 'select' || typeof instruction.value !== 'string') return null;
  const control = findJobAdderPhoneCountryControl(instruction.target, scope);
  if (!control) return null;

  const requestedValue = instruction.value;
  const requested = requestedValue.trim().toUpperCase();
  const option = control.options.find((candidate) =>
    candidate.value.toUpperCase() === requested ||
    normalized(candidate.label) === normalized(requestedValue),
  );
  if (!option && requestedValue !== '') {
    return result(instruction, 'rejected', 'The requested phone country is unavailable.');
  }
  const nextValue = option?.value || '';
  if (normalized(control.countryCode.value) === normalized(nextValue)) {
    return result(instruction, 'already_filled', 'Phone country already has the requested value.');
  }

  markAutofillWrite(control.countryList, instruction.source);
  setValue(control.countryList, nextValue);
  emitChange(control.countryList);
  // The JobAdder Select2 handler updates this hidden field itself. Set it as
  // a fallback as well, so a delayed widget initialisation cannot leave the
  // phone number with an empty country code.
  if (normalized(control.countryCode.value) !== normalized(nextValue)) {
    setValue(control.countryCode, nextValue);
    emitChange(control.countryCode);
  }
  return result(
    instruction,
    normalized(control.countryCode.value) === normalized(nextValue) ? 'filled' : 'rejected',
    normalized(control.countryCode.value) === normalized(nextValue)
      ? 'Phone country updated.'
      : 'The webpage did not accept the phone country update.',
  );
}

export async function fillFormField(
  instruction: FieldFillInstruction,
  scope: FormScope | null = document,
): Promise<FieldFillResult> {
  if (!scope)
    return result(
      instruction,
      'not_found',
      'No supported application form is open.',
    );

  for (const provider of providerDefinitions) {
    if (provider.driver?.fillField) {
      const driverResult = await provider.driver.fillField(instruction, scope);
      if (driverResult) return driverResult;
    }
  }

  const jobAdderCountryResult = fillJobAdderPhoneCountry(instruction, scope);
  if (jobAdderCountryResult) return jobAdderCountryResult;

  if (instruction.target.type === 'file') {
    const input = findFileInput(instruction.target, scope);
    if (!input)
      return result(
        instruction,
        'not_found',
        'The upload control is no longer available.',
      );
    if (
      typeof instruction.value === 'string' &&
      instruction.source === 'panel'
    ) {
      if (instruction.value === '') {
        return clearFormFile(input, instruction);
      }
      const selection = selectExistingDocument(input, instruction.value, scope);
      if (selection === 'selected')
        return result(instruction, 'filled', 'Existing document selected.');
      if (selection === 'already_selected')
        return result(
          instruction,
          'already_filled',
          'This document is already selected.',
        );
      return result(
        instruction,
        'rejected',
        'The selected document is no longer available.',
      );
    }
    return result(
      instruction,
      'requires_user_action',
      'Choose a local file through the browser file picker.',
    );
  }

  const ariaCheckbox = instruction.target.type === 'checkbox'
    ? findAriaCheckbox(instruction.target, scope)
    : null;
  if (ariaCheckbox) {
    if (typeof instruction.value !== 'boolean')
      return result(instruction, 'rejected', 'Checkbox values must be boolean.');
    if (ariaCheckboxIsChecked(ariaCheckbox) === instruction.value)
      return result(instruction, 'already_filled', 'Checkbox already has the requested value.');
    if (instruction.value) clickControl(ariaCheckbox);
    if (!instruction.value && ariaCheckboxIsChecked(ariaCheckbox)) clickControl(ariaCheckbox);
    return result(
      instruction,
      ariaCheckboxIsChecked(ariaCheckbox) === instruction.value ? 'filled' : 'rejected',
      ariaCheckboxIsChecked(ariaCheckbox) === instruction.value
        ? 'Checkbox value updated.'
        : 'The webpage did not accept this checkbox change. Please tick it directly on the webpage.',
    );
  }

  const ariaCombobox = instruction.target.type === 'select'
    ? findAriaCombobox(instruction.target, scope)
    : null;
  if (ariaCombobox) {
    if (typeof instruction.value !== 'string')
      return result(instruction, 'rejected', 'Dropdown values must be strings.');
    const current = normalized(ariaCombobox.textContent || '');
    const expected = normalized(instruction.value);
    if (current && (current === expected || current.includes(expected) || expected.includes(current))) {
      return result(instruction, 'already_filled', 'Dropdown already has the requested value.');
    }
    const filled = await fillAriaCombobox(ariaCombobox, instruction.value);
    return result(
      instruction,
      filled ? 'filled' : 'rejected',
      filled ? 'Dropdown value updated.' : 'The requested dropdown option is unavailable.',
    );
  }

  let element = findFormElement(instruction.target, scope);
  if (!element && instruction.target.type !== 'radio') {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    element = findFormElement(instruction.target, scope);
  }
  if (!element) {
    if (
      instruction.target.type === 'radio' &&
      typeof instruction.value === 'string'
    ) {
      const choice = findButtonChoiceOption(
        scope,
        instruction.target.label,
        instruction.value,
      );
      if (!choice)
        return result(
          instruction,
          'not_found',
          'The targeted field is no longer visible.',
        );
      const scrollPosition = { left: window.scrollX, top: window.scrollY };
      clickControl(choice);
      restoreScrollAfterRerender(scrollPosition);
      return result(instruction, 'filled', 'Button choice selected.');
    }
    return result(
      instruction,
      'not_found',
      'The targeted field is no longer visible.',
    );
  }
  // Side-panel edits originate from a field just inspected in this exact
  // form scope. LinkedIn may append required markers or alter the label DOM
  // between inspection and editing, so label text is not a safe second
  // identity check here. Backend instructions remain protected by it.
  if (
    instruction.source !== 'panel' &&
    !matchesTarget(element, instruction, scope)
  ) {
    return result(
      instruction,
      'rejected',
      'The field identity changed; no value was written.',
    );
  }

  const type = fieldType(element);
  markAutofillWrite(element, instruction.source);
  if (
    instruction.target.type === 'radio' &&
    element instanceof HTMLInputElement &&
    checkboxChoiceGroupFor(element, scope)
  ) {
    if (typeof instruction.value !== 'string')
      return result(instruction, 'rejected', 'Choice values must be strings.');
    if (!fillCheckboxChoiceGroup(element, instruction.value, scope)) {
      return result(
        instruction,
        'rejected',
        'The requested option is unavailable.',
      );
    }
    return result(instruction, 'filled', 'Choice selected.');
  }
  if (type === 'unknown')
    return result(instruction, 'rejected', 'This field type is not supported.');

  if (type === 'checkbox') {
    if (typeof instruction.value !== 'boolean')
      return result(
        instruction,
        'rejected',
        'Checkbox values must be boolean.',
      );
    const checkbox = element as HTMLInputElement;
    if (checkboxIsChecked(checkbox, scope) === instruction.value) {
      return result(
        instruction,
        'already_filled',
        'Checkbox already has the requested value.',
      );
    }
    if (!updateCheckbox(checkbox, instruction.value, scope)) {
      return result(
        instruction,
        'rejected',
        'The webpage did not accept this checkbox change. Please tick it directly on the webpage.',
      );
    }
    return result(instruction, 'filled', 'Checkbox value updated.');
  }

  if (type === 'radio') {
    if (typeof instruction.value !== 'string')
      return result(instruction, 'rejected', 'Radio values must be strings.');
    if (!fillRadio(element as HTMLInputElement, instruction.value, scope))
      return result(
        instruction,
        'rejected',
        'The requested radio option is unavailable.',
      );
    return result(instruction, 'filled', 'Radio option selected.');
  }

  if (typeof instruction.value !== 'string')
    return result(
      instruction,
      'rejected',
      'This field requires a string value.',
    );
  if (type === 'select') {
    if (element instanceof HTMLInputElement && isSelectableCombobox(element)) {
      const combobox = element;
      const previousValue = comboboxCurrentValue(combobox);
      if (!(await fillCombobox(combobox, instruction.value, scope))) {
        return result(
          instruction,
          'rejected',
          'The requested dropdown option is unavailable.',
        );
      }
      await new Promise((res) => window.setTimeout(res, 150));
      if (
        normalized(comboboxCurrentValue(combobox)) === normalized(previousValue)
      ) {
        return result(
          instruction,
          'already_filled',
          'Dropdown already has the requested value.',
        );
      }
      return result(instruction, 'filled', 'Dropdown value updated.');
    }
    const select = element as HTMLSelectElement;
    const previousValue = select.value;
    const selection = await fillSelect(select, instruction.value, scope);
    if (!selection.matched)
      return result(
        instruction,
        'rejected',
        'The requested select option is unavailable.',
      );
    // Dispatch after the async visual option click and native value write so
    // controlled ATS components receive the event for the committed value.
    emitChange(select);
    await new Promise((res) => window.setTimeout(res, 150));
    if (!selection.changed && select.value === previousValue)
      return result(
        instruction,
        'already_filled',
        'Select already has the requested value.',
      );
    return result(instruction, 'filled', 'Select value updated.');
  }

  const textElement = element as HTMLInputElement | HTMLTextAreaElement;
  if (textElement.value === instruction.value)
    return result(
      instruction,
      'already_filled',
      'Field already has the requested value.',
    );

  try {
    textElement.focus({ preventScroll: true });
  } catch {}
  const focusEventOptions = { bubbles: true, composed: true, cancelable: true };
  textElement.dispatchEvent(new PointerEvent('pointerdown', focusEventOptions));
  textElement.dispatchEvent(new MouseEvent('mousedown', focusEventOptions));
  textElement.dispatchEvent(
    new FocusEvent('focusin', { bubbles: true, composed: true }),
  );
  textElement.dispatchEvent(
    new FocusEvent('focus', { bubbles: true, composed: true }),
  );

  setValue(textElement, instruction.value);
  textElement.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true, composed: true }),
  );
  textElement.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true, composed: true }),
  );
  emitChange(textElement);
  try {
    textElement.blur();
  } catch {}
  return result(instruction, 'filled', 'Field value updated.');
}

export function fillFormFieldValue(
  target: FormFieldTarget,
  value: FieldFillInstruction['value'],
  scope: FormScope | null = document,
): Promise<FieldFillResult> {
  const safeKey = target.key.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const commandId = `panel-${Date.now()}-${safeKey}`.slice(0, 64);
  return fillFormField(
    {
      type: 'content.fill-field',
      commandId,
      source: 'panel',
      target,
      value,
    },
    scope,
  );
}

export function canFillField(
  instruction: FieldFillInstruction,
  scope: FormScope | null = document,
): boolean {
  return Boolean(
    scope &&
    inspectVisibleFormFields(scope).some(
      (field) =>
        (instruction.target.id && field.id === instruction.target.id) ||
        (instruction.target.name && field.name === instruction.target.name),
    ),
  );
}

export async function tryFillDefaultRadioForUnanswered(
  field: {
    key: string;
    id?: string;
    name?: string;
    type: FormFieldType;
    label: string;
    required: boolean;
    filled: boolean;
    options: Array<{ label: string; value: string }>;
  },
  scope: FormScope | null = document,
): Promise<boolean> {
  if (!scope || field.type !== 'radio' || !field.required || field.filled)
    return false;

  const labelNorm = field.label.toLowerCase();
  let defaultAnswer = '';

  if (
    /eligible|authorized|work\s+rights|working\s+rights|right\s+to\s+work|permit|citizen|pr|residency|legally/i.test(
      labelNorm,
    )
  ) {
    if (!/sponsorship|require\s+visa|visa\s+sponsorship|on\s+a\s+work\s+visa/i.test(labelNorm)) {
      defaultAnswer = 'Yes';
    }
  }

  if (/sponsorship|require\s+visa|visa\s+sponsorship/i.test(labelNorm)) {
    defaultAnswer = 'No';
  }

  if (/on\s+a\s+work\s+visa|work\s+visa|current\s+visa|visa\s+holder/i.test(labelNorm)) {
    defaultAnswer = 'No';
  }

  if (!defaultAnswer) return false;

  const instruction: FieldFillInstruction = {
    type: 'content.fill-field',
    commandId: `default-radio-${Date.now()}`,
    source: 'backend',
    target: {
      key: field.key,
      id: field.id,
      name: field.name,
      type: 'radio',
      label: field.label,
    },
    value: defaultAnswer,
  };

  const res = await fillFormField(instruction, scope);
  return res.status === 'filled' || res.status === 'already_filled';
}
