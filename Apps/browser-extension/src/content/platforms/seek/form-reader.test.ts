// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { readSeekFormPage } from './form-reader';
import { filterSeekFormFields } from './definition';

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

describe('SEEK form recognition and filter exclusion', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/job/12345678');
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: visibleRect,
    });
  });

  it('does not misidentify search filters as application form on a job details page', () => {
    document.body.innerHTML = `
      <div id="search-bar">
        <label for="keywords">Keywords</label>
        <input id="keywords" value="Software Engineer" />
        <label for="classification">Classification</label>
        <input id="classification" value="Information & Communication Technology" />
        <label for="where">Where</label>
        <input id="where" value="Sydney NSW" />
        <button type="submit">SEEK</button>
      </div>
      <div id="search-refinements">
        <div role="checkbox" aria-label="Refine your search" aria-checked="false"></div>
        <div role="checkbox" aria-label="Strong applicant jobs" aria-checked="false"></div>
      </div>
      <main id="job-details">
        <h1>Senior Full Stack Engineer</h1>
        <a data-automation="job-detail-apply" href="/job/12345678/apply">Quick apply</a>
        <div class="job-description">
          <p>Please submit your resume and cover letter to apply for this role.</p>
        </div>
      </main>
    `;

    const inspection = readSeekFormPage();
    expect(inspection.kind).toBe('not_application_form');
    if (inspection.kind !== 'not_application_form') return;
    expect(inspection.reason).toContain('Click SEEK Quick apply');
  });

  it('recognizes application fields when the application modal is open and excludes background filters', () => {
    document.body.innerHTML = `
      <div id="search-refinements">
        <div role="checkbox" aria-label="Refine your search" aria-checked="false"></div>
        <div role="checkbox" aria-label="Strong applicant jobs" aria-checked="false"></div>
      </div>
      <div data-automation="apply-container" role="dialog" aria-modal="true">
        <h2>Apply for Senior Full Stack Engineer</h2>
        <label for="first-name">First name *</label>
        <input id="first-name" required value="John" />
        <label for="last-name">Last name *</label>
        <input id="last-name" required value="Doe" />
        <label for="resume-file">Resume *</label>
        <input id="resume-file" type="file" required />
        <button type="button" aria-label="Continue">Continue</button>
      </div>
    `;

    const inspection = readSeekFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields.map((f) => f.label)).toEqual([
      'First name',
      'Last name',
      'Resume',
    ]);
    expect(inspection.fields.some((f) => f.label.includes('Refine your search'))).toBe(false);
    expect(inspection.fields.some((f) => f.label.includes('Strong applicant'))).toBe(false);
  });

  it('filterSeekFormFields filters out search and refinement controls', () => {
    const fields = [
      { label: 'First name' },
      { label: 'Refine your search' },
      { label: 'Strong applicant jobs' },
      { label: 'Keywords' },
      { label: 'Resume' },
    ];
    const filtered = filterSeekFormFields(fields);
    expect(filtered.map((f) => f.label)).toEqual(['First name', 'Resume']);
  });
});
