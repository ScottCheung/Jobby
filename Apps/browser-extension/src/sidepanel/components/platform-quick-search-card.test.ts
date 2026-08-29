/** @format */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  extractProfileSearchCriteria,
  PlatformQuickSearchList,
  SUPPORTED_PLATFORMS,
} from './PlatformQuickSearchCard';
import type { CareerProfile } from '../../shared/contracts/tailored-resume';

describe('PlatformQuickSearchCard', () => {
  it('extracts search title and location from headline and location', () => {
    const profile: CareerProfile = {
      id: 'prof-1',
      name: 'Default Profile',
      is_default: true,
      resume_data: {
        basics: {
          headline: 'Full Stack Engineer',
          location: {
            city: 'Sydney',
            state: 'NSW',
            country: 'Australia',
          },
        },
      },
    };

    const criteria = extractProfileSearchCriteria(profile);
    expect(criteria.jobTitle).toBe('Full Stack Engineer');
    expect(criteria.location).toBe('Sydney, NSW, Australia');
  });

  it('falls back to latest experience title when headline is absent', () => {
    const profile: CareerProfile = {
      id: 'prof-2',
      name: 'Default',
      is_default: true,
      resume_data: {
        basics: {
          location: {
            city: 'Melbourne',
            country: 'Australia',
          },
        },
        experience: [
          {
            title: 'Senior Frontend Developer',
            company: 'Tech Corp',
          },
        ],
      },
    };

    const criteria = extractProfileSearchCriteria(profile);
    expect(criteria.jobTitle).toBe('Senior Frontend Developer');
    expect(criteria.location).toBe('Melbourne, Australia');
  });

  it('generates proper search URLs for all supported platforms', () => {
    const title = 'Software Engineer';
    const location = 'Sydney';

    const linkedin = SUPPORTED_PLATFORMS.find((p) => p.id === 'linkedin')!;
    expect(linkedin.getSearchUrl(title, location)).toContain('keywords=Software+Engineer');
    expect(linkedin.getSearchUrl(title, location)).toContain('location=Sydney');

    const seek = SUPPORTED_PLATFORMS.find((p) => p.id === 'seek')!;
    expect(seek.getSearchUrl(title, location)).toContain('keywords=Software+Engineer');
    expect(seek.getSearchUrl(title, location)).toContain('where=Sydney');

    const greenhouse = SUPPORTED_PLATFORMS.find((p) => p.id === 'greenhouse')!;
    expect(greenhouse.getSearchUrl(title, location)).toContain('boards.greenhouse.io');

    const ashby = SUPPORTED_PLATFORMS.find((p) => p.id === 'ashby')!;
    expect(ashby.getSearchUrl(title, location)).toContain('jobs.ashbyhq.com');
  });

  it('handles empty or null profile safely without crashing', () => {
    expect(extractProfileSearchCriteria(null)).toEqual({ jobTitle: '', location: '' });
    expect(extractProfileSearchCriteria(undefined)).toEqual({ jobTitle: '', location: '' });
  });

  it('renders PlatformQuickSearchList with Job Boards and ATS Portals and no numeric count labels', () => {
    const html = renderToStaticMarkup(
      createElement(PlatformQuickSearchList, { activeProfile: null }),
    );
    expect(html).toContain('Job Boards');
    expect(html).toContain('ATS Portals');
    expect(html).toContain('LinkedIn');
    expect(html).toContain('Greenhouse');
    // Ensure numeric count pill next to headings is removed
    expect(html).not.toMatch(/>\s*4\s*<\/span>/);
    expect(html).not.toMatch(/>\s*8\s*<\/span>/);
  });
});

