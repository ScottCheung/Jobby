/** @format */

import type { FieldFillInstruction } from '../../../shared/contracts/form-actions';
import {
  checkboxIsChecked,
  checkboxPresentationElements,
  type FormScope,
} from '../form-inspector';
import type { AshbyChoiceGroup } from '../../platforms/ashby/choice-groups';
import {
  clickControl,
  isVisible,
  markAutofillWrite,
  restoreScrollAfterRerender,
  cleanText,
  normalized,
} from './events';
import {
  checkboxChoiceGroupFor,
  labelTextWithoutControl,
} from './element-finder';

export function checkboxInteractionTargets(
  checkbox: HTMLInputElement,
  scope: FormScope,
): HTMLElement[] {
  const visiblePresentation = checkboxPresentationElements(
    checkbox,
    scope,
  ).filter((candidate) => candidate !== checkbox && isVisible(candidate));
  return [...visiblePresentation, checkbox];
}

export function updateCheckbox(
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

export function optionLabelFor(element: HTMLElement, scope: FormScope): string {
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

export function isSeekHost(): boolean {
  return /^(?:[a-z0-9-]+\.)*seek\.(?:com(?:\.au)?|co\.nz)$/i.test(
    window.location.hostname,
  );
}

export function setRadioChecked(radio: HTMLInputElement): void {
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

export function clickRadioOption(element: HTMLInputElement, scope: FormScope): void {
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

export function fillRadio(
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

export function fillCheckboxChoiceGroup(
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

export function optionMatchesRequested(
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

export function fillMultiSelectGroup(
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
