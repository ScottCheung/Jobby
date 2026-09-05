// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { linkedinAdapter } from './adapter';
import { readLinkedInFormPage } from './form-reader';

function visibleRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 480,
    height: 48,
    top: 0,
    right: 480,
    bottom: 48,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('LinkedIn Easy Apply form scope', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/jobs/search/?currentJobId=123');
    linkedinAdapter.invalidateApplicationRootCache();
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: visibleRect,
    });
  });

  it('replaces a stale page-level root with the current Apply modal', () => {
    const page = document.createElement('main');
    page.className = 'jobs-easy-apply-content';
    page.setAttribute('data-test-modal-container', '');
    page.setAttribute('aria-label', 'Easy Apply jobs search');
    page.innerHTML = `
      <label for="job-search">Describe the job you want</label>
      <input id="job-search" value="" />
      <div role="checkbox" aria-label="Date posted" aria-checked="false"></div>
      <div role="checkbox" aria-label="Easy Apply" aria-checked="false"></div>
      <button type="button">Next</button>
    `;
    document.body.append(page);

    // Reproduce the stale cache created while only the search page exists.
    expect(linkedinAdapter.getApplicationRoot()).toBe(page);

    const modal = document.createElement('section');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <h2>Apply to Morgan McKinley</h2>
      <label for="email">Email address *</label>
      <input id="email" type="email" required value="candidate@example.com" />
      <label for="phone-country">Phone country code *</label>
      <select id="phone-country" required>
        <option value="AU" selected>Australia (+61)</option>
      </select>
      <label for="phone">Mobile phone number *</label>
      <input id="phone" type="tel" required value="434344292" />
      <button type="button" aria-label="Next">Next</button>
    `;
    page.append(modal);

    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields.map((field) => field.label)).toEqual([
      'Email address',
      'Phone country',
      'Mobile phone number',
    ]);
    expect(inspection.fields.some((field) => field.label === 'Date posted')).toBe(false);
    expect(inspection.fields.some((field) => field.label === 'Easy Apply')).toBe(false);
  });

  it('only reads controls in the Easy Apply form', () => {
    document.body.innerHTML = `
      <section role="dialog" aria-modal="true" class="jobs-easy-apply-modal">
        <h2>Apply to Cloud Raptor</h2>
        <form class="jobs-easy-apply-form">
          <label for="email">Email address *</label>
          <input id="email" type="email" required value="candidate@example.com" />
          <label for="phone">Mobile phone number *</label>
          <input id="phone" type="tel" required value="434344292" />
        </form>
        <input aria-label="Search" placeholder="Search" />
        <div role="checkbox" aria-label="Software Engineer, Sydney, New South Wales, Australia" aria-checked="true"></div>
        <button type="button" aria-label="Next">Next</button>
      </section>
    `;

    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields.map((field) => field.label)).toEqual([
      'Email address',
      'Mobile phone number',
    ]);
  });

  it('does not misidentify "Set job alert for Full Stack Developer in Sydney" as an application form when Easy Apply is not open', () => {
    document.body.innerHTML = `
      <div class="jobs-search-box">
        <input aria-label="Search by title, skill, or company" value="Full Stack Developer" />
        <input aria-label="City, state, or zip code" value="Sydney" />
      </div>
      <div class="jobs-search-create-alert">
        <label for="alert-toggle">Set job alert for Full Stack Developer in Sydney</label>
        <input type="checkbox" id="alert-toggle" role="switch" aria-label="Set job alert for Full Stack Developer in Sydney" />
      </div>
      <main class="jobs-search__job-details">
        <h1>Full Stack Developer</h1>
        <div class="jobs-apply-button--top-card">
          <button type="button" class="jobs-apply-button" aria-label="Easy Apply to Full Stack Developer">Easy Apply</button>
        </div>
        <div class="jobs-description">
          <p>We are looking for a Full Stack Developer. Please submit your application with resume and cover letter.</p>
        </div>
      </main>
    `;

    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('not_application_form');
    if (inspection.kind !== 'not_application_form') return;
    expect(inspection.reason).toContain('Click LinkedIn Easy Apply');
  });

  it('does not treat a job alert modal as an Easy Apply root', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" class="artdeco-modal" aria-label="Set job alert for Full Stack Developer in Sydney">
        <h2>Set job alert for Full Stack Developer in Sydney</h2>
        <label for="alert-email">Email notification</label>
        <input type="checkbox" id="alert-email" checked />
        <button type="button">Save</button>
      </div>
    `;

    expect(linkedinAdapter.getApplicationRoot()).toBeNull();
    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('not_application_form');
  });
});

