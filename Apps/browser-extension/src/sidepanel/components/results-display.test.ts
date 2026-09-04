import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { FormFieldObservation } from '../../shared/contracts/form-inspection';

vi.mock('@jobby/ui/components/UI/tooltip', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    Tooltip: ({
      children,
      content,
    }: {
      children: ReactNode;
      content: ReactNode;
    }) => createElement(Fragment, null, children, content),
  };
});
import {
  displayValue,
  fileFieldPurpose,
  ExpandableAnswer,
  sortRecentTailoredResumes,
} from './ResultsDisplay';

function fileField(
  overrides: Partial<FormFieldObservation>,
): FormFieldObservation {
  return {
    key: 'file-input',
    type: 'file',
    label: 'Choose a file or drop it here',
    required: false,
    filled: false,
    sensitive: false,
    options: [],
    ...overrides,
  };
}

describe('file field purpose detection', () => {
  it('recognizes a generic SmartRecruiters label from its semantic key', () => {
    expect(
      fileFieldPurpose(fileField({ key: 'file-resume-upload', required: true })),
    ).toBe('resume');
  });

  it('uses name and semantic features when the visible label is generic', () => {
    expect(
      fileFieldPurpose(
        fileField({ name: 'candidate_cv', semanticFeatures: ['document'] }),
      ),
    ).toBe('resume');
  });

  it('does not confuse profile images or cover letters with resumes', () => {
    expect(
      fileFieldPurpose(fileField({ label: 'Upload profile image' })),
    ).toBe('profile_image');
    expect(
      fileFieldPurpose(fileField({ key: 'cover-letter-upload' })),
    ).toBe('cover_letter');
    expect(
      fileFieldPurpose(fileField({ label: 'Cover note' })),
    ).toBe('cover_letter');
    expect(
      fileFieldPurpose(fileField({ label: 'Upload your resume' })),
    ).toBe('resume');
    expect(
      fileFieldPurpose(fileField({ label: 'Attach Resume' })),
    ).toBe('resume');
  });

  it('uses a cover letter for generic additional-file uploads', () => {
    expect(
      fileFieldPurpose(fileField({ label: 'Additional files' })),
    ).toBe('cover_letter');
  });
});

describe('recent tailored resume ordering', () => {
  const resume = (id: string, createdAt: string, jobTitle: string, company: string) =>
    ({
      id,
      job_application_id: '',
      job_title: jobTitle,
      company,
      job_description: '',
      resume_data: {},
      created_at: createdAt,
      updated_at: createdAt,
    }) as any;

  it('places the current job resume first and the default resume second', () => {
    const ordered = sortRecentTailoredResumes(
      [
        resume('newest-other', '2026-01-03T00:00:00.000Z', 'Designer', 'Beta'),
        resume('default', '2026-01-01T00:00:00.000Z', 'Developer', 'Gamma'),
        resume('current-older', '2026-01-02T00:00:00.000Z', 'Software Engineer', 'Acme'),
        resume('current-newer', '2026-01-04T00:00:00.000Z', 'Software Engineer', 'Acme'),
      ],
      { title: 'Software Engineer', company: 'Acme' },
      'default',
    );

    expect(ordered.map((item) => item.id)).toEqual([
      'current-newer',
      'default',
      'newest-other',
      'current-older',
    ]);
  });

  it('places the default resume first when the current job has no generated resume', () => {
    const ordered = sortRecentTailoredResumes(
      [
        resume('newest-other', '2026-01-03T00:00:00.000Z', 'Designer', 'Beta'),
        resume('default', '2026-01-01T00:00:00.000Z', 'Developer', 'Gamma'),
        resume('older-other', '2026-01-02T00:00:00.000Z', 'Analyst', 'Delta'),
      ],
      { title: 'Software Engineer', company: 'Acme' },
      'default',
    );

    expect(ordered.map((item) => item.id)).toEqual([
      'default',
      'newest-other',
      'older-other',
    ]);
  });
});

describe('ExpandableAnswer component', () => {
  it('exports ExpandableAnswer component correctly', () => {
    expect(ExpandableAnswer).toBeDefined();
  });
});

describe('password field display', () => {
  it('confirms a filled password without exposing its value', () => {
    expect(displayValue({
      ...fileField({}),
      key: 'password',
      type: 'password',
      label: 'Password',
      filled: true,
      sensitive: true,
    })).toBe('Filled securely');
  });
});

