const CONTAINER_ID = "jobby-in-page-score-card";
let currentInspection = null;
let currentPlan = null;
let observer = null;
let retryTimer = void 0;
function isVisible(element) {
  const html = element;
  if (html.hidden || html.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(html);
  return style.display !== "none" && style.visibility !== "hidden";
}
export function findPrimaryHeading() {
  const candidateSelectors = [
    // LinkedIn
    ".job-details-jobs-unified-top-card__job-title-link",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title-link",
    ".jobs-unified-top-card__job-title",
    ".jobs-details__main-content h1",
    "[data-testid='job-title']",
    "main h1 a[href*='/jobs/view/']",
    // Seek
    "[data-automation='job-detail-title']",
    "[data-automation='job-title']",
    // Indeed
    "[data-testid='jobsearch-JobInfoHeader-title']",
    ".jobsearch-JobInfoHeader-title",
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
    ".posting-headline h2",
    ".app-title",
    // Fallback H1s
    "main h1",
    "article h1",
    "[role='main'] h1",
    "h1"
  ];
  for (const selector of candidateSelectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    for (const el of elements) {
      if (isVisible(el)) return el;
    }
  }
  return null;
}
export function renderScoreCard() {
  const heading = findPrimaryHeading();
  if (!heading) return;
  let host = document.getElementById(CONTAINER_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = CONTAINER_ID;
    host.attachShadow({ mode: "open" });
    heading.insertAdjacentElement("afterend", host);
  }
  const shadow = host.shadowRoot;
  if (!shadow) return;
  const decision = currentPlan?.plan?.decision;
  const candidate = currentPlan?.plan?.candidate;
  const score = decision?.score ?? candidate?.priority_score ?? candidate?.match_score;
  const action = decision?.action;
  const explanation = decision?.explanation;
  const hasScore = typeof score === "number" && !isNaN(score);
  const percentage = hasScore ? Math.round(score * 100) : 0;
  const matchLabel = !hasScore ? "Calculating Score..." : percentage >= 75 ? "Highly Recommended" : percentage >= 50 ? "Recommended" : "Not Recommended";
  const defaultExplanation = hasScore ? "Match evaluation completed." : "Analyzing job skills and requirements...";
  const displayExplanation = explanation || defaultExplanation;
  const actionStyle = action === "apply" ? "background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3);" : action === "review" ? "background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3);" : "background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3);";
  const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  shadow.innerHTML = `
    <style>
      :host {
        display: block;
        all: initial;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .score-card {
        margin: 10px 0 14px 0;
        padding: 12px 14px;
        border-radius: 12px;
        background: ${isDark ? "#0f172a" : "rgba(255, 255, 255, 0.98)"};
        border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.1)"};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        color: ${isDark ? "#f8fafc" : "#0f172a"};
        display: flex;
        align-items: center;
        gap: 12px;
        box-sizing: border-box;
        max-width: 100%;
        position: relative;
        z-index: 10;
        backdrop-filter: blur(8px);
      }
      .jobby-score-circle {
        width: 44px;
        height: 44px;
        border-radius: 9999px;
        background: #0d9488;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(13, 148, 136, 0.35);
      }
      .jobby-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1;
        min-width: 0;
      }
      .jobby-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .jobby-match-title {
        font-weight: 700;
        font-size: 13px;
        color: currentColor;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .jobby-action-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 2px 8px;
        border-radius: 6px;
        line-height: 1.2;
      }
      .jobby-explanation {
        font-size: 11.5px;
        line-height: 1.4;
        color: ${isDark ? "#94a3b8" : "#64748b"};
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    </style>
    <div class="score-card">
      <div class="jobby-score-circle">
        ${hasScore ? `${percentage}%` : "..."}
      </div>
      <div class="jobby-info">
        <div class="jobby-header-row">
          <span class="jobby-match-title">${matchLabel}</span>
          ${action ? `<span class="jobby-action-badge" style="${actionStyle}">${action}</span>` : ""}
        </div>
        <p class="jobby-explanation">${displayExplanation}</p>
      </div>
    </div>
  `;
}
export function injectInPageScoreCard(inspection, plan) {
  if (inspection !== void 0) currentInspection = inspection;
  if (plan !== void 0) currentPlan = plan;
  if (currentInspection && currentInspection.kind !== "job") {
    const existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();
    return;
  }
  renderScoreCard();
  if (!document.getElementById(CONTAINER_ID)) {
    if (retryTimer !== void 0) window.clearTimeout(retryTimer);
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
  if (!observer && typeof MutationObserver !== "undefined") {
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
