// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchLinkedInJobPosting } from './api-client';

describe('fetchLinkedInJobPosting posting dates', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://www.linkedin.com/jobs/view/123456789/'),
    });
    document.cookie = 'JSESSIONID="ajax:123"; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps original and repost timestamps as separate canonical values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          originalListedAt: Date.parse('2026-07-01T00:00:00.000Z'),
          listedAt: Date.parse('2026-08-24T06:30:00.000Z'),
        },
      }),
    }));

    const result = await fetchLinkedInJobPosting('123456789');

    expect(result).toMatchObject({
      firstPostedAt: '2026-07-01T00:00:00.000Z',
      lastPostedAt: '2026-08-24T06:30:00.000Z',
      isReposted: true,
      postingDateRaw: {
        originalListedAt: Date.parse('2026-07-01T00:00:00.000Z'),
        listedAt: Date.parse('2026-08-24T06:30:00.000Z'),
      },
    });
    expect(result?.postingObservedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('extracts title and company from Voyager API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          title: 'Senior Software Engineer',
          companyName: 'Acme Global',
          listedAt: Date.parse('2026-08-24T06:30:00.000Z'),
        },
      }),
    }));

    const result = await fetchLinkedInJobPosting('123456789');

    expect(result).toMatchObject({
      title: 'Senior Software Engineer',
      company: 'Acme Global',
      lastPostedAt: '2026-08-24T06:30:00.000Z',
    });
  });
});
