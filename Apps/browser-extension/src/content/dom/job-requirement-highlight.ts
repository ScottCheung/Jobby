/** @format */

import { detectDedicatedPlatform } from '../platforms/provider-routing';
import type { DedicatedPlatform } from '../../shared/contracts/platform';
import { getJobDescriptionRoot } from './job-description-root';
import {
  getAtsProviderDefinition,
  getProviderDefinition,
  isAtsJobPlatform,
} from '../platforms/registry';

const EXCLUDED_CONTAINERS_SELECTOR = [
  'nav',
  'header',
  'footer',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="search"]',
  '[role="complementary"]',
  '.job-card-container',
  '.jobs-search-results-list',
  '.jobs-search-results',
  '.jobsearch-LeftPane',
  '.jobsearch-ResultsList',
  '.search-results',
  '.related-jobs',
  '.recommended-jobs',
  "[data-automation='job-card']",
  "[data-testid='job-card']",
  "[data-test*='job-card' i]",
  '[data-jk]',
  'input',
  'textarea',
  'select',
  'button',
  'form',
].join(', ');

type HighlightTarget = {
  element: HTMLElement;
  range?: Range;
};

export type HighlightJobRequirementResult = {
  highlighted: boolean;
  matchCount: number;
  currentIndex: number;
};

function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type TermOccurrence = {
  term: string;
  index: number;
  length: number;
};

function termMatchAll(
  text: string,
  searchTerms: string[],
): TermOccurrence[] {
  const cleanTerms = Array.from(
    new Set(searchTerms.map((t) => t.trim()).filter(Boolean)),
  ).sort((a, b) => b.length - a.length);

  if (cleanTerms.length === 0 || !text) return [];

  const occurrences: TermOccurrence[] = [];

  for (const cleanTerm of cleanTerms) {
    const escaped = escapeRegExp(cleanTerm).replace(/\s+/g, '\\s+');
    const prefix = /^\w/.test(cleanTerm) ? '\\b' : '';
    const suffix = /\w$/.test(cleanTerm) ? '\\b' : '';
    const regex = new RegExp(`${prefix}${escaped}${suffix}`, 'gi');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchLength = match[0].length;

      const overlaps = occurrences.some(
        (existing) =>
          Math.max(existing.index, matchIndex) <
          Math.min(existing.index + existing.length, matchIndex + matchLength),
      );

      if (!overlaps) {
        occurrences.push({
          term: cleanTerm,
          index: matchIndex,
          length: matchLength,
        });
      }

      if (regex.lastIndex === match.index) {
        regex.lastIndex += 1;
      }
    }
  }

  return occurrences.sort((a, b) => a.index - b.index);
}

function textRangeFor(
  node: Node,
  index: number,
  length: number,
): Range | undefined {
  if (node.nodeType !== Node.TEXT_NODE) return undefined;
  try {
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + length);
    return range;
  } catch {
    return undefined;
  }
}

function isExcludedElement(element: HTMLElement): boolean {
  return Boolean(element.closest(EXCLUDED_CONTAINERS_SELECTOR));
}

function highlightTargetFor(element: HTMLElement): HTMLElement {
  const semanticContainer = element.closest<HTMLElement>(
    'li, p, [role="listitem"], tr, h1, h2, h3, h4, h5, h6, blockquote, dt, dd',
  );
  if (
    semanticContainer &&
    isVisible(semanticContainer) &&
    !isExcludedElement(semanticContainer)
  ) {
    return semanticContainer;
  }
  return element;
}

function findScrollableParent(element: HTMLElement | null): HTMLElement | null {
  let current = element;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const isScrollable =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight;
    if (isScrollable) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function scrollRangeIntoView(range: Range, fallbackElement: HTMLElement): void {
  try {
    const rect = range.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) {
      const scrollContainer = findScrollableParent(
        range.startContainer.parentElement || fallbackElement,
      );
      if (
        scrollContainer &&
        scrollContainer !== document.documentElement &&
        scrollContainer !== document.body
      ) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const relativeTop =
          rect.top - containerRect.top + scrollContainer.scrollTop;
        const targetScrollTop =
          relativeTop - scrollContainer.clientHeight / 2 + rect.height / 2;
        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
        return;
      }

      const targetY =
        rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth',
      });
      return;
    }
  } catch {
    // Fall back if getBoundingClientRect fails
  }

  fallbackElement.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  });
}

