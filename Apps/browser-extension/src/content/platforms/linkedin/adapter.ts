/** @format */

import type { LinkedInJobSnapshot } from '../../../shared/contracts/page-inspection';
import type {
  LinkedInApplicationAction,
  LinkedInApplicationResult,
} from '../../../shared/contracts/linkedin';
import { extractLinkedInPostedDate } from './date-parser';
import { extractStructuredText } from '../../text-utils';
import type { LinkedInJobApiData } from './api-client';
import { captureJobDate } from '../../../shared/utils/date-formatter';

type LinkedInJobData = Omit<
  LinkedInJobSnapshot,
  'platform' | 'url' | 'technologies'
>;

const SELECTORS = {
  title: [
    '.job-details-jobs-unified-top-card__job-title-link',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title-link',
    '.jobs-unified-top-card__job-title',
    '.jobs-details__main-content h1',
    "[data-testid='job-title']",
    "main h1 a[href*='/jobs/view/']",
    "main h1",
    "h1.t-24",
    "h1[class*='job-title']",
    "h1[class*='topcard']",
    "h1",
  ],
  company: [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    "[class*='company-name'] a",
    "[class*='company-name']",
    "[class*='employer-name']",
    "a[href*='/company/']",
    "[aria-label^='Company,']",
    "[data-tracking-control-name*='company']",
  ],
  location: [
    '.job-details-jobs-unified-top-card__primary-description-container',
    '.jobs-unified-top-card__primary-description-container',
    '.job-details-jobs-unified-top-card__bullet',
    "[class*='job-details'] [class*='primary-description']",
    "[class*='job-details'] [class*='location']",
    "[class*='topcard'] [class*='location']",
  ],
  description: [
    '#job-details',
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description__container .jobs-box__html-content',
    '.jobs-description__container .jobs-description-content__text',
    '.jobs-description__container',
    '.jobs-description',
    '.jobs-description-content__text',
    '.jobs-description__content',
    "[data-test-id='job-details-description']",
    "[data-testid='job-details-description']",
    "[data-testid='expandable-text-box']",
    "[class*='job-details__description']",
    "[class*='jobs-box__html-content']",
  ],
  easyApply: [
    'button.jobs-apply-button',
    '.jobs-apply-button button',
    '.jobs-apply-button',
    'button.jobs-apply-button--top-card',
    '.jobs-apply-button--top-card button',
    'button.jobs-s-apply',
    "button[aria-label*='Easy Apply']",
    "button[aria-label*='Easy apply']",
    "button[aria-label*='简单申请']",
    "button[aria-label*='轻松应聘']",
    "a[aria-label*='Easy Apply']",
    '[data-live-test-job-apply]',
    "a[href*='/jobs/view/'][href*='/apply']",
  ],
  applicationRoot: [
    ".jobs-easy-apply-modal",
    ".jobs-easy-apply-content",
    "#artdeco-modal-outlet .artdeco-modal",
    "#artdeco-modal-outlet [role='dialog']",
    ".artdeco-modal[role='dialog']",
    "[role='dialog'][aria-label*='Apply']",
    "[role='dialog'][aria-label*='申请']",
    "[role='dialog'][aria-label*='应聘']",
    "div[role='dialog']",
    "form.jobs-easy-apply-form",
    "#artdeco-modal-outlet [data-test-modal]",
    "#artdeco-modal-outlet [data-test-modal-container]",
    "[data-test-modal]",
  ],
  nextAction: [
    "button[aria-label*='Continue']",
    "button[aria-label*='Next']",
    "button[aria-label*='Review']",
    "button[aria-label*='继续']",
    "button[aria-label*='下一步']",
    ".jobs-easy-apply-modal footer button.artdeco-button--primary",
    "#artdeco-modal-outlet footer button.artdeco-button--primary",
    "[role='dialog'] footer button.artdeco-button--primary",
    "[role='dialog'] button.artdeco-button--primary",
  ],
  previousAction: [
    "button[aria-label*='Back']",
    "button[aria-label*='Previous']",
    "button[aria-label*='返回']",
    "button[aria-label*='上一步']",
    "button[aria-label*='back']",
    "button[aria-label*='previous']",
  ],
  submitAction: [
    "[data-live-test-easy-apply-submit-button]",
    "button[aria-label*='Submit application']",
    "button[aria-label*='Submit']",
    "button[aria-label*='提交应用']",
    "button[aria-label*='提交申请']",
    "button[aria-label*='提交']",
  ],
} as const;

const APPLICATION_FIELD_SELECTOR =
  "input:not([type='hidden']), select, textarea";

const APPLICATION_ROOT_SELECTOR = [
  ...SELECTORS.applicationRoot,
  "#artdeco-modal-outlet .artdeco-modal",
  "#artdeco-modal-outlet [role='dialog']",
  "#artdeco-modal-outlet [data-test-modal]",
  "#artdeco-modal-outlet [data-test-modal-container]",
  "[role='dialog']",
  "[data-test-modal]",
].filter((selector, index, selectors) => selectors.indexOf(selector) === index);

const TITLE_METADATA = new Set([
  'easy apply',
  'full-time',
  'hybrid',
  'internship',
  'linkedin',
  'no response insights available yet',
  'on-site',
  'part-time',
  'remote',
  'save',
  'temporary',
  'contract',
  'jobs',
  'job',
  'job details',
  'show all',
  'show more',
  'show less',
  'see all',
  'see more',
  'view all',
  'read more',
]);

const INVALID_TITLE_PATTERNS = [
  /\b\d+\s+(?:connections?|alumni|school|employees?|reactions?|comments?|shares?|likes?|views?|reposts?)\b/i,
  /\b(?:connections?|alumni|reactions?|comments?|shares?|likes?|reposts?)\b/i,
  /\b(?:about\s+the\s+job|job\s+description|job\s+details|hiring\s+team)\b/i,
  /\b(?:people\s+also\s+viewed|similar\s+jobs|response\s+insights)\b/i,
  /\b(?:easy\s+apply|apply\s+now|apply\s+on\s+company)\b/i,
  /\b(?:company\s+logo|promoted|posted)\b/i,
  /\b(?:show\s+(?:all|more|less)|see\s+(?:all|more)|view\s+(?:all|more)|read\s+more)\b/i,
];

