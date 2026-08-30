import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  JobScoreCard,
  jobMatchLabel,
} from '@jobby/ui/components/UI/job-analysis/JobScoreCard';
import type { PageInspection } from '../../shared/contracts/page-inspection';

describe('job match score card', () => {
  it('keeps the loading and final score labels separate', () => {
    expect(jobMatchLabel(true, true, null)).toBe('Calculating Score...');
    expect(jobMatchLabel(true, false, 82)).toBe('Highly Recommended');
    expect(jobMatchLabel(true, false, null)).toBe('Score unavailable');
  });

  it('hides tailor actions while the job match is being calculated', () => {
    const html = renderToStaticMarkup(
      createElement(JobScoreCard, {
        latestInspection: {
          kind: 'job',
          snapshot: {
            platform: 'seek',
            externalId: '123',
            url: 'https://www.seek.com.au/job/123',
            title: 'Frontend Developer',
            company: 'Atlassian',
          },
        },
        latestMatch: null,
        isMatchLoading: true,
        onTailor: vi.fn(),
        authConnected: true,
      }),
    );

    expect(html).toContain('Calculating Score...');
    expect(html).not.toContain('Tailor CV');
    expect(html).not.toContain('Generate CL');
    expect(html).not.toContain('Get Both');
  });

  it('enables tailor buttons for the current job when a different job is generating in the background', () => {
    const onTailor = vi.fn();
    const currentJob: PageInspection = {
      kind: 'job',
      snapshot: {
        platform: 'seek',
        externalId: '123',
        url: 'https://www.seek.com.au/job/123',
        title: 'Frontend Developer',
        company: 'Atlassian',
        technologies: ['React'],
      },
    };

    const html = renderToStaticMarkup(
      createElement(JobScoreCard, {
        latestInspection: currentJob,
        latestMatch: null,
        onTailor: onTailor,
        authConnected: true,
        activeGeneration: {
          docType: 'resume',
          jobTitle: 'Full Stack Engineer',
          company: 'Synechron',
        },
      }),
    );

    // Shows background task banner
    expect(html).toContain('Background task: Generating CV for');
    expect(html).toContain('Full Stack Engineer at Synechron');
    expect(html).toContain('You can tailor documents for this page concurrently.');

    // Tailor CV button is enabled (not disabled)
    expect(html).toContain('Tailor CV');
    expect(html).not.toContain('disabled=""');
  });

  it('disables tailor buttons when the current job itself is generating', () => {
    const onTailor = vi.fn();
    const currentJob: PageInspection = {
      kind: 'job',
      snapshot: {
        platform: 'seek',
        externalId: '123',
        url: 'https://www.seek.com.au/job/123',
        title: 'Full Stack Engineer',
        company: 'Synechron',
        technologies: ['React'],
      },
    };

    const html = renderToStaticMarkup(
      createElement(JobScoreCard, {
        latestInspection: currentJob,
        latestMatch: null,
        onTailor: onTailor,
        authConnected: true,
        activeGeneration: {
          docType: 'resume',
          jobTitle: 'Full Stack Engineer',
          company: 'Synechron',
        },
      }),
    );

    // Shows current role generating banner
    expect(html).toContain('Generating CV for');
    expect(html).toContain('Full Stack Engineer at Synechron');
    expect(html).toContain('You can switch pages; progress will remain available.');

    // Tailor CV button is busy / disabled
    expect(html).toContain('Tailoring...');
    expect(html).toContain('disabled=""');
  });
});
