// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { readCurrentForm, readCurrentPage } from '../../page-reader';
import { uploadFormFile } from '../../dom/form-driver';
import { fileFieldPurpose } from '../../../shared/utils/form-field-resolution';
import { dayforceDefinition } from './definition';
import { dayforceDriverOverride } from './driver';

function base64Encode(text: string): string {
  return btoa(text);
}

describe('Dayforce platform', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('reads Dayforce job details page with company, clean id, date, and description', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('https://jobs.dayforcehcm.com/en-AU/picagroup/CANDIDATEPORTAL/jobs/3458'),
    });

    document.body.innerHTML = `
      <header test-id="navigation-bar">
        <a test-id="header-logo" href="/"><img test-id="header-logo" alt="PICA Group logo" src="/logo.png" /></a>
      </header>
      <main>
        <div test-id="job-details-dayforce-jobs">
          <div>
            <h1 test-id="job-detail-title">Junior Full Stack Developer</h1>
            <div test-id="job-detail-job-req-id">Job req ID: 3458</div>
            <div test-id="job-detail-location-list">
              <span test-id="job-detail-location-name">Sydney, New South Wales, Australia</span>
            </div>
            <div test-id="job-detail-posted-date">Monday, 1 September 2026, 10:30 AM</div>
            <div test-id="job-detail-header"><p>Welcome to PICA Group, a leading property services organization across Australia.</p></div>
            <div test-id="job-detail-body"><p>We are looking for a Junior Full Stack Developer to build amazing applications using React and Node.js.</p></div>
            <div test-id="job-detail-footer"><p>PICA Group is proud to be an Equal Opportunity Employer dedicated to workforce diversity.</p></div>
            <button test-id="apply-button">Apply</button>
          </div>
        </div>
      </main>
    `;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe('job');
    if (inspection.kind === 'job') {
      expect(inspection.snapshot.platform).toBe('dayforce');
      expect(inspection.snapshot.title).toBe('Junior Full Stack Developer');
      expect(inspection.snapshot.company).toBe('PICA Group');
      expect(inspection.snapshot.externalId).toBe('3458');
      expect(inspection.snapshot.location).toContain('Sydney');
      expect(inspection.snapshot.description).toContain('Junior Full Stack Developer');
      expect(inspection.snapshot.description).toContain('Welcome to PICA Group');
      expect(inspection.snapshot.description).toContain('Equal Opportunity Employer');
      expect(inspection.snapshot.postingDateRaw?.label).toBe('Monday, 1 September 2026, 10:30 AM');
    }
  });

  it('reads company from __NEXT_DATA__ dehydrated state when logo image is absent', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('https://jobs.dayforcehcm.com/en-AU/picagroup/CANDIDATEPORTAL/jobs/3458'),
    });

    const nextData = {
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              {
                queryKey: ['site-info'],
                state: {
                  data: {
                    candidateCorrespondenceClientName: 'PICA Group Corresp',
                  },
                },
              },
            ],
          },
        },
      },
    };

    document.body.innerHTML = `
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
      <main>
        <div test-id="job-details-dayforce-jobs">
          <h1 test-id="job-detail-title">Software Engineer</h1>
          <div test-id="job-detail-body"><p>Job description with enough text to exceed minimum length requirements for testing.</p></div>
          <button test-id="apply-button">Apply</button>
        </div>
      </main>
    `;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe('job');
    if (inspection.kind === 'job') {
      expect(inspection.snapshot.company).toBe('PICA Group Corresp');
    }
  });

  it('reads Dayforce manual application form and identifies CV and CL file fields', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL(
        'https://jobs.dayforcehcm.com/en-AU/picagroup/CANDIDATEPORTAL/jobs/3458/apply/manualApplication?applicationSource=seek&seek-prefill-id=abc&seek-token=xyz',
      ),
    });

    document.body.innerHTML = `
      <main>
        <div test-id="manual-application-dayforce-jobs">
          <div class="ant-form ant-form-vertical" name="jobPostingApplication">
            <div class="mt-5" test-id="application-step-candidateinfo">
              <div test-id="personal-information">
                <label for="personalInfo_firstName">First name *</label>
                <input id="personalInfo_firstName" />
                <label for="personalInfo_lastName">Last name *</label>
                <input id="personalInfo_lastName" />
                <label for="personalInfo_email">Email address *</label>
                <input id="personalInfo_email" />
                <label for="personalInfo_countryCode">Country *</label>
                <div class="ant-select">
                  <input id="personalInfo_countryCode" role="combobox" aria-controls="country_list" />
                </div>
              </div>

              <section test-id="resume-upload-section">
                <h2 test-id="resume-upload-title">Resume</h2>
                <div class="max-w-sm">
                  <div class="ant-form-item">
                    <div class="ant-form-item-label">
                      <label title="Attachment:">Attachment:</label>
                    </div>
                    <div class="ant-form-item-control">
                      <div class="ant-form-item-control-input">
                        <span class="ant-upload ant-upload-select">
                          <span tabindex="0" class="ant-upload" role="button">
                            <input type="file" accept="doc,docx,pdf,rtf" style="display: none;" />
                            <button type="button" test-id="resume-upload-button">Upload</button>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section test-id="cover-letter-upload-section">
                <h2 test-id="cover-letter-upload-title">Cover letter</h2>
                <div class="max-w-xs">
                  <div class="ant-form-item">
                    <div class="ant-form-item-control">
                      <div class="ant-form-item-control-input">
                        <span class="ant-upload ant-upload-select">
                          <span tabindex="0" class="ant-upload" role="button">
                            <input type="file" accept="doc,docx,pdf,rtf" style="display: none;" />
                            <button type="button" test-id="cover-letter-upload-button">Upload</button>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <button test-id="application-next-step">Next</button>
            </div>
          </div>
        </div>
      </main>
    `;

    const form = readCurrentForm();
    expect(form.kind).toBe('application_form');
    if (form.kind === 'application_form') {
      expect(form.platform).toBe('dayforce');
      const fileFields = form.fields.filter((f) => f.type === 'file');
      expect(fileFields.length).toBe(2);

      const resumeField = fileFields.find((f) => fileFieldPurpose(f) === 'resume');
      const clField = fileFields.find((f) => fileFieldPurpose(f) === 'cover_letter');

      expect(resumeField).toBeDefined();
      expect(resumeField?.label).toBe('Resume');
      expect(resumeField?.semanticFeatures).toContain('resume');

      expect(clField).toBeDefined();
      expect(clField?.label).toBe('Cover Letter');
      expect(clField?.semanticFeatures).toContain('cover_letter');

      const countryField = form.fields.find((f) => f.id === 'personalInfo_countryCode');
      expect(countryField).toBeDefined();
      expect(countryField?.label).toBe('Country');
    }
  });

  it('successfully uploads PDF resume and cover letter on Dayforce with accept="doc,docx,pdf,rtf"', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL(
        'https://jobs.dayforcehcm.com/en-AU/picagroup/CANDIDATEPORTAL/jobs/3458/apply/manualApplication',
      ),
    });

    document.body.innerHTML = `
      <div test-id="manual-application-dayforce-jobs">
        <section test-id="resume-upload-section">
          <h2 test-id="resume-upload-title">Resume</h2>
          <span class="ant-upload" role="button">
            <input type="file" accept="doc,docx,pdf,rtf" style="display: none;" />
            <button type="button" test-id="resume-upload-button">Upload</button>
          </span>
        </section>
        <section test-id="cover-letter-upload-section">
          <h2 test-id="cover-letter-upload-title">Cover letter</h2>
          <span class="ant-upload" role="button">
            <input type="file" accept="doc,docx,pdf,rtf" style="display: none;" />
            <button type="button" test-id="cover-letter-upload-button">Upload</button>
          </span>
        </section>
      </div>
    `;

    const form = readCurrentForm();
    expect(form.kind).toBe('application_form');
    if (form.kind !== 'application_form') return;

    const resumeField = form.fields.find((f) => fileFieldPurpose(f) === 'resume');
    expect(resumeField).toBeDefined();

    const clField = form.fields.find((f) => fileFieldPurpose(f) === 'cover_letter');
    expect(clField).toBeDefined();

    const dummyPdfBase64 = base64Encode('%PDF-1.4 dummy pdf content');

    // Upload resume
    const resumeRes = await uploadFormFile(
      {
        commandId: 'cmd-resume-1',
        target: {
          key: resumeField!.key,
          id: resumeField!.id,
          label: resumeField!.label,
          type: 'file',
        },
        filename: 'My-Resume.pdf',
        mimeType: 'application/pdf',
        contentBase64: dummyPdfBase64,
      },
      document,
    );
    expect(resumeRes.status).toBe('filled');

    // Upload cover letter
    const clRes = await uploadFormFile(
      {
        commandId: 'cmd-cl-1',
        target: {
          key: clField!.key,
          id: clField!.id,
          label: clField!.label,
          type: 'file',
        },
        filename: 'My-Cover-Letter.pdf',
        mimeType: 'application/pdf',
        contentBase64: dummyPdfBase64,
      },
      document,
    );
    expect(clRes.status).toBe('filled');
  });

  it('accurately detects filled state and uploaded filenames for Resume and Cover Letter when Ant Design upload list items are present', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL(
        'https://jobs.dayforcehcm.com/en-AU/picagroup/CANDIDATEPORTAL/jobs/3458/apply/manualApplication',
      ),
    });

    document.body.innerHTML = `
      <div test-id="manual-application-dayforce-jobs">
        <section test-id="resume-upload-section">
          <h2 test-id="resume-upload-title">Resume</h2>
          <div class="ant-form-item">
            <span class="ant-upload">
              <input type="file" accept="doc,docx,pdf,rtf" style="display: none;" />
              <button type="button" test-id="resume-upload-button">Upload</button>
            </span>
            <div class="ant-upload-list">
              <div test-id="upload-file-item-test" class="w-44">
                <div class="ant-upload-list-item">
                  <span class="ant-upload-list-item-name" title="Alex_Candidate_Resume.pdf">Alex_Candidate_Resume.pdf</span>
                  <button type="button" test-id="resume-upload-delete-icon-button" aria-label="Delete">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section test-id="cover-letter-upload-section">
          <h2 test-id="cover-letter-upload-title">Cover letter</h2>
          <div class="ant-form-item">
            <span class="ant-upload">
              <input type="file" accept="doc,docx,pdf,rtf" style="display: none;" />
              <button type="button" test-id="cover-letter-upload-button">Upload</button>
            </span>
            <!-- No file uploaded for cover letter yet -->
          </div>
        </section>
      </div>
    `;

    const form = readCurrentForm();
    expect(form.kind).toBe('application_form');
    if (form.kind !== 'application_form') return;

    const resumeField = form.fields.find((f) => fileFieldPurpose(f) === 'resume');
    expect(resumeField).toBeDefined();
    expect(resumeField?.filled).toBe(true);
    expect(resumeField?.upload?.state).toBe('ready');
    expect(resumeField?.upload?.filename).toBe('Alex_Candidate_Resume.pdf');
    expect(resumeField?.currentValue).toBe('Alex_Candidate_Resume.pdf');

    const clField = form.fields.find((f) => fileFieldPurpose(f) === 'cover_letter');
    expect(clField).toBeDefined();
    expect(clField?.filled).toBe(false);
    expect(clField?.upload?.state).toBe('empty');
    expect(clField?.currentValue).toBeUndefined();
  });

  it('accurately detects filled state and values for Ant Design Select fields and distinguishes from placeholders', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL(
        'https://jobs.dayforcehcm.com/en-AU/picagroup/CANDIDATEPORTAL/jobs/3458/apply/manualApplication',
      ),
    });

    document.body.innerHTML = `
      <div test-id="manual-application-dayforce-jobs">
        <!-- Selected country: Australia -->
        <div test-id="country-selector">
          <label for="personalInfo_countryCode">Country</label>
          <div class="ant-select ant-select-single ant-select-show-arrow">
            <div class="ant-select-selector">
              <span class="ant-select-selection-search">
                <input id="personalInfo_countryCode" role="combobox" class="ant-select-selection-search-input" value="" />
              </span>
              <span class="ant-select-selection-item" title="Australia">Australia</span>
            </div>
          </div>
        </div>

        <!-- Unselected state/province with placeholder -->
        <div test-id="state-province-selector">
          <label for="personalInfo_stateCode">State/Province</label>
          <div class="ant-select ant-select-single ant-select-show-arrow">
            <div class="ant-select-selector">
              <span class="ant-select-selection-search">
                <input id="personalInfo_stateCode" role="combobox" class="ant-select-selection-search-input" value="" />
              </span>
              <span class="ant-select-selection-placeholder">Select a state or province</span>
            </div>
          </div>
        </div>

        <!-- Selected preferred contact method -->
        <div>
          <label for="personalInfo_preferredContactMethod">Preferred contact method</label>
          <div class="ant-select ant-select-single ant-select-show-arrow">
            <div class="ant-select-selector">
              <span class="ant-select-selection-search">
                <input id="personalInfo_preferredContactMethod" role="combobox" class="ant-select-selection-search-input" value="" />
              </span>
              <span class="ant-select-selection-item" title="Mobile">Mobile</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const form = readCurrentForm();
    expect(form.kind).toBe('application_form');
    if (form.kind !== 'application_form') return;

    const countryField = form.fields.find((f) => f.id === 'personalInfo_countryCode');
    expect(countryField).toBeDefined();
    expect(countryField?.label).toBe('Country');
    expect(countryField?.filled).toBe(true);
    expect(countryField?.currentValue).toBe('Australia');

    const stateField = form.fields.find((f) => f.id === 'personalInfo_stateCode');
    expect(stateField).toBeDefined();
    expect(stateField?.label).toBe('State/Province');
    expect(stateField?.filled).toBe(false);
    expect(stateField?.currentValue).toBeUndefined();

    const contactField = form.fields.find((f) => f.id === 'personalInfo_preferredContactMethod');
    expect(contactField).toBeDefined();
    expect(contactField?.label).toBe('Preferred contact method');
    expect(contactField?.filled).toBe(true);
    expect(contactField?.currentValue).toBe('Mobile');
  });

  it('accurately detects filled state for text, confirm fields, checkbox, and radio groups', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL(
        'https://jobs.dayforcehcm.com/en-AU/picagroup/CANDIDATEPORTAL/jobs/3458/apply/manualApplication',
      ),
    });

    document.body.innerHTML = `
      <div test-id="manual-application-dayforce-jobs">
        <label for="jobPostingApplication_personalInfo_firstName">First name</label>
        <input id="jobPostingApplication_personalInfo_firstName" value="Jane" />

        <label for="jobPostingApplication_personalInfo_email">Email address</label>
        <input id="jobPostingApplication_personalInfo_email" value="jane@example.com" />

        <label for="jobPostingApplication_personalInfo_confirmEmail">Confirm email address</label>
        <input id="jobPostingApplication_personalInfo_confirmEmail" value="jane@example.com" />

        <label for="jobPostingApplication_personalInfo_mobilePhone">Mobile phone</label>
        <input id="jobPostingApplication_personalInfo_mobilePhone" value="" />

        <label for="jobPostingApplication_personalInfo_isApplyingWithPhoneNumber">Apply with phone number</label>
        <input id="jobPostingApplication_personalInfo_isApplyingWithPhoneNumber" type="checkbox" checked />

        <fieldset>
          <legend>Hide profile</legend>
          <label><input type="radio" name="hideExternalCandidateProfile" value="false" checked /> No</label>
          <label><input type="radio" name="hideExternalCandidateProfile" value="true" /> Yes</label>
        </fieldset>
      </div>
    `;

    const form = readCurrentForm();
    expect(form.kind).toBe('application_form');
    if (form.kind !== 'application_form') return;

    const firstName = form.fields.find((f) => f.id === 'jobPostingApplication_personalInfo_firstName');
    expect(firstName?.label).toBe('First name');
    expect(firstName?.filled).toBe(true);
    expect(firstName?.currentValue).toBe('Jane');

    const email = form.fields.find((f) => f.id === 'jobPostingApplication_personalInfo_email');
    expect(email?.label).toBe('Email address');
    expect(email?.filled).toBe(true);
    expect(email?.currentValue).toBe('jane@example.com');
    expect(email?.semanticFeatures).toContain('email');

    const confirmEmail = form.fields.find((f) => f.id === 'jobPostingApplication_personalInfo_confirmEmail');
    expect(confirmEmail?.label).toBe('Confirm email address');
    expect(confirmEmail?.filled).toBe(true);
    expect(confirmEmail?.currentValue).toBe('jane@example.com');
    expect(confirmEmail?.semanticFeatures).toContain('confirm_email');

    const mobile = form.fields.find((f) => f.id === 'jobPostingApplication_personalInfo_mobilePhone');
    expect(mobile?.filled).toBe(false);
    expect(mobile?.currentValue).toBeUndefined();

    const phoneCheckbox = form.fields.find((f) => f.id === 'jobPostingApplication_personalInfo_isApplyingWithPhoneNumber');
    expect(phoneCheckbox?.filled).toBe(true);
    expect(phoneCheckbox?.currentValue).toBe('true');

    const hideProfile = form.fields.find((f) => f.name === 'hideExternalCandidateProfile');
    expect(hideProfile?.filled).toBe(true);
  });

  it('dayforceDriverOverride commits and fills Ant Design Select fields', async () => {
    document.body.innerHTML = `
      <div class="ant-form" name="jobPostingApplication">
        <div class="ant-select ant-select-single ant-select-show-arrow" id="select-wrap">
          <div class="ant-select-selector">
            <span class="ant-select-selection-search">
              <input id="personalInfo_countryCode" role="combobox" class="ant-select-selection-search-input" aria-controls="country_list" value="" />
            </span>
            <span class="ant-select-selection-placeholder">Select a country</span>
          </div>
        </div>
      </div>
      <div id="country_list" role="listbox">
        <div role="option" class="ant-select-item ant-select-item-option" data-value="AU" title="Australia">
          <div class="ant-select-item-option-content">Australia</div>
        </div>
        <div role="option" class="ant-select-item ant-select-item-option" data-value="US" title="United States">
          <div class="ant-select-item-option-content">United States</div>
        </div>
      </div>
    `;

    const input = document.getElementById('personalInfo_countryCode') as HTMLInputElement;

    // Check isComboboxCommitted before selection
    expect(dayforceDriverOverride.isComboboxCommitted?.(input, document)).toBe(false);

    // Fill field
    const fillResult = await dayforceDriverOverride.fillField?.(
      {
        commandId: 'cmd-select-country',
        target: {
          key: 'personalInfo_countryCode',
          id: 'personalInfo_countryCode',
          label: 'Country',
          type: 'select',
        },
        value: 'Australia',
      },
      document,
    );

    expect(fillResult?.status).toBe('filled');

    // Simulate Ant Design updating selection item
    const selector = document.querySelector('.ant-select-selector');
    const placeholder = document.querySelector('.ant-select-selection-placeholder');
    placeholder?.remove();
    const selectionItem = document.createElement('span');
    selectionItem.className = 'ant-select-selection-item';
    selectionItem.title = 'Australia';
    selectionItem.textContent = 'Australia';
    selector?.appendChild(selectionItem);

    // Verify committed
    expect(dayforceDriverOverride.isComboboxCommitted?.(input, document)).toBe(true);

    // Fill again with same value -> already_filled
    const alreadyResult = await dayforceDriverOverride.fillField?.(
      {
        commandId: 'cmd-select-country-again',
        target: {
          key: 'personalInfo_countryCode',
          id: 'personalInfo_countryCode',
          label: 'Country',
          type: 'select',
        },
        value: 'Australia',
      },
      document,
    );
    expect(alreadyResult?.status).toBe('already_filled');
  });

  it('declares sequential autofill policy with settle delay', () => {
    expect(dayforceDefinition.autofill).toBeDefined();
    expect(dayforceDefinition.autofill?.mode).toBe('sequential');
    expect(dayforceDefinition.autofill?.refreshAfterFieldMs).toBe(150);
    expect(dayforceDefinition.autofill?.settleBetweenFieldsMs).toBe(100);
  });
});