function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Search-result URLs carry `currentJobId`, tracking parameters, and sometimes
 * a stale route. Persisting this canonical URL makes every downstream action
 * target one job detail page instead of returning to a multi-card search view.
 */
export function canonicalLinkedInJobUrl(jobId: string): string {
  return `https://www.linkedin.com/jobs/view/${jobId}/`;
}

const NOISY_ELEMENT_TAGS = new Set([
  'BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT'
]);

function extractNodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  const el = node as HTMLElement;
  if (NOISY_ELEMENT_TAGS.has(el.tagName)) {
    return '';
  }
  if (el.getAttribute('role') === 'img') {
    return '';
  }
  if (el.tagName === 'A' && el.getAttribute('aria-label')?.includes('Verified')) {
    return '';
  }
  const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
  if (className.includes('visually-hidden') || className.includes('sr-only')) {
    return '';
  }
  let text = '';
  for (let child = el.firstChild; child; child = child.nextSibling) {
    text += extractNodeText(child);
  }
  return text;
}

function extractCleanElementText(element: Element): string {
  if (!element) return '';
  let rawText = cleanText(extractNodeText(element));
  if (!rawText) {
    rawText = cleanText(element.textContent);
  }

  return rawText
    .replace(
      /\b(?:show\s+(?:all|more|less)|see\s+(?:all|more)|view\s+(?:all|more)|read\s+more)\b/gi,
      "",
    )
    .trim();
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  // In headless test environments (happy-dom), getBoundingClientRect always returns 0x0.
  if (rect.width === 0 && rect.height === 0) {
    return true;
  }
  return rect.width > 0 && rect.height > 0;
}

function isEnabled(element: HTMLElement): boolean {
  return (
    !(element instanceof HTMLButtonElement && element.disabled) &&
    element.getAttribute('aria-disabled') !== 'true'
  );
}

function deepElements(root: ParentNode): HTMLElement[] {
  const result: HTMLElement[] = [];
  const visited = new Set<ParentNode>();

  const visit = (scope: ParentNode) => {
    if (visited.has(scope)) return;
    visited.add(scope);
    Array.from(scope.querySelectorAll<HTMLElement>("*")).forEach((element) => {
      result.push(element);
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };

  visit(root);
  return result;
}

function deepQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  return deepElements(root).filter((element) => element.matches(selector));
}

function deepFirst(root: ParentNode, selector: string): HTMLElement | null {
  return deepQueryAll(root, selector)[0] || null;
}

function firstText(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const element = deepFirst(root, selector);
    if (!element) continue;
    const text = extractCleanElementText(element);
    if (text) return text;
  }
  return '';
}

function descriptionText(element: HTMLElement): string {
  return extractStructuredText(element);
}

function firstDescriptionText(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const element = deepFirst(root, selector);
    if (!element) continue;
    const text = descriptionText(element);
    if (text) return text;
  }
  return '';
}

function descriptionFromHeading(root: ParentNode): string {
  const heading = deepElements(root).find((element) => {
    const text = cleanText(element.textContent);
    if (text.length > 80) return false;
    return /^(?:about\s+the\s+job|job\s+description|job\s+details|职位描述|工作描述)$/i.test(text);
  });
  if (!heading) return '';

  const container = heading.closest<HTMLElement>(
    "section, article, .jobs-description, .jobs-description__container, [data-test-id*='description' i], [data-testid*='description' i]",
  ) || heading.parentElement;
  if (!container) return '';

  const text = descriptionText(container);
  const headingText = cleanText(heading.textContent);
  let body = text;
  if (headingText && body.toLowerCase().startsWith(headingText.toLowerCase())) {
    body = body.slice(headingText.length).trim();
  }
  return body.length >= 40 ? body : '';
}

function findVisible(
  root: ParentNode,
  selectors: readonly string[],
  predicate: (element: HTMLElement) => boolean = () => true,
): HTMLElement | null {
  const elements = deepElements(root);
  for (const selector of selectors) {
    const element = elements.find(
      (candidate) =>
        candidate.matches(selector) &&
        predicate(candidate) && isVisible(candidate) && isEnabled(candidate),
    );
    if (element) return element;
  }
  return null;
}

function normalized(value: string): string {
  return cleanText(value).toLowerCase();
}

/**
 * Returns the right-side job detail panel on search-results pages, or the
 * full detail root on a direct job page. Unlike `getJobDetailRoot()`, this
 * function never falls back to `main` — which on search pages wraps BOTH the
 * left job-list sidebar and the right detail panel.
 *
 * Priority: most-specific detail-panel selectors first; `main` only as
 * absolute last resort when we're on a direct /jobs/view/ page where `main`
 * is safe (there is no list sidebar).
 */
