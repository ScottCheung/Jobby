/** @format */

import type {
  FieldFillInstruction,
  FieldFillResult,
  FileUploadInstruction,
  FormFieldTarget,
} from '../../shared/contracts/form-actions';
import type { FormFieldType } from '../../shared/contracts/form-inspection';

import {
  checkboxIsChecked,
  checkboxPresentationElements,
  comboboxCurrentValue,
  comboboxOptionsFor,
  elementsInScope,
  fieldKeyFor,
  findButtonChoiceOption,
  inspectVisibleFormFields,
  isSelectableCombobox,
  visibleControlsInScope,
  type FormScope,
} from './form-inspector';
import { selectPageCombobox } from './combobox-bridge';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function markAutofillWrite(element: FormControl, source: FieldFillInstruction['source']): void {
  if (source !== 'backend') return;
  element.dataset.jobbyAutofillUntil = String(Date.now() + 2_000);
  window.setTimeout(() => delete element.dataset.jobbyAutofillUntil, 2_100);
}

function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalized(value: string): string {
  return cleanText(value).toLowerCase();
}

function result(
  instruction: FieldFillInstruction,
  status: FieldFillResult['status'],
  message: string,
): FieldFillResult {
  return {
    commandId: instruction.commandId,
    key: instruction.target.key,
    status,
    message,
  };
}

function fieldType(element: FormControl): FormFieldType {
  if (element instanceof HTMLSelectElement) return 'select';
  if (element instanceof HTMLTextAreaElement) return 'textarea';
  const type = element.type.toLowerCase();
  if (type === 'text' || type === 'search') return 'text';
  if (
    [
      'checkbox',
      'radio',
      'file',
      'number',
      'email',
      'tel',
      'url',
      'date',
      'password',
    ].includes(type)
  ) {
    return type as FormFieldType;
  }
  return 'unknown';
}

