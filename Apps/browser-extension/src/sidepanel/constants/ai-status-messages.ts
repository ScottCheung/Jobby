/**
 * AI status progress messages displayed during real-time tailoring generation.
 */

export const AI_TAILOR_STATUS_MESSAGES: string[] = [
  'AI is analyzing job requirements & hiring intent...',
  'AI is identifying key alignment points with your background...',
  'AI is extracting high-value qualification keywords & ATS tags...',
  'AI is tailoring executive summary for maximum role relevance...',
  'AI is optimizing work experience bullet points with quantified metrics...',
  'AI is mapping technical skill proficiencies to target specifications...',
  'AI is highlighting standout leadership & domain accomplishments...',
  'AI is refining action verbs and industry-standard terminology...',
  'AI is structuring ATS-compliant layout & readability sections...',
  'AI is evaluating keyword density against recruitment screening filters...',
  'AI is synthesizing competitive edge & unique value proposition...',
  'AI is contextualizing project contributions against target role challenges...',
  'AI is fine-tuning bullet points for conciseness and executive clarity...',
  'AI is cross-verifying candidate qualifications against hiring criteria...',
  'AI is polishing tone, typography, and professional phrasing...',
  'AI is running final ATS quality & relevance verification...',
  'AI is assembling tailored resume & document assets...',
];

export const AI_COVER_LETTER_STATUS_MESSAGES: string[] = [
  'AI is analyzing company culture, tone, and role objectives...',
  'AI is framing a compelling opening hook and motivation statement...',
  'AI is extracting relevant career achievements for the narrative...',
  'AI is articulating your unique value proposition for the hiring manager...',
  'AI is addressing job-specific requirements with concrete impact stories...',
  'AI is polishing persuasive tone and executive sign-off...',
  'AI is running final quality and readability verification...',
  'AI is assembling your targeted cover letter...',
];

export const AI_BOTH_STATUS_MESSAGES: string[] = [
  'AI is analyzing job requirements & hiring intent across all documents...',
  'AI is extracting core competency keywords & ATS tags...',
  'AI is optimizing resume bullet points and executive summary...',
  'AI is synthesizing matching achievements for the cover letter...',
  'AI is tailoring narrative consistency across resume and cover letter...',
  'AI is evaluating keyword alignment with recruitment screening filters...',
  'AI is drafting personalized cover letter hook and closing pitch...',
  'AI is structuring ATS-compliant sections for your resume...',
  'AI is polishing tone and executive presentation...',
  'AI is assembling your complete tailored application package...',
];

export function getAiStatusMessages(docType?: string | null): string[] {
  if (docType === 'cover_letter') return AI_COVER_LETTER_STATUS_MESSAGES;
  if (docType === 'both') return AI_BOTH_STATUS_MESSAGES;
  return AI_TAILOR_STATUS_MESSAGES;
}