function getJobDetailPanel(): HTMLElement | null {
  // These selectors resolve to the right-side detail panel only.
  // They do NOT match list-card elements.
  const directSelectors = [
    '.jobs-search__job-details--detail-view',
    '.jobs-search__job-details',
    '.jobs-details__main-content',
    '.job-details-jobs-unified-top-card__container',
    '.job-details-jobs-unified-top-card',
    '.jobs-unified-top-card__container',
  ];
  for (const sel of directSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  // On a direct /jobs/view/<id> page there is no left sidebar, so `main` is safe.
  const isDirectJobPage = /\/jobs\/view\/\d+/i.test(window.location.pathname);
  if (isDirectJobPage) {
    return document.querySelector<HTMLElement>('main');
  }
  return null;
}

function getJobDetailRoot(): ParentNode {
  return getJobDetailPanel() || document.querySelector<HTMLElement>(
    ".jobs-details__main-content, .job-details-jobs-unified-top-card, main",
  ) || document;
}

const JOB_ROLE_KEYWORDS = /\b(?:engineer|developer|architect|lead|principal|senior|junior|mid|staff|manager|director|consultant|analyst|specialist|designer|administrator|coordinator|officer|executive|head|vp|intern|graduate|associate|agent|advisor|operator|technician|contractor)\b/i;

function isLikelyTitle(value: string, company?: string): boolean {
  const text = cleanText(value);
  if (!text || text.length < 2 || text.length > 180) return false;
  if (TITLE_METADATA.has(text.toLowerCase())) return false;
  if (INVALID_TITLE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (isPureLocation(text)) return false;
  if (/[·•]/.test(text) || /\b(?:ago|applicants?)\b/i.test(text)) return false;

  if (company) {
    const normText = normalized(text);
    const normComp = normalized(company);
    if (normText === normComp) return false;
    if (!JOB_ROLE_KEYWORDS.test(text) && normComp.length > 3 && (normComp.includes(normText) || normText.includes(normComp))) {
      return false;
    }
  }

  return true;
}

function isPureLocation(value: string): boolean {
  const text = cleanText(value);
  if (!text) return false;
  if (JOB_ROLE_KEYWORDS.test(text)) return false;
  return /^[A-Za-z\s.-]+,\s*(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT|Australia|New South Wales|Victoria|Queensland|Western Australia|South Australia|Tasmania|Australian Capital Territory|Northern Territory)(?:,\s*Australia)?$/i.test(text);
}

function titleFromMain(company?: string): string {
  const root = getJobDetailRoot();
  const companyName = company || firstText(root, SELECTORS.company) || firstText(document, SELECTORS.company);
  if (!companyName) return "";

  const paragraphs = Array.from(root.querySelectorAll<HTMLElement>("p"))
    .map((element) => cleanText(element.textContent))
    .filter(Boolean);
  const companyIndex = paragraphs.findIndex((text) => text === companyName);
  if (companyIndex < 0) return "";

  return paragraphs.slice(companyIndex + 1, companyIndex + 5).find((t) => isLikelyTitle(t, companyName)) || "";
}

function titleFromDocument(jobId: string, company?: string): string {
  if (!jobId) return "";
  const rawTitle = cleanText(document.title);
  const parts = rawTitle.split(/\s*\|\s*/);
  for (const part of parts) {
    const cleanedPart = part.replace(/\s*-\s*LinkedIn$/i, "").replace(/\b(?:LinkedIn|Search|Jobs?)\b/gi, "").trim();
    const candidate = cleanedPart.split(/\s+hiring\s+/i)[1] || cleanedPart.split(/\s+is\s+hiring\s+/i)[1] || cleanedPart;
    const titleOnly = candidate.split(/\s+in\s+[^|-]+$/i)[0]?.trim() || candidate;
    if (isLikelyTitle(titleOnly, company)) return titleOnly;
  }
  return "";
}

function titleFromJobLink(jobId: string, company?: string): string {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>([
    '.job-details-jobs-unified-top-card__job-title-link',
    '.jobs-unified-top-card__job-title-link',
    "main h1 a[href*='/jobs/view/']",
  ].join(', ')));
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (!new RegExp(`/jobs/view/${jobId}(?:/|\\?|$)`, "i").test(href)) continue;
    const text = extractCleanElementText(link);
    if (isLikelyTitle(text, company)) return text;
  }
  return "";
}

function titleFromPage(jobId: string, company?: string): string {
  const jobLinkTitle = titleFromJobLink(jobId, company);
  if (jobLinkTitle) return jobLinkTitle;

  const root = getJobDetailRoot();
  const isDirectJobPage = new RegExp(`/jobs/view/${jobId}(?:/|$)`, 'i').test(
    window.location.pathname,
  );
  if (isDirectJobPage) {
    const documentTitle = titleFromDocument(jobId, company);
    if (documentTitle) return documentTitle;
  }

  const selectedTitle = firstText(root, SELECTORS.title);
  if (isLikelyTitle(selectedTitle, company)) return selectedTitle;

  return titleFromMain(company) || titleFromDocument(jobId, company);
}

function locationFromPage(): string | undefined {
  const root = getJobDetailRoot();
  const selected = firstText(root, SELECTORS.location) || firstText(document, SELECTORS.location);
  if (selected) return selected.split(/\s*[·•]\s*/)[0] || undefined;

  const metadata = Array.from(root.querySelectorAll<HTMLElement>("p"))
    .map((element) => cleanText(element.textContent))
    .find((text) => /\s*[·•]\s*/.test(text) && /\b(?:ago|applicants?)\b/i.test(text));
  return metadata?.split(/\s*[·•]\s*/)[0] || undefined;
}

/**
 * Selectors that LinkedIn uses for the top-card metadata row containing the
 * post date (typically "Location · N days ago · N applicants").
 * Listed in order of descending specificity.
 *
 * NOTE: `span.tvm__text` is intentionally excluded — it is used in ALL job
 * cards across the page, so it matches list-card elements before the detail
 * panel when root is broad.
 */
const DATE_METADATA_SELECTORS = [
  // Detail-panel-only primary/tertiary description containers
  '.job-details-jobs-unified-top-card__primary-description-without-tagline',
  '.job-details-jobs-unified-top-card__primary-description-container',
  '.job-details-jobs-unified-top-card__primary-description',
  '.jobs-unified-top-card__primary-description-container',
  '.jobs-unified-top-card__primary-description',
  '.job-details-jobs-unified-top-card__tertiary-description-container',
  '.jobs-unified-top-card__tertiary-description-container',
  '.job-details-jobs-unified-top-card__subtitle-primary-grouping',
  '.jobs-unified-top-card__subtitle-primary-grouping',
  // aria-labelled elements are reliable because they're authored on purpose
  '[aria-label*="posted" i]',
  '[aria-label*="reposted" i]',
];

