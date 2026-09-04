import { describe, expect, it } from 'vitest';
import type { FormInspection } from '../../shared/contracts/form-inspection';
import { reconcileUploadStates } from './useInspection';

describe('upload source reconciliation', () => {
  it('keeps the actual tailored source after the page confirms a cover letter', () => {
    const next = reconcileUploadStates(
      {
        cover_letter_upload: {
          phase: 'uploading',
          message: 'Preparing cover letter...',
          updatedAt: 1,
          sourceDocumentId: 'cl-1',
          sourceLabel: 'Acme · Backend Engineer',
        },
      },
      {
        kind: 'application_form',
        platform: 'seek',
        url: 'https://seek.com.au/job/93941097/apply',
        fields: [
          {
            key: 'cover_letter_upload',
            type: 'file',
            label: 'Cover letter',
            required: false,
            filled: true,
            sensitive: false,
            options: [],
            upload: {
              state: 'ready',
              filename: 'Scott-Cover-Letter.pdf',
            },
          },
        ],
      } as FormInspection,
    );

    expect(next.cover_letter_upload).toMatchObject({
      phase: 'confirmed',
      sourceDocumentId: 'cl-1',
      sourceLabel: 'Acme · Backend Engineer',
    });
  });
});