function findAllMatchingTargets(
  roots: HTMLElement[],
  searchTerms: string[],
): HighlightTarget[] {
  const targets: HighlightTarget[] = [];
  const seenRanges = new Set<string>();

  for (const root of roots) {
    if (isExcludedElement(root)) continue;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (isExcludedElement(parent)) return NodeFilter.FILTER_REJECT;
          if (!isVisible(parent)) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let node = walker.nextNode();
    while (node) {
      const text = node.textContent || '';
      const parent = node.parentElement;
      if (parent && isVisible(parent) && !isExcludedElement(parent)) {
        const matches = termMatchAll(text, searchTerms);
        for (const match of matches) {
          const range = textRangeFor(node, match.index, match.length);
          if (range) {
            const key = `${match.index}:${match.length}:${node.textContent}`;
            if (!seenRanges.has(key)) {
              seenRanges.add(key);
              targets.push({
                element: highlightTargetFor(parent),
                range,
              });
            }
          }
        }
      }
      node = walker.nextNode();
    }
  }

  return targets;
}

function matchingElements(
  root: ParentNode,
  selectors: readonly string[],
): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const selector of selectors) {
    if (
      root instanceof HTMLElement &&
      root.matches(selector) &&
      isVisible(root) &&
      !isExcludedElement(root)
    ) {
      seen.add(root);
      candidates.push(root);
    }
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>(selector),
    );
    for (const el of elements) {
      if (!seen.has(el) && isVisible(el) && !isExcludedElement(el)) {
        seen.add(el);
        candidates.push(el);
      }
    }
  }

  return candidates;
}

function firstProviderJobRoot(selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const root = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (element) => isVisible(element) && !isExcludedElement(element),
    );
    if (root) return root;
  }
  return null;
}

function getCandidateRoots(platform = detectDedicatedPlatform()): HTMLElement[] {
  if (!platform) return [];

  const candidates: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  const add = (el: HTMLElement | null | undefined) => {
    if (el && isVisible(el) && !isExcludedElement(el) && !seen.has(el)) {
      seen.add(el);
      candidates.push(el);
    }
  };

  const capturedRoot = getJobDescriptionRoot(platform);
  add(capturedRoot);

  if (!isAtsJobPlatform(platform)) {
    const definition = getProviderDefinition(platform);
    if (definition.jobDescriptionRootSelectors) {
      const jobRoot = firstProviderJobRoot(
        definition.jobDescriptionRootSelectors,
      );
      if (jobRoot) {
        const roots = matchingElements(
          jobRoot,
          definition.jobDescriptionSelectors || [],
        );
        for (const r of roots) add(r);
        if (candidates.length > 0) return candidates;
      }
    }
    const roots = matchingElements(
      document,
      definition.jobDescriptionSelectors || [],
    );
    for (const r of roots) add(r);
  } else {
    const definition = getAtsProviderDefinition(platform);
    const jobRoot = firstProviderJobRoot(definition.job.roots);
    if (jobRoot) {
      const roots = matchingElements(jobRoot, definition.job.description);
      for (const r of roots) add(r);
      if (candidates.length > 0) return candidates;
    }
    const roots = matchingElements(document, definition.job.description);
    for (const r of roots) add(r);
  }

  return candidates;
}

const EXCLUDED_CONTROL_ANCESTORS = [
  'nav',
  'header',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="search"]',
  '.job-card-container',
  '.jobs-search-results-list',
  '.jobs-search-results',
  '.jobsearch-LeftPane',
  '.jobsearch-ResultsList',
  '.search-results',
  '.related-jobs',
  '.recommended-jobs',
  "[data-automation='job-card']",
  "[data-testid='job-card']",
  "[data-test*='job-card' i]",
  '[data-jk]',
].join(', ');

function isExcludedControl(element: HTMLElement): boolean {
  return Boolean(element.closest(EXCLUDED_CONTROL_ANCESTORS));
}

function simulateClick(element: HTMLElement): void {
  try {
    element.focus?.();
    const eventInit: MouseEventInit = {
      view: window,
      bubbles: true,
      cancelable: true,
      composed: true,
      buttons: 1,
    };
    element.dispatchEvent(new PointerEvent('pointerdown', eventInit));
    element.dispatchEvent(new MouseEvent('mousedown', eventInit));
    element.dispatchEvent(new PointerEvent('pointerup', eventInit));
    element.dispatchEvent(new MouseEvent('mouseup', eventInit));
    element.click();
  } catch {
    element.click?.();
  }
}

