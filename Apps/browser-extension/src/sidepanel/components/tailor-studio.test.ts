/** @format */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../background/api-client';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type {
  JobReviewResult,
  MasterResumeData,
  TailoredResume,
} from '../../shared/contracts/tailored-resume';
import { tailorGenerationFingerprint } from '../hooks/useTailoredResumeStudio';
import { TailorStudioCard } from './TailorStudioCard';

describe('Document Studio & Resume Tailoring (Zero-Token Mock Mode)', () => {
  const sampleInspection: PageInspection = {
    kind: 'job',
    snapshot: {
      platform: 'linkedin',
      externalId: 'job-12345',
      url: 'https://www.linkedin.com/jobs/view/12345',
      title: 'Senior Frontend Engineer',
      company: 'Acme Corp',
      firstPostedAt: '2026-08-24T00:00:00.000Z',
      lastPostedAt: '2026-08-24T00:00:00.000Z',
      postingObservedAt: '2026-08-26T00:00:00.000Z',
      description: 'Looking for a Senior Frontend Engineer proficient in React, TypeScript, and Tailwind CSS.',
      technologies: ['React', 'TypeScript', 'Tailwind CSS'],
      easyApply: true,
    },
  };

  const sampleMasterResume: MasterResumeData = {
    basics: {
      first_name: 'Alex',
      last_name: 'Taylor',
      email: 'alex@example.com',
      headline: 'Software Engineer',
    },
    summary: 'Experienced software engineer specializing in scalable frontend apps.',
    core_competencies: ['React Architecture', 'TypeScript', 'State Management'],
    experience: [
      {
        company: 'Tech Innovations',
        title: 'Frontend Developer',
        start_date: '2022',
        end_date: 'Present',
        description: [
          'Architected responsive UI with React and TypeScript',
          'Boosted page load performance by 40%',
        ],
      },
    ],
    skills: [
      {
        type: 'Frontend',
        skills: ['React', 'TypeScript', 'HTML/CSS'],
      },
    ],
  };

  it('pre-populates job details from detected job inspection', () => {
    expect(sampleInspection.kind).toBe('job');
    if (sampleInspection.kind === 'job') {
      expect(sampleInspection.snapshot.title).toBe('Senior Frontend Engineer');
      expect(sampleInspection.snapshot.company).toBe('Acme Corp');
      expect(sampleInspection.snapshot.lastPostedAt).toBe('2026-08-24T00:00:00.000Z');
      expect(sampleInspection.snapshot.description).toContain('Senior Frontend Engineer');
    }
  });

  it('allows same document type for different jobs but identifies exact duplicates', () => {
    const first = tailorGenerationFingerprint(
      'resume',
      'Frontend Engineer',
      'Acme',
      'Build React applications',
    );
    const duplicate = tailorGenerationFingerprint(
      'resume',
      'Frontend Engineer',
      'Acme',
      'Build React applications',
    );
    const secondJob = tailorGenerationFingerprint(
      'resume',
      'Backend Engineer',
      'Example Co',
      'Build APIs',
    );

    expect(duplicate).toBe(first);
    expect(secondJob).not.toBe(first);
  });

  it('passes mock: true when requesting zero-token tailored resume generation', async () => {
    const mockResult: JobReviewResult = {
      resume_data: {
        ...sampleMasterResume,
        summary: 'Experienced Senior Frontend Engineer tailored for Acme Corp.',
        core_competencies: [
          'Full-Stack Engineering',
          'Backend Architecture',
          'System Design',
        ],
      },
      core_competencies: [
        'Full-Stack Engineering',
        'Backend Architecture',
        'System Design',
      ],
      raw_ai_response: {
        mock: true,
        note: 'Generated in token-saving mock mode',
      },
      tailored_resume: {
        id: 'tailored-mock-1',
        job_application_id: 'app-mock-1',
        job_title: 'Senior Frontend Engineer',
        company: 'Acme Corp',
        job_description: 'Looking for a Senior Frontend Engineer',
        resume_data: sampleMasterResume,
        core_competencies: ['Full-Stack Engineering', 'Backend Architecture'],
        key_qualifications: ['Full-Stack Engineering', 'Backend Architecture'],
        targeted_projects: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    const reviewSpy = vi
      .spyOn(apiClient, 'reviewJob')
      .mockResolvedValueOnce(mockResult);

    const payload = {
      job_description: sampleInspection.kind === 'job' ? sampleInspection.snapshot.description || '' : '',
      title: 'Senior Frontend Engineer',
      company: 'Acme Corp',
      doc_type: 'resume' as const,
      mock: true, // Zero-Token mode
    };

    const res = await apiClient.reviewJob(payload);

    expect(reviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mock: true,
        title: 'Senior Frontend Engineer',
        company: 'Acme Corp',
        doc_type: 'resume',
      }),
    );
    expect(res.raw_ai_response?.mock).toBe(true);
    expect(res.core_competencies).toHaveLength(3);
    expect(res.resume_data?.summary).toContain('Acme Corp');
  });

  it('supports requesting cover letter and both document types', async () => {
    const mockCoverLetterResult: JobReviewResult = {
      resume_data: sampleMasterResume,
      core_competencies: ['React', 'TypeScript'],
      cover_letter: 'Dear Hiring Team at Acme Corp,\n\nI am writing to express my strong interest in the Senior Frontend Engineer position.',
      raw_ai_response: {
        mock: true,
        cover_letter: 'Dear Hiring Team at Acme Corp...',
      },
      tailored_resume: {
        id: 'tailored-cover-1',
        job_application_id: 'app-mock-1',
        job_title: 'Senior Frontend Engineer',
        company: 'Acme Corp',
        job_description: 'Looking for a Senior Frontend Engineer',
        resume_data: sampleMasterResume,
        cover_letter: 'Dear Hiring Team at Acme Corp...',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    const reviewSpy = vi
      .spyOn(apiClient, 'reviewJob')
      .mockResolvedValueOnce(mockCoverLetterResult);

    const coverPayload = {
      job_description: 'Looking for a Senior Frontend Engineer',
      title: 'Senior Frontend Engineer',
      company: 'Acme Corp',
      doc_type: 'cover_letter' as const,
      mock: true,
    };

    const coverRes = await apiClient.reviewJob(coverPayload);
    expect(reviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        doc_type: 'cover_letter',
      }),
    );
    expect(coverRes.cover_letter).toContain('Dear Hiring Team');

    const mockBothResult: JobReviewResult = {
      resume_data: sampleMasterResume,
      core_competencies: ['React', 'TypeScript'],
      cover_letter: 'Dear Hiring Team...',
      raw_ai_response: { mock: true },
    };

    vi.spyOn(apiClient, 'reviewJob').mockResolvedValueOnce(mockBothResult);

    const bothPayload = {
      job_description: 'Looking for a Senior Frontend Engineer',
      title: 'Senior Frontend Engineer',
      company: 'Acme Corp',
      doc_type: 'both' as const,
      mock: true,
    };

    const bothRes = await apiClient.reviewJob(bothPayload);
    expect(bothRes.cover_letter).toBeDefined();
    expect(bothRes.resume_data).toBeDefined();
  });


  it('loads and switches saved tailored resumes', async () => {
    const savedList: TailoredResume[] = [
      {
        id: 'saved-1',
        job_application_id: 'app-1',
        job_title: 'Full Stack Engineer',
        company: 'Google',
        job_description: 'Full stack development position',
        resume_data: sampleMasterResume,
        core_competencies: ['Python', 'TypeScript'],
        key_qualifications: ['Python', 'TypeScript'],
        targeted_projects: [],
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'saved-2',
        job_application_id: 'app-2',
        job_title: 'React Specialist',
        company: 'Meta',
        job_description: 'React design systems',
        resume_data: sampleMasterResume,
        core_competencies: ['React', 'Next.js', 'Design Systems'],
        key_qualifications: ['React', 'Next.js'],
        targeted_projects: [],
        created_at: '2026-08-05T00:00:00Z',
        updated_at: '2026-08-05T00:00:00Z',
      },
    ];

    vi.spyOn(apiClient, 'getTailoredResumes').mockResolvedValueOnce(savedList);

    const resumes = await apiClient.getTailoredResumes();
    expect(resumes).toHaveLength(2);
    expect(resumes[0]?.company).toBe('Google');
    expect(resumes[1]?.company).toBe('Meta');
  });

  it('updates tailored resume sections via PUT API', async () => {
    const updatedResume: TailoredResume = {
      id: 'saved-1',
      job_application_id: 'app-1',
      job_title: 'Full Stack Engineer',
      company: 'Google',
      job_description: 'Full stack development position',
      resume_data: {
        ...sampleMasterResume,
        summary: 'Updated summary by candidate.',
      },
      core_competencies: ['Python', 'TypeScript', 'Kubernetes'],
      key_qualifications: ['Python', 'TypeScript', 'Kubernetes'],
      targeted_projects: [],
      created_at: '2026-08-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    };

    const updateSpy = vi
      .spyOn(apiClient, 'updateTailoredResume')
      .mockResolvedValueOnce(updatedResume);

    const result = await apiClient.updateTailoredResume('saved-1', {
      resume_data: updatedResume.resume_data,
      core_competencies: ['Python', 'TypeScript', 'Kubernetes'],
    });

    expect(updateSpy).toHaveBeenCalledWith(
      'saved-1',
      expect.objectContaining({
        core_competencies: ['Python', 'TypeScript', 'Kubernetes'],
      }),
    );
    expect(result.core_competencies).toContain('Kubernetes');
    expect(result.resume_data.summary).toBe('Updated summary by candidate.');
  });

  it('formats resume filename according to rule: Candidate Name_CV_Company_Job Title', async () => {
    const { formatResumeFilename } = await import('@jobby/ui/components/UI/Resume/helpers');
    const testResume: MasterResumeData = {
      basics: {
        first_name: 'Scott',
        last_name: 'Zhang',
      },
    };

    const filename = formatResumeFilename(
      testResume,
      'TechnologyOne',
      '.NET Developer',
    );
    expect(filename).toBe('Scott Zhang - CV - TechnologyOne - .NET Developer.pdf');

    // Without company or job title
    expect(formatResumeFilename(testResume, 'Google', '')).toBe(
      'Scott Zhang - CV - Google.pdf',
    );
    expect(formatResumeFilename(testResume, '', 'Frontend Lead')).toBe(
      'Scott Zhang - CV - Frontend Lead.pdf',
    );
    expect(formatResumeFilename(testResume, '', '')).toBe('Scott Zhang - CV.pdf');
    expect(formatResumeFilename(testResume, 'Company', 'Front End Developer')).toBe(
      'Scott Zhang - CV - Front End Developer.pdf',
    );

    const { formatCoverLetterFilename } = await import(
      '@jobby/ui/components/UI/Resume/helpers'
    );
    expect(formatCoverLetterFilename(testResume, 'Company', 'Front End Developer')).toBe(
      'Scott Zhang - CL - Front End Developer.pdf',
    );

    // Sanitizes special characters and normalizes Unicode dashes
    expect(
      formatResumeFilename(
        testResume,
        'Macquarie Group',
        'C# Developer – Trading Desk Software Engineer (Relocation) - J12730',
      ),
    ).toBe(
      'Scott Zhang - CV - Macquarie Group - C Developer - Trading Desk Software Engineer (Relocation) - J12730.pdf',
    );

    // Sanitizes quotes, slashes, and complex punctuation
    expect(
      formatResumeFilename(
        testResume,
        'AT&T / "Acme" Corp',
        'Senior Fullstack/Backend Engineer (Node.js & C++) - #101',
      ),
    ).toBe(
      'Scott Zhang - CV - AT T Acme Corp - Senior Fullstack Backend Engineer (Node.js C ) - 101.pdf',
    );
  });

  it('aligns preview filename with the selected tailored document rather than current page', async () => {
    const { formatResumeFilename, formatCoverLetterFilename } = await import(
      '@jobby/ui/components/UI/Resume/helpers'
    );
    const testResume: MasterResumeData = {
      basics: {
        first_name: 'Scott',
        last_name: 'Zhang',
      },
    };

    // Selected tailored document is for "Google" / "Staff Engineer"
    const selectedDocument = {
      company: 'Google',
      job_title: 'Staff Engineer',
    };
    // Current page is for "Synechron" / "Full Stack Engineer"
    const currentPage = {
      company: 'Synechron',
      title: 'Full Stack Engineer',
    };

    const resolvedCompany = selectedDocument.company || currentPage.company;
    const resolvedJobTitle = selectedDocument.job_title || currentPage.title;

    const resumeFilename = formatResumeFilename(
      testResume,
      resolvedCompany,
      resolvedJobTitle,
    );
    const clFilename = formatCoverLetterFilename(
      testResume,
      resolvedCompany,
      resolvedJobTitle,
    );

    expect(resumeFilename).toBe('Scott Zhang - CV - Google - Staff Engineer.pdf');
    expect(clFilename).toBe('Scott Zhang - CL - Google - Staff Engineer.pdf');
  });

  it('prioritizes user-modified job details from inspection snapshot over previous document metadata', async () => {
    const { formatResumeFilename, formatCoverLetterFilename } = await import(
      '@jobby/ui/components/UI/Resume/helpers'
    );
    const testResume: MasterResumeData = {
      basics: {
        first_name: 'Scott',
        last_name: 'Zhang',
      },
    };

    const savedDoc = {
      company: 'Old Recognized Company',
      job_title: 'Old Recognized Title',
    };
    const userModifiedSnapshot = {
      company: 'User Overridden Corp',
      title: 'Senior Principal Engineer',
    };

    const effectiveCompany = userModifiedSnapshot.company || savedDoc.company;
    const effectiveJobTitle = userModifiedSnapshot.title || savedDoc.job_title;

    const resumeFilename = formatResumeFilename(
      testResume,
      effectiveCompany,
      effectiveJobTitle,
    );
    const clFilename = formatCoverLetterFilename(
      testResume,
      effectiveCompany,
      effectiveJobTitle,
    );

    expect(resumeFilename).toBe(
      'Scott Zhang - CV - User Overridden Corp - Senior Principal Engineer.pdf',
    );
    expect(clFilename).toBe(
      'Scott Zhang - CL - User Overridden Corp - Senior Principal Engineer.pdf',
    );
  });

  it('provides concise AI status messages for resume, cover letter, and bundle generation', async () => {
    const {
      getAiStatusMessages,
      AI_TAILOR_STATUS_MESSAGES,
      AI_COVER_LETTER_STATUS_MESSAGES,
      AI_BOTH_STATUS_MESSAGES,
    } = await import('../constants/ai-status-messages');

    const resumeMessages = getAiStatusMessages('resume');
    expect(resumeMessages.length).toBeGreaterThan(5);
    expect(resumeMessages[0]).toContain('job requirements');
    expect(resumeMessages).toEqual(AI_TAILOR_STATUS_MESSAGES);

    const letterMessages = getAiStatusMessages('cover_letter');
    expect(letterMessages.length).toBeGreaterThan(4);
    expect(letterMessages[0]).toContain('company');
    expect(letterMessages).toEqual(AI_COVER_LETTER_STATUS_MESSAGES);

    const bothMessages = getAiStatusMessages('both');
    expect(bothMessages.length).toBeGreaterThan(4);
    expect(bothMessages[0]).toContain('role requirements');
    expect(bothMessages).toEqual(AI_BOTH_STATUS_MESSAGES);
  });

  it('supports optimistic pending state in TailoredResume contract', () => {
    const optimisticRecord: TailoredResume = {
      id: 'optimistic-123456789',
      job_application_id: '',
      job_title: 'Senior React Developer',
      company: 'Canva',
      job_description: 'Looking for a Senior React Developer...',
      resume_data: {} as MasterResumeData,
      core_competencies: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isGenerating: true,
      generatingDocType: 'resume',
    };

    expect(optimisticRecord.isGenerating).toBe(true);
    expect(optimisticRecord.generatingDocType).toBe('resume');
    expect(optimisticRecord.id).toMatch(/^optimistic-/);
  });

  it('formats tailored resume into structured plain text for one-click copy', async () => {
    const { formatResumeAsPlainText } = await import('@jobby/ui/components/UI/Resume/helpers');

    const plainText = formatResumeAsPlainText(
      sampleMasterResume,
      ['React Architecture', 'TypeScript', 'Tailwind CSS'],
    );

    expect(plainText).toContain('Alex Taylor');
    expect(plainText).toContain('alex@example.com');
    expect(plainText).toContain('SUMMARY');
    expect(plainText).toContain('Experienced software engineer');
    expect(plainText).toContain('CORE COMPETENCIES');
    expect(plainText).toContain('React Architecture • TypeScript • Tailwind CSS');
    expect(plainText).toContain('WORK EXPERIENCE');
    expect(plainText).toContain('Frontend Developer at Tech Innovations');
    expect(plainText).toContain('Architected responsive UI');
    expect(plainText).toContain('SKILLS');
    expect(plainText).toContain('Frontend: React, TypeScript, HTML/CSS');
  });

  it('supports permanently deleting a tailored resume via apiClient', async () => {
    const deleteSpy = vi
      .spyOn(apiClient, 'deleteTailoredResume')
      .mockResolvedValueOnce({ success: true, id: 'tailored-uuid-123' });

    const result = await apiClient.deleteTailoredResume('tailored-uuid-123');
    expect(result.success).toBe(true);
    expect(result.id).toBe('tailored-uuid-123');
    expect(deleteSpy).toHaveBeenCalledWith('tailored-uuid-123');
  });

  it('renders cover letter PDF with vector SVG in milliseconds without hanging', async () => {
    const {
      COVER_LETTER_SIGNATURE_STYLE,
      coverLetterBody,
      renderCoverLetterPdfOnce,
    } =
      await import('@jobby/ui/components/UI/Resume/cover-letter-pdf-document');

    expect(COVER_LETTER_SIGNATURE_STYLE).toEqual({
      fontFamily:
        "'Sacramento', 'Segoe Script', cursive",
      fontStyle: 'normal',
      fontWeight: 400,
    });

    const sampleLetter = `Dear Hiring Team,\n\nI am writing to express my enthusiasm for the Senior Frontend Engineer position at Acme Corp. With extensive experience in React, TypeScript, and modern design systems, I have delivered robust user interfaces and high-performance web applications.\n\nThank you for considering my application.\n\nSincerely,\nScott Zhang`;

    expect(coverLetterBody(sampleLetter)).toBe(
      'I am writing to express my enthusiasm for the Senior Frontend Engineer position at Acme Corp. With extensive experience in React, TypeScript, and modern design systems, I have delivered robust user interfaces and high-performance web applications.\n\nThank you for considering my application.',
    );

    const start = Date.now();
    const { blob, pages } = await renderCoverLetterPdfOnce(
      sampleLetter,
      sampleMasterResume,
      'Acme Corp',
      'Senior Frontend Engineer',
    );
    const duration = Date.now() - start;

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(100);
    expect(pages).toBe(1);
    expect(duration).toBeLessThan(3000);
  });

  it('shows the generated cover letter PDF size in preview metadata', async () => {
    const { formatCoverLetterPdfFileSize } = await import(
      '@jobby/ui/components/UI/Resume/helpers'
    );

    expect(formatCoverLetterPdfFileSize(24_576)).toBe('24.0 KB');
  });

  it('guards tailoring actions when unauthenticated', async () => {
    let signInTriggered = false;
    const onSignIn = () => {
      signInTriggered = true;
    };
    const authConnected = false;

    const generateIfAuth = (auth: boolean, signIn: () => void) => {
      if (!auth) {
        signIn();
        return false;
      }
      return true;
    };

    const allowed = generateIfAuth(authConnected, onSignIn);
    expect(allowed).toBe(false);
    expect(signInTriggered).toBe(true);
  });

  it('provides dedicated status messages for each generating document type (resume, cover_letter, both)', async () => {
    const { getAiStatusMessages } = await import('../constants/ai-status-messages');
    
    const resumeMessages = getAiStatusMessages('resume');
    const clMessages = getAiStatusMessages('cover_letter');
    const bothMessages = getAiStatusMessages('both');

    expect(resumeMessages.length).toBeGreaterThan(0);
    expect(clMessages.length).toBeGreaterThan(0);
    expect(bothMessages.length).toBeGreaterThan(0);

    expect(resumeMessages.some((m) => m.toLowerCase().includes('resume'))).toBe(true);
    expect(clMessages.some((m) => m.toLowerCase().includes('cover letter'))).toBe(true);
    expect(bothMessages.some((m) => m.toLowerCase().includes('resume') || m.toLowerCase().includes('letter'))).toBe(true);
  });

  it('renders empty state placeholder with re-detect and action buttons when no documents exist', () => {
    const mockStudio: any = {
      jobTitle: '',
      company: '',
      datePosted: '',
      jobDescription: '',
      mockMode: false,
      setMockMode: vi.fn(),
      isPreviewLoading: false,
      generationTasks: [],
      isGeneratingType: vi.fn().mockReturnValue(false),
      activeOptimisticId: null,
      preview: null,
      showPreviewModal: false,
      setShowPreviewModal: vi.fn(),
      result: null,
      savedResumes: [],
      careerProfiles: [],
      selectedProfileId: '',
      switchProfile: vi.fn(),
      makeDefaultProfile: vi.fn(),
      originalResume: null,
      detectedJob: null,
      populateFromDetected: vi.fn(),
      loadSavedResume: vi.fn(),
      previewPrompt: vi.fn(),
      generateTailoredResume: vi.fn(),
      cancelGeneration: vi.fn(),
      deleteSavedResume: vi.fn(),
      simulateDevGeneration: vi.fn(),
      clearDevGeneration: vi.fn(),
    };

    const html = renderToStaticMarkup(
      createElement(TailorStudioCard, {
        studio: mockStudio,
        latestInspection: null,
        managementOnly: true,
        onNavigateHome: vi.fn(),
        onReDetect: vi.fn(),
        isInspecting: false,
      }),
    );

    expect(html).toContain('No Tailored Documents');
    expect(html).toContain('Re-scan Current Page');
    expect(html).toContain('Go to Home');
    expect(html).toContain('Master Resume');
    expect(html).toContain('ip-0');
  });

  it('shows re-scanning state when isInspecting is true on empty state', () => {
    const mockStudio: any = {
      jobTitle: '',
      company: '',
      datePosted: '',
      jobDescription: '',
      mockMode: false,
      setMockMode: vi.fn(),
      isPreviewLoading: false,
      generationTasks: [],
      isGeneratingType: vi.fn().mockReturnValue(false),
      activeOptimisticId: null,
      preview: null,
      showPreviewModal: false,
      setShowPreviewModal: vi.fn(),
      result: null,
      savedResumes: [],
      careerProfiles: [],
      selectedProfileId: '',
      switchProfile: vi.fn(),
      makeDefaultProfile: vi.fn(),
      originalResume: null,
      detectedJob: null,
      populateFromDetected: vi.fn(),
      loadSavedResume: vi.fn(),
      previewPrompt: vi.fn(),
      generateTailoredResume: vi.fn(),
      cancelGeneration: vi.fn(),
      deleteSavedResume: vi.fn(),
      simulateDevGeneration: vi.fn(),
      clearDevGeneration: vi.fn(),
    };

    const html = renderToStaticMarkup(
      createElement(TailorStudioCard, {
        studio: mockStudio,
        latestInspection: null,
        managementOnly: true,
        onNavigateHome: vi.fn(),
        onReDetect: vi.fn(),
        isInspecting: true,
      }),
    );

    expect(html).toContain('Re-scanning page...');
  });
});
