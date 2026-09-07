// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { readCurrentForm, readCurrentPage } from '../../page-reader';
import { uploadFormFile } from '../../dom/form-driver';
import { fileFieldPurpose } from '../../../shared/utils/form-field-resolution';

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
});
