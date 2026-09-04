/** @format */

import {
  comboboxCurrentValue,
  comboboxOptionsFor,
  elementsInScope,
  type FormScope,
} from '../form-inspector';
import {
  inspectPageCombobox,
  selectPageCombobox,
} from '../combobox-bridge';
import { providerDefinitions } from '../../platforms/registry';
import {
  clickControl,
  emitChange,
  emitInput,
  isVisible,
  setValue,
  cleanText,
  normalized,
} from './events';

export function setSelectValue(element: HTMLSelectElement, value: string): void {
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

export function visibleOptionMatch(
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

export function optionInteractionTarget(option: HTMLElement): HTMLElement {
  return (
    option.shadowRoot?.querySelector<HTMLElement>(
      "[role='option'], button, [role='button']",
    ) || option
  );
}

export async function clickVisualSelectOption(
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

export function comboboxListbox(
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

export function matchingComboboxLabel(
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

export function comboboxSelectionMatches(
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

export const COMBOBOX_OPTION_WAIT_MS = 2_500;
export const COMBOBOX_COMMIT_WAIT_MS = 1_200;

export function comboboxHasCommittedSelection(
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

  const providerHasCommitted = providerDefinitions.some((provider) =>
    provider.driver?.isComboboxCommitted?.(element, scope),
  );

  if (!selectionMatches && !providerHasCommitted && (!selected || selected === normalized(typedQuery))) {
    return false;
  }

  const valueChangedAfterChoice =
    normalized(element.value) !== normalized(typedQuery);
  const listboxClosed =
    element.getAttribute('aria-expanded') === 'false' ||
    !listbox ||
    !isVisible(listbox);
  return valueChangedAfterChoice || listboxClosed || providerHasCommitted;
}

export function waitForComboboxCommit(
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

export function waitForComboboxOption(
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

export async function fillCombobox(
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

export async function fillAriaCombobox(
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

export async function fillSelect(
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