function isCollapsedDescriptionControl(element: HTMLElement): boolean {
  if (element.getAttribute('aria-expanded') === 'true') return false;
  const label = [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.innerText,
    element.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/(?:show|see|read|view)\s+(?:less|fewer)|收起|隐藏/i.test(label)) {
    return false;
  }
  if (/\b(?:company|options?|similar jobs?|applicants?|people)\b/i.test(label)) {
    return false;
  }
  if (
    element.classList.contains('jobs-description__footer-button') ||
    element.classList.contains('show-more-less-html__button--more') ||
    element.classList.contains('show-more-less-html__button') ||
    element.classList.contains('show-more-less-button') ||
    /(?:^|\s)[^\s]*(?:showMore|show_more|show-more|readMore|read_more|read-more|seeMore|see_more)[^\s]*(?:\s|$)/i.test(element.className) ||
    element.getAttribute('data-tracking-control-name')?.includes('show_more') ||
    element.getAttribute('data-control-name')?.includes('show_more') ||
    element.getAttribute('data-control-name') === 'job_details_show_more' ||
    element.getAttribute('data-test')?.includes('show-more') ||
    element.getAttribute('data-test')?.includes('showMore') ||
    element.getAttribute('data-testid')?.includes('show-more') ||
    element.getAttribute('data-testid')?.includes('showMore')
  ) {
    return true;
  }
  if (!label) return false;
  return /\b(?:show|see|read|view)\s+(?:more|all)\b|显示更多|展开全部|展开|更多|查看全部/i.test(
    label,
  );
}

function forceUnclampJobDescription(
  _platform?: DedicatedPlatform | null,
): void {
  const containerSelectors = [
    // LinkedIn
    '.jobs-description__content',
    '.jobs-description__container',
    '.jobs-description',
    '.jobs-box__html-content',
    '.jobs-description-content__text',
    '#job-details',
    '.show-more-less-html',
    '.show-more-less-html__markup',
    '.inline-show-more-less',
    "[data-testid='expandable-text-box']",
    '.jobs-details__main-content',
    '.artdeco-card',
    'article.jobs-description__container',
    'section.jobs-description',
    // Glassdoor
    "[class*='JobDetails_jobDescriptionWrapper']",
    "[class*='JobDetails_jobDescription']",
    "[class*='JobDetails_jobDetailsContainer']",
    "[class*='JobDetails_truncated']",
    "[class*='JobDetails_blur']",
    "[class*='jobDescriptionWrapper']",
    "[data-test='job-description']",
    "[data-test='job-description-container']",
    // Seek / Indeed / ATS / Generic
    "[data-automation='jobDescription']",
    "[data-automation='jobDetails']",
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    "[data-ui='job-description']",
    "[data-testid='jobsearch-jobDescriptionText']",
  ];

  const condensedClassPatterns = [
    /condensed/i,
    /collapsed/i,
    /clamp/i,
    /truncated/i,
    /blur/i,
    /showMore/i,
    /show_more/i,
  ];

  for (const selector of containerSelectors) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of elements) {
      if (isExcludedControl(el)) continue;
      const classesToRemove: string[] = [];
      for (const cls of Array.from(el.classList)) {
        if (condensedClassPatterns.some((pattern) => pattern.test(cls))) {
          classesToRemove.push(cls);
        }
      }
      for (const cls of classesToRemove) {
        el.classList.remove(cls);
      }
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('-webkit-line-clamp', 'none', 'important');
    }
  }
}

