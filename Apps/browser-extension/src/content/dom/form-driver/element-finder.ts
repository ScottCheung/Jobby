/** @format */

import type {
  FieldFillInstruction,
  FormFieldTarget,
} from '../../../shared/contracts/form-actions';
import type { FormFieldType } from '../../../shared/contracts/form-inspection';
import {
  elementsInScope,
  fieldKeyFor,
  isSelectableCombobox,
  labelFor,
  visibleControlsInScope,
  type FormScope,
} from '../form-inspector';
import {
  cleanText,
  isVisible,
  normalized,
  type FormControl,
} from './events';

export function fieldType(element: FormControl): FormFieldType {
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

export function labelTextWithoutControl(label: HTMLElement | null | undefined): string {
  if (!label) return '';
  const copy = label.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('input,select,textarea,button,img,svg,noscript,script,style').forEach((node) => node.remove());
  return cleanText(copy.textContent);
}

export function checkboxChoiceGroupFor(
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

export function isCheckboxChoiceGroupForTarget(
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

export function ariaCheckboxLabel(element: HTMLElement, scope: FormScope): string {
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

export function ariaCheckboxIsChecked(element: HTMLElement): boolean {
  return element.getAttribute('aria-checked') === 'true' ||
    element.getAttribute('data-state') === 'checked' ||
    element.classList.contains('checked') ||
    element.classList.contains('selected');
}

export function findAriaCheckbox(target: FormFieldTarget, scope: FormScope): HTMLElement | null {
  const candidates = elementsInScope(scope).filter((element) =>
    element.matches("[role='checkbox']") && isVisible(element),
  );
  return candidates.find((element) =>
    (target.id && element.id === target.id) ||
    (target.name && element.getAttribute('name') === target.name) ||
    normalized(ariaCheckboxLabel(element, scope)) === normalized(target.label),
  ) || null;
}

export function findAriaCombobox(target: FormFieldTarget, scope: FormScope): HTMLElement | null {
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

export function labelsMatchTarget(
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

export function matchesTarget(
  element: FormControl,
  instruction: FieldFillInstruction,
  scope: FormScope,
): boolean {
  if (instruction.target.id && element.id === instruction.target.id) return true;
  if (instruction.target.name && element.getAttribute('name') === instruction.target.name) return true;
  return labelsMatchTarget(element, instruction.target, scope);
}
