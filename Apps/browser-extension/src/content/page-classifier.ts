/**
 * Lightweight page classifier.
 *
 * Runs BEFORE any heavy DOM parsing to decide whether the current page has
 * enough signals to warrant a full job-extraction attempt. The goal is to
 * short-circuit expensive work on obviously non-job pages (news sites, social
 * feeds, developer tools, etc.) without sacrificing recall on legitimate ATS /
 * job-board pages.
 *
 * Heuristics are intentionally cheap — no shadow-DOM traversal, no
 * getComputedStyle calls, no network requests.
 */

export type PageClass =
  | { isJobPage: true; confidence: number; reasons: string[] }
  | { isJobPage: false; confidence: number; reasons: string[]; skipReason: string };

/** Known job-board / ATS hostnames — always attempt parsing. */
const KNOWN_JOB_HOSTS: ReadonlyArray<RegExp> = [
  /^(?:www\.)?linkedin\.com$/,
  /^(?:au\.)?indeed\.com$/,
  /^(?:www\.)?seek\.com(?:\.au)?$/,
  /^(?:www\.)?glassdoor\.com$/,
  /^(?:www\.)?glassdoor\.com\.au$/,
  /^(?:www\.)?seek\.co\.nz$/,
  /^(?:www\.)?myworkdayjobs\.com$/,
  /^(?:www\.)?workday\.com$/,
  /^(?:www\.)?greenhouse\.io$/,
  /^boards\.greenhouse\.io$/,
  /^(?:www\.)?lever\.co$/,
  /^jobs\.lever\.co$/,
  /^(?:www\.)?smartrecruiters\.com$/,
  /^(?:www\.)?ashbyhq\.com$/,
  /^jobs\.ashbyhq\.com$/,
  /^apply\.workable\.com$/,
  /^(?:www\.)?workable\.com$/,
  /^jobs\.jobvite\.com$/,
  /^(?:www\.)?jobvite\.com$/,
  /^(?:www\.)?icims\.com$/,
  /^(?:www\.)?taleo\.net$/,
  /^(?:www\.)?successfactors\.com$/,
  /^(?:www\.)?bamboohr\.com$/,
  /^(?:www\.)?recruitee\.com$/,
  /^(?:www\.)?breezy\.hr$/,
  /^(?:www\.)?welcometothejungle\.com$/,
  /^(?:www\.)?otta\.com$/,
  /^(?:www\.)?seek\.com\.au$/,
  /^(?:www\.)?seek\.co\.nz$/,
  /^(?:www\.)?jora\.com$/,
  /^(?:www\.)?careerone\.com\.au$/,
];

/** URL path patterns strongly associated with individual job postings. */
const JOB_URL_PATTERNS: ReadonlyArray<RegExp> = [
  /[/._-]jobs?[/._?]/i,
  /[/._-]careers?[/._?]/i,
  /[/._-]positions?[/._?]/i,
  /[/._-]vacancies?[/._?]/i,
  /[/._-]roles?[/._?]/i,
  /[/._-]openings?[/._?]/i,
  /[/._-]postings?[/._?]/i,
  /[/._-]requisitions?[/._?]/i,
  /[/._-]apply[/._?]/i,
  /[?&]jk=/i,          // Indeed job key
  /[?&]job_id=/i,
  /[?&]jobId=/i,
  /[?&]jobid=/i,
  /[?&]position=/i,
  /\/viewjob\b/i,
  /\/jobs\/view\//i,
  /\/job-detail\//i,
  /\/job-posting\//i,
  /\/job-description\//i,
];

/** Structural DOM signals: if any of these selectors match we get a bonus. */
const JOB_DOM_SELECTORS = [
  "script[type='application/ld+json']",
  "[data-testid*='job-title' i]",
  "[data-testid*='jobsearch' i]",
  "#jobDescriptionText",
  "[class*='jobsearch-JobInfoHeader' i]",
  "[class*='job-description' i]",
  "[class*='job__title' i]",
  "[class*='posting-headline' i]",
  "#app_body",          // Greenhouse
  ".posting-description", // Lever
  "[data-automation='jobTitle']", // Seek
  "[data-automation='job-detail-title']",
  "[class*='jobs-unified-top-card' i]",  // LinkedIn
  "[class*='job-view-layout' i]",
  "[data-job-id]",
  "[data-jobid]",
  "[id*='job-description' i]",
] as const;

