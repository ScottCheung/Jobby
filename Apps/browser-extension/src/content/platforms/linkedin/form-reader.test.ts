// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { linkedinAdapter } from './adapter';
import { resolveLinkedInApplySurface } from './application-surface';
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

  it('recognizes SDUI resume cards with a button and no mounted file input', () => {
    document.body.innerHTML = `
      <dialog open data-testid="dialog" aria-labelledby="dialog-header">
        <h2 id="dialog-header">Apply to Example</h2>
        <div data-testid="dialog-content">
          <p>Resume*</p>
          <p>Select or upload a resume in DOC, DOCX, or PDF format that is less than 2MB</p>
          <fieldset role="radiogroup" aria-describedby="error-message-r1">
            <div><div role="radio" tabindex="0" aria-label="Previous Resume.pdf" aria-checked="true"><input type="radio" checked /></div></div>
            <div><div role="radio" tabindex="0" aria-label="Other Resume.pdf" aria-checked="false"><input type="radio" /></div></div>
          </fieldset>
          <div><button type="button">Upload resume</button></div>
        </div>
        <button>Back</button><button>Next</button>
      </dialog>`;
    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields).toEqual([expect.objectContaining({
      key: 'linkedin-resume-upload', type: 'file', label: 'Resume', required: true,
      currentValue: 'Previous Resume.pdf', upload: { state: 'ready', filename: 'Previous Resume.pdf' },
    })]);
    expect(document.querySelector('[data-jobby-linkedin-resume-upload]')?.textContent).toBe('Upload resume');
    expect(resolveLinkedInApplySurface()?.fieldRoot).toBe(document.querySelector('dialog'));
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

  it('correctly scopes modern LinkedIn Easy Apply A/B test resume modal with radiogroup and excludes global page controls', () => {
    document.body.innerHTML = `
      <header>
        <input aria-label="Search" placeholder="Search" />
      </header>
      <main class="scaffold-layout__main">
        <input type="checkbox" aria-label="Software Engineer, Sydney, New South Wales, Australia" checked />
      </main>
      <footer>
        <select aria-label="Select language"><option>English (English)</option></select>
      </footer>
      <div id="artdeco-modal-outlet">
        <div role="dialog" aria-modal="true" class="artdeco-modal">
          <div class="artdeco-modal__header">
            <h2>Apply to TheDriveGroup</h2>
          </div>
          <div class="artdeco-modal__content">
            <h3>Resume*</h3>
            <p>Select or upload a resume in DOC, DOCX, or PDF format that is less than 2MB</p>
            <div role="radiogroup" aria-label="Resume">
              <div role="radio" aria-checked="true">
                <span>Scott Zhang - CV - IVEGA GROUP PTY LTD - Full Stack Engineer (AI).pdf</span>
                <span>9/2/2026</span>
              </div>
              <div role="radio" aria-checked="false">
                <span>Scott Zhang - CV - Ashford.pdf</span>
                <span>9/2/2026</span>
              </div>
            </div>
            <button type="button">Upload resume</button>
            <input type="file" id="resume-file" accept=".doc,.docx,.pdf" style="display: none;" />
          </div>
          <div class="artdeco-modal__action-bar">
            <button type="button" class="artdeco-button artdeco-button--primary">
              <span>Next</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;

    expect(inspection.fields).toHaveLength(1);
    expect(inspection.fields[0]?.label).toBe('Resume');
    expect(inspection.fields[0]?.type).toBe('file');
    expect(inspection.fields[0]?.filled).toBe(true);
    expect(inspection.fields[0]?.currentValue).toBe(
      'Scott Zhang - CV - IVEGA GROUP PTY LTD - Full Stack Engineer (AI).pdf',
    );
    expect(inspection.fields[0]?.options).toHaveLength(2);
    expect(inspection.fields[0]?.options?.[0]?.label).toBe(
      'Scott Zhang - CV - IVEGA GROUP PTY LTD - Full Stack Engineer (AI).pdf',
    );
    expect(inspection.fields[0]?.options?.[1]?.label).toBe(
      'Scott Zhang - CV - Ashford.pdf',
    );
    expect(inspection.fields.some((field) => field.label === 'Search')).toBe(false);
    expect(
      inspection.fields.some((field) => field.label.includes('Software Engineer')),
    ).toBe(false);
    expect(
      inspection.fields.some((field) => field.label.includes('Select language')),
    ).toBe(false);
  });

  it('scopes a form-less modern modal to the current step instead of its wider shell', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" aria-label="Apply to Northstar">
        <div class="application-shell">
          <div class="application-step step-2" aria-current="step">
            <h3>Additional questions</h3>
            <label for="work-rights">Are you legally authorised to work here? *</label>
            <input id="work-rights" name="work_rights" />
            <label for="notice-period">Notice period *</label>
            <input id="notice-period" name="notice_period" />
          </div>
          <div class="search-filters">
            <input aria-label="Search jobs" />
            <div role="checkbox" aria-label="Date posted" aria-checked="false"></div>
          </div>
        </div>
        <button type="button" aria-label="Next">Next</button>
      </div>
    `;

    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields.map((field) => field.label)).toEqual([
      'Are you legally authorised to work here?',
      'Notice period',
    ]);
  });

  it('ignores a hidden previous step when LinkedIn remounts the active step', () => {
    document.body.innerHTML = `
      <div class="jobs-easy-apply-modal" role="dialog" aria-modal="true">
        <h2>Apply to Northstar</h2>
        <div class="application-step step-1" aria-hidden="true" hidden>
          <label for="old-question">Old question</label>
          <input id="old-question" name="old_question" />
        </div>
        <div class="application-step step-2" aria-current="step">
          <label for="new-question">New question</label>
          <input id="new-question" name="new_question" />
          <button type="button">Next</button>
        </div>
      </div>
    `;

    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields.map((field) => field.label)).toEqual(['New question']);
  });

  it('prefers Easy Apply when a job-alert modal is also mounted', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" aria-label="Set job alert for Northstar">
        <h2>Set job alert for Northstar</h2>
        <input type="checkbox" aria-label="Email notification" />
        <button type="button">Save</button>
      </div>
      <div class="artdeco-modal" role="dialog" aria-modal="true">
        <h2>Apply to Northstar</h2>
        <label for="application-question">Application question</label>
        <input id="application-question" name="application_question" />
        <button type="button">Next</button>
      </div>
    `;

    const surface = resolveLinkedInApplySurface();
    expect(surface?.state).toBe('artdeco-modal');
    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields.map((field) => field.label)).toEqual([
      'Application question',
    ]);
  });

  it('identifies an open native dialog as a top-layer application surface', () => {
    document.body.innerHTML = `
      <dialog open aria-modal="true">
        <h2>Apply to Northstar</h2>
        <label for="native-question">Native dialog question</label>
        <input id="native-question" name="native_question" />
        <button type="button">Submit application</button>
      </dialog>
    `;

    const surface = resolveLinkedInApplySurface();
    expect(surface?.state).toBe('native-dialog');
    expect(surface?.topLayer).toBe(true);
    expect(surface?.fieldRoot).toBeInstanceOf(HTMLElement);
  });

  it('supports a full-page Easy Apply flow without falling back to the whole document', () => {
    window.history.replaceState({}, '', '/jobs/view/123/apply');
    document.body.innerHTML = `
      <main data-testid="application-page">
        <header><input aria-label="Search jobs" /></header>
        <section class="application-step" aria-current="step">
          <h1>Application questions</h1>
          <label for="full-page-question">Full-page question</label>
          <input id="full-page-question" name="full_page_question" />
        </section>
        <button type="button">Continue</button>
      </main>
    `;

    const surface = resolveLinkedInApplySurface();
    expect(surface?.state).toBe('full-page');
    const inspection = readLinkedInFormPage();
    expect(inspection.kind).toBe('application_form');
    if (inspection.kind !== 'application_form') return;
    expect(inspection.fields.map((field) => field.label)).toEqual([
      'Full-page question',
    ]);
  });
});
