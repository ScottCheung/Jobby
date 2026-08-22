/**
 * AI status progress messages displayed during real-time tailoring generation.
 * Short, crisp, and executive status indicators.
 */

export const AI_TAILOR_STATUS_MESSAGES: string[] = [
  'Analyzing job requirements...',
  'Matching key qualifications...',
  'Tailoring summary & highlights...',
  'Optimizing experience bullets...',
  'Aligning technical skills...',
  'Refining tone & action verbs...',
  'Verifying ATS layout...',
  'Assembling tailored resume...',
];

export const AI_COVER_LETTER_STATUS_MESSAGES: string[] = [
  'Analyzing company & role...',
  'Framing opening narrative...',
  'Highlighting key achievements...',
  'Connecting role requirements...',
  'Polishing persuasive tone...',
  'Assembling cover letter...',
];

export const AI_BOTH_STATUS_MESSAGES: string[] = [
  'Analyzing role requirements...',
  'Matching qualifications & skills...',
  'Tailoring resume bullet points...',
  'Drafting targeted cover letter...',
  'Ensuring narrative consistency...',
  'Assembling application package...',
];

export function getAiStatusMessages(docType?: string | null): string[] {
  if (docType === 'cover_letter') return AI_COVER_LETTER_STATUS_MESSAGES;
  if (docType === 'both') return AI_BOTH_STATUS_MESSAGES;
  return AI_TAILOR_STATUS_MESSAGES;
}
