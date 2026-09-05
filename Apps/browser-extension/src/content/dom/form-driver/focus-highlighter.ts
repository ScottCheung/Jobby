import type {
  FormFieldTarget,
  FormFocusResult,
} from '../../../shared/contracts/form-actions';
import {
  checkboxPresentationElements,
  type FormScope,
} from '../form-inspector';
import { activeProviderDriver } from '../../platforms/active-driver';
import { isVisible } from './events';
import { findFormElement } from './element-finder';
import {
  findFileInput,
  fileUploadTrigger,
} from './file-uploader';

export type { FormFocusResult };

export function questionContainerFor(element: HTMLElement): HTMLElement {
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

export function scrollAndHighlightQuestion(element: HTMLElement): void {
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

  const providerFocus = activeProviderDriver(scope)?.focusField?.(target, scope);
  if (providerFocus) return providerFocus;

  const element = findFormElement(target, scope);
  if (!element)
    return {
      key: target.key,
      status: 'not_found',
      message: 'The field is no longer visible.',
    };

  const focusTarget = target.type === 'checkbox' && element instanceof HTMLInputElement ?
      checkboxPresentationElements(element, scope).find(
        (candidate) => candidate !== element && isVisible(candidate),
      ) || element
    : element;
  if (focusTarget === element) element.focus({ preventScroll: true });
  scrollAndHighlightQuestion(focusTarget);

  return { key: target.key, status: 'focused', message: 'Field focused.' };
}
