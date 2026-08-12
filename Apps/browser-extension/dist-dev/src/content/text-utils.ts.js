export function extractStructuredText(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  clone.querySelectorAll("button, script, style, svg, [role='img'], .visually-hidden, .sr-only").forEach((node) => node.remove());
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const blockSelectors = "p, div, h1, h2, h3, h4, h5, h6, article, section, blockquote, ul, ol";
  clone.querySelectorAll(blockSelectors).forEach((block) => {
    block.prepend(document.createTextNode("\n"));
    block.appendChild(document.createTextNode("\n"));
  });
  clone.querySelectorAll("li").forEach((li) => {
    li.prepend(document.createTextNode("\n• "));
    li.appendChild(document.createTextNode("\n"));
  });
  const text = clone.textContent || "";
  return text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function cleanDescription(value) {
  if (!value) return "";
  return value.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
