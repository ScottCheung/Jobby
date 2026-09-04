/** @format */

import type {
  FieldFillInstruction,
  FieldFillResult,
  FileUploadInstruction,
  FormFieldTarget,
} from '../../../shared/contracts/form-actions';
import {
  elementsInScope,
  fieldKeyFor,
  isAutofillResumeInput,
  visibleControlsInScope,
  type FormScope,
} from '../form-inspector';
import {
  clickControl,
  emitChange,
  isVisible,
  restoreScrollAfterRerender,
  result,
  setValue,
  cleanText,
  normalized,
} from './events';
import {
  labelTextWithoutControl,
} from './element-finder';
import {
  clickRadioOption,
  optionLabelFor,
} from './choice-driver';

export function decodeBase64(contentBase64: string): Uint8Array | null {
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

export function findFileInput(
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

export function fileUploadTrigger(
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

export function nearbyFileLabelText(input: HTMLInputElement): string {
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

export function fileInputMatchesTarget(
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

export function selectExistingDocument(
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

export function isUploadChoiceOption(
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

export function findUploadChoiceOption(
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

export async function ensureUploadOptionSelected(
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

export function waitForUploadUiToSettle(
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

export function findFileRemoveButton(
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
