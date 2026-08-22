// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';

import { ensureSmartRecruitersResumeField } from './smartrecruiters-file-adapter';

function visible(element: HTMLElement, width = 800, height = 90): void {
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height });
  element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  });
}

function addDropzone(
  parent: HTMLElement | ShadowRoot,
  dataTest: string,
): HTMLInputElement {
  const dropzone = document.createElement('spl-dropzone');
  dropzone.setAttribute('data-test', dataTest);
  visible(dropzone);
  parent.append(dropzone);

  const shadow = dropzone.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'file-input';
  input.style.opacity = '0';
  shadow.append(input);
  return input;
}

describe('SmartRecruiters resume field fallback', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('ignores Apply with resume and restores the required nested Resume field', () => {
    const parser = document.createElement('oc-apply-with-resume');
    const parserShadow = parser.attachShadow({ mode: 'open' });
    addDropzone(parserShadow, 'apply-with-resume-container');
    document.body.append(parser);

    const resume = document.createElement('oc-resume-upload');
    visible(resume, 900, 180);
    const resumeShadow = resume.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.setAttribute('data-test', 'resume-upload-container');
    container.textContent = 'Resume *';
    visible(container, 900, 180);
    const required = document.createElement('span');
    required.setAttribute('data-test', 'section-required-mark');
    required.textContent = '*';
    container.append(required);
    resumeShadow.append(container);
    addDropzone(container, 'resume-upload');
    document.body.append(resume);

    const fields = ensureSmartRecruitersResumeField(
      'smartrecruiters',
      [],
      document,
    );

    expect(fields).toEqual([
      expect.objectContaining({
        key: 'file-resume-upload',
        id: 'file-input',
        type: 'file',
        label: 'Resume',
        required: true,
        filled: false,
        upload: { state: 'empty' },
      }),
    ]);
  });

  it('does not add a duplicate when generic inspection already found Resume', () => {
    const existing = {
      key: 'file-resume-upload',
      type: 'file' as const,
      label: 'Resume',
      required: true,
      filled: false,
      sensitive: true,
      options: [],
      upload: { state: 'empty' as const },
    };

    expect(
      ensureSmartRecruitersResumeField('smartrecruiters', [existing], document),
    ).toEqual([existing]);
  });

  it('does not let a parser field suppress the real Resume component', () => {
    const resume = document.createElement('oc-resume-upload');
    visible(resume, 900, 180);
    const resumeShadow = resume.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.setAttribute('data-test', 'resume-upload-container');
    container.textContent = 'Resume *';
    visible(container, 900, 180);
    resumeShadow.append(container);
    addDropzone(container, 'resume-upload');
    document.body.append(resume);

    const parserField = {
      key: 'file-apply-with-resume-container',
      id: 'file-input',
      type: 'file' as const,
      label: 'Apply with resume',
      required: false,
      filled: false,
      sensitive: true,
      options: [],
      upload: { state: 'empty' as const },
    };

    expect(
      ensureSmartRecruitersResumeField(
        'smartrecruiters',
        [parserField],
        document,
      ),
    ).toEqual([
      expect.objectContaining({
        key: 'file-resume-upload',
        label: 'Resume',
        required: true,
      }),
    ]);
  });

  it('leaves other ATS platforms unchanged', () => {
    const fields: never[] = [];
    expect(ensureSmartRecruitersResumeField('greenhouse', fields, document)).toBe(
      fields,
    );
  });
});
