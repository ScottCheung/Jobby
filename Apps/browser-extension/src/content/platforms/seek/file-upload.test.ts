// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { uploadFormFile } from '../../dom/form-driver';

function base64Encode(text: string): string {
  return btoa(text);
}

describe('SEEK file upload and option selection', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('https://www.seek.com.au/job/12345678/apply'),
    });
  });

  it('automatically selects "Upload a cover letter" radio option before uploading cover letter', async () => {
    const container = document.createElement('fieldset');
    container.innerHTML = `
      <legend>Cover letter</legend>
      <div>
        <input type="radio" id="cl-none" name="coverLetterOption" value="none" checked />
        <label for="cl-none">Don't include a cover letter</label>
      </div>
      <div>
        <input type="radio" id="cl-write" name="coverLetterOption" value="write" />
        <label for="cl-write">Write a cover letter</label>
      </div>
      <div>
        <input type="radio" id="cl-upload" name="coverLetterOption" value="upload" />
        <label for="cl-upload">Upload a cover letter</label>
        <input type="file" id="cl-file" accept=".pdf,.docx,.doc" />
      </div>
    `;
    document.body.append(container);

    const clNone = container.querySelector<HTMLInputElement>('#cl-none')!;
    const clUpload = container.querySelector<HTMLInputElement>('#cl-upload')!;
    const clFile = container.querySelector<HTMLInputElement>('#cl-file')!;

    expect(clNone.checked).toBe(true);
    expect(clUpload.checked).toBe(false);

    const dummyPdfBase64 = base64Encode('%PDF-1.4 dummy pdf content');
    const res = await uploadFormFile(
      {
        commandId: 'cmd-cl-1',
        target: {
          key: 'cl-file',
          id: 'cl-file',
          label: 'Cover Letter',
          type: 'file',
        },
        filename: 'My-Cover-Letter.pdf',
        mimeType: 'application/pdf',
        contentBase64: dummyPdfBase64,
      },
      document,
    );

    expect(clUpload.checked).toBe(true);
    expect(clFile.files?.[0]?.name).toBe('My-Cover-Letter.pdf');
    expect(res.status).toBe('filled');
  });

  it('preserves already-selected upload radio without error', async () => {
    const container = document.createElement('fieldset');
    container.innerHTML = `
      <legend>Cover letter</legend>
      <div>
        <input type="radio" id="cl-none" name="coverLetterOption" value="none" />
        <label for="cl-none">Don't include a cover letter</label>
      </div>
      <div>
        <input type="radio" id="cl-upload" name="coverLetterOption" value="upload" checked />
        <label for="cl-upload">Upload a cover letter</label>
        <input type="file" id="cl-file" accept=".pdf,.docx,.doc" />
      </div>
    `;
    document.body.append(container);

    const clUpload = container.querySelector<HTMLInputElement>('#cl-upload')!;
    const clFile = container.querySelector<HTMLInputElement>('#cl-file')!;

    const dummyPdfBase64 = base64Encode('%PDF-1.4 dummy pdf content');
    const res = await uploadFormFile(
      {
        commandId: 'cmd-cl-2',
        target: {
          key: 'cl-file',
          id: 'cl-file',
          label: 'Cover Letter',
          type: 'file',
        },
        filename: 'My-Cover-Letter.pdf',
        mimeType: 'application/pdf',
        contentBase64: dummyPdfBase64,
      },
      document,
    );

    expect(clUpload.checked).toBe(true);
    expect(clFile.files?.[0]?.name).toBe('My-Cover-Letter.pdf');
    expect(res.status).toBe('filled');
  });

  it('automatically selects "Upload a resume" radio option before uploading resume', async () => {
    const container = document.createElement('fieldset');
    container.innerHTML = `
      <legend>Resume</legend>
      <div>
        <input type="radio" id="resume-profile" name="resumeOption" value="profile" checked />
        <label for="resume-profile">Select a resume stored in your SEEK profile</label>
      </div>
      <div>
        <input type="radio" id="resume-upload" name="resumeOption" value="upload" />
        <label for="resume-upload">Upload a resume</label>
        <input type="file" id="resume-file" accept=".pdf,.docx,.doc" />
      </div>
    `;
    document.body.append(container);

    const resumeProfile = container.querySelector<HTMLInputElement>('#resume-profile')!;
    const resumeUpload = container.querySelector<HTMLInputElement>('#resume-upload')!;
    const resumeFile = container.querySelector<HTMLInputElement>('#resume-file')!;

    expect(resumeProfile.checked).toBe(true);
    expect(resumeUpload.checked).toBe(false);

    const dummyPdfBase64 = base64Encode('%PDF-1.4 dummy pdf content');
    const res = await uploadFormFile(
      {
        commandId: 'cmd-resume-1',
        target: {
          key: 'resume-file',
          id: 'resume-file',
          label: 'Resume',
          type: 'file',
        },
        filename: 'Custom-Resume.pdf',
        mimeType: 'application/pdf',
        contentBase64: dummyPdfBase64,
      },
      document,
    );

    expect(resumeUpload.checked).toBe(true);
    expect(resumeFile.files?.[0]?.name).toBe('Custom-Resume.pdf');
    expect(res.status).toBe('filled');
  });

  it('triggers React/Braid click handler on label/span when selecting "Upload a cover letter"', async () => {
    let labelClicked = false;
    const container = document.createElement('div');
    container.setAttribute('data-automation', 'cover-letter-section');
    container.innerHTML = `
      <div role="radiogroup" aria-label="Cover letter">
        <div class="RadioItem">
          <input type="radio" id="braid-none" name="clOption" value="none" checked />
          <label for="braid-none"><span>Don't include a cover letter</span></label>
        </div>
        <div class="RadioItem">
          <input type="radio" id="braid-upload" name="clOption" value="upload" />
          <label for="braid-upload"><span>Upload a cover letter</span></label>
        </div>
      </div>
      <input type="file" id="braid-file" accept=".pdf" />
    `;
    document.body.append(container);

    const uploadLabel = container.querySelector<HTMLLabelElement>("label[for='braid-upload']")!;
    uploadLabel.addEventListener('click', () => {
      labelClicked = true;
    });

    const dummyPdfBase64 = base64Encode('%PDF-1.4 dummy pdf content');
    const res = await uploadFormFile(
      {
        commandId: 'cmd-cl-braid',
        target: {
          key: 'braid-file',
          id: 'braid-file',
          label: 'Cover Letter',
          type: 'file',
        },
        filename: 'My-Cover-Letter.pdf',
        mimeType: 'application/pdf',
        contentBase64: dummyPdfBase64,
      },
      document,
    );

    expect(labelClicked).toBe(true);
    expect(res.status).toBe('filled');
  });

  it('does not click upload buttons or file triggers when uploading', async () => {
    let uploadButtonClicked = false;
    const container = document.createElement('fieldset');
    container.innerHTML = `
      <legend>Resume</legend>
      <div>
        <input type="radio" id="resume-profile-2" name="resumeOption" value="profile" checked />
        <label for="resume-profile-2">Select a resume stored in your SEEK profile</label>
      </div>
      <div>
        <input type="radio" id="resume-upload-2" name="resumeOption" value="upload" />
        <label for="resume-upload-2"><span>Upload a resume</span></label>
        <button type="button" data-automation="upload-button">Upload resume</button>
        <input type="file" id="resume-file-2" accept=".pdf" />
      </div>
    `;
    document.body.append(container);

    const uploadBtn = container.querySelector<HTMLButtonElement>("[data-automation='upload-button']")!;
    uploadBtn.addEventListener('click', () => {
      uploadButtonClicked = true;
    });

    const dummyPdfBase64 = base64Encode('%PDF-1.4 dummy pdf content');
    const res = await uploadFormFile(
      {
        commandId: 'cmd-resume-btn-test',
        target: {
          key: 'resume-file-2',
          id: 'resume-file-2',
          label: 'Resume',
          type: 'file',
        },
        filename: 'Custom-Resume.pdf',
        mimeType: 'application/pdf',
        contentBase64: dummyPdfBase64,
      },
      document,
    );

    expect(uploadButtonClicked).toBe(false);
    expect(res.status).toBe('filled');
  });

  it('recognises SEEK resume selection radio as a document selection radio and skips it from regular fields', async () => {
    const { inspectVisibleFormFields } = await import('../../dom/form-inspector');
    const container = document.createElement('fieldset');
    container.innerHTML = `
      <legend>Resume</legend>
      <div>
        <input type="radio" id="resume-profile-3" name="resumeOption" value="profile" checked />
        <label for="resume-profile-3">Select a resume stored in your SEEK profile</label>
      </div>
      <div>
        <input type="radio" id="resume-upload-3" name="resumeOption" value="upload" />
        <label for="resume-upload-3">Upload a resume</label>
        <input type="file" id="resume-file-3" accept=".pdf" />
      </div>
    `;
    document.body.append(container);

    const fields = inspectVisibleFormFields(container);
    // The resume radio options should not be reported as a standalone radio field
    expect(fields.filter((f) => f.type === 'radio')).toHaveLength(0);
    // Only the file field should be reported
    expect(fields.filter((f) => f.type === 'file')).toHaveLength(1);
    expect(fields.find((f) => f.type === 'file')?.label).toBe('Resume');
  });
});