function labelFor(element: HTMLElement, scope: FormScope): string {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const ariaLabel = cleanText(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;
  if (element.id) {
    const label = queryScope.querySelector<HTMLLabelElement>(
      `label[for='${CSS.escape(element.id)}']`,
    );
    const text = cleanText(label?.textContent);
    if (text) return text;
  }
  const parentLabel = cleanText(element.closest('label')?.textContent);
  if (parentLabel) return parentLabel;
  const legend = cleanText(
    element.closest('fieldset')?.querySelector('legend')?.textContent,
  );
  if (legend) return legend;
  return (
    cleanText(element.getAttribute('placeholder')) ||
    cleanText(element.getAttribute('name')) ||
    'Unnamed field'
  );
}

function checkboxChoiceGroupFor(
  element: HTMLInputElement,
  scope: FormScope,
): {
  container: HTMLElement;
  options: HTMLInputElement[];
  label: string;
} | null {
  const name = cleanText(element.name);
  if (
    element.type.toLowerCase() !== 'checkbox' ||
    !name ||
    !name.startsWith('question_') ||
    !name.endsWith('[]')
  ) {
    return null;
  }
  const container = element.closest<HTMLElement>('fieldset');
  const label = cleanText(container?.querySelector('legend')?.textContent);
  if (!container || !label) return null;
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const options = Array.from(
    queryScope.querySelectorAll<HTMLInputElement>(
      `input[type='checkbox'][name='${CSS.escape(name)}']`,
    ),
  ).filter(
    (candidate) =>
      isVisible(candidate) && candidate.closest('fieldset') === container,
  );
  return options.length >= 2 ? { container, options, label } : null;
}

function isCheckboxChoiceGroupForTarget(
  element: FormControl,
  target: FormFieldTarget,
  scope: FormScope,
): boolean {
  if (!(element instanceof HTMLInputElement) || target.type !== 'radio')
    return false;
  const group = checkboxChoiceGroupFor(element, scope);
  if (!group) return false;
  const currentLabel = normalized(group.label);
  const targetLabel = normalized(target.label);
  return (
    currentLabel === targetLabel ||
    (currentLabel.length > 3 &&
      targetLabel.length > 3 &&
      (currentLabel.includes(targetLabel) ||
        targetLabel.includes(currentLabel)))
  );
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function labelsMatchTarget(
  element: FormControl,
  target: FormFieldTarget,
  scope: FormScope,
): boolean {
  const checkboxGroup =
    element instanceof HTMLInputElement ?
      checkboxChoiceGroupFor(element, scope)
    : null;
  const currentLabel = normalized(
    isCheckboxChoiceGroupForTarget(element, target, scope) ?
      checkboxGroup?.label || ''
    : labelFor(element, scope),
  );
  const targetLabel = normalized(target.label);
  return (
    (fieldType(element) === target.type ||
      isCheckboxChoiceGroupForTarget(element, target, scope)) &&
    (currentLabel === targetLabel ||
      (currentLabel.length > 3 &&
        targetLabel.length > 3 &&
        (currentLabel.includes(targetLabel) ||
          targetLabel.includes(currentLabel))))
  );
}

export function findFormElement(
  target: FormFieldTarget,
  scope: FormScope,
): FormControl | null {
  const controls = visibleControlsInScope(scope);
  const keyed = controls.find(
    (element, index) => fieldKeyFor(element, index) === target.key,
  );
  if (
    keyed &&
    (!target.id || keyed.id === target.id) &&
    (!target.name || keyed.getAttribute('name') === target.name) &&
    (Boolean(target.id || target.name) ||
      labelsMatchTarget(keyed, target, scope))
  ) {
    return keyed;
  }
  if (target.id) {
    const element = controls.find((candidate) => candidate.id === target.id);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    ) {
      return isVisible(element) ? element : null;
    }
  }
  if (target.name) {
    const elements = controls.filter(
      (element) => element.getAttribute('name') === target.name,
    );
    const visibleElements = elements.filter((element) => isVisible(element));
    return (
      visibleElements.find((element) =>
        labelsMatchTarget(element, target, scope),
      ) ||
      visibleElements[0] ||
      null
    );
  }
  return (
    controls.find((element) => labelsMatchTarget(element, target, scope)) ||
    null
  );
}

function findFileInput(
  target: FormFieldTarget,
  scope: FormScope,
): HTMLInputElement | null {
  const files = elementsInScope(scope).filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement &&
      element.type.toLowerCase() === 'file',
  );
  const keyed = files.find(
    (element, index) =>
      fieldKeyFor(element, visibleControlsInScope(scope).length + index) ===
      target.key,
  );
  if (
    keyed &&
    (!target.id || keyed.id === target.id) &&
    (!target.name || keyed.name === target.name) &&
    (Boolean(target.id || target.name) ||
      fileInputMatchesTarget(keyed, target, scope))
  ) {
    return keyed;
  }
  if (target.id)
    return files.find((element) => element.id === target.id) || null;
  if (target.name)
    return files.find((element) => element.name === target.name) || null;
  return (
    files.find((element) => fileInputMatchesTarget(element, target, scope)) ||
    null
  );
}

function fileUploadTrigger(
  input: HTMLInputElement,
  scope: FormScope,
): HTMLElement {
  const root = input.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const explicitTrigger =
    (input.id ?
      queryScope.querySelector<HTMLElement>(
        `label[for='${CSS.escape(input.id)}']`,
      )
    : null) ||
    (input.id ?
      queryScope.querySelector<HTMLElement>(
        `[aria-controls='${CSS.escape(input.id)}']`,
      )
    : null);
  if (explicitTrigger && isVisible(explicitTrigger)) return explicitTrigger;

  let container = input.parentElement;
  for (let depth = 0; container && depth < 5; depth += 1) {
    const visibleControl = Array.from(
      container.querySelectorAll<HTMLElement>("button, [role='button'], label"),
    ).find((candidate) => {
      if (!isVisible(candidate)) return false;
      return /upload|browse|choose|attach|resume|cv|file/.test(
        normalized(
          candidate.textContent || candidate.getAttribute('aria-label') || '',
        ),
      );
    });
    if (visibleControl) return visibleControl;
    container = container.parentElement;
  }
  return explicitTrigger || input;
}

