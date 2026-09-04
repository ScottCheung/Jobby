/** @format */

import type { MasterResumeData } from '@jobby/ui/components/UI/Resume/types';

export async function renderCoverLetterPdfForExtension(
  coverLetter: string,
  candidateData?: MasterResumeData,
  company?: string,
  jobTitle?: string,
): Promise<{ blob: Blob; pages: number }> {
  const { renderCoverLetterPdfOnce } = await import(
    '@jobby/ui/components/UI/Resume/cover-letter-pdf-document'
  );
  return renderCoverLetterPdfOnce(
    coverLetter,
    candidateData,
    company,
    jobTitle,
  );
}
