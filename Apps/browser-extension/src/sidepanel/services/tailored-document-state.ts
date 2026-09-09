import type { TailoredResume } from '../../shared/contracts/tailored-resume';

export function findTailoredDocumentForJob(
  resumes: TailoredResume[],
  title: string,
  company: string,
): TailoredResume | null {
  const currentTitle = title.trim().toLowerCase();
  const currentCompany = company.trim().toLowerCase();
  if (!currentTitle || !currentCompany) return null;

  const matches = resumes.filter((item) => {
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
  });

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const both = matches.find((item) => {
    const avail = tailoredDocumentAvailability(item);
    return avail.resume && avail.cover_letter;
  });
  if (both) return both;

  const primary = matches[0];
  const resumeItem = matches.find(
    (item) => tailoredDocumentAvailability(item).resume,
  );
  const clItem = matches.find(
    (item) => tailoredDocumentAvailability(item).cover_letter,
  );

  const mergedRawAi = {
    ...(resumeItem?.raw_ai_response || {}),
    ...(primary.raw_ai_response || {}),
    generated_documents: {
      resume: Boolean(resumeItem),
      cover_letter: Boolean(clItem),
    },
    ...(clItem?.cover_letter || clItem?.raw_ai_response?.cover_letter ?
      {
        cover_letter:
          clItem.cover_letter || clItem.raw_ai_response?.cover_letter,
      }
    : {}),
  };

  return {
    ...primary,
    resume_data: resumeItem?.resume_data || primary.resume_data,
    core_competencies:
      resumeItem?.core_competencies || primary.core_competencies,
    key_qualifications:
      resumeItem?.key_qualifications || primary.key_qualifications,
    targeted_projects:
      resumeItem?.targeted_projects || primary.targeted_projects,
    cover_letter: clItem?.cover_letter || primary.cover_letter,
    raw_ai_response: mergedRawAi,
  };
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
