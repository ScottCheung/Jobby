import type { TailoredResume } from '../../shared/contracts/tailored-resume';

export function findTailoredDocumentForJob(
  resumes: TailoredResume[],
  title: string,
  company: string,
): TailoredResume | null {
  const currentTitle = title.trim().toLowerCase();
  const currentCompany = company.trim().toLowerCase();
  if (!currentTitle || !currentCompany) return null;

  return (
    resumes.find((item) => {
      if (item.isGenerating) return false;
      const itemTitle = (item.job_title || '').trim().toLowerCase();
      const itemCompany = (item.company || '').trim().toLowerCase();
      const titleMatches =
        Boolean(itemTitle) &&
        (itemTitle === currentTitle ||
          itemTitle.includes(currentTitle) ||
          currentTitle.includes(itemTitle));
      const companyMatches = Boolean(itemCompany) && itemCompany === currentCompany;
      return titleMatches && companyMatches;
    }) || null
  );
}

export function resolveAutofillDocument(
  resumes: TailoredResume[],
  selectedDocumentId: string,
  matchingDocument: TailoredResume | null,
  defaultDocumentId: string,
  kind: 'resume' | 'cover_letter',
): TailoredResume | undefined {
  const available = resumes.filter(
    (item) => !item.isGenerating && tailoredDocumentAvailability(item)[kind],
  );

  const selectedDocument = available.find(
    (item) => item.id === selectedDocumentId,
  );
  if (selectedDocument) return selectedDocument;

  if (matchingDocument && available.some((item) => item.id === matchingDocument.id)) {
    return matchingDocument;
  }

  return (
    available.find((item) => item.id === defaultDocumentId) || available[0]
  );
}

export function tailoredDocumentAvailability(item: TailoredResume | null) {
  if (!item) return { resume: false, cover_letter: false };

  const generated = item.raw_ai_response?.generated_documents as
    | { resume?: boolean; cover_letter?: boolean }
    | undefined;
  const hasGenerationState = Boolean(
    generated && ('resume' in generated || 'cover_letter' in generated),
  );
  const coverLetter =
    item.cover_letter ||
    (typeof item.raw_ai_response?.cover_letter === 'string' ?
      item.raw_ai_response.cover_letter
    : '');

  return {
    resume:
      hasGenerationState ?
        generated?.resume === true
      : Object.keys(item.resume_data || {}).length > 0,
    cover_letter:
      hasGenerationState ?
        generated?.cover_letter === true
      : Boolean(coverLetter.trim()),
  };
}
