import type { FormFieldObservation } from '../../../shared/contracts/form-inspection';
import type { ProviderFormRoot } from '../platform-definition';
import { isVisibleElement } from '../../dom/form-inspector';
import type { FormFieldTarget, FormFocusResult } from '../../../shared/contracts/form-actions';
import { scrollAndHighlightQuestion } from '../../dom/form-driver/focus-highlighter';

export const LINKEDIN_RESUME_UPLOAD_KEY = 'linkedin-resume-upload';
export const LINKEDIN_RESUME_UPLOAD_SELECTOR = '[data-jobby-linkedin-resume-upload]';

export function findLinkedInResumeUpload(root: ProviderFormRoot): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => isVisibleElement(button) &&
      /^upload\s+resume$/i.test((button.textContent || button.getAttribute('aria-label') || '').trim()),
  );
}

export function adaptLinkedInResumeUpload(
  fields: FormFieldObservation[],
  root: ProviderFormRoot,
): FormFieldObservation[] {
  const button = findLinkedInResumeUpload(root);
  if (!button || root.querySelector('input[type="file"]')) return fields;
  if (!button.hasAttribute('data-jobby-linkedin-resume-upload')) {
    button.setAttribute('data-jobby-linkedin-resume-upload', '');
  }
  const radios = Array.from(root.querySelectorAll<HTMLElement>('[role="radio"][aria-label]'))
    .filter((radio) => /\.(?:pdf|docx?)$/i.test(radio.getAttribute('aria-label') || ''));
  const filename = radios.find((radio) => radio.getAttribute('aria-checked') === 'true')
    ?.getAttribute('aria-label');
  return [
    ...fields.filter((field) => field.type !== 'radio' ||
      (!/^(?:resume\s*\*?|select or upload a resume\b)/i.test(field.label) &&
        !field.options.some((option) => /\.(?:pdf|docx?)$/i.test(option.label)))),
    {
      key: LINKEDIN_RESUME_UPLOAD_KEY,
      type: 'file',
      label: 'Resume',
      required: /Resume\s*\*/i.test(root.textContent || ''),
      filled: Boolean(filename),
      sensitive: true,
      options: [],
      ...(filename ? { currentValue: filename } : {}),
      upload: filename ? { state: 'ready', filename } : { state: 'empty' },
    },
  ];
}

export function focusLinkedInResumeUpload(target: FormFieldTarget, root: ProviderFormRoot): FormFocusResult | null {
  if (target.key !== LINKEDIN_RESUME_UPLOAD_KEY) return null;
  const button = findLinkedInResumeUpload(root);
  if (!button) return { key: target.key, status: 'not_found', message: 'The upload control is no longer available.' };
  scrollAndHighlightQuestion(button);
  return { key: target.key, status: 'focused', message: 'Upload control highlighted. Click the upload button on the webpage to choose a local file.' };
}
