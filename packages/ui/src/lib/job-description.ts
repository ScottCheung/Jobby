/** @format */

export function cleanDescription(rawText: string | null | undefined): string {
  if (!rawText) return '';

  let text = rawText
    .replace(/TypeScript/g, '___TYPESCRIPT___')
    .replace(/JavaScript/g, '___JAVASCRIPT___')
    .replace(/NodeJS/gi, '___NODEJS___')
    .replace(/GraphQL/gi, '___GRAPHQL___');

  // 1. Fix missing space/newline after period between sentences (e.g. "products.We believe" -> "products.\n\nWe believe")
  text = text.replace(/([a-z0-9)])\.\s*([A-Z])/g, '$1.\n\n$2');

  // 2. Fix missing newline after section headings ending with colon (e.g. "About the role:We're" -> "About the role:\nWe're")
  text = text.replace(/([a-z0-9)])\s*:\s*([A-Z\u4e00-\u9fa5])/g, '$1:\n$2');

  // 3. Fix missing newline after question marks (e.g. "Who is Shift? At Shift" -> "Who is Shift?\n\nAt Shift")
  text = text.replace(/([?！])\s*([A-Z\u4e00-\u9fa5])/g, '$1\n\n$2');

  // 4. Fix squished list items/sentences concatenated without punctuation or space
  text = text.replace(/\(\.NET\)\s*([A-Z])/gi, '(.NET)\n$1');
  text = text.replace(/([a-z0-9)])([A-Z][a-z])/g, '$1\n$2');

  text = text
    .replace(/___TYPESCRIPT___/g, 'TypeScript')
    .replace(/___JAVASCRIPT___/g, 'JavaScript')
    .replace(/___NODEJS___/g, 'NodeJS')
    .replace(/___GRAPHQL___/g, 'GraphQL');

  // Split into raw lines and clean each line while preserving blank lines
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, ' ').trim());

  const formattedLines: string[] = [];
  let isInsideListSection = false;

  const HEADER_PATTERN =
    /^(?:about\s+(?:the\s+)?(?:job|role|company|us|you)|what\s+you(?:'|’)ll\s+do|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|overview|position\s+overview|job\s+summary|mandatory\s+skills|preferred\s+skills|years\s+of\s+experience|职位描述|岗位职责|任职要求|任职资格)\b/i;
  const LIST_HEADER_PATTERN =
    /^(?:what\s+you(?:'|’)ll\s+do|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|mandatory\s+skills|preferred\s+skills|岗位职责|任职要求|任职资格)\b/i;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (!line) {
      formattedLines.push('');
      continue;
    }

    // Normalize leading bullet characters like "- ", "* ", "– ", "▪ " to "• "
    if (/^[*\-▪►▸–—]\s+/.test(line)) {
      line = line.replace(/^[*\-▪►▸–—]\s+/, '• ');
    }

    const isHeader =
      HEADER_PATTERN.test(line) || /^[A-Z][A-Za-z0-9\s/&'-]{2,40}:$/.test(line);

    if (isHeader) {
      isInsideListSection = LIST_HEADER_PATTERN.test(line) || /:\s*$/.test(line);
      if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
        formattedLines.push('');
      }
      formattedLines.push(line);
      continue;
    }

    const isExplicitBullet = line.startsWith('• ');

    if (!isExplicitBullet && isInsideListSection && line.length < 300) {
      line = `• ${line}`;
    }

    formattedLines.push(line);
  }

  return formattedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type ContentBlock =
  | { type: 'header'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string };

export function parseDescriptionBlocks(
  rawText: string | null | undefined,
): ContentBlock[] {
  if (!rawText) return [];

  const cleanedText = cleanDescription(rawText);
  if (!cleanedText) return [];

  const lines = cleanedText.split(/\r?\n/).map((line) => line.trim());

  const HEADER_PATTERN =
    /^(?:about\s+(?:the\s+)?(?:job|role|company|us|you)|what\s+you(?:'|’)ll\s+do|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|overview|position\s+overview|job\s+summary|mandatory\s+skills|preferred\s+skills|years\s+of\s+experience|职位描述|岗位职责|任职要求|任职资格)\b/i;

  const blocks: ContentBlock[] = [];
  let currentListItems: string[] = [];
  let currentParagraphLines: string[] = [];

  function flushList() {
    if (currentListItems.length > 0) {
      blocks.push({ type: 'list', items: [...currentListItems] });
      currentListItems = [];
    }
  }

  function flushParagraph() {
    if (currentParagraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: currentParagraphLines.join('\n') });
      currentParagraphLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }

    const isBullet = /^(?:[•*\-▪►▸–—]|\(?\d+[\.\)]?)\s+/.test(line);

    // Lookahead: check if next non-empty line is a bullet
    let nextNonEmptyIsBullet = false;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      if (nextLine) {
        if (/^(?:[•*\-▪►▸–—]|\(?\d+[\.\)]?)\s+/.test(nextLine)) {
          nextNonEmptyIsBullet = true;
        }
        break;
      }
    }

    const isExplicitHeader =
      HEADER_PATTERN.test(line) ||
      /^[A-Z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s/&'-]{1,60}:$/.test(line) ||
      line.endsWith(':');
    const isHeaderPrecedingBullets =
      !isBullet &&
      nextNonEmptyIsBullet &&
      line.length <= 90 &&
      !/[.!?!。！？]$/.test(line);

    const isHeader = isExplicitHeader || isHeaderPrecedingBullets;

    if (isHeader) {
      flushList();
      flushParagraph();
      blocks.push({ type: 'header', text: line });
      continue;
    }

    if (isBullet) {
      flushParagraph();
      const cleanItem = line.replace(/^(?:[•*\-▪►▸–—]|\(?\d+[\.\)]?)\s+/, '').trim();
      if (cleanItem) {
        currentListItems.push(cleanItem);
      }
      continue;
    }

    flushList();
    currentParagraphLines.push(line);
  }

  flushList();
  flushParagraph();

  return blocks;
}