export function expandJobDescription(
  platform: DedicatedPlatform | null = detectDedicatedPlatform(),
): boolean {
  const expandCandidates = new Set<HTMLElement>();

  if (platform) {
    try {
      const definition = isAtsJobPlatform(platform as any)
        ? getAtsProviderDefinition(platform as any)
        : getProviderDefinition(platform as any);
      const selectors = (definition as any)?.jobDescriptionExpandSelectors || [];
      for (const selector of selectors) {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
          if (isVisible(el) && !isExcludedControl(el) && isCollapsedDescriptionControl(el)) {
            expandCandidates.add(el);
          }
        }
      }
    } catch {
      // Ignore definition errors
    }
  }

  const commonButtonSelectors = [
    // LinkedIn
    '.jobs-description button',
    '.jobs-description__container button',
    '.jobs-description__content button',
    '#job-details button',
    '.jobs-details__main-content button',
    '.scaffold-layout__detail button',
    '.jobs-search-two-pane__job-details button',
    '.jobs-search__job-details button',
    '.job-view-layout button',
    // Glassdoor
    "[class*='JobDetails_jobDetailsContainer'] button",
    "[class*='JobDetails_jobDescription'] button",
    "[class*='JobDetails_jobDescriptionWrapper'] button",
    "[class*='JobDetails_showMore'] button",
    "[class*='JobDetails_showMore']",
    "button[class*='JobDetails_showMore']",
    "button[class*='ShowMore']",
    "button[class*='showMore']",
    "button[class*='show-more']",
    "[data-test='show-more-button']",
    "[data-test='job-description-show-more']",
    "[data-test='show-more']",
    "[data-test='showMore']",
    "[data-test='job-description'] button",
    // Generic / Seek / Indeed / ATS
    "[data-automation='jobDescription'] button",
    "[data-automation*='showMore']",
    "[data-automation*='toggle']",
    '#jobDescriptionText button',
    '.jobsearch-JobComponent-description button',
    "[data-ui='job-description'] button",
    "[data-testid='expandable-text-box'] button",
  ];

  if (platform !== 'linkedin') {
    for (const sel of commonButtonSelectors) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        if (isVisible(el) && !isExcludedControl(el) && isCollapsedDescriptionControl(el)) {
          expandCandidates.add(el);
        }
      }
    }

    const candidateRoots = getCandidateRoots(platform);
    for (const root of candidateRoots) {
      const parentContainer = root.parentElement || root;
      for (const btn of Array.from(parentContainer.querySelectorAll<HTMLElement>('button, [role="button"]'))) {
        if (isVisible(btn) && !isExcludedControl(btn) && isCollapsedDescriptionControl(btn)) {
          expandCandidates.add(btn);
        }
      }
    }
  }

  let clicked = false;
  for (const control of expandCandidates) {
    simulateClick(control);
    control.setAttribute('aria-expanded', 'true');
    clicked = true;
  }

  forceUnclampJobDescription(platform);

  return clicked || expandCandidates.size > 0;
}

