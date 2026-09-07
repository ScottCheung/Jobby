/** @format */

import type {
  FieldFillInstruction,
  FieldFillResult,
} from '../../../shared/contracts/form-actions';
import type { FormScope } from '../../dom/form-inspector';
import type { ProviderDriverOverride } from '../platform-definition';
import { findFormElement } from '../../dom/form-driver/element-finder';
import {
  clickControl,
  emitInput,
  normalized,
  result,
  setValue,
  cleanText,
  isVisible,
} from '../../dom/form-driver/events';
import {
  optionInteractionTarget,
  visibleOptionMatch,
} from '../../dom/form-driver/select-combobox';

function isDayforceComboboxCommitted(element: HTMLInputElement): boolean {
  const select =
    element.closest('.ant-select') ||
    element.parentElement?.closest('.ant-select');
  if (!select) return false;
  const item = select.querySelector<HTMLElement>('.ant-select-selection-item');
  return Boolean(item && cleanText(item.getAttribute('title') || item.textContent));
}

function matchingOptionInScope(root: ParentNode, expectedValue: string): HTMLElement | null {
  const match = visibleOptionMatch(root, expectedValue);
  if (match) return match;

  const normExpected = normalized(expectedValue);
  const normFirstToken = normExpected.split(/[,，\s]+/)[0] || normExpected;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      ".ant-select-item-option, [role='option'], .ant-select-dropdown [data-value], [role='listbox'] li",
    ),
  );
  return (
    candidates.find((opt) => {
      const val = normalized(
        opt.getAttribute('title') ||
          opt.getAttribute('data-value') ||
          opt.getAttribute('aria-label') ||
          opt.textContent ||
          '',
      );
      return (
        val === normExpected ||
        (normExpected.length > 1 && (val.includes(normExpected) || normExpected.includes(val))) ||
        (normFirstToken.length > 1 && val.includes(normFirstToken))
      );
    }) || null
  );
}

async function waitForDayforceOption(
  _select: HTMLElement,
  input: HTMLInputElement | null,
  value: string,
  timeoutMs = 1500,
): Promise<HTMLElement | null> {
  const listboxId = input?.getAttribute('aria-controls');
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const check = () => {
      if (listboxId) {
        const listbox = document.getElementById(listboxId);
        if (listbox) {
          const match = matchingOptionInScope(listbox, value);
          if (match) {
            resolve(match);
            return;
          }
        }
      }

      const dropdowns = Array.from(
        document.querySelectorAll<HTMLElement>('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
      );
      for (const dd of dropdowns) {
        if (isVisible(dd) || dropdowns.length === 1) {
          const match = matchingOptionInScope(dd, value);
          if (match) {
            resolve(match);
            return;
          }
        }
      }

      const docMatch = matchingOptionInScope(document, value);
      if (docMatch) {
        resolve(docMatch);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(check, 30);
    };
    check();
  });
}

async function fillDayforceSelect(
  instruction: FieldFillInstruction,
  scope: FormScope,
): Promise<FieldFillResult | null> {
  if (instruction.target.type !== 'select' || typeof instruction.value !== 'string') {
    return null;
  }

  const control = findFormElement(instruction.target, scope);
  const select =
    control?.closest<HTMLElement>('.ant-select') ||
    control?.parentElement?.closest<HTMLElement>('.ant-select') ||
    (instruction.target.id
      ? scope.querySelector<HTMLElement>(`#${CSS.escape(instruction.target.id)}`)?.closest<HTMLElement>('.ant-select')
      : null);

  if (!select) return null;

  const currentItem = select.querySelector<HTMLElement>('.ant-select-selection-item');
  const currentText = cleanText(currentItem?.getAttribute('title') || currentItem?.textContent);
  const expectedText = normalized(instruction.value);

  if (
    currentText &&
    (normalized(currentText) === expectedText ||
      normalized(currentText).includes(expectedText) ||
      expectedText.includes(normalized(currentText)))
  ) {
    return result(instruction, 'already_filled', 'Dropdown already has the requested value.');
  }

  const trigger = select.querySelector<HTMLElement>('.ant-select-selector') || select;
  clickControl(trigger);

  const searchInput = select.querySelector<HTMLInputElement>(
    'input.ant-select-selection-search-input, input[role="combobox"]',
  );
  if (searchInput) {
    try {
      searchInput.focus();
    } catch {}
    setValue(searchInput, instruction.value);
    emitInput(searchInput);
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const option = await waitForDayforceOption(select, searchInput, instruction.value);
  if (option) {
    clickControl(optionInteractionTarget(option));
    await new Promise((res) => window.setTimeout(res, 80));
    return result(instruction, 'filled', 'Dropdown value updated.');
  }

  if (searchInput && searchInput.value) {
    const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    searchInput.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
    await new Promise((res) => window.setTimeout(res, 80));
    if (isDayforceComboboxCommitted(searchInput)) {
      return result(instruction, 'filled', 'Dropdown value updated.');
    }
  }

  return result(instruction, 'rejected', 'The requested dropdown option is unavailable.');
}

export const dayforceDriverOverride: ProviderDriverOverride = {
  fillField: (instruction, scope) => fillDayforceSelect(instruction, scope as FormScope),
  isComboboxCommitted: (element) => isDayforceComboboxCommitted(element),
};