/** Headings that almost always appear on a job detail page. */
const JOB_HEADING_RE =
  /\b(responsibilities|qualifications|requirements|about the role|about the job|position overview|job description|what you.ll do|who you are|key skills|we.re looking for)\b/i;

/**
 * Classify the current page cheaply.
 *
 * Confidence scoring:
 *  - Known job-board host: +5 (auto qualifies)
 *  - Job-like URL path:    +3
 *  - JSON-LD JobPosting:   +4 (auto qualifies)
 *  - DOM structural match: +2 (per hit, capped at +4)
 *  - Job heading in h1/h2: +2
 *
 * Threshold to proceed: confidence >= 3 OR auto-qualify flag set.
 */
export function classifyCurrentPage(): PageClass {
  const url = window.location.href;
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname;

  const reasons: string[] = [];
  let confidence = 0;
  let autoQualify = false;

  // --- 1. Known job-board host check ---
  for (const pattern of KNOWN_JOB_HOSTS) {
    if (pattern.test(hostname)) {
      reasons.push(`已知求职平台域名: ${hostname}`);
      confidence += 5;
      autoQualify = true;
      break;
    }
  }

  // --- 2. JSON-LD JobPosting structured data ---
  const ldScripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']"),
  ).slice(0, 20);
  let hasJobPosting = false;
  for (const script of ldScripts) {
    try {
      const raw = JSON.parse(script.textContent || "");
      const types: string[] = Array.isArray(raw?.["@type"])
        ? raw["@type"]
        : [raw?.["@type"]];
      const graphItems: unknown[] = raw?.["@graph"] ?? [];
      const allTypes = [
        ...types,
        ...graphItems.flatMap((item) =>
          Array.isArray((item as { "@type"?: unknown })["@type"])
            ? ((item as { "@type": string[] })["@type"])
            : [(item as { "@type"?: string })["@type"] ?? ""],
        ),
      ];
      if (allTypes.includes("JobPosting")) {
        hasJobPosting = true;
        break;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  if (hasJobPosting) {
    reasons.push("页面包含 JSON-LD JobPosting 结构化数据");
    confidence += 4;
    autoQualify = true;
  }

  // --- 3. URL path pattern ---
  let urlPatternMatched = false;
  for (const pattern of JOB_URL_PATTERNS) {
    if (pattern.test(pathname) || pattern.test(url)) {
      if (!urlPatternMatched) {
        reasons.push(`URL 路径匹配求职关键词 (${pathname})`);
        urlPatternMatched = true;
      }
      confidence += 3;
      break;
    }
  }

  // --- 4. DOM structural signals (fast querySelector) ---
  let domHits = 0;
  for (const selector of JOB_DOM_SELECTORS) {
    if (document.querySelector(selector)) {
      domHits += 1;
      if (domHits === 1) {
        reasons.push(`DOM 中发现求职页面结构 (${selector})`);
      }
      if (domHits >= 2) break;
    }
  }
  confidence += Math.min(domHits * 2, 4);

  // --- 5. Heading text scan (h1 / h2 only — fast) ---
  const headings = Array.from(document.querySelectorAll<HTMLElement>("h1, h2")).slice(0, 10);
  for (const h of headings) {
    const text = (h.textContent || "").trim();
    if (JOB_HEADING_RE.test(text)) {
      reasons.push(`标题/章节包含求职关键词: "${text.slice(0, 60)}"`);
      confidence += 2;
      break;
    }
  }

  // --- Decision ---
  const THRESHOLD = 3;
  if (autoQualify || confidence >= THRESHOLD) {
    return { isJobPage: true, confidence, reasons };
  }

  const skipReason =
    reasons.length === 0
      ? "页面没有任何求职信号（域名、URL、DOM结构、结构化数据均不匹配）"
      : `置信度不足（${confidence}/${THRESHOLD}）：${reasons.join("；")}`;

  return { isJobPage: false, confidence, reasons, skipReason };
}