export function expandLinkedInJobDescription(): boolean {
  return expandJobDescription('linkedin');
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

const SKILL_HIGHLIGHT_NAME = 'jobby-skill-navigation';
const SKILL_HIGHLIGHT_ACTIVE_NAME = 'jobby-skill-navigation-active';
const SKILL_HIGHLIGHT_STYLE_ID = 'jobby-skill-highlight-style';
const NAV_FEEDBACK_ID = 'jobby-skill-nav-feedback-root';
let activeHighlightId = 0;
let navFeedbackTimer: number | undefined;

function showTextHighlight(allRanges: Range[], activeRange?: Range): void {
  if (allRanges.length === 0) return;

  if (!document.getElementById(SKILL_HIGHLIGHT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = SKILL_HIGHLIGHT_STYLE_ID;
    style.textContent = `
      ::highlight(${SKILL_HIGHLIGHT_NAME}) {
        background-color: rgba(250, 204, 21, 0.45);
        color: #000000;
      }
      ::highlight(${SKILL_HIGHLIGHT_ACTIVE_NAME}) {
        background-color: #facc15;
        color: #000000;
      }
    `;
    document.head.appendChild(style);
  }

  const cssHighlights =
    (window as any).CSS?.highlights ||
    (typeof CSS !== 'undefined' ? (CSS as any).highlights : undefined);
  const HighlightClass =
    (window as any).Highlight || (globalThis as any).Highlight;
  if (!cssHighlights || !HighlightClass) return;

  const highlightId = ++activeHighlightId;
  const otherRanges = activeRange
    ? allRanges.filter((r) => r !== activeRange)
    : allRanges;

  if (otherRanges.length > 0) {
    cssHighlights.set(SKILL_HIGHLIGHT_NAME, new HighlightClass(...otherRanges));
  } else {
    cssHighlights.delete(SKILL_HIGHLIGHT_NAME);
  }

  if (activeRange) {
    cssHighlights.set(
      SKILL_HIGHLIGHT_ACTIVE_NAME,
      new HighlightClass(activeRange),
    );
  }

  window.setTimeout(() => {
    if (activeHighlightId === highlightId) {
      cssHighlights.delete(SKILL_HIGHLIGHT_NAME);
      cssHighlights.delete(SKILL_HIGHLIGHT_ACTIVE_NAME);
    }
  }, 4000);
}

function showInPageNavFeedback(
  term: string,
  currentIndex: number,
  totalMatches: number,
): void {
  if (navFeedbackTimer !== undefined) {
    window.clearTimeout(navFeedbackTimer);
  }

  let host = document.getElementById(NAV_FEEDBACK_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = NAV_FEEDBACK_ID;
    host.style.cssText =
      'position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: none !important; width: 0 !important; height: 0 !important; border: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important;';
    host.attachShadow({ mode: 'open' });
  }

  const rootParent = document.documentElement || document.body;
  if (host.parentElement !== rootParent || rootParent.lastElementChild !== host) {
    rootParent.appendChild(host);
  }

  const shadow = host.shadowRoot;
  if (!shadow) return;

  const existingPill = shadow.getElementById('pill');
  const existingTerm = shadow.getElementById('feedback-term');
  const existingCounter = shadow.getElementById('feedback-counter');

  if (existingPill && existingTerm && existingCounter) {
    existingTerm.textContent = term;
    existingCounter.textContent = `${currentIndex} / ${totalMatches}`;
    existingPill.classList.add('visible');

    if (typeof existingCounter.animate === 'function') {
      existingCounter.animate(
        [
          { transform: 'scale(1.12)' },
          { transform: 'scale(1)' },
        ],
        { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
  } else {
    let logoUrl = '/favicon.svg';
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        logoUrl = chrome.runtime.getURL('favicon.svg');
      }
    } catch {
      logoUrl = '/favicon.svg';
    }

    shadow.innerHTML = `
    <style>
      :host {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        overflow: visible !important;
      }
      .feedback-overlay {
        position: fixed !important;
        top: 24px !important;
        left: 0 !important;
        right: 0 !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
      }
      .feedback-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        padding: 1.5px;
        background: linear-gradient(
          90deg,
          #10b981,
          #06b6d4,
          #8b5cf6,
          #ec4899,
          #f59e0b,
          #10b981
        );
        background-size: 300% 100%;
        animation: aiFlow 6s linear infinite;
        box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.75),
                    0 0 24px 2px rgba(6, 182, 212, 0.35);
        opacity: 0;
        transform: translateY(-12px) scale(0.94);
        transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
        pointer-events: auto;
        will-change: transform, opacity;
      }
      .feedback-wrapper.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      /* Atmospheric Diffusion Glow */
      .feedback-wrapper::before {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 9999px;
        background: linear-gradient(
          90deg,
          rgba(16, 185, 129, 0.75),
          rgba(6, 182, 212, 0.75),
          rgba(139, 92, 246, 0.75),
          rgba(236, 72, 153, 0.65),
          rgba(245, 158, 11, 0.75),
          rgba(16, 185, 129, 0.75)
        );
        background-size: 300% 100%;
        animation: aiFlow 6s linear infinite, aiDiffuse 3.6s ease-in-out infinite alternate;
        filter: blur(12px);
        z-index: -1;
        pointer-events: none;
      }
      /* Inner Dark Glass Pill */
      .badge-content {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 4px 4px 4px 8px;
        border-radius: 9999px;
        background: rgba(10, 15, 26, 0.94);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: #ffffff;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14.5px;
        font-weight: 600;
        letter-spacing: -0.01em;
        position: relative;
        overflow: hidden;
        white-space: nowrap;
      }
      /* Shimmer sweep effect */
      .badge-content::after {
        content: '';
        position: absolute;
        top: 0;
        left: -120%;
        width: 60%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.16),
          transparent
        );
        transform: skewX(-20deg);
        animation: aiShimmer 4.5s ease-in-out infinite;
        pointer-events: none;
      }
      .term-container {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      }
      .brand-logo {
        width: 20px;
        height: 20px;
        border-radius: 5px;
        object-fit: contain;
        flex-shrink: 0;
        user-select: none;
        pointer-events: none;
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
      }
      /* Yellow Index Counter Pill - Concentric & Equidistant */
      .highlight-pill {
        background: linear-gradient(135deg, #fef08a 0%, #facc15 50%, #eab308 100%);
        color: #09090b;
        height: 28px;
        padding: 0 12px;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 13.5px;
        font-weight: 800;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.5px;
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.6),
                    0 2px 6px rgba(234, 179, 8, 0.35);
        flex-shrink: 0;
        will-change: transform;
      }
      @keyframes aiFlow {
        0% { background-position: 0% 50%; }
        100% { background-position: 300% 50%; }
      }
      @keyframes aiDiffuse {
        0% {
          opacity: 0.5;
          filter: blur(10px);
        }
        100% {
          opacity: 0.85;
          filter: blur(16px);
        }
      }
      @keyframes aiShimmer {
        0% { left: -120%; }
        30%, 100% { left: 220%; }
      }
    </style>
    <div class="feedback-overlay">
      <div class="feedback-wrapper" id="pill">
        <div class="badge-content">
          <span class="term-container">
            <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="Jobby" />
            <span id="feedback-term">${escapeHtml(term)}</span>
          </span>
          <span class="highlight-pill" id="feedback-counter">${currentIndex} / ${totalMatches}</span>
        </div>
      </div>
    </div>
  `;

    const pill = shadow.getElementById('pill');
    window.requestAnimationFrame(() => {
      pill?.classList.add('visible');
    });
  }

  const pill = shadow.getElementById('pill');
  navFeedbackTimer = window.setTimeout(() => {
    if (pill) pill.classList.remove('visible');
    window.setTimeout(() => {
      host?.remove();
    }, 360);
  }, 4000);
}

let lastSearchKey = '';
let currentMatchIndex = 0;

export async function highlightJobRequirement(
  searchTerms: string[],
): Promise<HighlightJobRequirementResult> {
  const terms = searchTerms.map((term) => term.trim()).filter(Boolean);
  if (terms.length === 0 || !document.body) {
    return { highlighted: false, matchCount: 0, currentIndex: 0 };
  }

  const platform = detectDedicatedPlatform();
  const isLinkedIn =
    platform === 'linkedin' ||
    /(?:^|\.)linkedin\.com$/i.test(window.location.hostname);
  const isGlassdoor =
    platform === 'glassdoor' ||
    /(?:^|\.)glassdoor\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i.test(
      window.location.hostname,
    );

  const expanded = expandJobDescription(platform);
  if (expanded) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    await nextAnimationFrame();
  }

  const candidateRoots = getCandidateRoots(platform);
  let targets = findAllMatchingTargets(candidateRoots, terms);

  if (targets.length === 0) {
    if (isLinkedIn) {
      const fallbackRoots = Array.from(
        document.querySelectorAll<HTMLElement>(
          '#job-details, .jobs-description__content, .jobs-description__container, .jobs-box__html-content, .jobs-search__job-details, .jobs-details__main-content, .job-view-layout, .jobs-details',
        ),
      ).filter((el) => isVisible(el) && !isExcludedElement(el));

      targets = findAllMatchingTargets(fallbackRoots, terms);
    } else if (isGlassdoor) {
      const fallbackRoots = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[class*='JobDetails_jobDescription'], [class*='JobDetails_jobDescriptionWrapper'], [class*='JobDetails_jobDetailsContainer'], [data-test='job-description']",
        ),
      ).filter((el) => isVisible(el) && !isExcludedElement(el));

      targets = findAllMatchingTargets(fallbackRoots, terms);
    }
  }

  if (targets.length === 0) {
    return { highlighted: false, matchCount: 0, currentIndex: 0 };
  }

  const searchKey = terms
    .map((t) => t.toLowerCase())
    .sort()
    .join('::');

  if (searchKey === lastSearchKey) {
    currentMatchIndex = (currentMatchIndex + 1) % targets.length;
  } else {
    lastSearchKey = searchKey;
    currentMatchIndex = 0;
  }

  const target = targets[currentMatchIndex] ?? targets[0];
  if (!target) {
    return { highlighted: false, matchCount: 0, currentIndex: 0 };
  }

  const allRanges = targets
    .map((t) => t.range)
    .filter((r): r is Range => Boolean(r));

  if (target.range) {
    scrollRangeIntoView(target.range, target.element);
  } else {
    target.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }

  showTextHighlight(allRanges, target.range);
  showInPageNavFeedback(terms[0] || '', currentMatchIndex + 1, targets.length);

  return {
    highlighted: true,
    matchCount: targets.length,
    currentIndex: currentMatchIndex + 1,
  };
}
