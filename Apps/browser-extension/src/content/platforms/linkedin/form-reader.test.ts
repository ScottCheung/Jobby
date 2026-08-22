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
});
