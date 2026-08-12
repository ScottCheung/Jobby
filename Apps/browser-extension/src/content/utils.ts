export function extractStructuredText(element: Element | null | undefined): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove noisy elements
  clone.querySelectorAll("button, script, style, svg, [role='img'], .visually-hidden, .sr-only").forEach((node) => node.remove());
  
  // Replace line breaks
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  
  // Add newlines around block elements
  const blockSelectors = 'p, div, h1, h2, h3, h4, h5, h6, article, section, blockquote, ul, ol';
  clone.querySelectorAll(blockSelectors).forEach(block => {
    block.prepend(document.createTextNode('\n'));
    block.appendChild(document.createTextNode('\n'));
  });
  
  // Format list items
  clone.querySelectorAll('li').forEach(li => {
    li.prepend(document.createTextNode('\n• '));
    li.appendChild(document.createTextNode('\n'));
  });
  
  const text = clone.textContent || "";
  
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
