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
  isAutofillResumeInput,
  jobAdderPhoneCountryControls,
  labelFor,
  visibleControlsInScope,
  type FormScope,
} from './form-inspector';
import {
  inspectPageCombobox,
  selectPageCombobox,
} from './combobox-bridge';
import {
  findAshbyChoiceGroup,
  type AshbyChoiceGroup,
} from '../platforms/ashby/choice-groups';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function markAutofillWrite(element: FormControl, _source: FieldFillInstruction['source']): void {
  element.dataset.jobbyAutofillUntil = String(Date.now() + 3_000);
  window.setTimeout(() => delete element.dataset.jobbyAutofillUntil, 3_100);
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
  if (isSelectableCombobox(element)) return 'select';
  const type = element.type.toLowerCase();
  if (type === 'text' && element.hasAttribute('data-val-phone')) return 'tel';
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

function labelTextWithoutControl(label: HTMLElement | null | undefined): string {
  if (!label) return '';
  const copy = label.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('input,select,textarea,button,img,svg,noscript,script,style').forEach((node) => node.remove());
  return cleanText(copy.textContent);
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

function ariaCheckboxLabel(element: HTMLElement, scope: FormScope): string {
  const labelledBy = cleanText(element.getAttribute('aria-labelledby'))
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => cleanText(scope.querySelector(`#${CSS.escape(id)}`)?.textContent))
    .filter(Boolean)
    .join(' ');
  return cleanText(
    labelledBy ||
      element.getAttribute('aria-label') ||
      labelTextWithoutControl(element.closest('label')) ||
      element.getAttribute('name') ||
      element.id,
  );
}

function ariaCheckboxIsChecked(element: HTMLElement): boolean {
  return element.getAttribute('aria-checked') === 'true' ||
    element.getAttribute('data-state') === 'checked' ||
    element.classList.contains('checked') ||
    element.classList.contains('selected');
}

function findAriaCheckbox(target: FormFieldTarget, scope: FormScope): HTMLElement | null {
  const candidates = elementsInScope(scope).filter((element) =>
    element.matches("[role='checkbox']") && isVisible(element),
  );
  return candidates.find((element) =>
    (target.id && element.id === target.id) ||
    (target.name && element.getAttribute('name') === target.name) ||
    normalized(ariaCheckboxLabel(element, scope)) === normalized(target.label),
  ) || null;
}

function findAriaCombobox(target: FormFieldTarget, scope: FormScope): HTMLElement | null {
  const candidates = elementsInScope(scope).filter((element) =>
    !(element instanceof HTMLInputElement) &&
    element.getAttribute('role') === 'combobox' &&
    isVisible(element) &&
    element.getAttribute('aria-disabled') !== 'true',
  );
  const targetLabel = normalized(target.label);
  return candidates.find((element) =>
    (target.id && element.id === target.id) ||
    (target.name && element.getAttribute('name') === target.name) ||
    normalized(labelFor(element, scope)) === targetLabel,
  ) || null;
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
  const rawCurrent =
    isCheckboxChoiceGroupForTarget(element, target, scope) ?
      checkboxGroup?.label || ''
    : labelFor(element, scope);
  const currentLabel = normalized(rawCurrent)
    .replace(/^\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*/gi, '')
    .replace(/\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*$/gi, '')
    .trim();
  const targetLabel = normalized(target.label)
    .replace(/^\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*/gi, '')
    .replace(/\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*$/gi, '')
    .trim();
  return (
    (fieldType(element) === target.type ||
      isCheckboxChoiceGroupForTarget(element, target, scope)) &&
    (currentLabel === targetLabel ||
      (currentLabel.length >= 2 &&
        targetLabel.length >= 2 &&
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
  if (keyed) {
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
  const allFiles = elementsInScope(scope).filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && element.type.toLowerCase() === 'file',
  );
  const files = allFiles.filter((element) => !isAutofillResumeInput(element));
  const keyed = files.find(
    (element) =>
      fieldKeyFor(
        element,
        visibleControlsInScope(scope).length + allFiles.indexOf(element),
      ) === target.key,
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

function nearbyFileLabelText(input: HTMLInputElement): string {
  let container = input.parentElement;
  for (let depth = 0; container && depth < 5; depth += 1) {
    // Many React forms render the field label as a sibling of the upload drop
    // zone rather than associating it with the hidden input. Only consider
    // preceding siblings of the branch containing the input, so upload-copy
    // such as "browse computer" inside the drop zone is not a field label.
    const children = Array.from(container.children);
    const inputBranchIndex = children.findIndex((child) => child.contains(input));
    const siblingText = children
      .slice(0, inputBranchIndex)
      .map((child) => cleanText(child.textContent))
      .filter(Boolean)
      .join(' ');
    if (siblingText) return siblingText;
    container = container.parentElement;
  }
  return '';
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
      nearbyFileLabelText(input),
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

function formatValueForInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): string {
  if (element instanceof HTMLInputElement) {
    const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    if (isIsoDate) {
      const [year, month, day] = value.trim().split('-');
      if (placeholder.includes('mm/dd/yyyy') || ariaLabel.includes('mm/dd/yyyy')) {
        return `${month}/${day}/${year}`;
      }
      if (placeholder.includes('dd/mm/yyyy') || ariaLabel.includes('dd/mm/yyyy')) {
        return `${day}/${month}/${year}`;
      }
    }
  }
  return value;
}

function setValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const formattedValue = formatValueForInput(element, value);
  const tracker = (element as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
  if (tracker) {
    tracker.setValue(formattedValue);
  }

  const prototype =
    element instanceof HTMLTextAreaElement ?
      HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(element, formattedValue);
  else element.value = formattedValue;
}

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

function isUploadChoiceOption(
  element: HTMLElement,
  target: FormFieldTarget,
  scope: FormScope,
): boolean {
  const isCover = /(?:cover[\s_-]*letter|cover[\s_-]*note|motivation[\s_-]*letter|求职信|自荐信|附言)/i.test(
    `${target.label} ${target.key} ${target.id || ''} ${target.name || ''}`,
  );
  const text = normalized(
    optionLabelFor(element, scope) ||
      labelTextWithoutControl(element.closest('label')) ||
      (element instanceof HTMLInputElement ? element.value : '') ||
      element.getAttribute('aria-label') ||
      element.getAttribute('data-automation') ||
      element.getAttribute('data-testid') ||
      element.textContent ||
      '',
  );

  if (!text) return false;

  if (
    /(?:don'?t|do not|no\b|none\b|write|type|paste|无需|不包含|不提供|在线填写|在线编写)/i.test(
      text,
    )
  ) {
    return false;
  }

  const hasUpload = /(?:upload|attach|provide|choose|add|import|上传|添加|提供|附加)/i.test(
    text,
  );
  if (!hasUpload) return false;

  if (isCover) {
    const inCoverSection = Boolean(
      element.closest(
        "fieldset, section, [data-automation*='cover' i], [data-testid*='cover' i], [class*='cover' i]",
      ),
    );
    const mentionsCover = /(?:cover|letter|求职信|自荐信|doc|file|文件)/i.test(
      text,
    );
    return inCoverSection || mentionsCover;
  }

  const inResumeSection = Boolean(
    element.closest(
      "fieldset, section, [data-automation*='resume' i], [data-testid*='resume' i], [class*='resume' i]",
    ),
  );
  const mentionsResume = /(?:resume|cv|简历|履历|doc|file|文件)/i.test(text);
  return inResumeSection || mentionsResume;
}

function findUploadChoiceOption(
  target: FormFieldTarget,
  input: HTMLInputElement | null,
  scope: FormScope,
): HTMLElement | null {
  const isCover = /(?:cover[\s_-]*letter|cover[\s_-]*note|motivation[\s_-]*letter|求职信|自荐信|附言)/i.test(
    `${target.label} ${target.key} ${target.id || ''} ${target.name || ''}`,
  );
  const root =
    scope instanceof Document || scope instanceof ShadowRoot
      ? scope
      : (input?.getRootNode() as ParentNode) || document;

  if (input) {
    let container: HTMLElement | null = input.parentElement;
    for (let depth = 0; container && depth < 8; depth += 1) {
      const candidates = Array.from(
        container.querySelectorAll<HTMLElement>(
          "input[type='radio'], [role='radio']",
        ),
      );
      const match = candidates.find((cand) =>
        isUploadChoiceOption(cand, target, scope),
      );
      if (match) return match;
      container = container.parentElement;
    }
  }

  if (isCover) {
    const coverSections = Array.from(
      root.querySelectorAll<HTMLElement>(
        "fieldset, [data-automation*='cover' i], [data-testid*='cover' i], section, [role='region'], div",
      ),
    ).filter((sec) => {
      const heading =
        sec.querySelector('legend, h1, h2, h3, h4, h5, h6, [role="heading"]')
          ?.textContent || '';
      return /(?:cover[\s_-]*letter|求职信|自荐信)/i.test(heading);
    });

    for (const section of coverSections) {
      const candidates = Array.from(
        section.querySelectorAll<HTMLElement>(
          "input[type='radio'], [role='radio']",
        ),
      );
      const match = candidates.find((cand) =>
        isUploadChoiceOption(cand, target, scope),
      );
      if (match) return match;
    }
  } else {
    const resumeSections = Array.from(
      root.querySelectorAll<HTMLElement>(
        "fieldset, [data-automation*='resume' i], [data-testid*='resume' i], section, [role='region'], div",
      ),
    ).filter((sec) => {
      const heading =
        sec.querySelector('legend, h1, h2, h3, h4, h5, h6, [role="heading"]')
          ?.textContent || '';
      return /(?:resume|\bcv\b|简历|履历)/i.test(heading);
    });

    for (const section of resumeSections) {
      const candidates = Array.from(
        section.querySelectorAll<HTMLElement>(
          "input[type='radio'], [role='radio']",
        ),
      );
      const match = candidates.find((cand) =>
        isUploadChoiceOption(cand, target, scope),
      );
      if (match) return match;
    }
  }

  const allCandidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      "input[type='radio'], [role='radio']",
    ),
  );
  return (
    allCandidates.find((cand) => isUploadChoiceOption(cand, target, scope)) ||
    null
  );
}

async function ensureUploadOptionSelected(
  target: FormFieldTarget,
  input: HTMLInputElement | null,
  scope: FormScope,
): Promise<HTMLInputElement | null> {
  const option = findUploadChoiceOption(target, input, scope);
  if (!option) return input;

  const root =
    scope instanceof Document || scope instanceof ShadowRoot
      ? scope
      : document;
  const radio =
    option instanceof HTMLInputElement && option.type.toLowerCase() === 'radio'
      ? option
      : option.querySelector<HTMLInputElement>("input[type='radio']") ||
        (option.id
          ? (root.querySelector<HTMLInputElement>(
              `input[type='radio'][id='${CSS.escape(option.id)}']`,
            ) ?? null)
          : null);

  if (!radio && option.getAttribute('role') !== 'radio') {
    return input;
  }

  const isAlreadyChecked =
    (radio && radio.checked) ||
    option.getAttribute('aria-checked') === 'true' ||
    option.classList.contains('selected') ||
    option.getAttribute('data-state') === 'checked';

  if (!isAlreadyChecked) {
    if (radio) {
      clickRadioOption(radio, scope);
    } else {
      try {
        option.focus({ preventScroll: true });
      } catch {}
      clickControl(option);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    return findFileInput(target, scope) || input;
  }

  return input;
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
  let input = findFileInput(instruction.target, scope);
  const activeInput = await ensureUploadOptionSelected(
    instruction.target,
    input,
    scope,
  );
  if (activeInput) {
    input = activeInput;
  }
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

function findFileRemoveButton(
  input: HTMLInputElement,
): HTMLElement | null {
  let container: HTMLElement | null = input.parentElement;
  for (let depth = 0; container && depth < 6; depth += 1) {
    const candidateButtons = Array.from(
      container.querySelectorAll<HTMLElement>(
        "button, [role='button'], a, svg, span.dismiss, .remove-file, .delete-file, [aria-label*='remove' i], [aria-label*='delete' i], [aria-label*='clear' i], [aria-label*='trash' i], [aria-label*='删除' i], [aria-label*='移除' i], [aria-label*='清除' i]",
      ),
    );
    const removeBtn = candidateButtons.find((candidate) => {
      if (!isVisible(candidate) || candidate === input) return false;
      const text = normalized(
        candidate.textContent ||
          candidate.getAttribute('aria-label') ||
          candidate.getAttribute('title') ||
          candidate.className ||
          '',
      );
      return (
        /delete|remove|clear|trash|dismiss|cancel|detach|remove-file|delete-file|删除|移除|清除/.test(
          text,
        ) || candidate.querySelector('svg') !== null
      );
    });
    if (removeBtn) return removeBtn;
    container = container.parentElement;
  }
  return null;
}

export function clearFormFile(
  input: HTMLInputElement,
  instruction: FieldFillInstruction,
): FieldFillResult {
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  const removeBtn = findFileRemoveButton(input);
  if (removeBtn) {
    clickControl(removeBtn);
  }

  try {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'files',
    )?.set;
    const emptyTransfer = new DataTransfer();
    if (setter) setter.call(input, emptyTransfer.files);
    else input.files = emptyTransfer.files;
  } catch {
    // Ignore native files assignment failure
  }

  setValue(input, '');
  emitChange(input);
  restoreScrollAfterRerender(scrollPosition);

  return result(instruction, 'filled', 'File upload cleared.');
}

function matchesTarget(
  element: FormControl,
  instruction: FieldFillInstruction,
  scope: FormScope,
): boolean {
  if (instruction.target.id && element.id === instruction.target.id) return true;
  if (instruction.target.name && element.getAttribute('name') === instruction.target.name) return true;
  return labelsMatchTarget(element, instruction.target, scope);
}

function setSelectValue(element: HTMLSelectElement, value: string): void {
  const normVal = normalized(value);
  const matchedOpt = Array.from(element.options).find(
    (opt) =>
      opt.value === value ||
      normalized(opt.value) === normVal ||
      normalized(opt.textContent || '') === normVal ||
      (normVal.length > 1 && normalized(opt.textContent || '').includes(normVal)),
  );
  if (matchedOpt) {
    Array.from(element.options).forEach((opt) => {
      opt.selected = opt === matchedOpt;
    });
  }

  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  if (setter) setter.call(element, matchedOpt?.value || value);
  else element.value = matchedOpt?.value || value;
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
  const targetFirstToken = targetValue.split(/[,，\s]+/)[0] || targetValue;
  const selector = "[role='option'], [role='listbox'] button, [role='listbox'] li, [data-value], [data-option-value], [class*='t1-' i], [class*='option' i], [class*='item' i], [class*='suggestion' i], [class*='result' i], [class*='row' i], .ui-menu-item, .ui-menu-item-wrapper, .pac-item";
  // Listboxes on modern ATS pages are frequently rendered in a sibling or
  // child shadow root. `querySelectorAll` stops at a shadow boundary, while
  // `elementsInScope` deliberately follows open shadow roots.
  const candidates =
    root instanceof Document || root instanceof HTMLElement || root instanceof ShadowRoot
      ? elementsInScope(root).filter(
          (element) =>
            element.matches(selector) ||
            element.tagName.toLowerCase().endsWith('-option') ||
            element.parentElement?.getAttribute('role') === 'listbox',
        )
      : Array.from(root.querySelectorAll<HTMLElement>(selector));

  const visibleCandidates = candidates.filter((candidate) => {
    return (
      isVisible(candidate) &&
      candidate.getAttribute('aria-disabled') !== 'true' &&
      !(candidate instanceof HTMLInputElement) &&
      !(candidate instanceof HTMLSelectElement)
    );
  });

  const matched = visibleCandidates.find((candidate) => {
    const candidateValue = normalized(
      candidate.getAttribute('data-value') ||
        candidate.getAttribute('data-option-value') ||
        candidate.getAttribute('aria-label') ||
        candidate.textContent ||
        candidate.getAttribute('value') ||
        '',
    );
    return (
      candidateValue === targetValue ||
      (targetValue.length > 1 &&
        (candidateValue.includes(targetValue) ||
          targetValue.includes(candidateValue))) ||
      (targetFirstToken.length > 1 &&
        candidateValue.includes(targetFirstToken))
    );
  });

  if (matched) return matched;
  return visibleCandidates[0] || null;
}

function optionInteractionTarget(option: HTMLElement): HTMLElement {
  return (
    option.shadowRoot?.querySelector<HTMLElement>(
      "[role='option'], button, [role='button']",
    ) || option
  );
}

async function clickVisualSelectOption(
  element: HTMLSelectElement,
  value: string,
  scope: FormScope,
): Promise<boolean> {
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
  const startedAt = Date.now();
  let option: HTMLElement | null = null;
  while (!option && Date.now() - startedAt < 900) {
    option =
      visibleOptionMatch(queryScope, value) ||
      (queryScope !== document ? visibleOptionMatch(document, value) : null);
    if (!option) await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
  }
  if (!option) return false;
  clickControl(optionInteractionTarget(option));
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
  const localMatch =
    queryScope.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ||
    (queryScope !== document ?
      document.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    : null);
  if (localMatch) return localMatch;

  // The controlled input and its listbox can be siblings in different shadow
  // roots (SmartRecruiters' location autocomplete is one example). Search
  // the inspected form, then the whole document, without leaving the page.
  return (
    elementsInScope(scope).find((candidate) => candidate.id === id) ||
    (scope !== document
      ? elementsInScope(document).find((candidate) => candidate.id === id)
      : null) ||
    null
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
  const selected = normalized(comboboxCurrentValue(element) || element.value);
  const expected = normalized(value);
  const expectedFirstToken = expected.split(/[,，\s]+/)[0] || expected;
  return Boolean(
    selected &&
    (selected === expected ||
      (expected.length > 1 &&
        (selected.includes(expected) || expected.includes(selected))) ||
      (expectedFirstToken.length > 1 && selected.includes(expectedFirstToken))),
  );
}

const COMBOBOX_OPTION_WAIT_MS = 2_500;
const COMBOBOX_COMMIT_WAIT_MS = 1_200;

function comboboxHasCommittedSelection(
  element: HTMLInputElement,
  scope: FormScope,
  value: string,
  typedQuery: string,
): boolean {
  const expected = normalized(value);
  const expectedFirstToken = expected.split(/[,，\s]+/)[0] || expected;
  const bridgedValue = normalized(inspectPageCombobox(element)?.currentValue || '');
  if (
    bridgedValue &&
    (bridgedValue === expected ||
      bridgedValue.includes(expected) ||
      expected.includes(bridgedValue) ||
      (expectedFirstToken.length > 1 && bridgedValue.includes(expectedFirstToken)))
  ) {
    return true;
  }

  const listbox = comboboxListbox(element, scope);
  const selected = normalized(comboboxCurrentValue(element) || element.value);
  const selectionMatches = Boolean(
    selected &&
    (selected === expected ||
      (expected.length > 1 && (selected.includes(expected) || expected.includes(selected))) ||
      (expectedFirstToken.length > 1 && selected.includes(expectedFirstToken)))
  );

  const root = element.getRootNode();
  const searchScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const hasHiddenGreenhouseId = Boolean(
    (searchScope.querySelector("#job_application_location_id, input[name*='location_id']") as HTMLInputElement)?.value
  );

  if (!selectionMatches && !hasHiddenGreenhouseId && (!selected || selected === normalized(typedQuery))) {
    return false;
  }

  const valueChangedAfterChoice =
    normalized(element.value) !== normalized(typedQuery);
  const listboxClosed =
    element.getAttribute('aria-expanded') === 'false' ||
    !listbox ||
    !isVisible(listbox);
  return valueChangedAfterChoice || listboxClosed || hasHiddenGreenhouseId;
}

function waitForComboboxCommit(
  element: HTMLInputElement,
  scope: FormScope,
  value: string,
  typedQuery: string,
  timeoutMs = COMBOBOX_COMMIT_WAIT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const verify = () => {
      if (comboboxHasCommittedSelection(element, scope, value, typedQuery)) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(verify, 40);
    };
    verify();
  });
}

function waitForComboboxOption(
  element: HTMLInputElement,
  scope: FormScope,
  value: string,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const find = () => {
      const listbox = comboboxListbox(element, scope);
      const option =
        (listbox && visibleOptionMatch(listbox, value)) ||
        visibleOptionMatch(document, value);
      if (option) {
        resolve(option);
        return;
      }
      if (Date.now() - startedAt >= COMBOBOX_OPTION_WAIT_MS) {
        resolve(null);
        return;
      }
      window.setTimeout(find, 40);
    };
    find();
  });
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

  try {
    element.focus({ preventScroll: true });
  } catch {}
  if (element.getAttribute('aria-expanded') !== 'true') clickControl(element);
  setValue(element, label);
  emitInput(element);
  const char = label.slice(-1) || 'a';
  element.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  const typedQuery = element.value;

  const option = await waitForComboboxOption(element, scope, label);
  if (option) {
    // Custom option hosts (including SmartRecruiters' spl-select-option)
    // keep the click handler on an interactive node inside their shadow root.
    // Clicking the host programmatically does not activate that inner node.
    clickControl(optionInteractionTarget(option));
    // A successful option click is the commit. Do not immediately send
    // ArrowDown/Enter afterwards: on many async location controls that moves
    // the selection away from the option we just chose.
    if (await waitForComboboxCommit(element, scope, label, typedQuery)) {
      return true;
    }
  }

  const dispatchKey = (key: string, keyCode: number) => {
    const keyOptions = { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent('keydown', keyOptions));
    element.dispatchEvent(new KeyboardEvent('keyup', keyOptions));
  };

  // Keyboard selection is a fallback for controls that expose no clickable
  // option nodes. It is deliberately skipped when a click was confirmed.
  dispatchKey('ArrowDown', 40);
  dispatchKey('Enter', 13);

  if (await waitForComboboxCommit(element, scope, label, typedQuery)) return true;
  dispatchKey('Tab', 9);
  return waitForComboboxCommit(element, scope, label, typedQuery, 500);
}

async function fillAriaCombobox(
  element: HTMLElement,
  value: string,
): Promise<boolean> {
  const before = normalized(element.textContent || '');
  clickControl(element);
  const startedAt = Date.now();
  let option: HTMLElement | null = null;
  while (!option && Date.now() - startedAt < 900) {
    option = visibleOptionMatch(document, value);
    if (!option) await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
  }
  if (!option) return false;
  clickControl(optionInteractionTarget(option));
  await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
  const after = normalized(element.textContent || '');
  const expected = normalized(value);
  return after !== before || after === expected || after.includes(expected) || expected.includes(after);
}

async function fillSelect(
  element: HTMLSelectElement,
  value: string,
  scope: FormScope,
): Promise<{ matched: boolean; changed: boolean }> {
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
  if (!option) return { matched: false, changed: false };
  // SEEK and other React application forms often render a hidden native
  // select beside a visual combobox. Prefer the same visible option click a
  // user performs so their controlled state updates as well.
  const previousValue = element.value;
  const visualSelected = await clickVisualSelectOption(
    element,
    option.value || option.textContent || value,
    scope,
  );
  if (element.value === option.value) {
    return { matched: true, changed: previousValue !== option.value || visualSelected };
  }
  setSelectValue(element, option.value);
  return {
    matched: element.value === option.value || visualSelected,
    changed: previousValue !== option.value || visualSelected,
  };
}

function optionLabelFor(element: HTMLElement, scope: FormScope): string {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const ariaLabel = cleanText(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelledBy = cleanText(element.getAttribute('aria-labelledby'))
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => cleanText(queryScope.querySelector(`#${CSS.escape(id)}`)?.textContent))
    .filter(Boolean)
    .join(' ');
  if (labelledBy) return labelledBy;

  const dataLabel = cleanText(element.getAttribute('data-label') || element.getAttribute('data-value'));
  if (dataLabel) return dataLabel;

  const id = cleanText(element.id);
  if (id) {
    const label = queryScope.querySelector<HTMLLabelElement>(
      `label[for='${CSS.escape(id)}']`,
    );
    const text = labelTextWithoutControl(label);
    if (text) return text;
  }

  const parentLabel = labelTextWithoutControl(element.closest('label'));
  if (parentLabel) return parentLabel;

  const siblingText = cleanText(
    element.nextElementSibling?.textContent ||
      element.parentElement?.textContent ||
      '',
  );
  if (siblingText && siblingText.length <= 300) return siblingText;

  const previousText = cleanText(element.previousElementSibling?.textContent || '');
  if (previousText && previousText.length <= 300) return previousText;

  if (element instanceof HTMLInputElement && element.value)
    return element.value;
  return '';
}

function isSeekHost(): boolean {
  return /^(?:[a-z0-9-]+\.)*seek\.(?:com(?:\.au)?|co\.nz)$/i.test(
    window.location.hostname,
  );
}

function setRadioChecked(radio: HTMLInputElement): void {
  try {
    const tracker = (
      radio as unknown as {
        _valueTracker?: { setValue: (v: string) => void };
      }
    )._valueTracker;
    if (tracker) {
      tracker.setValue(String(!radio.checked));
    }
  } catch {}

  try {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'checked',
    )?.set;
    if (setter) {
      setter.call(radio, true);
    } else {
      radio.checked = true;
    }
  } catch {
    radio.checked = true;
  }

  const eventOptions = { bubbles: true, composed: true };
  try {
    radio.dispatchEvent(new Event('input', eventOptions));
    radio.dispatchEvent(new Event('change', eventOptions));
  } catch {}
}

function clickRadioOption(element: HTMLInputElement, scope: FormScope): void {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const explicitLabel = element.id
    ? queryScope.querySelector<HTMLLabelElement>(
        `label[for='${CSS.escape(element.id)}']`,
      )
    : null;
  const parentLabel = element.closest<HTMLElement>('label');
  const roleRadio = element.closest<HTMLElement>("[role='radio']");
  const label = explicitLabel || parentLabel;
  const textSpan = label
    ? Array.from(
        label.querySelectorAll<HTMLElement>('span, div, p, b, strong'),
      ).find(
        (node) =>
          node.textContent &&
          node.textContent.trim().length > 0 &&
          node.children.length === 0,
      )
    : null;

  const target = textSpan || label || roleRadio || element;
  try {
    target.focus({ preventScroll: true });
  } catch {}
  clickControl(target);

  if (!element.checked) {
    try {
      element.click();
    } catch {}
  }

  setRadioChecked(element);
}

function fillRadio(
  element: HTMLInputElement,
  value: string,
  scope: FormScope,
): boolean {
  const root = element.getRootNode();
  const queryScope =
    root instanceof Document || root instanceof ShadowRoot ? root : scope;
  let group =
    element.name ?
      Array.from(
        queryScope.querySelectorAll<HTMLInputElement>(
          `input[type='radio'][name='${CSS.escape(element.name)}']`,
        ),
      )
    : [];
  if (group.length <= 1) {
    let container = element.parentElement;
    for (let depth = 0; container && depth < 8; depth += 1) {
      const containerRadios = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='radio']"));
      if (containerRadios.length >= 2) {
        group = containerRadios;
        break;
      }
      container = container.parentElement;
    }
  }
  if (group.length === 0) group = [element];

  const targetNorm = normalized(value);
  const targetAliases = new Set<string>([targetNorm]);
  if (['yes', 'true', 'authorized', 'eligible'].includes(targetNorm)) {
    targetAliases.add('y');
    targetAliases.add('yes');
    targetAliases.add('true');
    targetAliases.add('1');
  } else if (['no', 'false'].includes(targetNorm)) {
    targetAliases.add('n');
    targetAliases.add('no');
    targetAliases.add('false');
    targetAliases.add('0');
  }

  const selected = group.find((candidate) => {
    const candVal = normalized(candidate.value);
    const candLabel = normalized(optionLabelFor(candidate, scope));
    if (candidate.value === value || targetAliases.has(candVal) || targetAliases.has(candLabel)) {
      return true;
    }
    return (
      (targetNorm.length > 3 && candLabel.length > 3 &&
        (candLabel.includes(targetNorm) || targetNorm.includes(candLabel))) ||
      (targetNorm.length > 3 && candVal.length > 3 && candVal !== 'on' &&
        (candVal.includes(targetNorm) || targetNorm.includes(candVal)))
    );
  });
  if (!selected) return false;
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  // LinkedIn's custom radio UI is often controlled by a handler on the
  // surrounding label/card rather than the input. Follow the same pointer
  // and click path a user takes on the whole option.
  clickRadioOption(selected, scope);
  if (!selected.checked) {
    try {
      selected.click();
    } catch {}
  }
  if (!selected.checked) {
    try {
      selected.checked = true;
      selected.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      selected.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    } catch {}
  }
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

function optionMatchesRequested(
  option: HTMLInputElement,
  requested: string,
  scope: FormScope,
): boolean {
  const target = normalized(requested);
  const value = normalized(option.value);
  const label = normalized(optionLabelFor(option, scope));
  return option.value === requested || value === target || label === target ||
    (target.length > 1 && (label.includes(target) || target.includes(label)));
}

function fillMultiSelectGroup(
  group: AshbyChoiceGroup,
  values: string[],
  scope: FormScope,
  source: FieldFillInstruction['source'],
): 'filled' | 'already_filled' | 'unavailable' | 'rejected' {
  const selected = values.map((value) =>
    group.options.find((option) => optionMatchesRequested(option, value, scope)),
  );
  if (selected.some((option) => !option)) return 'unavailable';
  const desired = new Set(selected as HTMLInputElement[]);
  const alreadyFilled = group.options.every(
    (option) => checkboxIsChecked(option, scope) === desired.has(option),
  );
  if (alreadyFilled) return 'already_filled';

  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  for (const option of group.options) {
    markAutofillWrite(option, source);
    if (checkboxIsChecked(option, scope) !== desired.has(option) &&
      !updateCheckbox(option, desired.has(option), scope)) return 'rejected';
  }
  restoreScrollAfterRerender(scrollPosition);
  return group.options.every((option) => checkboxIsChecked(option, scope) === desired.has(option))
    ? 'filled'
    : 'rejected';
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

  if (instruction.target.type === 'multiselect') {
    if (!Array.isArray(instruction.value))
      return result(instruction, 'rejected', 'Multi-select values must be a list.');
    const group = findAshbyChoiceGroup(instruction.target, scope, 'multiselect');
    if (!group)
      return result(instruction, 'not_found', 'The targeted multi-select field is no longer visible.');
    const status = fillMultiSelectGroup(group, instruction.value, scope, instruction.source);
    if (status === 'unavailable')
      return result(instruction, 'rejected', 'One or more requested options are unavailable.');
    if (status === 'rejected')
      return result(instruction, 'rejected', 'The webpage did not accept the multi-select change.');
    return result(
      instruction,
      status,
      status === 'filled' ? 'Multi-select options updated.' : 'Multi-select already has the requested values.',
    );
  }

  if (instruction.target.type === 'radio' && typeof instruction.value === 'string') {
    const group = findAshbyChoiceGroup(instruction.target, scope, 'radio');
    if (group) {
      if (!fillRadio(group.options[0]!, instruction.value, scope))
        return result(instruction, 'rejected', 'The requested radio option is unavailable.');
      return result(instruction, 'filled', 'Radio option selected.');
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
  if (target.type === 'multiselect') {
    const group = findAshbyChoiceGroup(target, scope, 'multiselect');
    if (!group)
      return {
        key: target.key,
        status: 'not_found',
        message: 'The multi-select field is no longer visible.',
      };
    scrollAndHighlightQuestion(group.container);
    return { key: target.key, status: 'focused', message: 'Field focused.' };
  }
  if (target.type === 'radio') {
    const group = findAshbyChoiceGroup(target, scope, 'radio');
    if (group) {
      scrollAndHighlightQuestion(group.container);
      return { key: target.key, status: 'focused', message: 'Field focused.' };
    }
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