/**
 * Find the list-card container element for the given job ID.
 *
 * LinkedIn renders each job card in the left sidebar as an `<li>` with a
 * `data-occludable-job-id` attribute equal to the numeric job ID.  Falling
 * back to walking up from any matching `<a>` is used when that attribute is
 * absent (e.g. older LinkedIn layouts).
 */
function findListCard(externalId: string): HTMLElement | null {
  // Most reliable: LinkedIn stamps the job ID directly onto the list item.
  const byAttr = (document.querySelector<HTMLElement>(
    `[data-occludable-job-id="${externalId}"], [data-job-id="${externalId}"]`,
  ));
  if (byAttr) return byAttr;

  // Fallback: walk up from a link whose href contains the job ID.
  // IMPORTANT: only consider links that are NOT inside the right-side detail
  // panel — detail-panel links are title/company links, not list-card links.
  const panel = getJobDetailPanel();
  const jobLinkPattern = new RegExp(`/jobs/view/${externalId}(?:/|\\?|$)`, 'i');
  const allLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[href*='/jobs/view/']"),
  ).filter((link) => {
    if (!jobLinkPattern.test(link.getAttribute('href') || '')) return false;
    // Exclude links that live inside the detail panel
    if (panel && panel.contains(link)) return false;
    return true;
  });

  for (const link of allLinks) {
    let el: HTMLElement | null = link.parentElement;
    for (let d = 0; el && d < 10; d += 1) {
      if (el.matches(
        '.job-card-container, .jobs-search-results__list-item, ' +
        'li[data-occludable-job-id], li[data-job-id], article.job-card-container',
      )) {
        return el;
      }
      el = el.parentElement;
    }
  }
  return null;
}

/**
 * Extract the job posting date from the currently selected job's top card.
 *
 * Strategy (ordered by reliability):
 *
 * 1. `<time datetime="...">` inside the exact list-card for this job — the
 *    most precise source because LinkedIn stamps each card's <time> with the
 *    job's own ISO date, completely independent of the detail panel.
 * 2. `<time datetime="...">` inside the detail panel only.
 * 3. Known top-card metadata selectors inside the detail panel.
 * 4. Leaf `<span>` nodes inside the top-card within the detail panel.
 * 5. Leaf `<span>` nodes inside the matched list-card (relative text fallback).
 */
function datePostedFromPage(externalId: string): string | undefined {
  // ── 1. List-card <time datetime> for this specific job ────────────────────
  // LinkedIn places a <time datetime="YYYY-MM-DDTHH:MM:SSZ"> inside each job
  // card in the sidebar.  Because we locate the card by externalId (not by
  // position), this read is always scoped to the correct job even when the
  // detail panel has not yet rendered its own date metadata.
  const listCard = externalId ? findListCard(externalId) : null;
  if (listCard) {
    for (const timeEl of Array.from(listCard.querySelectorAll<HTMLElement>('time'))) {
      const datetime = timeEl.getAttribute('datetime');
      if (extractLinkedInPostedDate(datetime)) return datetime || undefined;
      const text = cleanText(timeEl.textContent);
      if (extractLinkedInPostedDate(text)) return text;
    }
  }

  // ── 2–4. Detail-panel scans ───────────────────────────────────────────────
  // Use the precise detail-panel root so we never accidentally scan the
  // left-side job-list sidebar which contains dates for other jobs.
  const panel = getJobDetailPanel();
  const root: ParentNode = panel || getJobDetailRoot();

  // ── 2. <time datetime="..."> inside detail panel ──────────────────────────
  for (const timeNode of Array.from(root.querySelectorAll<HTMLElement>('time'))) {
    const dt = timeNode.getAttribute('datetime');
    if (extractLinkedInPostedDate(dt)) return dt || undefined;
    const text = cleanText(timeNode.textContent);
    if (extractLinkedInPostedDate(text)) return text;
  }

  // ── 3. Known metadata selectors scoped to detail panel ───────────────────
  for (const selector of DATE_METADATA_SELECTORS) {
    for (const element of deepQueryAll(root, selector)) {
      const candidates = [
        element.getAttribute('aria-label'),
        element.getAttribute('datetime'),
        cleanText(element.textContent),
      ];
      const raw = candidates.find((candidate) => extractLinkedInPostedDate(candidate));
      if (raw) return raw;
    }
  }

  // ── 4. Leaf spans inside the detail-panel top-card ───────────────────────
  const topCard = (root as HTMLElement).querySelector?.<HTMLElement>(
    '.job-details-jobs-unified-top-card, .jobs-unified-top-card, ' +
    '.job-details-jobs-unified-top-card__primary-description-container, ' +
    '.jobs-unified-top-card__primary-description-container',
  ) || root;
  const leafSpans = Array.from((topCard as HTMLElement).querySelectorAll<HTMLElement>('span, time, font'))
    .filter((el) => el.childElementCount === 0);
  for (const element of leafSpans) {
    const text = cleanText(element.textContent);
    if (text && text.length <= 80) {
      const date = extractLinkedInPostedDate(text);
      if (date) return text;
    }
  }

  // ── 5. List-card leaf-span fallback (relative text) ──────────────────────
  // If the list card had no <time datetime>, scan its leaf spans for a
  // relative expression like "2 days ago".  This is the last resort because
  // LinkedIn sometimes prepends "Viewed · " before the actual date text.
  if (listCard) {
    const cardLeafs = Array.from(listCard.querySelectorAll<HTMLElement>('span, time'))
      .filter((el) => el.childElementCount === 0);
    for (const leaf of cardLeafs) {
      const text = cleanText(leaf.textContent);
      if (text && text.length <= 80) {
        const date = extractLinkedInPostedDate(text);
        if (date) return text;
      }
    }
  }

  return undefined;
}

export class LinkedInAdapter {
  readonly platformName = 'linkedin' as const;
  private applicationRootCache: HTMLElement | null | undefined;
  private applicationActionCache = new Map<LinkedInApplicationAction, HTMLElement | null>();

