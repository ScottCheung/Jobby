export function extractStructuredText(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  clone.querySelectorAll(
    "button, script, style, svg, [role='img'], .visually-hidden, .sr-only"
  ).forEach((node) => node.remove());
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const blockSelectors = "p, div, h1, h2, h3, h4, h5, h6, article, section, blockquote, ul, ol, tr, td, th, dt, dd, header, footer, summary, details";
  clone.querySelectorAll(blockSelectors).forEach((block) => {
    block.prepend(document.createTextNode("\n"));
    block.appendChild(document.createTextNode("\n"));
  });
  clone.querySelectorAll("li").forEach((li) => {
    const rawContent = (li.textContent || "").trim();
    if (!/^[•*\-▪►▸–—]\s*/.test(rawContent)) {
      li.prepend(document.createTextNode("\n• "));
    } else {
      li.prepend(document.createTextNode("\n"));
    }
    li.appendChild(document.createTextNode("\n"));
  });
  clone.querySelectorAll("span, strong, b, em, i, a, label, font").forEach((inline) => {
    inline.prepend(document.createTextNode(" "));
    inline.appendChild(document.createTextNode(" "));
  });
  const text = clone.textContent || "";
  return cleanDescriptionText(text);
}
export function cleanDescriptionText(rawText) {
  if (!rawText) return "";
  let text = rawText.replace(/TypeScript/g, "___TYPESCRIPT___").replace(/JavaScript/g, "___JAVASCRIPT___").replace(/NodeJS/gi, "___NODEJS___").replace(/GraphQL/gi, "___GRAPHQL___");
  text = text.replace(/([a-z0-9)])\.\s*([A-Z])/g, "$1.\n\n$2");
  text = text.replace(/([a-z0-9)])\s*:\s*([A-Z\u4e00-\u9fa5])/g, "$1:\n$2");
  text = text.replace(/([?！])\s*([A-Z\u4e00-\u9fa5])/g, "$1\n\n$2");
  text = text.replace(/\(\.NET\)\s*([A-Z])/gi, "(.NET)\n$1");
  text = text.replace(/([a-z0-9)])([A-Z][a-z])/g, "$1\n$2");
  text = text.replace(/___TYPESCRIPT___/g, "TypeScript").replace(/___JAVASCRIPT___/g, "JavaScript").replace(/___NODEJS___/g, "NodeJS").replace(/___GRAPHQL___/g, "GraphQL");
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, " ").trim());
  const formattedLines = [];
  let isInsideListSection = false;
  const HEADER_PATTERN = /^(?:about\s+(?:the\s+)?(?:job|role|company|us|you)|what\s+you(?:'|’)ll\s+do|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|overview|position\s+overview|job\s+summary|mandatory\s+skills|preferred\s+skills|years\s+of\s+experience|职位描述|岗位职责|任职要求|任职资格)\b/i;
  const LIST_HEADER_PATTERN = /^(?:what\s+you(?:'|’)ll\s+do|responsibilities|key\s+responsibilities|qualifications|requirements|key\s+requirements|who\s+you\s+are|what\s+we\s+offer|benefits|mandatory\s+skills|preferred\s+skills|岗位职责|任职要求|任职资格)\b/i;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line) {
      formattedLines.push("");
      continue;
    }
    if (/^[*\-▪►▸–—]\s+/.test(line)) {
      line = line.replace(/^[*\-▪►▸–—]\s+/, "• ");
    }
    const isHeader = HEADER_PATTERN.test(line) || /^[A-Z][A-Za-z0-9\s/&'-]{2,40}:$/.test(line);
    if (isHeader) {
      isInsideListSection = LIST_HEADER_PATTERN.test(line) || /:\s*$/.test(line);
      if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== "") {
        formattedLines.push("");
      }
      formattedLines.push(line);
      continue;
    }
    const isExplicitBullet = line.startsWith("• ");
    if (!isExplicitBullet && isInsideListSection && line.length < 300) {
      line = `• ${line}`;
    }
    formattedLines.push(line);
  }
  return formattedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function cleanDescription(value) {
  if (!value) return "";
  if (/<[a-z][\s\S]*>/i.test(value) && typeof document !== "undefined") {
    try {
      const container = document.createElement("div");
      container.innerHTML = value;
      return extractStructuredText(container);
    } catch {
    }
  }
  return cleanDescriptionText(value);
}
