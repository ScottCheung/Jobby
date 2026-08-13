/** @format */

import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { PageInspection } from '../../shared/contracts/page-inspection';

const CONTAINER_ID = 'jobby-in-page-score-card';

let currentInspection: PageInspection | null = null;
let currentPlan: ValidatedApplicationPlanResponse | null = null;
let observer: MutationObserver | null = null;
let retryTimer: number | undefined = undefined;

function isVisible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.hidden || html.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(html);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function findPrimaryHeading(): HTMLElement | null {
  const candidateSelectors = [
    // LinkedIn
    '.job-details-jobs-unified-top-card__job-title-link',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title-link',
    '.jobs-unified-top-card__job-title',
    '.jobs-details__main-content h1',
    "[data-testid='job-title']",
    "main h1 a[href*='/jobs/view/']",
    // Seek
    "[data-automation='job-detail-title']",
    "[data-automation='job-title']",
    // Indeed
    "[data-testid='jobsearch-JobInfoHeader-title']",
    '.jobsearch-JobInfoHeader-title',
    "h1[class*='job-title' i]",
    "h1[class*='jobTitle' i]",
    // Generic data attributes used by ATSs (Greenhouse, Lever, Workday, etc.)
    "[data-testid*='job-title' i]",
    "[data-qa*='job-title' i]",
    "[data-test*='job-title' i]",
    "[data-automation*='job-title' i]",
    "[class*='job-title' i]",
    "[class*='jobtitle' i]",
    "[class*='job__title' i]",
    "[class*='posting-headline' i] h2",
    '.posting-headline h2',
    '.app-title',
    // Fallback H1s
    'main h1',
    'article h1',
    "[role='main'] h1",
    'h1',
  ];

  for (const selector of candidateSelectors) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of elements) {
      if (isVisible(el)) return el;
    }
  }
  return null;
}

export function renderScoreCard(): void {
  const heading = findPrimaryHeading();
  if (!heading) return;

  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    // Insert immediately below the heading
    heading.insertAdjacentElement('afterend', container);
  }

  const decision = currentPlan?.plan?.decision;
  const candidate = currentPlan?.plan?.candidate;
  const score = decision?.score ?? candidate?.priority_score ?? candidate?.match_score;
  const action = decision?.action;
  const explanation = decision?.explanation;

  const hasScore = typeof score === 'number' && !isNaN(score);
  const percentage = hasScore ? Math.round(score * 100) : 0;

  const matchLabel =
    !hasScore ? 'Calculating Score...'
    : percentage >= 75 ? 'Highly Recommended'
    : percentage >= 50 ? 'Recommended'
    : 'Not Recommended';

  const defaultExplanation =
    hasScore ?
      'Match evaluation completed.'
    : 'Analyzing job skills and requirements...';
  const displayExplanation = explanation || defaultExplanation;

  const actionStyle =
    action === 'apply' ?
      'background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3);'
    : action === 'review' ?
      'background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3);'
    : 'background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3);';

  container.innerHTML = `
    <style>
      #jobby-in-page-score-card {
        margin: 10px 0 14px 0;
        padding: 12px 14px;
        border-radius: 12px;
        background: var(--jobby-card-bg, rgba(255, 255, 255, 0.96));
        border: 1px solid var(--primary, oklch(0.45 0.15 160));
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        font-family: Inter, system-ui, -apple-system, sans-serif;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 12px;
        box-sizing: border-box;
        max-width: 100%;
        z-index: 10;
        position: relative;
      }
      .dark #jobby-in-page-score-card {
        background: #0f172a;
        color: #f8fafc;
      }
      #jobby-in-page-score-card .jobby-score-circle {
        width: 44px;
        height: 44px;
        border-radius: 9999px;
        background: var(--primary, oklch(0.45 0.15 160));
        color: var(--primary-foreground, #ffffff);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 12px;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      }
      #jobby-in-page-score-card .jobby-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }
      #jobby-in-page-score-card .jobby-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #jobby-in-page-score-card .jobby-match-title {
        font-weight: 700;
        font-size: 12px;
        color: currentColor;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #jobby-in-page-score-card .jobby-action-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1.2;
      }
      #jobby-in-page-score-card .jobby-explanation {
        font-size: 11px;
        line-height: 1.4;
        color: #64748b;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .dark #jobby-in-page-score-card .jobby-explanation {
        color: #94a3b8;
      }
    </style>
    <div class="jobby-score-circle">
      ${hasScore ? `${percentage}%` : '...'}
    </div>
    <div class="jobby-info">
      <div class="jobby-header-row">
        <span class="jobby-match-title">${matchLabel}</span>
        ${action ? `<span class="jobby-action-badge" style="${actionStyle}">${action}</span>` : ''}
      </div>
      <p class="jobby-explanation">${displayExplanation}</p>
    </div>
  `;
}

export function injectInPageScoreCard(
  inspection?: PageInspection | null,
  plan?: ValidatedApplicationPlanResponse | null
): void {
  if (inspection !== undefined) currentInspection = inspection;
  if (plan !== undefined) currentPlan = plan;

  if (currentInspection && currentInspection.kind !== 'job') {
    const existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();
    return;
  }

  renderScoreCard();

  // Schedule bounded retries if element is not in DOM yet
  if (!document.getElementById(CONTAINER_ID)) {
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      renderScoreCard();
      if (!document.getElementById(CONTAINER_ID) && attempts < 10) {
        retryTimer = window.setTimeout(retry, 200);
      }
    };
    retryTimer = window.setTimeout(retry, 150);
  }

  // Set up DOM observer if not already active to handle SPA updates
  if (!observer && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      const existing = document.getElementById(CONTAINER_ID);
      const heading = findPrimaryHeading();
      if (heading && (!existing || existing.previousElementSibling !== heading)) {
        renderScoreCard();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