  jobIdFromUrl(url: string): string {
    const match = url.match(/\/jobs\/view\/(\d+)/i);
    if (match?.[1]) return match[1];

    try {
      const parsed = new URL(url);
      const currentJobId = parsed.searchParams.get('currentJobId') || parsed.searchParams.get('jobId');
      if (currentJobId && /^\d+$/.test(currentJobId)) return currentJobId;
    } catch {}

    // Fallback 1: Extract from active or selected job card in the search list
    const selectedEl = document.querySelector<HTMLElement>(
      '.jobs-search-results-list__list-item--active [data-job-id], ' +
      '.jobs-search-results-list__list-item--active [data-occludable-job-id], ' +
      '.job-card-container--clickable[data-job-id], ' +
      '[data-occludable-job-id], ' +
      '[data-job-id], ' +
      '[data-current-job-id]',
    );
    if (selectedEl) {
      const domJobId =
        selectedEl.getAttribute('data-job-id') ||
        selectedEl.getAttribute('data-occludable-job-id') ||
        selectedEl.getAttribute('data-current-job-id');
      if (domJobId && /^\d+$/.test(domJobId)) return domJobId;
    }

    // Fallback 2: Extract from detail panel job links
    const detailPanelLink = document.querySelector<HTMLAnchorElement>(
      ".jobs-search__job-details a[href*='/jobs/view/'], " +
      ".job-details-jobs-unified-top-card a[href*='/jobs/view/'], " +
      "main a[href*='/jobs/view/']",
    );
    if (detailPanelLink) {
      const linkMatch = (detailPanelLink.getAttribute('href') || '').match(/\/jobs\/view\/(\d+)/i);
      if (linkMatch?.[1]) return linkMatch[1];
    }

    return '';
  }

  isJobPageUrl(url: string): boolean {
    return Boolean(this.jobIdFromUrl(url));
  }

  readJob(url: string, apiData?: LinkedInJobApiData | null): LinkedInJobData | null {
    const externalId = this.jobIdFromUrl(url);
    if (!externalId) return null;
    if (!this.hasCurrentJobReference(externalId)) return null;

    const root = getJobDetailRoot();
    const company = firstText(root, SELECTORS.company) || firstText(document, SELECTORS.company) || "Unknown company";
    const title = titleFromPage(externalId, company);
    if (!title) return null;

    const description =
      firstDescriptionText(root, SELECTORS.description) ||
      firstDescriptionText(document, SELECTORS.description) ||
      descriptionFromHeading(root) ||
      descriptionFromHeading(document);

    const apiHasPostingDate = Boolean(apiData?.firstPostedAt || apiData?.lastPostedAt);
    const rawDatePosted = apiHasPostingDate ? undefined : datePostedFromPage(externalId);
    const capturedDate = rawDatePosted ? captureJobDate(rawDatePosted) : undefined;
    const postingDateRaw = capturedDate || apiData?.postingDateRaw ? {
      ...(capturedDate ? { label: capturedDate.rawValue } : {}),
      ...(apiData?.postingDateRaw ?? {}),
    } : undefined;

    // ── Easy Apply: API is authoritative when available ───────────────────────
    const easyApply = apiData?.easyApply ?? Boolean(this.findEasyApplyTrigger());

    return {
      externalId,
      title,
      company,
      location: apiData?.location || locationFromPage(),
      firstPostedAt: apiData?.firstPostedAt ?? apiData?.lastPostedAt ?? capturedDate?.postedAt,
      lastPostedAt: apiData?.lastPostedAt ?? apiData?.firstPostedAt ?? capturedDate?.postedAt,
      postingObservedAt: capturedDate?.observedAt ?? apiData?.postingObservedAt,
      isReposted: apiHasPostingDate ? apiData?.isReposted : capturedDate?.isReposted,
      postingDateRaw,
      description: description || undefined,
      easyApply,
      ...(apiData?.workType ? { workType: apiData.workType } : {}),
      ...(apiData?.experienceLevel ? { experienceLevel: apiData.experienceLevel } : {}),
    };
  }

  getApplicationRoot(): HTMLElement | null {
    // A jobs search page can expose form-like filters before Easy Apply opens.
    // If that broad container was cached, it remains connected and visible
    // underneath the modal. Prefer the current "Apply to …" heading's narrow
    // container on every read so background search controls never leak into
    // the application field list.
    const headingRoot = this.findApplicationRootFromHeading();
    if (headingRoot) {
      if (this.applicationRootCache !== headingRoot) {
        this.applicationActionCache.clear();
      }
      this.applicationRootCache = headingRoot;
      return headingRoot;
    }
    if (
      this.applicationRootCache &&
      this.applicationRootCache.isConnected &&
      isVisible(this.applicationRootCache)
    ) {
      return this.applicationRootCache;
    }
    // Do not hold on to a negative result: LinkedIn often creates the modal
    // after the initial inspection request has already run.
    this.applicationRootCache = undefined;
    const candidates = this.applicationRootCandidates();

    // LinkedIn can finish inserting the modal before its first paint. An
    // explicitly active data-test container is a stronger signal than a zero
    // bounding rect during that transition.
    const activeRoot = candidates.find(
      (candidate) =>
        this.isEasyApplyRoot(candidate) && this.isExplicitlyActiveModal(candidate),
    );
    if (activeRoot) {
      this.applicationRootCache = activeRoot;
      return activeRoot;
    }

    const modalRoot =
      candidates.find(
        (candidate) =>
          this.isEasyApplyRoot(candidate) &&
          isVisible(candidate) &&
          isEnabled(candidate) &&
          !this.hasHiddenModalAncestor(candidate),
      ) || null;
    if (modalRoot) {
      this.applicationRootCache = modalRoot;
      return modalRoot;
    }

    this.applicationRootCache = this.findFullPageApplicationRoot();
    return this.applicationRootCache;
  }

  invalidateApplicationRootCache(): void {
    this.applicationRootCache = undefined;
    this.applicationActionCache.clear();
  }

  invalidateApplicationActionCache(): void {
    this.applicationActionCache.clear();
  }