function fileInputMatchesTarget(
  input: HTMLInputElement,
  target: FormFieldTarget,
  scope: FormScope,
): boolean {
  const targetLabel = normalized(target.label);
  const trigger = fileUploadTrigger(input, scope);
  const uploadGroup = input.closest<HTMLElement>(
    "[role='group'][aria-labelledby], .file-upload, [class*='file-upload' i]",
  );
  const root = input.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const groupLabel = cleanText(
    uploadGroup
      ?.getAttribute('aria-labelledby')
      ?.split(/\s+/)
      .map((id) => queryScope.querySelector(`#${CSS.escape(id)}`)?.textContent)
      .join(' '),
  );
  const context = normalized(
    [
      groupLabel,
      input.getAttribute('aria-label'),
      input.getAttribute('name'),
      trigger.getAttribute('aria-label'),
      trigger.textContent,
      trigger.closest("fieldset, section, [role='group'], div")?.textContent,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return (
    context.includes(targetLabel) ||
    (targetLabel.length > 3 &&
      context.includes(targetLabel.replace(/\s*\*+\s*$/, '')))
  );
}

function selectExistingDocument(
  input: HTMLInputElement,
  optionId: string,
  scope: FormScope,
): 'selected' | 'already_selected' | 'not_found' {
  const root = input.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const option = queryScope.querySelector<HTMLInputElement>(
    `input[type='radio'][id='${CSS.escape(optionId)}']`,
  );
  if (!option) return 'not_found';
  if (option.checked) return 'already_selected';
  clickRadioOption(option, scope);
  return option.checked ? 'selected' : 'not_found';
}

function setValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype =
    element instanceof HTMLTextAreaElement ?
      HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function emitChange(element: FormControl): void {
  const eventOptions = { bubbles: true, composed: true };
  try {
    element.dispatchEvent(
      new InputEvent('input', { ...eventOptions, inputType: 'insertText' }),
    );
  } catch {
    element.dispatchEvent(new Event('input', eventOptions));
  }
  element.dispatchEvent(new Event('change', eventOptions));
  // React and similar frameworks delegate blur validation through focusout.
  element.dispatchEvent(new FocusEvent('focusout', eventOptions));
  element.dispatchEvent(new FocusEvent('blur', eventOptions));
}

function emitInput(element: HTMLInputElement): void {
  const eventOptions = { bubbles: true, composed: true };
  try {
    element.dispatchEvent(
      new InputEvent('input', { ...eventOptions, inputType: 'insertText' }),
    );
  } catch {
    element.dispatchEvent(new Event('input', eventOptions));
  }
}

function decodeBase64(contentBase64: string): Uint8Array | null {
  try {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

export async function uploadFormFile(
  instruction: FileUploadInstruction,
  scope: FormScope | null = document,
): Promise<FieldFillResult> {
  if (!scope)
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: 'not_found',
      message: 'No supported application form is open.',
    };
  const input = findFileInput(instruction.target, scope);
  if (!input)
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: 'not_found',
      message: 'The upload control is no longer available.',
    };
  const bytes = decodeBase64(instruction.contentBase64);
  if (!bytes)
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: 'rejected',
      message: 'The resume file could not be decoded.',
    };

  const accepted = input.accept
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const extensionStart = instruction.filename.lastIndexOf('.');
  const extension =
    extensionStart >= 0 ?
      instruction.filename.slice(extensionStart).toLowerCase()
    : '';
  const acceptedByInput =
    accepted.length === 0 ||
    accepted.some(
      (value) =>
        value === instruction.mimeType.toLowerCase() ||
        value === extension ||
        (value.endsWith('/*') &&
          instruction.mimeType.toLowerCase().startsWith(value.slice(0, -1))),
    );
  if (!acceptedByInput) {
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: 'rejected',
      message: `This upload control does not accept ${instruction.filename}.`,
    };
  }

  try {
    const scrollPosition = { left: window.scrollX, top: window.scrollY };
    const file = new File(
      [bytes.slice().buffer as ArrayBuffer],
      instruction.filename,
      { type: instruction.mimeType },
    );
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'files',
    )?.set;
    if (setter) setter.call(input, transfer.files);
    else input.files = transfer.files;
    emitChange(input);
    await waitForUploadUiToSettle(input, instruction.filename);
    restoreScrollAfterRerender(scrollPosition);
  } catch {
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: 'rejected',
      message: 'The webpage blocked automatic file assignment.',
    };
  }

  const selected = input.files?.[0];
  if (
    !selected ||
    selected.name !== instruction.filename ||
    selected.size === 0
  ) {
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: 'rejected',
      message: 'The webpage did not accept the resume file.',
    };
  }
  return {
    commandId: instruction.commandId,
    key: instruction.target.key,
    status: 'filled',
    message: `${instruction.filename} uploaded.`,
  };
}

