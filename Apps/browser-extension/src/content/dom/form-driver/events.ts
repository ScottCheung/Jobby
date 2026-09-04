/** @format */

import type {
  FieldFillInstruction,
  FieldFillResult,
} from '../../../shared/contracts/form-actions';

export type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function markAutofillWrite(element: FormControl, _source: FieldFillInstruction['source']): void {
  element.dataset.jobbyAutofillUntil = String(Date.now() + 3_000);
  window.setTimeout(() => delete element.dataset.jobbyAutofillUntil, 3_100);
}

export function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function normalized(value: string): string {
  return cleanText(value).toLowerCase();
}

export function result(
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

export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function formatValueForInput(
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

export function setValue(
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

export function emitChange(element: FormControl): void {
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

export function emitInput(element: HTMLInputElement): void {
  const eventOptions = { bubbles: true, composed: true };
  try {
    element.dispatchEvent(
      new InputEvent('input', { ...eventOptions, inputType: 'insertText' }),
    );
  } catch {
    element.dispatchEvent(new Event('input', eventOptions));
  }
}

export function clickControl(target: HTMLElement): void {
  const eventOptions = { bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
  target.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  target.dispatchEvent(new PointerEvent('pointerup', eventOptions));
  target.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  target.click();
}

export function restoreScrollAfterRerender(position: {
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
