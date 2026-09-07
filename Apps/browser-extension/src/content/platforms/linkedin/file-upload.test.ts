// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { uploadFormFile } from '../../dom/form-driver';
import { selectExistingDocument } from '../../dom/form-driver/file-uploader';

describe('LinkedIn resume upload', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('https://www.linkedin.com/jobs/view/123/'),
    });
  });

  it('switches from a selected LinkedIn document to the upload path before assigning the tailored PDF', async () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" class="artdeco-modal">
        <h2>Apply to RenewMap</h2>
        <h3>Resume*</h3>
        <div role="radiogroup" aria-label="Resume">
          <div id="stored-resume" role="radio" aria-checked="true">Previous Resume.pdf</div>
        </div>
        <button id="upload-resume" type="button">Upload resume</button>
        <input type="file" id="resume-file" accept=".pdf" style="display: none;" />
      </div>
    `;
    const storedResume = document.querySelector<HTMLElement>('#stored-resume')!;
    const uploadButton = document.querySelector<HTMLButtonElement>('#upload-resume')!;
    Object.defineProperty(uploadButton, 'getBoundingClientRect', {
      value: () => ({ width: 1, height: 1 }),
    });
    uploadButton.addEventListener('click', () => {
      storedResume.setAttribute('aria-checked', 'false');
    });

    const result = await uploadFormFile({
      commandId: 'linkedin-resume',
      target: {
        key: 'resume-file',
        id: 'resume-file',
        label: 'Resume',
        type: 'file',
      },
      filename: 'Scott-Zhang-RenewMap.pdf',
      mimeType: 'application/pdf',
      contentBase64: btoa('%PDF-1.4'),
    });

    expect(storedResume.getAttribute('aria-checked')).toBe('false');
    expect(result.status, result.message).toBe('filled');
    expect(document.querySelector<HTMLInputElement>('#resume-file')!.files?.[0]?.name).toBe(
      'Scott-Zhang-RenewMap.pdf',
    );
  });

  it('selects LinkedIn ARIA document cards from the form option value', () => {
    document.body.innerHTML = `
      <div role="radiogroup" aria-label="Resume">
        <div id="resume-a" role="radio" aria-checked="true">Previous Resume.pdf</div>
        <div id="resume-b" role="radio" aria-checked="false">Tailored Resume.pdf</div>
      </div>
      <input type="file" id="resume-file" accept=".pdf" />
    `;
    const previous = document.querySelector<HTMLElement>('#resume-a')!;
    const tailored = document.querySelector<HTMLElement>('#resume-b')!;
    tailored.addEventListener('click', () => {
      previous.setAttribute('aria-checked', 'false');
      tailored.setAttribute('aria-checked', 'true');
    });

    expect(
      selectExistingDocument(
        document.querySelector<HTMLInputElement>('#resume-file')!,
        'resume-b',
        document,
      ),
    ).toBe('selected');
    expect(tailored.getAttribute('aria-checked')).toBe('true');
  });
});