function waitForUploadUiToSettle(
  input: HTMLInputElement,
  filename: string,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: number | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      const text = cleanText(input.closest('form, section, div')?.textContent);
      if (!input.isConnected || text.includes(filename)) finish();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    timer = window.setTimeout(finish, 900);
  });
}

function restoreScrollAfterRerender(position: {
  left: number;
  top: number;
}): void {
  const restore = () => {
    // Preserve the user's reading position when an ATS re-renders the
    // uploader. Do not override a new position the user has scrolled to.
    if (position.top > 80 && window.scrollY < 80) {
      window.scrollTo({
        left: position.left,
        top: position.top,
        behavior: 'auto',
      });
    }
  };
  restore();
  [80, 260, 700].forEach((delay) => window.setTimeout(restore, delay));
}

function matchesTarget(
  element: FormControl,
  instruction: FieldFillInstruction,
  scope: FormScope,
): boolean {
  return labelsMatchTarget(element, instruction.target, scope);
}

function setSelectValue(element: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function clickControl(target: HTMLElement): void {
  const eventOptions = { bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
  target.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  target.dispatchEvent(new PointerEvent('pointerup', eventOptions));
  target.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  target.click();
}

function checkboxInteractionTargets(
  checkbox: HTMLInputElement,
  scope: FormScope,
): HTMLElement[] {
  const visiblePresentation = checkboxPresentationElements(
    checkbox,
    scope,
  ).filter((candidate) => candidate !== checkbox && isVisible(candidate));
  return [...visiblePresentation, checkbox];
}

function updateCheckbox(
  checkbox: HTMLInputElement,
  checked: boolean,
  scope: FormScope,
): boolean {
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  for (const target of checkboxInteractionTargets(checkbox, scope)) {
    if (checkboxIsChecked(checkbox, scope) === checked) return true;
    clickControl(target);
    if (checkboxIsChecked(checkbox, scope) === checked) {
      restoreScrollAfterRerender(scrollPosition);
      return true;
    }
  }
  return checkboxIsChecked(checkbox, scope) === checked;
}

function visibleOptionMatch(
  root: ParentNode,
  value: string,
): HTMLElement | null {
  const targetValue = normalized(value);
  return (
    Array.from(
      root.querySelectorAll<HTMLElement>(
        "[role='option'], [role='listbox'] button, [role='listbox'] li, [data-value], [data-option-value]",
      ),
    ).find((candidate) => {
      if (
        !isVisible(candidate) ||
        candidate.getAttribute('aria-disabled') === 'true'
      )
        return false;
      const candidateValue = normalized(
        candidate.getAttribute('data-value') ||
          candidate.getAttribute('data-option-value') ||
          candidate.getAttribute('aria-label') ||
          candidate.textContent,
      );
      return (
        candidateValue === targetValue ||
        (targetValue.length > 1 &&
          (candidateValue.includes(targetValue) ||
            targetValue.includes(candidateValue)))
      );
    }) || null
  );
}

function clickVisualSelectOption(
  element: HTMLSelectElement,
  value: string,
  scope: FormScope,
): boolean {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const fieldContainer =
    element.closest<HTMLElement>(
      "label, [role='combobox'], [data-automation], [data-testid], .field, .input-group",
    ) || element.parentElement;
  const trigger = fieldContainer?.querySelector<HTMLElement>(
    "[role='combobox'], button[aria-haspopup='listbox'], [aria-controls][role='button']",
  );
  if (!trigger) return false;

  clickControl(trigger);
  const option =
    visibleOptionMatch(queryScope, value) ||
    (queryScope !== document ? visibleOptionMatch(document, value) : null);
  if (!option) return false;
  clickControl(option);
  return true;
}

function comboboxListbox(
  element: HTMLInputElement,
  scope: FormScope,
): HTMLElement | null {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const id = cleanText(element.getAttribute('aria-controls'));
  if (!id) return null;
  return (
    queryScope.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ||
    (queryScope !== document ?
      document.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    : null)
  );
}

function matchingComboboxLabel(
  element: HTMLInputElement,
  value: string,
  scope: FormScope,
): string {
  const targetValue = normalized(value);
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const matchingOption = comboboxOptionsFor(element, queryScope).find(
    (option) => {
      const optionValue = normalized(option.value);
      const optionLabel = normalized(option.label);
      return (
        optionValue === targetValue ||
        optionLabel === targetValue ||
        (targetValue.length > 1 &&
          (optionValue.includes(targetValue) ||
            targetValue.includes(optionValue))) ||
        (targetValue.length > 1 &&
          (optionLabel.includes(targetValue) ||
            targetValue.includes(optionLabel)))
      );
    },
  );
  return matchingOption?.label || value;
}

function comboboxSelectionMatches(
  element: HTMLInputElement,
  value: string,
): boolean {
  const selected = normalized(comboboxCurrentValue(element));
  const expected = normalized(value);
  return Boolean(
    selected &&
    (selected === expected ||
      (expected.length > 1 &&
        (selected.includes(expected) || expected.includes(selected)))),
  );
}

async function fillCombobox(
  element: HTMLInputElement,
  value: string,
  scope: FormScope,
): Promise<boolean> {
  const label = matchingComboboxLabel(element, value, scope);
  if (comboboxSelectionMatches(element, label)) return true;

  const bridged = await selectPageCombobox(element, value);
  if (bridged?.ok && comboboxSelectionMatches(element, label)) return true;

  if (element.getAttribute('aria-expanded') !== 'true') clickControl(element);
  setValue(element, label);
  emitInput(element);

  const listbox = comboboxListbox(element, scope);
  const option =
    (listbox && visibleOptionMatch(listbox, label)) ||
    visibleOptionMatch(document, label);
  if (!option) return false;
  clickControl(option);
  return comboboxSelectionMatches(element, label);
}

function fillSelect(
  element: HTMLSelectElement,
  value: string,
  scope: FormScope,
): boolean {
  const normValue = normalized(value);
  const option = Array.from(element.options).find(
    (candidate) =>
      candidate.value === value ||
      normalized(candidate.value) === normValue ||
      normalized(candidate.textContent || '') === normValue ||
      (normValue.length > 1 &&
        normalized(candidate.textContent || '').includes(normValue)) ||
      (normValue.length > 1 &&
        normValue.includes(normalized(candidate.textContent || ''))),
  );
  if (!option) return false;
  // SEEK and other React application forms often render a hidden native
  // select beside a visual combobox. Prefer the same visible option click a
  // user performs so their controlled state updates as well.
  clickVisualSelectOption(
    element,
    option.value || option.textContent || value,
    scope,
  );
  if (element.value === option.value) return true;
  setSelectValue(element, option.value);
  return element.value === option.value;
}

function optionLabelFor(element: HTMLElement, scope: FormScope): string {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const ariaLabel = cleanText(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const id = cleanText(element.id);
  if (id) {
    const label = queryScope.querySelector<HTMLLabelElement>(
      `label[for='${CSS.escape(id)}']`,
    );
    const text = cleanText(label?.textContent);
    if (text) return text;
  }

  const parentLabel = cleanText(element.closest('label')?.textContent);
  if (parentLabel) return parentLabel;

  if (element instanceof HTMLInputElement && element.value)
    return element.value;
  return '';
}

function isSeekHost(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === 'seek.com' ||
    hostname.endsWith('.seek.com') ||
    hostname === 'seek.com.au' ||
    hostname.endsWith('.seek.com.au')
  );
}

function clickRadioOption(element: HTMLInputElement, scope: FormScope): void {
  // SEEK's document and cover-letter controls are native radios. Its React
  // state updates from the input's own change path; clicking the text label
  // from an isolated extension world can update only the panel's mirror.
  if (isSeekHost()) {
    element.focus({ preventScroll: true });
    element.click();
    if (element.checked) return;
  }
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const explicitLabel =
    element.id ?
      queryScope.querySelector<HTMLLabelElement>(
        `label[for='${CSS.escape(element.id)}']`,
      )
    : null;
  const target =
    explicitLabel ||
    element.closest<HTMLElement>("label, [role='radio']") ||
    element;
  clickControl(target);
}

function fillRadio(
  element: HTMLInputElement,
  value: string,
  scope: FormScope,
): boolean {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const group =
    element.name ?
      Array.from(
        queryScope.querySelectorAll<HTMLInputElement>(
          `input[type='radio'][name='${CSS.escape(element.name)}']`,
        ),
      )
    : [element];
  const targetNorm = normalized(value);
  const selected = group.find(
    (candidate) =>
      candidate.value === value ||
      normalized(candidate.value) === targetNorm ||
      normalized(optionLabelFor(candidate, scope)) === targetNorm ||
      normalized(labelFor(candidate, scope)) === targetNorm ||
      (targetNorm.length > 1 &&
        normalized(optionLabelFor(candidate, scope)).includes(targetNorm)) ||
      (targetNorm.length > 1 &&
        targetNorm.includes(normalized(optionLabelFor(candidate, scope)))),
  );
  if (!selected) return false;
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  // LinkedIn's custom radio UI is often controlled by a handler on the
  // surrounding label/card rather than the input. Follow the same pointer
  // and click path a user takes on the whole option.
  clickRadioOption(selected, scope);
  if (!selected.checked) {
    return false;
  }
  restoreScrollAfterRerender(scrollPosition);
  return true;
}

function fillCheckboxChoiceGroup(
  element: HTMLInputElement,
  value: string,
  scope: FormScope,
): boolean {
  const group = checkboxChoiceGroupFor(element, scope);
  if (!group) return false;
  const targetValue = normalized(value);
  const selected = group.options.find((option) => {
    const optionLabel = normalized(optionLabelFor(option, scope));
    return (
      option.value === value ||
      normalized(option.value) === targetValue ||
      optionLabel === targetValue ||
      (targetValue.length > 1 &&
        (optionLabel.includes(targetValue) ||
          targetValue.includes(optionLabel)))
    );
  });
  if (!selected) return false;

  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  // These Greenhouse questions are visually checkboxes but are phrased as a
  // single answer. Keep the form state aligned with the panel's one-choice UI.
  for (const option of group.options) {
    if (
      option !== selected &&
      checkboxIsChecked(option, scope) &&
      !updateCheckbox(option, false, scope)
    )
      return false;
  }
  if (
    !checkboxIsChecked(selected, scope) &&
    !updateCheckbox(selected, true, scope)
  )
    return false;
  restoreScrollAfterRerender(scrollPosition);
  return checkboxIsChecked(selected, scope);
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

  const element = findFormElement(instruction.target, scope);
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
  if (type === 'password') {
    return result(
      instruction,
      'requires_user_action',
      'Sensitive fields require explicit user handling.',
    );
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
    if (!fillSelect(select, instruction.value, scope))
      return result(
        instruction,
        'rejected',
        'The requested select option is unavailable.',
      );
    if (select.value === previousValue)
      return result(
        instruction,
        'already_filled',
        'Select already has the requested value.',
      );
    emitChange(select);
    return result(instruction, 'filled', 'Select value updated.');
  }

  const textElement = element as HTMLInputElement | HTMLTextAreaElement;
  if (textElement.value === instruction.value)
    return result(
      instruction,
      'already_filled',
      'Field already has the requested value.',
    );
  setValue(textElement, instruction.value);
  emitChange(textElement);
  return result(instruction, 'filled', 'Field value updated.');
}

export function fillFormFieldValue(
  target: FormFieldTarget,
  value: string | boolean,
  scope: FormScope | null = document,
): Promise<FieldFillResult> {
  return fillFormField(
    {
      type: 'content.fill-field',
      commandId: `panel-${Date.now()}-${target.key}`,
      source: 'panel',
      target,
      value,
    },
    scope,
  );
}

export interface FormFocusResult {
  key: string;
  status: 'focused' | 'not_found';
  message: string;
}

function questionContainerFor(element: HTMLElement): HTMLElement {
  const semanticContainer = element.closest<HTMLElement>(
    [
      'fieldset',
      "[role='group']",
      '.fb-dash-form-element',
      '.jobs-easy-apply-form-element',
      '.jobs-document-upload',
      '.jobs-document-upload-redesign-card',
      '[data-test-form-element]',
      '[data-test-form-element-container]',
      '.artdeco-text-input--container',
      '.artdeco-dropdown',
      '.artdeco-toggle',
    ].join(', '),
  );
  if (semanticContainer) return semanticContainer;

  const wrappingLabel = element.closest<HTMLElement>('label');
  if (wrappingLabel) return wrappingLabel;

  let candidate: HTMLElement = element;
  for (let depth = 0; depth < 4; depth += 1) {
    const parent = candidate.parentElement;
    if (!parent || !isVisible(parent)) break;
    const rect = parent.getBoundingClientRect();
    const hasQuestionText = Boolean(
      parent.querySelector('label, legend, [aria-label]'),
    );
    if (
      hasQuestionText &&
      rect.height > element.getBoundingClientRect().height + 8 &&
      rect.height < 420
    ) {
      return parent;
    }
    candidate = parent;
  }
  return element;
}

function scrollAndHighlightQuestion(element: HTMLElement): void {
  const question = questionContainerFor(element);
  question.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  });

  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'fixed',
    background: 'rgba(250, 204, 21, 0.30)',
    border: '2px solid rgba(202, 138, 4, 0.95)',
    borderRadius: '14px',
    padding: '7px',
    margin: '-7px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    transition: 'opacity 1000ms ease',
    opacity: '0',
  });
  document.documentElement.appendChild(highlight);

  let revealed = false;
  const positionHighlight = () => {
    const rect = question.getBoundingClientRect();
    Object.assign(highlight.style, {
      left: `${Math.max(0, rect.left - 7)}px`,
      top: `${Math.max(0, rect.top - 7)}px`,
      width: `${rect.width + 14}px`,
      height: `${rect.height + 14}px`,
    });
  };

  const revealAfterScroll = () => {
    if (revealed) return;
    revealed = true;
    document.removeEventListener('scrollend', revealAfterScroll, true);
    positionHighlight();
    highlight.style.opacity = '1';
  };

  // Chrome emits scrollend for both the document and nested application
  // panels. The timeout is a fallback for pages that implement scrolling
  // without that event.
  document.addEventListener('scrollend', revealAfterScroll, true);
  window.setTimeout(revealAfterScroll, 750);
  window.setTimeout(() => {
    highlight.style.opacity = '0';
    window.setTimeout(() => highlight.remove(), 260);
  }, 1900);
}

