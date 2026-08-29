/** @format */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
