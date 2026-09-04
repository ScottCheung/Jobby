/** @format */

import { describe, expect, it } from 'vitest';
import { extractJobRequirements } from '@jobby/ui/lib/job-requirements';

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
      { label: 'Citizen Required' },
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

  it('detects NV1 clearances in bulleted lists and varied naming conventions', () => {
    expect(
      extractJobRequirements(`
        Requirements:
        • NV-1 Security Clearance
        • 5+ years React experience
      `),
    ).toMatchObject([{ label: 'NV1 Clearance Required' }]);

    expect(
      extractJobRequirements(`
        Eligibility:
        - Negative Vetting Level 1 (NV1)
      `),
    ).toMatchObject([{ label: 'NV1 Clearance Required' }]);

    expect(
      extractJobRequirements('Candidates must hold or be eligible to obtain an NV1.'),
    ).toMatchObject([{ label: 'NV1 Clearance Required' }]);

    expect(
      extractJobRequirements('Security Clearance: NV1'),
    ).toMatchObject([{ label: 'NV1 Clearance Required' }]);
  });

  it('detects Baseline clearances in bulleted lists, AGSVA, and short forms', () => {
    expect(
      extractJobRequirements(`
        Requirements:
        - Baseline clearance
        - Australian Citizen
      `),
    ).toMatchObject([
      { label: 'Citizen Required' },
      { label: 'Baseline Clearance Required' },
    ]);

    expect(
      extractJobRequirements('Hold or be eligible to obtain AGSVA Baseline clearance.'),
    ).toMatchObject([{ label: 'Baseline Clearance Required' }]);

    expect(
      extractJobRequirements('Clearance Level: Baseline'),
    ).toMatchObject([{ label: 'Baseline Clearance Required' }]);

    expect(
      extractJobRequirements('Active Baseline clearance is required.'),
    ).toMatchObject([{ label: 'Baseline Clearance Required' }]);
  });

  it('detects NV2 and Positive Vetting / TSPV clearances', () => {
    expect(
      extractJobRequirements('Must hold a current NV2 clearance.'),
    ).toMatchObject([{ label: 'NV2 Clearance Required' }]);

    expect(
      extractJobRequirements('Negative Vetting Level 2 (NV2) clearance is mandatory.'),
    ).toMatchObject([{ label: 'NV2 Clearance Required' }]);

    expect(
      extractJobRequirements('Role requires Top Secret Positive Vetting (TSPV).'),
    ).toMatchObject([{ label: 'Positive Vetting Clearance Required' }]);

    expect(
      extractJobRequirements('You must hold an active TSPV clearance.'),
    ).toMatchObject([{ label: 'Positive Vetting Clearance Required' }]);
  });

  it('handles multiple clearances and mixed required/preferred specifications', () => {
    expect(
      extractJobRequirements('Applicants must hold a Baseline, NV1 or NV2 clearance.'),
    ).toMatchObject([
      { label: 'Baseline Clearance Required' },
      { label: 'NV1 Clearance Required' },
      { label: 'NV2 Clearance Required' },
    ]);

    expect(
      extractJobRequirements('Baseline clearance required (NV1 preferred).'),
    ).toMatchObject([
      { label: 'Baseline Clearance Required', priority: 'required' },
      { label: 'NV1 Clearance Preferred', priority: 'preferred' },
    ]);
  });

  it('does not falsely detect non-clearance baseline mentions', () => {
    expect(
      extractJobRequirements(`
        Requirements:
        • Experience with baseline testing and performance monitoring
        • Baseline salary of $130,000 + super
      `),
    ).toEqual([]);
  });
});

