import { describe, expect, it } from 'vitest';
import type { TailoredResume } from '../../shared/contracts/tailored-resume';
import {
  findTailoredDocumentForJob,
  resolveAutofillDocument,
  tailoredDocumentAvailability,
} from './tailored-document-state';

function tailoredResume(
  overrides: Partial<TailoredResume> = {},
): TailoredResume {
  return {
    id: 'resume-1',
    job_application_id: 'application-1',
    job_title: 'Backend Engineer',
    company: 'Acme',
    job_description: 'Build APIs',
    resume_data: {},
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  } as TailoredResume;
}

describe('tailored document state', () => {
  it('does not reuse a document from another job', () => {
    const saved = tailoredResume();

    expect(
      findTailoredDocumentForJob(
        [saved],
        'Software Engineer Backend',
        'The Digital BA',
      ),
    ).toBeNull();
  });

  it('does not treat a title-only match as the same job', () => {
    const saved = tailoredResume({
      job_title: 'Full Stack Engineer',
      company: 'Synechron',
    });

    expect(
      findTailoredDocumentForJob([saved], 'Full Stack Engineer', ''),
    ).toBeNull();
  });

  it('uses the last selection, then the matching job, default, and first available record', () => {
    const matching = tailoredResume({
      id: 'matching',
      resume_data: { basics: { name: 'Matching' } } as TailoredResume['resume_data'],
    });
    const defaultResume = tailoredResume({
      id: 'default',
      company: 'Default Company',
      resume_data: { basics: { name: 'Default' } } as TailoredResume['resume_data'],
    });
    const synechron = tailoredResume({
      id: 'synechron',
      company: 'Synechron',
      job_title: 'Full Stack Engineer',
      resume_data: { basics: { name: 'Other' } } as TailoredResume['resume_data'],
    });
    const resumes = [synechron, defaultResume, matching];

    expect(
      resolveAutofillDocument(resumes, 'synechron', matching, 'default', 'resume')?.id,
    ).toBe('synechron');
    expect(
      resolveAutofillDocument(resumes, '', matching, 'default', 'resume')?.id,
    ).toBe('matching');
    expect(
      resolveAutofillDocument(resumes, '', null, 'default', 'resume')?.id,
    ).toBe('default');
    expect(
      resolveAutofillDocument(resumes, '', null, '', 'resume')?.id,
    ).toBe('synechron');
  });

  it('resolves the default cover letter independently from the default CV', () => {
    const coverLetter = tailoredResume({
      id: 'default-cl',
      cover_letter: 'Default cover letter',
      raw_ai_response: {
        generated_documents: { cover_letter: true },
      },
    });
    const resumeOnly = tailoredResume({
      id: 'resume-only',
      resume_data: { basics: { name: 'CV' } } as TailoredResume['resume_data'],
      raw_ai_response: {
        generated_documents: { resume: true },
      },
    });

    expect(
      resolveAutofillDocument(
        [resumeOnly, coverLetter],
        '',
        null,
        'default-cl',
        'cover_letter',
      )?.id,
    ).toBe('default-cl');
  });

  it('uses generated document flags instead of empty or carried data', () => {
    const coverLetterOnly = tailoredResume({
      resume_data: {} as TailoredResume['resume_data'],
      cover_letter: 'Tailored letter',
      raw_ai_response: {
        generated_documents: { cover_letter: true },
      },
    });

    expect(tailoredDocumentAvailability(coverLetterOnly)).toEqual({
      resume: false,
      cover_letter: true,
    });
  });

  it('does not treat unmarked response content as a generated document', () => {
    const resumeOnly = tailoredResume({
      resume_data: { basics: { name: 'Scott' } } as TailoredResume['resume_data'],
      raw_ai_response: {
        cover_letter: 'Carried response text',
        generated_documents: { resume: true },
      },
    });

    expect(tailoredDocumentAvailability(resumeOnly)).toEqual({
      resume: true,
      cover_letter: false,
    });
  });

  it('renders cover letter PDF successfully', async () => {
    const { renderCoverLetterPdfOnce } = await import(
      '@jobby/ui/components/UI/Resume/cover-letter-pdf-document'
    );
    const result = await renderCoverLetterPdfOnce(
      'Dear Hiring Manager,\n\nTest cover letter.\n\nSincerely,\nScott',
    );
    expect(result.pages).toBe(1);
    expect(result.blob.size).toBeGreaterThan(1000);
  });
});
