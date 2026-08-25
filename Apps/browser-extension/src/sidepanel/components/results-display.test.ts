import { describe, expect, it } from 'vitest';
import type { FormFieldObservation } from '../../shared/contracts/form-inspection';
import { fileFieldPurpose, ExpandableAnswer } from './ResultsDisplay';

function fileField(
  overrides: Partial<FormFieldObservation>,
): FormFieldObservation {
  return {
    key: 'file-input',
    type: 'file',
    label: 'Choose a file or drop it here',
    required: false,
    filled: false,
    sensitive: false,
    options: [],
    ...overrides,
  };
}

describe('file field purpose detection', () => {
  it('recognizes a generic SmartRecruiters label from its semantic key', () => {
    expect(
      fileFieldPurpose(fileField({ key: 'file-resume-upload', required: true })),
    ).toBe('resume');
  });

  it('uses name and semantic features when the visible label is generic', () => {
    expect(
      fileFieldPurpose(
        fileField({ name: 'candidate_cv', semanticFeatures: ['document'] }),
      ),
    ).toBe('resume');
  });

  it('does not confuse profile images or cover letters with resumes', () => {
    expect(
      fileFieldPurpose(fileField({ label: 'Upload profile image' })),
    ).toBe('profile_image');
    expect(
      fileFieldPurpose(fileField({ key: 'cover-letter-upload' })),
    ).toBe('cover_letter');
    expect(
      fileFieldPurpose(fileField({ label: 'Cover note' })),
    ).toBe('cover_letter');
    expect(
      fileFieldPurpose(fileField({ label: 'Upload your resume' })),
    ).toBe('resume');
    expect(
      fileFieldPurpose(fileField({ label: 'Attach Resume' })),
    ).toBe('resume');
  });
});

describe('ExpandableAnswer component', () => {
  it('exports ExpandableAnswer component correctly', () => {
    expect(ExpandableAnswer).toBeDefined();
  });
});