  getCachedApplicationRoot(): HTMLElement | null | undefined {
    return this.applicationRootCache;
  }

  hasEasyApplyAction(): boolean {
    return Boolean(this.findEasyApplyTrigger());
  }

  isFullPageApplicationFlow(): boolean {
    try {
      const value = new URL(window.location.href).searchParams.get('openSDUIApplyFlow');
      return value === 'true' || value === '1';
    } catch {
      return false;
    }
  }

  applicationFormDiagnostic(): string {
    const containers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#artdeco-modal-outlet [data-test-modal-container]',
      ),
    );
    const candidates = this.applicationRootCandidates();
    const visibleCandidates = candidates.filter(
      (candidate) =>
        isVisible(candidate) && !this.hasHiddenModalAncestor(candidate),
    );
    const easyApplyModals = document.querySelectorAll(
      '.jobs-easy-apply-modal',
    ).length;
    const activeContainers = containers.filter(
      (container) => container.getAttribute('aria-hidden') !== 'true',
    ).length;
    const root = this.getApplicationRoot();
    const modalOutlet = document.querySelector<HTMLElement>('#artdeco-modal-outlet');
    const fieldScope = root || modalOutlet || document;
    const allFields = Array.from(
      fieldScope.querySelectorAll<HTMLElement>(APPLICATION_FIELD_SELECTOR),
    );
    const visibleFields = allFields.filter((field) => isVisible(field));
    const rootClasses = root && typeof root.className === 'string'
      ? root.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      : '';
    const rootDescription = root
      ? `${root.tagName.toLowerCase()}${rootClasses ? `.${rootClasses}` : ''}`
      : 'none';
    const fieldScopeDescription = root
      ? 'application root'
      : modalOutlet
        ? 'modal outlet fallback'
        : 'document fallback';
    return `诊断：modal outlet ${modalOutlet ? 1 : 0}；SDUI 全页流 ${this.isFullPageApplicationFlow() ? 1 : 0}；候选 dialog ${visibleCandidates.length}/${candidates.length}；活动 modal 容器 ${activeContainers}/${containers.length}；Easy Apply class ${easyApplyModals}；application root ${rootDescription}；表单字段 ${visibleFields.length}/${allFields.length}（scope: ${fieldScopeDescription}）。`;
  }

  getEasyApplyUrl(): string | undefined {
    const trigger = this.findEasyApplyTrigger();
    if (!(trigger instanceof HTMLAnchorElement)) return undefined;
    return trigger.href || undefined;
  }

  getCurrentApplicationAction(
    action: LinkedInApplicationAction,
  ): HTMLElement | null {
    const cached = this.applicationActionCache.get(action);
    if (cached && cached.isConnected && isVisible(cached) && isEnabled(cached)) {
      return cached;
    }
    this.applicationActionCache.delete(action);
    const root = this.getApplicationRoot();
    if (!root) {
      return null;
    }
    let result: HTMLElement | null = null;
    if (action === 'submit') {
      result = (
        findVisible(root, SELECTORS.submitAction) ||
        findVisible(
          root,
          [
            'button.artdeco-button--primary',
            'button[type="submit"]',
            'footer button.artdeco-button--primary',
            'footer button',
            'button',
            '[role="button"]',
          ],
          (candidate) => {
            const label = cleanText(
              candidate.textContent || candidate.getAttribute('aria-label'),
            );
            return /(?:submit|提交|应聘|申请)/i.test(label);
          },
        )
      );
    } else if (action === 'previous') {
      result = (
        findVisible(root, SELECTORS.previousAction) ||
        findVisible(root, ['button', 'footer button'], (candidate) => {
          const label = cleanText(
            candidate.textContent || candidate.getAttribute('aria-label'),
          );
          return /(?:back|previous|上一步|返回)/i.test(label);
        }) ||
        findVisible(
          document,
          [
            "button[aria-label*='Back to previous step']",
            "button[aria-label*='Back']",
            "button[aria-label*='Previous']",
          ],
          (candidate) => /(?:back|previous|上一步|返回)/i.test(
            cleanText(candidate.textContent || candidate.getAttribute('aria-label')),
          ),
        )
      );
    } else {
      const submitBtn = this.getCurrentApplicationAction('submit');
      result = findVisible(root, SELECTORS.nextAction, (candidate) => {
        if (candidate === submitBtn) return false;
        const label = cleanText(
          candidate.textContent || candidate.getAttribute('aria-label'),
        );
        if (/(?:submit|提交|应聘|申请)/i.test(label)) return false;
        return true;
      });
      if (!result) {
        result = findVisible(
          root,
          ['button', '[role="button"]'],
          (candidate) => {
            if (candidate === submitBtn) return false;
            const label = cleanText(
              candidate.textContent || candidate.getAttribute('aria-label'),
            );
            return (
              /(?:continue|next|review|继续|下一步|审核|检查)/i.test(label) &&
              !/(?:submit|提交|应聘|申请)/i.test(label)
            );
          },
        );
      }
    }
    this.applicationActionCache.set(action, result);
    return result;
  }

  getCurrentApplicationActionLabel(): string | undefined {
    const submit = this.getCurrentApplicationAction('submit');
    const next = this.getCurrentApplicationAction('next');
    const previous = this.getCurrentApplicationAction('previous');
    const action = submit || next || previous;
    if (!action) return undefined;
    return (
      cleanText(action.textContent || action.getAttribute('aria-label')) ||
      undefined
    );
  }

  getCurrentApplicationActionKind(): "next" | "submit" | undefined {
    const submit = this.getCurrentApplicationAction('submit');
    if (submit) {
      return 'submit';
    }
    if (this.getCurrentApplicationAction('next')) return 'next';
    return undefined;
  }

  async openApplication(): Promise<LinkedInApplicationResult> {
    const currentUrl = window.location.href;
    if (this.getApplicationRoot()) {
      return {
        status: 'already_open',
        message: 'LinkedIn Easy Apply is already open.',
        url: currentUrl,
      };
    }

    let trigger = this.findEasyApplyTrigger();
    if (!trigger) {
      trigger = await this.waitForEasyApplyTrigger();
    }
    if (!trigger) {
      return {
        status: 'unavailable',
        message: 'LinkedIn Easy Apply is not available on this page.',
        url: currentUrl,
      };
    }

    try {
      trigger.scrollIntoView({ block: 'center', inline: 'nearest' });
    } catch {}
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    trigger.click();

    if (await this.waitForApplicationRoot()) {
      return {
        status: 'opened',
        message: 'LinkedIn Easy Apply form is open.',
        url: window.location.href,
      };
    }

    return {
      status: 'clicked',
      message: 'LinkedIn Easy Apply click was dispatched; waiting for the application form.',
      url: window.location.href,
    };
  }

  async clickApplicationAction(
    action: LinkedInApplicationAction,
  ): Promise<LinkedInApplicationResult> {
    const currentUrl = window.location.href;
    const root = this.getApplicationRoot();
    // The final confirmation screen can be rendered in a lightweight modal
    // wrapper that does not satisfy the normal form-root heuristic. Its
    // explicit Submit application button remains a safe live fallback.
    const documentSubmit =
      action === 'submit'
        ? findVisible(
            document,
            [
              ...SELECTORS.submitAction,
              "button[type='submit']",
            ],
            (candidate) => /(?:submit|提交|应聘|申请)/i.test(
              cleanText(candidate.textContent || candidate.getAttribute('aria-label')),
            ),
          )
        : null;
    if (!root && !documentSubmit) {
      return {
        status: 'not_open',
        message: 'Open the LinkedIn Easy Apply form first.',
        url: currentUrl,
      };
    }

    // A previous step can have cached "Back" as unavailable. Resolve it
    // against the current modal just before the user action.
    this.invalidateApplicationActionCache();
    const button = this.getCurrentApplicationAction(action) || documentSubmit;
    if (!button) {
      return {
        status: 'unavailable',
        message:
          action === 'submit'
            ? 'The LinkedIn submit action is not available yet.'
            : action === 'previous'
            ? 'The LinkedIn previous action is not available.'
            : 'The LinkedIn next action is not available yet.',
        url: currentUrl,
      };
    }

    const actionLabel =
      cleanText(button.textContent || button.getAttribute('aria-label')) ||
      undefined;
    try {
      button.scrollIntoView({ block: 'center', inline: 'nearest' });
    } catch {}
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    button.click();
    if (action === 'submit' && !(await this.waitForSubmissionConfirmation())) {
      return {
        status: 'unavailable',
        message:
          'LinkedIn did not confirm the submission; review the application form before retrying.',
        url: currentUrl,
        ...(actionLabel ? { actionLabel } : {}),
      };
    }
    const message =
      action === 'submit'
        ? 'LinkedIn application submitted.'
        : action === 'previous'
        ? 'LinkedIn application moved to the previous step.'
        : 'LinkedIn application moved to the next step.';
    return {
      status: 'clicked',
      message,
      url: currentUrl,
      ...(actionLabel ? { actionLabel } : {}),
    };
  }

  private findEasyApplyTrigger(): HTMLElement | null {
    return findVisible(document, SELECTORS.easyApply, (element) => {
      const label = cleanText(
        element.getAttribute('aria-label') || element.textContent,
      );
      const href = element.getAttribute('href') || '';
      const classList =
        typeof element.className === 'string' ? element.className : '';
      const isExternal =
        /apply\s+on\s+company|continue\s+to\s+company|external/i.test(label);
      if (isExternal) return false;

      const isEasyApplyText = /(?:easy\s*apply|简单申请|輕鬆應聘|轻松应聘|一键应聘|一键申请)/i.test(
        label,
      );
      const isEasyApplyUrl = /\/jobs\/view\/\d+\/apply(?:[/?#]|$)/i.test(href);
      const isApplyButtonClass =
        classList.includes('jobs-apply-button') ||
        classList.includes('jobs-s-apply') ||
        Boolean(element.closest('.jobs-apply-button'));

      // LinkedIn uses the same presentation classes for external applications.
      // A class-only match is safe only when LinkedIn's Easy Apply test hook is present.
      const hasEasyApplyTestHook = element.hasAttribute('data-live-test-job-apply');
      return isEasyApplyText || isEasyApplyUrl || (isApplyButtonClass && hasEasyApplyTestHook);
    });
  }

  private isEasyApplyRoot(element: HTMLElement): boolean {
    const className = typeof element.className === 'string' ? element.className : '';
    if (/jobs-easy-apply-(?:modal|content|form)/i.test(className)) return true;

    const label = cleanText(
      `${element.getAttribute('aria-label') || ''} ${deepFirst(element, 'h1, h2, [role="heading"]')?.textContent || ''}`,
    );
    if (/(?:easy\s*apply|简单申请|輕鬆應聘|轻松应聘|一键应聘|一键申请)/i.test(label)) {
      return true;
    }

    // Current LinkedIn variants title the application modal "Apply to <company>"
    // instead of "Easy Apply". Require a real form control to avoid treating a
    // generic confirmation dialog as an application form.
    const hasApplicationField = Boolean(deepFirst(element, APPLICATION_FIELD_SELECTOR));
    if (/(?:apply\s+to|申请(?:职位|工作)?|应聘)/i.test(label) && hasApplicationField) {
      return true;
    }

    const hasApplicationAction = Boolean(deepFirst(
      element,
      'form.jobs-easy-apply-form, [data-live-test-easy-apply-submit-button], [data-live-test-easy-apply-next-button], button[aria-label*="Continue"], button[aria-label*="Next"], button[aria-label*="Review"], button[aria-label*="Submit"]',
    ));
    const isModalLike = element.matches(
      '[role="dialog"], .artdeco-modal, [data-test-modal], [data-test-modal-container], .jobs-easy-apply-content, form.jobs-easy-apply-form',
    );
    return isModalLike && (hasApplicationField || hasApplicationAction);
  }

  private applicationRootCandidates(): HTMLElement[] {
    const seen = new Set<HTMLElement>();
    const candidates: HTMLElement[] = [];
    const elements = deepElements(document);
    for (const selector of APPLICATION_ROOT_SELECTOR) {
      elements.filter((element) => element.matches(selector)).forEach((candidate) => {
        if (seen.has(candidate)) return;
        seen.add(candidate);
        candidates.push(candidate);
      });
    }
    return candidates;
  }

  private findFullPageApplicationRoot(): HTMLElement | null {
    if (!this.isFullPageApplicationFlow()) return null;

    const seen = new Set<HTMLElement>();
    const candidates: HTMLElement[] = [];
    const elements = deepElements(document);
    const addCandidates = (selector: string) => {
      elements.filter((element) => element.matches(selector)).forEach((candidate) => {
        if (seen.has(candidate)) return;
        seen.add(candidate);
        candidates.push(candidate);
      });
    };

    // SDUI may render a normal form, an application-labelled container, or a
    // main content region without the legacy modal outlet.
    addCandidates('form');
    addCandidates("[data-testid*='application'], [data-test*='application']");
    addCandidates('main');

    return (
      candidates.find(
        (candidate) =>
          isVisible(candidate) &&
          !this.hasHiddenModalAncestor(candidate) &&
          (this.hasVisibleApplicationField(candidate) ||
            this.hasApplicationAction(candidate)),
      ) || null
    );
  }

  private findApplicationRootFromHeading(): HTMLElement | null {
    const heading = deepElements(document).find((element) => {
      if (!isVisible(element)) return false;
      const text = cleanText(element.textContent);
      return /^apply\s+to\s+.+/i.test(text) || /^申请(?:职位|工作)?\s*.+/.test(text);
    });
    if (!heading) return null;

    const semanticModal = heading.closest<HTMLElement>(
      '[role="dialog"], [aria-modal="true"], .jobs-easy-apply-modal, .artdeco-modal, [data-test-modal], [data-test-modal-container]',
    );
    if (
      semanticModal &&
      isVisible(semanticModal) &&
      !this.hasHiddenModalAncestor(semanticModal) &&
      this.hasVisibleApplicationField(semanticModal) &&
      this.hasApplicationAction(semanticModal)
    ) {
      return semanticModal;
    }

    let candidate: HTMLElement | null = heading;
    for (let depth = 0; candidate && depth < 9; depth += 1) {
      if (
        isVisible(candidate) &&
        this.hasVisibleApplicationField(candidate) &&
        this.hasApplicationAction(candidate)
      ) {
        return candidate;
      }
      const currentRoot: Node = candidate.getRootNode();
      const shadowHost: HTMLElement | null =
        currentRoot instanceof ShadowRoot && currentRoot.host instanceof HTMLElement
          ? currentRoot.host
          : null;
      candidate = candidate.parentElement || shadowHost;
    }
    return null;
  }

  private hasVisibleApplicationField(root: ParentNode): boolean {
    return deepQueryAll(root, APPLICATION_FIELD_SELECTOR).some((field) => isVisible(field));
  }

  private hasApplicationAction(root: ParentNode): boolean {
    return deepQueryAll(root, 'button, [role="button"]').some((button) => {
      const label = cleanText(
        button.textContent || button.getAttribute('aria-label'),
      );
      return (
        isVisible(button) &&
        /(?:continue|next|review|submit|申请|提交|继续|下一步|审核|检查)/i.test(label)
      );
    });
  }

  private hasHiddenModalAncestor(element: HTMLElement): boolean {
    let current: HTMLElement | null = element;
    while (current) {
      if (current.getAttribute('aria-hidden') === 'true') return true;
      current = current.parentElement;
    }
    return false;
  }

  private isExplicitlyActiveModal(element: HTMLElement): boolean {
    if (this.hasHiddenModalAncestor(element)) return false;
    const container = element.closest<HTMLElement>(
      '[data-test-modal-container], [data-test-modal]',
    );
    if (!container) return false;
    const ariaHidden = container.getAttribute('aria-hidden');
    return ariaHidden === 'false' || (ariaHidden === null && isVisible(container));
  }

  private async waitForApplicationRoot(): Promise<HTMLElement | null> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const root = this.getApplicationRoot();
      if (root) return root;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    return this.getApplicationRoot();
  }

  private async waitForEasyApplyTrigger(): Promise<HTMLElement | null> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const trigger = this.findEasyApplyTrigger();
      if (trigger) return trigger;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    }
    return this.findEasyApplyTrigger();
  }

  private hasCurrentJobReference(jobId: string): boolean {
    if (!jobId) return false;
    const currentUrl = window.location.href;
    const jobPattern = new RegExp(`/jobs/view/${jobId}(?:/|\\?|$)`, 'i');
    if (
      jobPattern.test(currentUrl) ||
      new URLSearchParams(window.location.search).get('currentJobId') === jobId
    ) {
      return true;
    }

    const titleLink = document.querySelector<HTMLAnchorElement>(
      "main h1 a[href*='/jobs/view/'], main [role='heading'][aria-level='1'] a[href*='/jobs/view/']",
    );
    if (titleLink) return jobPattern.test(titleLink.getAttribute('href') || '');

    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href*='/jobs/view/']"),
    );
    if (!links.length) return true;
    return links.some((link) =>
      jobPattern.test(link.getAttribute('href') || ''),
    );
  }

  private async waitForSubmissionConfirmation(): Promise<boolean> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (this.hasSubmissionConfirmation()) return true;
      if (attempt > 0 && !this.getApplicationRoot()) return true;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    return !this.getApplicationRoot() || this.hasSubmissionConfirmation();
  }

  private hasSubmissionConfirmation(): boolean {
    const bodyText = cleanText(document.body?.textContent);
    return /application (?:was )?sent|application submitted|you(?:'|’)ve applied/i.test(
      bodyText,
    );
  }
}

export const linkedinAdapter = new LinkedInAdapter();
