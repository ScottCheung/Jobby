import { describe, expect, it } from 'vitest';

import { canonicalizeFormFields } from './form-field-resolution';

const fileField = (overrides: Partial<{
  key: string;
  id: string;
  name: string;
  label: string;
  required: boolean;
}> = {}) => ({
  key: 'field',
  type: 'file' as const,
  label: 'Upload',
  required: false,
  filled: false,
  sensitive: true,
  options: [],
  ...overrides,
});

describe('canonicalizeFormFields', () => {
  it('keeps one canonical resume when DOM controls use different identities', () => {
    const fields = canonicalizeFormFields([
      fileField({ key: 'resume-shortcut', id: 'shortcut-upload', label: 'Resume' }),
      fileField({ key: 'candidate-resume', id: 'CandidateResume', name: 'CandidateResume', label: 'Resume' }),
      fileField({ key: 'cover', id: 'CandidateCoverLetter', name: 'CandidateCoverLetter', label: 'Cover letter' }),
    ]);

    expect(fields.map((field) => field.id)).toEqual([
      'CandidateResume',
      'CandidateCoverLetter',
    ]);
  });

  it('does not merge distinct non-document upload requests', () => {
    const fields = canonicalizeFormFields([
      fileField({ key: 'portfolio', id: 'portfolio', label: 'Portfolio' }),
      fileField({ key: 'certificate', id: 'certificate', label: 'Certificate' }),
    ]);

    expect(fields).toHaveLength(2);
  });
});
