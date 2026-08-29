/** @format */

export const HEADER_PATTERN =
  /^(?:about\s+(?:the\s+)?(?:job|role|company|us|you|position|team|business|[a-z0-9\s&'’–-]{1,30})|why\s+(?:join|work\s+(?:with|at|for)|us|[a-z0-9\s&'’–-]{1,30})\b|how\s+(?:we\s+think\s+about\s+[^.!\n]{1,40}|we\s+work|we\s+hire|we\s+interview|to\s+apply|it\s+works)\b|who\s+(?:we\s+are|you\s+are|we(?:'|’)re\s+looking\s+for)\b|what\s+you(?:'|’)ll\s+(?:do|bring|get|need|achieve|learn|experience)\b|what\s+we(?:'|’)(?:re\s+looking\s+for|offer|want|value|do)\b|what\s+(?:you\s+need|to\s+expect|is\s+in\s+it\s+for\s+you|we\s+look\s+for)\b|what(?:'|’)s\s+on\s+offer\b|our\s+(?:interview\s+process|hiring\s+process|selection\s+process|process|team|culture|tech\s+stack|story|stack|benefits|commitment|approach|philosophy|mission|values)\b|(?:the\s+)?(?:interview\s+process|hiring\s+process|selection\s+process|application\s+process)\b|(?:the\s+)?(?:role|position|opportunity|team|company)\b|(?:key\s+|core\s+|role\s+)?responsibilities\b|(?:key\s+|role\s+|minimum\s+|basic\s+|preferred\s+)?qualifications\b|(?:key\s+|role\s+|mandatory\s+|preferred\s+)?requirements\b|(?:mandatory|preferred|core|technical|key)\s+skills\b|skills\s*(?:&|and)\s*experience\b|experience\s*(?:&|and)\s*qualifications\b|perks\s*(?:&|and)\s*benefits\b|benefits\s*(?:&|and)\s*perks\b|compensation\s*(?:&|and)\s*benefits\b|salary\s*(?:&|and)\s*benefits\b|compensation\b|benefits\b|overview\b|position\s+overview\b|job\s+summary\b|company\s+description\b|job\s+description\b|additional\s+information\b|years\s+of\s+experience\b|equal\s+opportunity\b|diversity\s*(?:&|and)\s*inclusion\b|life\s+at\b|nice\s+to\s+have\b|bonus\s+points\b|you(?:'|’)ll(?:\s+be)?\b|you\s+will(?:\s+be)?\b|what\s+we(?:'|’)re\s+looking\s+for\b|职位描述|岗位职责|任职要求|任职资格|福利待遇|关于我们|加分项|工作职责|职位要求)\b/i;

export const QUESTION_HEADER_PATTERN =
  /^(?:why|who|what|where|how|are\s+you|is\s+this)\b[^.!\n]{2,70}[?？]$/i;

export const LIST_HEADER_PATTERN =
  /^(?:what\s+you(?:'|’)ll\s+(?:do|bring|get|need)|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|mandatory\s+skills|preferred\s+skills|what\s+we(?:'|’)(?:re\s+looking\s+for|want)|nice\s+to\s+have|you(?:'|’)ll\b|岗位职责|任职要求|任职资格|职位要求)\b/i;

export function cleanDescription(rawText: string | null | undefined): string {
  if (!rawText) return '';

  let text = rawText
    .replace(/TypeScript/g, '___TYPESCRIPT___')
    .replace(/JavaScript/g, '___JAVASCRIPT___')
    .replace(/NodeJS/gi, '___NODEJS___')
    .replace(/GraphQL/gi, '___GRAPHQL___')
    .replace(/PostgreSQL/gi, '___POSTGRESQL___')
    .replace(/MongoDB/gi, '___MONGODB___');

  // Fix isolated bullets where bullet is on its own line before text (e.g. "•\nDesign, build", ".\nCompetitive salary")
  text = text.replace(/^[•*\-▪►▸–—·.]\s*\r?\n\s*([^\r\n])/gm, '• $1');

  // Fix lowercase followed by multi-letter uppercase acronyms (e.g. "ofATI" -> "of ATI")
  text = text.replace(/([a-z])([A-Z]{2,})/g, '$1 $2');

  // Separate known section headers that are followed by inline text (e.g. "Company Description: Are you ready...")
  text = text.replace(
    /(?:^|\n)\s*(Company Description|Job Description|Qualifications|Additional Information|About (?:the )?(?:Role|Job|Company|Us)|Key Responsibilities|Responsibilities|Requirements|What (?:we offer|you'll bring|you'll do|we're looking for)|What's on offer):\s+(?=[A-Z0-9\u4e00-\u9fa5])/gmi,
    '\n\n$1:\n\n',
  );

  // Separate bullets attached to preceding text without newlines (e.g. "change the game* Strong familiarity")
  text = text.replace(/([^\r\n])\s*([•*\-▪►▸–—·])\s+/g, '$1\n• ');

  // 1. Fix missing space/newline after period between sentences when squished without whitespace (e.g. "products.We believe" -> "products.\n\nWe believe")
  text = text.replace(/([a-z0-9)])\.(?=[A-Z\u4e00-\u9fa5])/g, '$1.\n\n');

  // 2. Fix missing newline after section headings ending with colon when squished without whitespace (e.g. "About the role:We're" -> "About the role:\nWe're")
  text = text.replace(/([a-z0-9)]):(?=[A-Z\u4e00-\u9fa5])/g, '$1:\n');

  // 3. Fix missing newline after question marks (e.g. "Who is Shift? At Shift" -> "Who is Shift?\n\nAt Shift")
  text = text.replace(/([?！])\s*([A-Z\u4e00-\u9fa5])/g, '$1\n\n$2');

  // 4. Fix missing newline after closing parentheses before capital letter (e.g. "(React)Support", "(.NET)Support")
  text = text.replace(/\)\s*([A-Z])/g, ')\n$1');

  // Fix abnormal spaces before punctuation (e.g. "Have fun with us . Celebrations." -> "Have fun with us. Celebrations.")
  text = text.replace(/\s+([.,!?;:])/g, '$1');

  text = text
    .replace(/___TYPESCRIPT___/g, 'TypeScript')
    .replace(/___JAVASCRIPT___/g, 'JavaScript')
    .replace(/___NODEJS___/g, 'NodeJS')
    .replace(/___GRAPHQL___/g, 'GraphQL')
    .replace(/___POSTGRESQL___/g, 'PostgreSQL')
    .replace(/___MONGODB___/g, 'MongoDB');

  // Split into raw lines and clean each line while preserving blank lines
  const rawLines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, ' ').trim());

  // Merge any stray lonely bullet characters with the next non-empty line
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i] ?? '';
    if (/^[•*\-▪►▸–—·.]$/.test(cur)) {
      let j = i + 1;
      while (j < rawLines.length && !rawLines[j]) {
        j++;
      }
      const next = rawLines[j];
      if (next && !/^[•*\-▪►▸–—·.]/.test(next)) {
        lines.push(`• ${next}`);
        i = j;
        continue;
      }
      continue;
    }
    lines.push(cur);
  }

  const formattedLines: string[] = [];
  let isInsideListSection = false;
  let isDirectlyAfterListHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (!line) {
      if (
        isInsideListSection &&
        isDirectlyAfterListHeader &&
        formattedLines.length > 0 &&
        !formattedLines[formattedLines.length - 1]?.startsWith('•')
      ) {
        continue;
      }
      if (!isDirectlyAfterListHeader) {
        isInsideListSection = false;
      }
      if (
        formattedLines.length > 0 &&
        formattedLines[formattedLines.length - 1] !== ''
      ) {
        formattedLines.push('');
      }
      continue;
    }

    const isExplicitBullet =
      /^[*\-▪►▸–—•·]\s+/.test(line) ||
      /^\.\s+/.test(line) ||
      /^\(?\d+[\.\)]\s+/.test(line);
    const strippedLine = line
      .replace(/^[*\-▪►▸–—•·]\s+/, '')
      .replace(/^\.\s+/, '')
      .replace(/^\(?\d+[\.\)]\s+/, '')
      .trim();

    const isHeader =
      !isExplicitBullet &&
      (HEADER_PATTERN.test(strippedLine) ||
        QUESTION_HEADER_PATTERN.test(strippedLine) ||
        /^[A-Z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s/&'’–-]{1,60}:$/.test(
          strippedLine,
        ));

    if (isHeader) {
      const isListHeader = LIST_HEADER_PATTERN.test(strippedLine);
      isInsideListSection = isListHeader;
      isDirectlyAfterListHeader = isListHeader;
      if (
        formattedLines.length > 0 &&
        formattedLines[formattedLines.length - 1] !== ''
      ) {
        formattedLines.push('');
      }
      formattedLines.push(strippedLine);
      continue;
    }

    if (isExplicitBullet) {
      isInsideListSection = true;
      isDirectlyAfterListHeader = false;
      formattedLines.push(`• ${strippedLine}`);
      continue;
    }

    if (
      isInsideListSection &&
      isDirectlyAfterListHeader &&
      line.length < 200 &&
      !HEADER_PATTERN.test(line) &&
      !QUESTION_HEADER_PATTERN.test(line)
    ) {
      formattedLines.push(`• ${line}`);
      continue;
    }

    isInsideListSection = false;
    isDirectlyAfterListHeader = false;
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

  const rawLines = cleanedText.split(/\r?\n/).map((line) => line.trim());

  // Merge any stray lonely bullet characters with the next non-empty line
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i] ?? '';
    if (/^[•*\-▪►▸–—·.]$/.test(cur)) {
      let j = i + 1;
      while (j < rawLines.length && !rawLines[j]) j++;
      const next = rawLines[j];
      if (next && !/^[•*\-▪►▸–—·.]/.test(next)) {
        lines.push(`• ${next}`);
        i = j;
        continue;
      }
      continue;
    }
    lines.push(cur);
  }

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
      blocks.push({
        type: 'paragraph',
        text: currentParagraphLines.join('\n'),
      });
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

    const rawBulletMatch = line.match(/^(?:[•*\-▪►▸–—·]|\.|\(?\d+[\.\)]?)\s+(.*)$/);
    const isBullet = Boolean(rawBulletMatch);
    const content =
      rawBulletMatch && typeof rawBulletMatch[1] === 'string' ?
        rawBulletMatch[1].trim()
      : line;

    // Lookahead: check if next non-empty line is a bullet
    let nextNonEmptyIsBullet = false;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      if (nextLine) {
        if (/^(?:[•*\-▪►▸–—·]|\.|\(?\d+[\.\)]?)\s+/.test(nextLine)) {
          nextNonEmptyIsBullet = true;
        }
        break;
      }
    }

    const isQuestionHeading =
      !isBullet && QUESTION_HEADER_PATTERN.test(content);
    const isExplicitHeading =
      !isBullet &&
      (HEADER_PATTERN.test(content) ||
        /^[A-Z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s/&'’–-]{1,60}:$/.test(
          content,
        ) ||
        (content.endsWith(':') && content.length <= 60));

    const isHeaderPrecedingBullets =
      !isBullet &&
      nextNonEmptyIsBullet &&
      content.length <= 90 &&
      !/[.!?!。！？]$/.test(content);

    const isHeader =
      isExplicitHeading || isQuestionHeading || isHeaderPrecedingBullets;

    if (isHeader) {
      flushList();
      flushParagraph();
      blocks.push({ type: 'header', text: content });
      continue;
    }

    if (isBullet) {
      flushParagraph();
      if (content) {
        currentListItems.push(content);
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
