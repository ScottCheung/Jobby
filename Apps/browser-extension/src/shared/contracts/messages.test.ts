import { describe, expect, it } from 'vitest';

import { runtimeMessageSchema } from './messages';

describe('runtime upload message contract', () => {
  it('accepts a prepared tailored resume from the extension UI', () => {
    expect(
      runtimeMessageSchema.safeParse({
        type: 'content.upload-file-active',
        target: {
          key: 'file-resume-upload',
          type: 'file',
          label: 'Resume',
        },
        filename: 'Candidate_CV_Company_Role.pdf',
        mimeType: 'application/pdf',
        contentBase64: 'JVBERi0xLjQ=',
      }).success,
    ).toBe(true);
  });
});