describe('ResultsDisplay file upload actions', () => {
  it('renders upload action button for document fields', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { ResultsDisplay } = await import('./ResultsDisplay');

    const html = renderToStaticMarkup(
      createElement(ResultsDisplay, {
        latestForm: {
          kind: 'application_form',
          platform: 'seek',
          url: 'https://seek.com.au',
          fields: [fileField({ key: 'resume_upload', label: 'Resume' })],
        },
        isInspectingForm: false,
        onFocusField: async () => {},
        onFillSingleField: async () => {},
        onUploadTailoredResume: async () => {},
        onEditField: async () => {},
        uploadStates: {},
        tailoredResumes: [],
        isAutofilling: false,
        onTailor: () => {},
        existingDocuments: {
          resume: false,
          cover_letter: false,
        },
      }),
    );

    expect(html).toContain('Upload selected Resume');
  });

  it('renders Recent Tailor preview without idle debug diagnostics', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { ResultsDisplay } = await import('./ResultsDisplay');

    const html = renderToStaticMarkup(
      createElement(ResultsDisplay, {
        latestForm: {
          kind: 'application_form',
          platform: 'seek',
          url: 'https://seek.com.au',
          fields: [fileField({ key: 'resume_upload', label: 'Resume' })],
        },
        isInspectingForm: false,
        onFocusField: async () => {},
        onFillSingleField: async () => {},
        onUploadTailoredResume: async () => {},
        onEditField: async () => {},
        uploadStates: {},
        tailoredResumes: [
          {
            id: 'res-1',
            job_title: 'Full Stack Engineer',
            company: 'Tech Corp',
            created_at: new Date().toISOString(),
            resume_data: {} as any,
          } as any,
        ],
        isAutofilling: false,
        onTailor: () => {},
        existingDocuments: {
          resume: false,
          cover_letter: false,
        },
      }),
    );

    expect(html).toContain('Recent Tailor (1)');
    expect(html).not.toContain('Idle: File not detected yet');
    expect(html).not.toContain('Upload diagnostic');
    expect(html).not.toContain('Confirmed:');
  });

  it('renders Upload default one button and keeps UI clean without bulky warning banner', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { ResultsDisplay } = await import('./ResultsDisplay');

    const html = renderToStaticMarkup(
      createElement(ResultsDisplay, {
        latestForm: {
          kind: 'application_form',
          platform: 'seek',
          url: 'https://seek.com.au',
          fields: [fileField({ key: 'resume_upload', label: 'Resume' })],
        },
        isInspectingForm: false,
        onFocusField: async () => {},
        onFillSingleField: async () => {},
        onUploadTailoredResume: async () => {},
        onEditField: async () => {},
        uploadStates: {},
        tailoredResumes: [
          {
            id: 'res-1',
            job_title: 'Backend Developer',
            company: 'Acme Corp',
            created_at: new Date().toISOString(),
            resume_data: {} as any,
          } as any,
        ],
        isAutofilling: false,
        onTailor: () => {},
        existingDocuments: {
          resume: false,
          cover_letter: false,
        },
        currentJob: {
          title: 'Frontend Engineer',
          company: 'Google',
        },
      }),
    );

    expect(html).toContain('Upload default one');
    expect(html).not.toContain('Warning: You are using resume for');
  });

  it('shows the uploaded badge and source tooltip for the actual cover letter', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { ResultsDisplay } = await import('./ResultsDisplay');

    const html = renderToStaticMarkup(
      createElement(ResultsDisplay, {
        latestForm: {
          kind: 'application_form',
          platform: 'seek',
          url: 'https://seek.com.au/job/93941097/apply',
          fields: [
            fileField({
              key: 'cover_letter_upload',
              label: 'Cover letter',
              filled: true,
              upload: {
                state: 'ready',
                filename: 'Scott-Cover-Letter.pdf',
              },
            }),
          ],
        },
        isInspectingForm: false,
        onFocusField: async () => {},
        onFillSingleField: async () => {},
        onUploadTailoredResume: async () => {},
        onEditField: async () => {},
        uploadStates: {
          cover_letter_upload: {
            phase: 'confirmed',
            message: 'Confirmed: Scott-Cover-Letter.pdf',
            updatedAt: Date.now(),
            sourceDocumentId: 'cl-1',
            sourceLabel: 'Acme · Backend Engineer',
          },
        },
        tailoredResumes: [
          {
            id: 'cl-1',
            job_title: 'Backend Engineer',
            company: 'Acme',
            cover_letter: 'Dear Hiring Manager',
            raw_ai_response: {
              generated_documents: { cover_letter: true },
            },
            created_at: new Date().toISOString(),
            resume_data: {} as any,
          } as any,
        ],
        isAutofilling: false,
        existingDocuments: {
          resume: false,
          cover_letter: true,
        },
      }),
    );

    expect(html).toContain('Uploaded');
    expect(html).toContain('Acme');
    expect(html).toContain('Backend Engineer');
    expect(html).toContain('Your source cover letter as above remains unchanged.');
  });
});
