/** @format */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  showInPageJobDescriptionModal,
  closeInPageJobDescriptionModal,
} from './job-description-modal-injector';

describe('Job Description In-Page Modal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    closeInPageJobDescriptionModal();
  });

  it('injects a modal shadow DOM into the document and renders structured description', async () => {
    const rawJobDescription = `
About the role:
We are looking for a Senior Software Engineer to build modern web apps.

Key Responsibilities:
- Design and develop scalable frontend systems
- Collaborate with cross-functional teams
- Write clean and well-tested code

Qualifications:
- 5+ years of experience with TypeScript and React
- Strong understanding of web fundamentals
    `.trim();

    await showInPageJobDescriptionModal({
      title: 'Senior Software Engineer',
      company: 'Acme Corp',
      location: 'Sydney, Australia',
      datePosted: '2 days ago',
      description: rawJobDescription,
      platform: 'LinkedIn',
    });

    const root = document.getElementById('jobby-in-page-job-description-modal-root');
    expect(root).not.toBeNull();
    expect(root?.shadowRoot).not.toBeNull();

    const shadow = root!.shadowRoot!;
    const titleEl = shadow.querySelector('.header-title');
    expect(titleEl?.textContent).toBe('Senior Software Engineer');

    const metaEl = shadow.querySelector('.header-meta');
    expect(metaEl?.textContent).toContain('Acme Corp');
    expect(metaEl?.textContent).toContain('Sydney, Australia');
    expect(metaEl?.textContent).toContain('2 days ago');

    const headings = Array.from(shadow.querySelectorAll('.jd-heading')).map(
      (el) => el.textContent?.trim(),
    );
    expect(headings).toContain('About the role:');
    expect(headings).toContain('Key Responsibilities:');
    expect(headings).toContain('Qualifications:');

    const listItems = Array.from(shadow.querySelectorAll('.jd-item-text')).map(
      (el) => el.textContent?.trim(),
    );
    expect(listItems).toContain('Design and develop scalable frontend systems');
    expect(listItems).toContain('5+ years of experience with TypeScript and React');

    const copyBtn = shadow.getElementById('jobby-btn-copy');
    expect(copyBtn).not.toBeNull();

    const closeBtn = shadow.getElementById('jobby-btn-close');
    expect(closeBtn).not.toBeNull();
  });

  it('falls back to execCommand when the Clipboard API rejects the copy', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'clipboard',
    );
    const execCommandDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'execCommand',
    );
    const writeText = vi.fn().mockRejectedValue(new Error('Not allowed'));
    let copiedText = '';

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => {
        copiedText = document.querySelector('textarea')?.value ?? '';
        return true;
      }),
    });

    try {
      await showInPageJobDescriptionModal({
        title: 'Engineer',
        description: 'Job description text',
      });

      const shadow = document.getElementById(
        'jobby-in-page-job-description-modal-root',
      )!.shadowRoot!;
      shadow.getElementById('jobby-btn-copy')!.click();
      await vi.waitFor(() => {
        expect(shadow.getElementById('jobby-copy-text')?.textContent).toBe(
          'Copied!',
        );
      });

      expect(writeText).toHaveBeenCalledWith('Job description text');
      expect(copiedText).toBe('Job description text');
      expect(document.querySelector('textarea')).toBeNull();
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
      } else {
        delete (navigator as unknown as Record<string, unknown>)['clipboard'];
      }
      if (execCommandDescriptor) {
        Object.defineProperty(document, 'execCommand', execCommandDescriptor);
      } else {
        delete (document as unknown as Record<string, unknown>)[
          'execCommand'
        ];
      }
    }
  });

  it('keeps a You will paragraph as body text before a bullet list', async () => {
    const paragraph =
      "You will work within Agile delivery teams to design, develop, test and maintain enterprise applications and cloud-native services. You'll contribute to the delivery of modern platforms, APIs, integrations and event-driven solutions while working in a secure, highly regulated environment. Responsibilities include:";

    await showInPageJobDescriptionModal({
      title: 'Full Stack Engineer',
      description: `${paragraph}\n• Designing and developing enterprise-grade software solutions`,
    });

    const shadow = document.getElementById(
      'jobby-in-page-job-description-modal-root',
    )!.shadowRoot!;
    const headings = Array.from(shadow.querySelectorAll('.jd-heading')).map(
      (element) => element.textContent,
    );

    expect(headings).not.toContain(paragraph);
    expect(shadow.querySelector('.jd-paragraph')?.textContent).toBe(paragraph);
    expect(shadow.querySelector('.jd-item-text')?.textContent).toBe(
      'Designing and developing enterprise-grade software solutions',
    );
  });

  it('does not treat a dash inside a paragraph as a bullet', async () => {
    const experience =
      "1 - 3+ years of commercial development experience is preferred, though we will consider less based on demonstrated capability.";
    const hiringProcess =
      "Our hiring process: There is a small coding test, completed offline in your own time. We expect you to use AI to generate the solution, because that's how we build here.";

    await showInPageJobDescriptionModal({
      title: 'Software Engineer',
      description: `Experience\n\n${experience}\n\n${hiringProcess}`,
    });

    const shadow = document.getElementById(
      'jobby-in-page-job-description-modal-root',
    )!.shadowRoot!;

    expect(shadow.querySelectorAll('.jd-list-item')).toHaveLength(0);
    expect(
      Array.from(shadow.querySelectorAll('.jd-heading')).map(
        (element) => element.textContent,
      ),
    ).toEqual(['Experience']);
    expect(
      Array.from(shadow.querySelectorAll('.jd-paragraph')).map(
        (element) => element.textContent,
      ),
    ).toEqual([experience, hiringProcess]);
  });

  it('closes the modal when closeInPageJobDescriptionModal is called', async () => {
    await showInPageJobDescriptionModal({
      title: 'Engineer',
      description: 'Job description text',
    });

    expect(
      document.getElementById('jobby-in-page-job-description-modal-root'),
    ).not.toBeNull();

    closeInPageJobDescriptionModal();

    expect(
      document.getElementById('jobby-in-page-job-description-modal-root'),
    ).toBeNull();
  });

  it('closes the modal when Escape key is pressed', async () => {
    await showInPageJobDescriptionModal({
      title: 'Engineer',
      description: 'Job description text',
    });

    expect(
      document.getElementById('jobby-in-page-job-description-modal-root'),
    ).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(
      document.getElementById('jobby-in-page-job-description-modal-root'),
    ).toBeNull();
  });

  it('formats raw ISO dates into friendly relative time in the header meta', async () => {
    // 16 days prior to fixed reference
    const now = new Date();
    const sixteenDaysAgo = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString();

    await showInPageJobDescriptionModal({
      title: 'Frontend Software Engineer',
      company: 'CORTO',
      location: 'Sydney, New South Wales, Australia',
      datePosted: sixteenDaysAgo,
      description: `
Why join CORTO?
• Your work matters.
• We solve real world problems that improve and support local law firms.
      `.trim(),
      platform: 'linkedin',
    });

    const root = document.getElementById('jobby-in-page-job-description-modal-root');
    expect(root).not.toBeNull();
    const shadow = root!.shadowRoot!;

    const metaEl = shadow.querySelector('.header-meta');
    expect(metaEl?.textContent).toContain('CORTO');
    expect(metaEl?.textContent).toContain('16 days ago');
    expect(metaEl?.textContent).not.toContain(sixteenDaysAgo);

    const headings = Array.from(shadow.querySelectorAll('.jd-heading')).map(
      (el) => el.textContent?.trim(),
    );
    expect(headings).toContain('Why join CORTO?');
  });
});
