import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderCoverLetterPdfForExtension } from './cover-letter-pdf-renderer';

describe('cover letter PDF renderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders without starting the incompatible extension worker', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('Worker must not be used');
        }
      },
    );

    const result = await renderCoverLetterPdfForExtension('Body');

    expect(result.pages).toBe(1);
    expect(result.blob.type).toBe('application/pdf');
    expect(result.blob.size).toBeGreaterThan(1000);
  });

  it('renders a long three-paragraph cover letter without hanging', async () => {
    const sentence =
      'I build reliable full-stack software, improve API performance, and collaborate across teams to deliver secure cloud-native products.';
    const paragraph = Array.from({ length: 4 }, () => sentence).join(' ');
    const coverLetter = [paragraph, paragraph, paragraph].join('\n\n');

    const result = await renderCoverLetterPdfForExtension(
      coverLetter,
      {
        basics: {
          first_name: 'Scott',
          last_name: 'Zhang',
          email: 'xianzhe.site@gmail.com',
          location: { city: 'Sydney' },
        },
        experience: [],
        education: [],
        projects: [],
      },
      'Blue Zebra',
      'Software Engineer',
    );

    expect(result.pages).toBe(1);
    expect(result.blob.size).toBeGreaterThan(1000);
  });
});
