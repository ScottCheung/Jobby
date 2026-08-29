/** @format */

import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@jobby/ui/components/UI/Button', () => ({
  Button: ({ children }: { children?: unknown }) => children,
}));
vi.mock('@jobby/ui/components/UI/popover', () => ({
  Popover: ({ children }: { children?: unknown }) => children,
  PopoverContent: ({ children }: { children?: unknown }) => children,
  PopoverTrigger: ({ children }: { children?: unknown }) => children,
  PopoverArrow: ({ children }: { children?: unknown }) => children,
}));
vi.mock('@jobby/ui/components/UI/tooltip', () => ({
  Tooltip: ({ children }: { children?: unknown }) => children,
}));
vi.mock('./DetectionProviderBadge', () => ({
  DetectionProviderBadge: () => null,
}));
vi.mock('./EditJobModal', () => ({ EditJobModal: () => null }));

import type { PageInspection } from '../../shared/contracts/page-inspection';
import {
  PageClassBanner,
  getSkillSource,
  shouldShowTechnologyLoading,
} from './PageClassBanner';

describe('job details banner', () => {
  const inspection: PageInspection = {
    kind: 'job',
    snapshot: {
      platform: 'seek',
      externalId: 'job-998877',
      url: 'https://www.seek.com.au/job/998877',
      title: 'Full Stack Engineer',
      company: 'Canva',
      firstPostedAt: '2026-08-25T00:00:00.000Z',
      lastPostedAt: '2026-08-25T00:00:00.000Z',
      postingObservedAt: '2026-08-26T00:00:00.000Z',
      description: 'Role requires React, TypeScript, Docker, and Python.',
      technologies: ['React', 'TypeScript', 'Docker', 'Python'],
    },
  };

  it('keeps detected technologies as job data without scoring them', () => {
    expect(inspection.snapshot.technologies).toEqual([
      'React',
      'TypeScript',
      'Docker',
      'Python',
    ]);
  });

  it('merges manual corrections into the current job snapshot', () => {
    const updated = {
      ...inspection.snapshot,
      title: 'Senior Full Stack Engineer',
      company: 'Canva HQ',
      location: 'Sydney, Australia',
      technologies: ['React', 'TypeScript', 'Node.js', 'AWS'],
    };

    expect(updated.title).toBe('Senior Full Stack Engineer');
    expect(updated.company).toBe('Canva HQ');
    expect(updated.location).toBe('Sydney, Australia');
    expect(updated.technologies).toEqual([
      'React',
      'TypeScript',
      'Node.js',
      'AWS',
    ]);
  });

  it('renders a job-details skeleton while page recognition is running', () => {
    const html = renderToStaticMarkup(
      createElement(PageClassBanner, {
        latestInspection: null,
        isInspecting: true,
      }),
    );

    expect(html).toContain('Inspecting Page...');
    expect(html).toContain('animate-skeleton-shimmer');
  });

  it('keeps technology shimmer visible while match scoring is loading', () => {
    expect(shouldShowTechnologyLoading(true, true)).toBe(true);
    expect(shouldShowTechnologyLoading(true, false)).toBe(false);
    expect(shouldShowTechnologyLoading(false, true)).toBe(false);
  });

  it('shows the job ID first without a collapsed technical-details section', () => {
    const html = renderToStaticMarkup(
      createElement(PageClassBanner, {
        latestInspection: inspection,
        isInspecting: false,
      }),
    );

    expect(html).not.toContain('Show Technical Details');
    expect(html).toContain('Job ID:');
    expect(html.indexOf('Job ID:')).toBeLessThan(html.indexOf('Job Title:'));
    expect(html).toContain('truncate whitespace-nowrap');
  });

  it('offers copy actions for identified fields except dates and technologies', () => {
    const copyableInspection: PageInspection = {
      ...inspection,
      snapshot: {
        ...inspection.snapshot,
        location: 'Sydney, Australia',
        description:
          'Australian citizens must build React and TypeScript applications.',
      },
    };
    const html = renderToStaticMarkup(
      createElement(PageClassBanner, {
        latestInspection: copyableInspection,
        isInspecting: false,
      }),
    );

    expect(html).toContain('aria-label="Copy Job ID"');
    expect(html).toContain('aria-label="Copy Job Title"');
    expect(html).toContain('aria-label="Copy Company"');
    expect(html).toContain('aria-label="Copy Location"');
    expect(html).toContain('aria-label="Copy Job Description"');
    expect(html).not.toContain('aria-label="Copy Posted"');
    expect(html).not.toContain('aria-label="Copy Technologies"');
    expect(html.indexOf('Full Stack Engineer')).toBeLessThan(
      html.indexOf('aria-label="Copy Job Title"'),
    );
    expect(html.indexOf('aria-label="Copy Job Title"')).toBeLessThan(
      html.indexOf('Company:'),
    );
  });

  it('renders original and repost dates on separate rows', () => {
    const repostedInspection: PageInspection = {
      kind: 'job',
      snapshot: {
        ...inspection.snapshot,
        platform: 'linkedin',
        url: 'https://www.linkedin.com/jobs/view/998877',
        firstPostedAt: '2026-07-01T00:00:00.000Z',
        lastPostedAt: '2026-08-24T06:30:00.000Z',
        isReposted: true,
        easyApply: true,
      },
    };
    const html = renderToStaticMarkup(
      createElement(PageClassBanner, {
        latestInspection: repostedInspection,
        isInspecting: false,
      }),
    );

    expect(html).toContain('First posted:');
    expect(html).toContain('Reposted:');
    expect(html.indexOf('First posted:')).toBeLessThan(html.indexOf('Reposted:'));
  });

  it('shows explicit JD eligibility restrictions in the preview', () => {
    const restrictedInspection: PageInspection = {
      ...inspection,
      snapshot: {
        ...inspection.snapshot,
        description:
          'Applicants must be Australian citizens or permanent residents and must hold an NV2 clearance.',
      },
    };
    const html = renderToStaticMarkup(
      createElement(PageClassBanner, {
        latestInspection: restrictedInspection,
        isInspecting: false,
      }),
    );

    expect(html).toContain('Eligibility:');
    expect(html).toContain('Citizen Required');
    expect(html).toContain('PR Required');
    expect(html).toContain('NV2 Clearance Required');
    expect(html).not.toContain('Easy Apply:');
    expect(html).toContain('Show Citizen Required in the job description');
  });

  it('renders single Bonus group as Bonus - xxx and multi-group with Detail toggle', () => {
    const singleBonusInspection: PageInspection = {
      kind: 'job',
      snapshot: {
        ...inspection.snapshot,
        technologies: [
          'React',
          'C#',
          '.NET',
          'SQL',
          'Financial Services',
          'Wealth Management',
        ],
      },
    };
    const singleHtml = renderToStaticMarkup(
      createElement(PageClassBanner, {
        latestInspection: singleBonusInspection,
        isInspecting: false,
      }),
    );

    expect(singleHtml).toContain('Core (0/4)');
    expect(singleHtml).toContain('Bonus - Finance &amp; Banking (0/2)');
    expect(singleHtml).not.toContain('Detail');

    const multiBonusInspection: PageInspection = {
      kind: 'job',
      snapshot: {
        ...inspection.snapshot,
        technologies: [
          'React',
          'C#',
          '.NET',
          'SQL',
          'Financial Services',
          'Wealth Management',
          'Communication Skills',
        ],
      },
    };
    const multiHtml = renderToStaticMarkup(
      createElement(PageClassBanner, {
        latestInspection: multiBonusInspection,
        isInspecting: false,
      }),
    );

    expect(multiHtml).toContain('Core (0/4)');
    expect(multiHtml).toContain('Bonus (0/3)');
    expect(multiHtml).toContain('Detail');
    expect(multiHtml).toContain('aria-label="Show category details"');
  });

  it('correctly resolves skill source with priority for claimed profile skills', () => {
    const userSkills = [
      {
        id: '1',
        skill_name: 'Communication Skills',
        canonical_name: 'communication skills',
        created_at: '',
        updated_at: '',
      },
    ];

    // Even if matchedSet (AI match terms) is completely empty, claimed skill must resolve to 'profile'
    expect(getSkillSource('Communication Skills', new Set(), null, userSkills)).toBe(
      'profile',
    );

    // Unclaimed skill with empty matchedSet resolves to 'unclaimed'
    expect(getSkillSource('Financial Services', new Set(), null, userSkills)).toBe(
      'unclaimed',
    );

    // Skill present in matchedSet resolves to 'resume'
    expect(
      getSkillSource('Financial Services', new Set(['financial services']), null, userSkills),
    ).toBe('resume');
  });
});