export function focusFormField(
  target: FormFieldTarget,
  scope: FormScope | null = document,
): FormFocusResult {
  if (!scope)
    return {
      key: target.key,
      status: 'not_found',
      message: 'No active form scope.',
    };
  if (target.type === 'file') {
    const input = findFileInput(target, scope);
    if (!input)
      return {
        key: target.key,
        status: 'not_found',
        message: 'The upload control is no longer available.',
      };
    const trigger = fileUploadTrigger(input, scope);
    // A side-panel click crosses an extension message boundary, so it does
    // not retain the browser's trusted user activation required to open a
    // native file picker. Reliably take the user to the real upload button
    // instead, where their click can open the picker.
    scrollAndHighlightQuestion(trigger);
    return {
      key: target.key,
      status: 'focused',
      message:
        'Upload control highlighted. Click the upload button on the webpage to choose a local file.',
    };
  }
  const element = findFormElement(target, scope);
  if (!element)
    return {
      key: target.key,
      status: 'not_found',
      message: 'The field is no longer visible.',
    };

  const focusTarget =
    (
      target.type === 'radio' &&
      element instanceof HTMLInputElement &&
      checkboxChoiceGroupFor(element, scope)
    ) ?
      checkboxChoiceGroupFor(element, scope)?.container || element
    : target.type === 'checkbox' && element instanceof HTMLInputElement ?
      checkboxPresentationElements(element, scope).find(
        (candidate) => candidate !== element && isVisible(candidate),
      ) || element
    : element;
  if (focusTarget === element) element.focus({ preventScroll: true });
  scrollAndHighlightQuestion(focusTarget);

  return { key: target.key, status: 'focused', message: 'Field focused.' };
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
    /eligible|authorized|work\s+rights|right\s+to\s+work|permit|citizen|pr|residency|legally/i.test(
      labelNorm,
    )
  ) {
    if (!/sponsorship|require\s+visa|visa\s+sponsorship/i.test(labelNorm)) {
      defaultAnswer = 'Yes';
    }
  }

  if (/sponsorship|require\s+visa|visa\s+sponsorship/i.test(labelNorm)) {
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
