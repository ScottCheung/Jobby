/** @format */

const JOB_DESCRIPTION_SELECTORS = [
  '[data-testid*="job-description" i]',
  '[data-test*="job-description" i]',
  '[id*="job-description" i]',
  '[class*="job-description" i]',
  '[id*="description" i]',
  '[class*="description" i]',
].join(', ');

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function containsTerm(text: string, term: string): boolean {
  if (term.length <= 3) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  }
  return normalize(text).includes(normalize(term));
}

function highlightTargetFor(element: HTMLElement): HTMLElement {
  const semanticContainer = element.closest<HTMLElement>(
    'li, p, [role="listitem"], tr',
  );
  if (semanticContainer && isVisible(semanticContainer)) return semanticContainer;

  let target = element;
  for (let depth = 0; depth < 4; depth += 1) {
    const parent = target.parentElement;
    if (!parent || !isVisible(parent) || parent.innerText.length > 900) break;
    target = parent;
  }
  return target;
}

function findMatchingElement(root: HTMLElement, searchTerms: string[]): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent || '';
    const parent = node.parentElement;
    if (
      parent &&
      isVisible(parent) &&
      searchTerms.some((term) => containsTerm(text, term))
    ) {
      return highlightTargetFor(parent);
    }
    node = walker.nextNode();
  }
  return null;
}

function showHighlight(target: HTMLElement): void {
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'fixed',
    background: 'rgba(239, 68, 68, 0.16)',
    border: '2px solid rgba(220, 38, 38, 0.95)',
    borderRadius: '14px',
    padding: '7px',
    margin: '-7px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    transition: 'opacity 1000ms ease',
    opacity: '0',
  });
  document.documentElement.appendChild(highlight);

  let positionFrame: number | undefined;
  const positionHighlight = () => {
    const rect = target.getBoundingClientRect();
    Object.assign(highlight.style, {
      left: `${Math.max(0, rect.left - 7)}px`,
      top: `${Math.max(0, rect.top - 7)}px`,
      width: `${rect.width + 14}px`,
      height: `${rect.height + 14}px`,
    });
    return rect;
  };

  const syncHighlightPosition = () => {
    if (positionFrame !== undefined) return;
    positionFrame = window.requestAnimationFrame(() => {
      positionFrame = undefined;
      positionHighlight();
    });
  };
  document.addEventListener('scroll', syncHighlightPosition, true);
  window.addEventListener('resize', syncHighlightPosition);

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    positionHighlight();
    highlight.style.opacity = '1';
  };

  let stableChecks = 0;
  let previousRect: DOMRect | null = null;
  const startedAt = performance.now();
  const waitForSettledPosition = () => {
    if (revealed) return;
    const rect = positionHighlight();
    const isStable =
      previousRect &&
      Math.abs(previousRect.top - rect.top) < 1 &&
      Math.abs(previousRect.left - rect.left) < 1 &&
      Math.abs(previousRect.width - rect.width) < 1 &&
      Math.abs(previousRect.height - rect.height) < 1;
    stableChecks = isStable ? stableChecks + 1 : 0;
    previousRect = rect;

    if (performance.now() - startedAt >= 300 && stableChecks >= 3) {
      reveal();
      return;
    }
    window.setTimeout(waitForSettledPosition, 75);
  };

  window.setTimeout(waitForSettledPosition, 75);
  window.setTimeout(reveal, 1800);
  window.setTimeout(() => {
    highlight.style.opacity = '0';
    window.setTimeout(() => {
      if (positionFrame !== undefined) window.cancelAnimationFrame(positionFrame);
      document.removeEventListener('scroll', syncHighlightPosition, true);
      window.removeEventListener('resize', syncHighlightPosition);
      highlight.remove();
    }, 260);
  }, 1900);
}

export function highlightJobRequirement(searchTerms: string[]): boolean {
  const terms = searchTerms.map((term) => term.trim()).filter(Boolean);
  if (terms.length === 0 || !document.body) return false;

  const descriptionRoots = Array.from(
    document.querySelectorAll<HTMLElement>(JOB_DESCRIPTION_SELECTORS),
  ).filter(isVisible);
  const target =
    descriptionRoots
      .map((root) => findMatchingElement(root, terms))
      .find(Boolean) || findMatchingElement(document.body, terms);
  if (!target) return false;

  showHighlight(target);
  return true;
}
