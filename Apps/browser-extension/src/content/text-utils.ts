export function extractStructuredText(element: Element | null | undefined): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove noisy elements
  clone
    .querySelectorAll(
      "button, script, style, svg, [role='img'], .visually-hidden, .sr-only",
    )
    .forEach((node) => node.remove());

  // Replace br with newline
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));

  // Ensure block containers have newlines
  const blockSelectors =
    'p, div, h1, h2, h3, h4, h5, h6, article, section, blockquote, ul, ol, tr, td, th, dt, dd, header, footer, summary, details';
  clone.querySelectorAll(blockSelectors).forEach((block) => {
    block.prepend(document.createTextNode('\n'));
    block.appendChild(document.createTextNode('\n'));
  });

  // Format list items
  clone.querySelectorAll('li').forEach((li) => {
    const rawContent = (li.textContent || '').trim();
    if (!/^[•*\-▪►▸–—]\s*/.test(rawContent)) {
      li.prepend(document.createTextNode('\n• '));
    } else {
      li.prepend(document.createTextNode('\n'));
    }
    li.appendChild(document.createTextNode('\n'));
  });

  // Prepend/append space to inline elements so sibling inline nodes don't get glued without spaces
  clone.querySelectorAll('span, strong, b, em, i, a, label, font').forEach((inline) => {
    inline.prepend(document.createTextNode(' '));
    inline.appendChild(document.createTextNode(' '));
  });

  const text = clone.textContent || '';
  return cleanDescriptionText(text);
}

export function cleanDescriptionText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Fix missing space/newline after period between sentences (e.g. "products.We believe" -> "products.\n\nWe believe")
  text = text.replace(/([a-z0-9)])\.\s*([A-Z])/g, '$1.\n\n$2');

  // 2. Fix missing newline after section headings ending with colon (e.g. "About the role:We're" -> "About the role:\nWe're")
  text = text.replace(/([a-z0-9)])\s*:\s*([A-Z\u4e00-\u9fa5])/g, '$1:\n$2');

  // 3. Fix missing newline after question marks (e.g. "Who is Shift? At Shift" -> "Who is Shift?\n\nAt Shift")
  text = text.replace(/([?！])\s*([A-Z\u4e00-\u9fa5])/g, '$1\n\n$2');

  // 4. Fix missing newline after closing parentheses before capital letter (e.g. "(React)Support", "(.NET)Support")
  text = text.replace(/\)\s*([A-Z])/g, ')\n$1');

  // Split into raw lines and clean each line while preserving blank lines
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, ' ').trim());

  const formattedLines: string[] = [];
  let isInsideListSection = false;

  const HEADER_PATTERN = /^(?:about\s+(?:the\s+)?(?:job|role|company|us|you)|what\s+you(?:'|’)ll\s+do|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|overview|position\s+overview|job\s+summary|mandatory\s+skills|preferred\s+skills|years\s+of\s+experience|职位描述|岗位职责|任职要求|任职资格)\b/i;
  const LIST_HEADER_PATTERN = /^(?:what\s+you(?:'|’)ll\s+do|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|mandatory\s+skills|preferred\s+skills|岗位职责|任职要求|任职资格)\b/i;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (!line) {
      isInsideListSection = false;
      formattedLines.push('');
      continue;
    }

    // Normalize leading bullet characters like "- ", "* ", "– ", "▪ " to "• "
    if (/^[*\-▪►▸–—]\s+/.test(line)) {
      line = line.replace(/^[*\-▪►▸–—]\s+/, '• ');
    }

    const isHeader = HEADER_PATTERN.test(line) || /^[A-Z][A-Za-z0-9\s/&'-]{2,40}:$/.test(line);

    if (isHeader) {
      isInsideListSection = LIST_HEADER_PATTERN.test(line);
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

export function cleanDescription(value: string | null | undefined): string {
  if (!value) return '';

  if (/<[a-z][\s\S]*>/i.test(value) && typeof document !== 'undefined') {
    try {
      const container = document.createElement('div');
      container.innerHTML = value;
      return extractStructuredText(container);
    } catch {
      // Fall through to text cleanup
    }
  }

  return cleanDescriptionText(value);
}


