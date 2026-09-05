import { describe, expect, it } from 'vitest';

import { runtimeMessageSchema } from './messages';
import { pageInspectionSchema } from './page-inspection';

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

  it('accepts a request to highlight a JD requirement', () => {
    expect(
      runtimeMessageSchema.safeParse({
        type: 'content.highlight-job-requirement-active',
        searchTerms: ['citizenship', 'citizen'],
      }).success,
    ).toBe(true);
  });

  it('accepts all navigation aliases for a named clearance', () => {
    expect(
      runtimeMessageSchema.safeParse({
        type: 'content.highlight-job-requirement-active',
        searchTerms: Array.from({ length: 19 }, (_, index) => `nv1-alias-${index}`),
      }).success,
    ).toBe(true);
  });

  it('accepts a web-app request to inspect a job URL', () => {
    expect(
      runtimeMessageSchema.safeParse({
        type: 'content.inspect-url',
        url: 'https://www.seek.com.au/job/94260401',
      }).success,
    ).toBe(true);
  });
});

describe('page inspection posting-date compatibility', () => {
  it('converts a legacy relative date into canonical capture fields', () => {
    const parsed = pageInspectionSchema.parse({
      kind: 'job',
      snapshot: {
        platform: 'ashby',
        externalId: 'job-1',
        url: 'https://jobs.ashbyhq.com/example/job-1',
        title: 'Software Engineer',
        company: 'Example',
        datePosted: 'Posted 2 days ago',
        technologies: [],
      },
    });

    expect(parsed.kind).toBe('job');
    if (parsed.kind !== 'job') return;
    expect(parsed.snapshot.lastPostedAt).toBeDefined();
    expect(parsed.snapshot.postingObservedAt).toBeDefined();
    expect(parsed.snapshot.postingDateRaw?.label).toBe('Posted 2 days ago');
  });
});
