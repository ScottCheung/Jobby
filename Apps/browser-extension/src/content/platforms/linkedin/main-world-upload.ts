import type { FileUploadInstruction, FieldFillResult } from '../../../shared/contracts/form-actions';
import { LINKEDIN_RESUME_UPLOAD_KEY, LINKEDIN_RESUME_UPLOAD_SELECTOR } from './resume-upload';

export async function uploadLinkedInResume(
  instruction: FileUploadInstruction,
  context: { tabId: number },
): Promise<FieldFillResult | null> {
  if (instruction.target.key !== LINKEDIN_RESUME_UPLOAD_KEY) return null;
  const result = (status: FieldFillResult['status'], message: string): FieldFillResult => ({
    commandId: instruction.commandId, key: instruction.target.key, status, message,
  });
  try {
    const executions = await chrome.scripting.executeScript({
      target: { tabId: context.tabId, frameIds: [instruction.target.frameId ?? 0] },
      world: 'MAIN',
      func: uploadLinkedInResumeInPage,
      args: [instruction, LINKEDIN_RESUME_UPLOAD_SELECTOR],
    });
    const outcome = executions[0]?.result;
    return outcome ? result(outcome.status, outcome.message)
      : result('rejected', 'LinkedIn did not confirm the resume upload.');
  } catch {
    return result('rejected', 'The LinkedIn resume upload could not be completed.');
  }
}

export async function uploadLinkedInResumeInPage(
  instruction: FileUploadInstruction,
  selector: string,
): Promise<Pick<FieldFillResult, 'status' | 'message'>> {
  const button = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (candidate) => candidate.getBoundingClientRect().width > 0 &&
      !candidate.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
  const root = button?.closest('dialog, [role="dialog"]');
  if (!button || !root || (button instanceof HTMLButtonElement && button.disabled)) {
    return { status: 'not_found', message: 'The LinkedIn resume upload control is no longer available.' };
  }
  let file: File;
  try {
    const bytes = Uint8Array.from(atob(instruction.contentBase64), (char) => char.charCodeAt(0));
    file = new File([bytes], instruction.filename, { type: instruction.mimeType });
  } catch {
    return { status: 'rejected', message: 'The resume file could not be decoded.' };
  }
  if (!file.size || file.size >= 2 * 1024 * 1024 || !/\.(?:pdf|docx?)$/i.test(file.name)) {
    return { status: 'rejected', message: 'LinkedIn requires a DOC, DOCX, or PDF resume smaller than 2MB.' };
  }

  return new Promise((resolve) => {
    const previousMatches = new Set(Array.from(root.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"]'))
      .filter((radio) => radio.getAttribute('aria-label') === file.name));
    const prototype = HTMLInputElement.prototype;
    const clickDescriptor = Object.getOwnPropertyDescriptor(prototype, 'click');
    const pickerDescriptor = Object.getOwnPropertyDescriptor(prototype, 'showPicker');
    const originalClick = prototype.click;
    const originalPicker = prototype.showPicker;
    let captured = false;
    let done = false;
    let restored = false;
    let captureTimer: number | undefined;
    let completionTimer: number | undefined;
    const restore = () => {
      if (restored) return;
      restored = true;
      if (captureTimer !== undefined) window.clearTimeout(captureTimer);
      if (clickDescriptor) Object.defineProperty(prototype, 'click', clickDescriptor);
      else Reflect.deleteProperty(prototype, 'click');
      if (pickerDescriptor) Object.defineProperty(prototype, 'showPicker', pickerDescriptor);
    };
    const finish = (status: FieldFillResult['status'], message: string) => {
      if (done) return;
      done = true;
      restore();
      observer.disconnect();
      if (completionTimer !== undefined) window.clearTimeout(completionTimer);
      resolve({ status, message });
    };
    const check = () => {
      if (!captured) return;
      const selected = Array.from(root.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"]'))
        .some((radio) => radio.getAttribute('aria-label') === file.name && !previousMatches.has(radio));
      if (selected) finish('filled', `${file.name} uploaded.`);
    };
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    const assign = (input: HTMLInputElement) => {
      captured = true;
      restore();
      queueMicrotask(() => {
        if (done) return;
        try {
          const transfer = new DataTransfer();
          transfer.items.add(file);
          input.files = transfer.files;
          input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          check();
        } catch {
          finish('rejected', 'LinkedIn blocked automatic file assignment.');
        }
      });
    };
    Object.defineProperty(prototype, 'click', {
      configurable: true, writable: true,
      value: function (this: HTMLInputElement) {
        if (this.type === 'file' && !captured) assign(this);
        else originalClick.call(this);
      },
    });
    if (pickerDescriptor) Object.defineProperty(prototype, 'showPicker', {
      ...pickerDescriptor,
      value: function (this: HTMLInputElement) {
        if (this.type === 'file' && !captured) assign(this);
        else originalPicker.call(this);
      },
    });
    captureTimer = window.setTimeout(() => finish('rejected', 'LinkedIn did not open a supported resume upload control.'), 2000);
    completionTimer = window.setTimeout(() => finish('rejected', 'LinkedIn did not confirm the new resume selection. Please check the upload and try again.'), 15000);
    try {
      button.click();
    } catch {
      finish('rejected', 'The LinkedIn upload button could not be activated.');
    }
  });
}
