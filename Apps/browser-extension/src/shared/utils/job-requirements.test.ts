/** @format */

import { describe, expect, it } from 'vitest';
import { extractJobRequirements } from './job-requirements';

describe('extractJobRequirements', () => {
  it('extracts explicit citizenship, PR, and named clearance restrictions', () => {
    expect(
      extractJobRequirements(`
        Applicants must be Australian citizens or permanent residents.
        You must hold a current NV1 security clearance.
      `),
    ).toMatchObject([
      { label: 'Citizen Required' },
      { label: 'PR Required' },
      { label: 'NV1 Clearance Required' },
    ]);
  });

  it('supports other named and generic security clearances', () => {
    expect(
      extractJobRequirements(
        'A Baseline security clearance is required. Security clearance is mandatory.',
      ),
    ).toMatchObject([
      { label: 'Baseline Clearance Required' },
      { label: 'Security Clearance Required' },
    ]);
  });

  it('keeps preferred clearance signals separate from mandatory restrictions', () => {
    expect(
      extractJobRequirements(`
        Mandatory Requirements
        • Australian Citizenship.
        • Baseline or higher Security Clearance (preferred)
      `),
    ).toMatchObject([
      {
        label: 'Baseline Clearance Preferred',
        priority: 'preferred',
        searchTerms: expect.arrayContaining([
          'baseline or higher security clearance',
        ]),
      },
    ]);
  });

  it('recognises descriptions that say the role requires citizenship', () => {
    expect(
      extractJobRequirements('This position requires Australian citizenship.'),
    ).toMatchObject([{ label: 'Citizen Required' }]);
  });

  it('ignores incidental, preferred, and negated mentions', () => {
    expect(
      extractJobRequirements(`
        Australian citizenship is preferred but not required.
        Permanent residents are encouraged to apply.
        No security clearance is required.
      `),
    ).toEqual([]);
  });
});
