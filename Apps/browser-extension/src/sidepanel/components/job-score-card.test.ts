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

  it('labels the primary score as Apply Score and keeps Match and Fresh separate', () => {
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
        latestMatch: {
          candidate: {
            platform: 'seek',
            external_id: '123',
            title: 'Frontend Developer',
            company: 'Atlassian',
            match_score: 0.91,
            priority_score: 0.63,
            recency_factor: 0.69,
            skill_score: 0.95,
            title_score: 0.88,
            exp_score: 0.90,
            easy_apply: false,
            already_applied: false,
            description: 'Frontend role',
          },
          decision: {
            action: 'review',
            reason_codes: [],
            explanation: 'Review this opportunity',
            score: 0.63,
            resume_strategy: null,
            requires_submit_confirmation: false,
          },
          should_generate_tailored_resume: false,
          matched_terms: [],
        },
      }),
    );

    expect(html).toContain('Apply Score');
    expect(html).toContain('Match');
    expect(html).toContain('Fresh');
    expect(html).toContain('63');
    expect(html).toContain('91');
    expect(html).toContain('69');
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

  it('renders Record button and transforms to Applied when recorded', () => {
    const onRecord = vi.fn();
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

    const unrecordedHtml = renderToStaticMarkup(
      createElement(JobScoreCard, {
        latestInspection: currentJob,
        latestMatch: null,
        authConnected: true,
        onRecordApplication: onRecord,
        canRecordApplication: true,
        isApplicationRecorded: false,
      }),
    );

    expect(unrecordedHtml).toContain('Record');
    expect(unrecordedHtml).toContain('Mark as applied in Jobby');

    const recordedHtml = renderToStaticMarkup(
      createElement(JobScoreCard, {
        latestInspection: currentJob,
        latestMatch: null,
        authConnected: true,
        onRecordApplication: onRecord,
        canRecordApplication: true,
        isApplicationRecorded: true,
      }),
    );

    expect(recordedHtml).toContain('Applied');
    expect(recordedHtml).toContain('Application recorded in Jobby');
  });

  it('keeps only the missing document action when a CV exists', () => {
    const onPreview = vi.fn();
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
        authConnected: true,
        onTailor,
        onPreview,
        existingDocuments: {
          resume: true,
          cover_letter: false,
        },
      }),
    );

    expect(html).toContain('Preview CV');
    expect(html).toContain('Tailor CL');
    expect(html).not.toContain('Preview CL');
    expect(html).not.toContain('Tailor Both');
  });
});
