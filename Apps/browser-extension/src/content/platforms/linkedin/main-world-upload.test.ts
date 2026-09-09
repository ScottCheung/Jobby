// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileUploadInstruction } from '../../../shared/contracts/form-actions';
import { uploadLinkedInResume, uploadLinkedInResumeInPage } from './main-world-upload';
import { LINKEDIN_RESUME_UPLOAD_KEY, LINKEDIN_RESUME_UPLOAD_SELECTOR } from './resume-upload';

const instruction: FileUploadInstruction = {
  type: 'content.upload-file', commandId: 'upload',
  target: { key: LINKEDIN_RESUME_UPLOAD_KEY, type: 'file', label: 'Resume' },
  filename: 'Tailored Resume.pdf', mimeType: 'application/pdf', contentBase64: btoa('%PDF-1.4'),
};

describe('LinkedIn button-only resume upload', () => {
  let button: HTMLButtonElement;
  let radio: HTMLElement;
  let nativeClick: typeof HTMLInputElement.prototype.click;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<dialog open>
      <fieldset role="radiogroup"><div role="radio" aria-label="Previous Resume.pdf" aria-checked="true"></div></fieldset>
      <button data-jobby-linkedin-resume-upload>Upload resume</button>
    </dialog>`;
    button = document.querySelector('button')!;
    radio = document.querySelector('[role="radio"]')!;
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ width: 100 } as DOMRect);
    nativeClick = HTMLInputElement.prototype.click;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fills a detached input and waits for asynchronous selected-card confirmation', async () => {
    let uploaded: File | undefined;
    button.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => {
        uploaded = input.files?.[0];
        window.setTimeout(() => radio.setAttribute('aria-label', uploaded!.name), 1800);
      };
      input.click();
    });
    const promise = uploadLinkedInResumeInPage(instruction, LINKEDIN_RESUME_UPLOAD_SELECTOR);
    let settled = false;
    void promise.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(1000);
    expect(uploaded?.name).toBe(instruction.filename);
    expect(settled).toBe(false);
    expect(HTMLInputElement.prototype.click).toBe(nativeClick);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await promise).status).toBe('filled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['Previous Resume.pdf', 'Tailored Resume.pdf'])('does not report success when %s remains selected without confirmation', async (name) => {
    radio.setAttribute('aria-label', name);
    button.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.click();
    });
    const promise = uploadLinkedInResumeInPage(instruction, LINKEDIN_RESUME_UPLOAD_SELECTOR);
    await vi.advanceTimersByTimeAsync(15000);
    expect((await promise).status).toBe('rejected');
    expect(HTMLInputElement.prototype.click).toBe(nativeClick);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores the input methods when no file chooser is created', async () => {
    const before = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'click');
    const promise = uploadLinkedInResumeInPage(instruction, LINKEDIN_RESUME_UPLOAD_SELECTOR);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await promise).status).toBe('rejected');
    expect(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'click')).toEqual(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects invalid files before activating the upload button', async () => {
    const click = vi.spyOn(button, 'click');
    expect((await uploadLinkedInResumeInPage({ ...instruction, filename: 'resume.exe' }, LINKEDIN_RESUME_UPLOAD_SELECTOR)).status).toBe('rejected');
    expect(click).not.toHaveBeenCalled();
  });

  it('routes only the button-only field through the page main world', async () => {
    const executeScript = vi.fn().mockResolvedValue([{ result: { status: 'filled', message: 'Uploaded.' } }]);
    vi.stubGlobal('chrome', { scripting: { executeScript } });
    expect(await uploadLinkedInResume({ ...instruction, target: { ...instruction.target, key: 'native-file' } }, { tabId: 7 })).toBeNull();
    expect(executeScript).not.toHaveBeenCalled();
    expect((await uploadLinkedInResume(instruction, { tabId: 7 }))?.status).toBe('filled');
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 7, frameIds: [0] }, world: 'MAIN',
    }));
  });
});
