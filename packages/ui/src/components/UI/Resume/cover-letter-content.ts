/** @format */

export function coverLetterBody(text?: string | null): string {
  return (text || '')
    .trim()
    .replace(/^Dear\b[^\n]*(?:\n+|$)/i, '')
    .replace(
      /\n+(?:Sincerely|Best regards|Kind regards|Warm regards|Regards|Respectfully|Yours sincerely),?(?:\n+[^\n]+)?\s*$/i,
      '',
    )
    .trim();
}
