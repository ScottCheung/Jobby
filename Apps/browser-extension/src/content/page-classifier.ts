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

/** Dedicated ATS hostnames — almost every page on these subdomains is a job / application. */
const DEDICATED_ATS_HOSTS: ReadonlyArray<RegExp> = [
  /^(?:www\.)?myworkdayjobs\.com$/,
  /^(?:[a-z0-9-]+\.)+myworkdayjobs\.com$/,
  /^(?:[a-z0-9-]+\.)+myworkday\.com$/,
  /^boards\.greenhouse\.io$/,
  /^job-boards\.greenhouse\.io$/,
  /^jobs\.lever\.co$/,
  /^jobs\.eu\.lever\.co$/,
  /^jobs\.ashbyhq\.com$/,
  /^apply\.workable\.com$/,
  /^jobs\.jobvite\.com$/,
  /^(?:www\.)?taleo\.net$/,
  /^(?:[a-z0-9-]+\.)+taleo\.net$/,
  /^(?:www\.)?icims\.com$/,
  /^(?:[a-z0-9-]+\.)+icims\.com$/,
  /^(?:www\.)?bamboohr\.com$/,
  /^(?:[a-z0-9-]+\.)+bamboohr\.(?:com|co\.uk)$/,
  /(?:^|\.)(?:successfactors|sapsf)\.(?:com|eu)$/,
  /(?:^|\.)(?:oraclecloud|fa\.ocs\.oraclecloud)\.com$/,
  /^(?:www\.)?recruitee\.com$/,
  /^(?:www\.)?breezy\.hr$/,
  /^(?:www\.)?jobs\.smartrecruiters\.com$/,
  /^careers\.smartrecruiters\.com$/,
  /^ats\.rippling\.com$/,
  /^(?:www\.)?recruitcrm\.io$/,
  /^app\.vbench\.com\.au$/,
  /(?:^|\.)t1cloud\.com$/,
];

export interface MajorPlatformRule {
  name: string;
  hostRegex: RegExp;
  /** Paths that are strictly non-job pages (e.g., help center, user feed, messaging, profiles). */
  nonJobPatterns: ReadonlyArray<RegExp>;
  /** Path/URL patterns that strongly indicate an individual job posting on this platform. */
  jobPatterns: ReadonlyArray<RegExp>;
  /** Description for skipReason when nonJobPatterns match. */
  nonJobDescription: (pathname: string) => string;
}

export const MAJOR_PLATFORM_RULES: ReadonlyArray<MajorPlatformRule> = [
  {
    name: "LinkedIn",
    hostRegex: /^(?:[a-z0-9-]+\.)*linkedin\.com$/i,
    nonJobPatterns: [
      /^\/help(?:\/|$)/i,
      /^\/feed(?:\/|$)/i,
      /^\/in\//i,
      /^\/messaging(?:\/|$)/i,
      /^\/notifications(?:\/|$)/i,
      /^\/learning(?:\/|$)/i,
      /^\/mynetwork(?:\/|$)/i,
      /^\/sales(?:\/|$)/i,
      /^\/recruiter(?:\/|$)/i,
      /^\/settings(?:\/|$)/i,
      /^\/psettings(?:\/|$)/i,
      /^\/checkpoint(?:\/|$)/i,
      /^\/pulse(?:\/|$)/i,
      /^\/groups(?:\/|$)/i,
      /^\/events(?:\/|$)/i,
      /^\/company\/(?:[^/]+\/?$|[^/]+\/(?:about|life|people|posts|videos|insights)\/?$)/i,
    ],
    jobPatterns: [
      /\/jobs\//i,
      /\/jobs$/i,
      /\/jobs\/view\//i,
      /\/jobs\/search\//i,
      /\/jobs\/collections\//i,
      /[?&](?:currentJobId|jobId)=\d+/i,
    ],
    nonJobDescription: (pathname) =>
      /^\/help/i.test(pathname)
        ? "LinkedIn Help page is not a job listing"
        : /^\/feed/i.test(pathname)
        ? "LinkedIn Feed is not a job listing"
        : /^\/in\//i.test(pathname)
        ? "LinkedIn Profile page is not a job listing"
        : `LinkedIn non-job page (${pathname}) is not a job listing`,
  },
  {
    name: "SEEK",
    hostRegex: /^(?:[a-z0-9-]+\.)*seek\.(?:com(?:\.au)?|co\.nz)$/i,
    nonJobPatterns: [
      /^\/profile(?:\/|$)/i,
      /^\/career-advice(?:\/|$)/i,
      /^\/companies(?:\/|$)/i,
      /^\/saved-searches(?:\/|$)/i,
      /^\/saved-jobs(?:\/|$)/i,
      /^\/applied-jobs(?:\/|$)/i,
      /^\/employer(?:\/|$)/i,
      /^\/support(?:\/|$)/i,
      /^\/help(?:\/|$)/i,
      /^\/?$/i,
    ],
    jobPatterns: [
      /\/job\/\d+/i,
      /\/jobs(?:\/|\?|$)/i,
      /-jobs(?:\/|\?|$)/i,
      /[?&]jobId=\d+/i,
    ],
    nonJobDescription: (pathname) =>
      /^\/profile/i.test(pathname)
        ? "SEEK Profile page is not a job listing"
        : /^\/career-advice/i.test(pathname)
        ? "SEEK Career Advice article is not a job listing"
        : `SEEK non-job page (${pathname}) is not a job listing`,
  },
  {
    name: "Indeed",
    hostRegex: /^(?:[a-z0-9-]+\.)*indeed\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
    nonJobPatterns: [
      /^\/career-advice(?:\/|$)/i,
      /^\/salaries(?:\/|$)/i,
      /^\/companies(?:\/|$)/i,
      /^\/cmp\/(?:[^/]+\/?$|[^/]+\/(?:reviews|salaries|photos|faq|about)\/?$)/i,
      /^\/hire(?:\/|$)/i,
      /^\/employers(?:\/|$)/i,
      /^\/myjobs(?:\/|$)/i,
      /^\/messages(?:\/|$)/i,
      /^\/career(?:\/|$)/i,
      /^\/p\//i,
      /^\/legal(?:\/|$)/i,
      /^\/support(?:\/|$)/i,
      /^\/?$/i,
    ],
    jobPatterns: [
      /\/viewjob\b/i,
      /\/rc\/clk\b/i,
      /\/pagead\/clk\b/i,
      /[?&](?:jk|vjk|jobkey)=[a-z0-9]+/i,
    ],
    nonJobDescription: (pathname) =>
      /^\/salaries/i.test(pathname)
        ? "Indeed Salary page is not a job listing"
        : /^\/career-advice/i.test(pathname)
        ? "Indeed Career Advice page is not a job listing"
        : `Indeed non-job page (${pathname}) is not a job listing`,
  },
  {
    name: "Glassdoor",
    hostRegex: /^(?:[a-z0-9-]+\.)*glassdoor\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
    nonJobPatterns: [
      /^\/Reviews\//i,
      /^\/Salaries\//i,
      /^\/Interview\//i,
      /^\/Overview\//i,
      /^\/Benefits\//i,
      /^\/member\//i,
      /^\/community\//i,
      /^\/guide\//i,
      /^\/?$/i,
    ],
    jobPatterns: [
      /\/Job\//i,
      /\/job-listing\//i,
      /[?&](?:jobListingId|jl)=\d+/i,
    ],
    nonJobDescription: (pathname) => `Glassdoor non-job page (${pathname}) is not a job listing`,
  },
];

/** URL path patterns strongly associated with individual job postings. */
const JOB_URL_PATTERNS: ReadonlyArray<RegExp> = [
  /[/._#-]jobs?(?:[/._?#-]|$)/i,
  /[/._#-]careers?(?:[/._?#-]|$)/i,
  /[/._#-]positions?(?:[/._?#-]|$)/i,
  /[/._#-]vacancies?(?:[/._?#-]|$)/i,
  /[/._#-]roles?(?:[/._?#-]|$)/i,
  /[/._#-]openings?(?:[/._?#-]|$)/i,
  /[/._#-]postings?(?:[/._?#-]|$)/i,
  /[/._#-]requisitions?(?:[/._?#-]|$)/i,
  /[/._#-]apply(?:[/._?#-]|$)/i,
  /[/._#-]application(?:wizard)?(?:[/._?#-]|$)/i,
  /[/._#-]wizard(?:[/._?#-]|$)/i,
  /[?&]f=\$ORG\.REC/i,
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
  "[class*='t1-' i]",
  "[class*='application-wizard' i]",
  "[class*='wizard' i]",
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

  // --- 1. Structured data (JSON-LD JobPosting) check ---
  const ldScripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']"),
  ).slice(0, 20);
  let hasJobPosting = false;
  const containsJobPosting = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== "object" || depth > 8) return false;
    if (Array.isArray(value)) return value.some((item) => containsJobPosting(item, depth + 1));
    const record = value as Record<string, unknown>;
    const type = record["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return true;
    return Object.values(record).some((child) => containsJobPosting(child, depth + 1));
  };
  for (const script of ldScripts) {
    try {
      const raw = JSON.parse(script.textContent || "");
      if (containsJobPosting(raw)) {
        hasJobPosting = true;
        break;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // --- 2. Major platform specific rules ---
  const matchedPlatform = MAJOR_PLATFORM_RULES.find((rule) => rule.hostRegex.test(hostname));
  if (matchedPlatform) {
    const isJobUrl = matchedPlatform.jobPatterns.some((pattern) => pattern.test(pathname) || pattern.test(url));
    const platformDomSelectors: Record<string, string> = {
      LinkedIn: "[class*='jobs-unified-top-card'], [class*='job-details'], [data-occludable-job-id], #job-details, .jobs-search__job-details",
      SEEK: "[data-automation='job-detail-title'], [data-automation='jobDetails'], [data-automation='jobAdDetails'], h1[data-automation='job-detail-title']",
      Indeed: "#jobDescriptionText, [class*='jobsearch-jobDescriptionText'], [data-testid='jobsearch-JobInfoHeader-title'], .jobsearch-JobInfoHeader-title, #viewJobSSRRoot, [data-jk], [data-testid='inlineHeader-companyName']",
      Glassdoor: "[class*='JobDetails_jobDetailsContainer'], [data-test='job-details-header'], [id^='jd-job-title-']",
    };
    const selector = platformDomSelectors[matchedPlatform.name];
    const hasPlatformDomSignal = Boolean(selector && document.querySelector(selector));

    if (isJobUrl) {
      reasons.push(`Job posting URL pattern on ${matchedPlatform.name}: ${pathname}`);
      confidence += 5;
      autoQualify = true;
    } else if (hasJobPosting) {
      reasons.push(`Page on ${matchedPlatform.name} contains JSON-LD JobPosting structured data`);
      confidence += 5;
      autoQualify = true;
    } else if (hasPlatformDomSignal) {
      reasons.push(`DOM contains ${matchedPlatform.name} job detail elements`);
      confidence += 5;
      autoQualify = true;
    } else {
      const isExplicitNonJob = matchedPlatform.nonJobPatterns.some((pattern) => pattern.test(pathname));
      const skipReason = isExplicitNonJob
        ? matchedPlatform.nonJobDescription(pathname)
        : `${matchedPlatform.name} page (${pathname}) does not match an identified job listing URL pattern or content structure`;
      return {
        isJobPage: false,
        confidence: 0,
        reasons: [`${isExplicitNonJob ? "Explicit non-job path" : "Not a job listing"} on ${matchedPlatform.name}: ${pathname}`],
        skipReason,
      };
    }
  }

  // --- 3. Dedicated ATS host check ---
  if (!autoQualify) {
    for (const pattern of DEDICATED_ATS_HOSTS) {
      if (pattern.test(hostname)) {
        reasons.push(`Dedicated ATS host: ${hostname}`);
        confidence += 5;
        autoQualify = true;
        break;
      }
    }
  }

  // --- 4. Include JSON-LD reason if found for generic hosts ---
  if (hasJobPosting && !autoQualify) {
    reasons.push("Page contains JSON-LD JobPosting structured data");
    confidence += 4;
    autoQualify = true;
  }

  // --- 5. Generic URL path pattern ---
  let urlPatternMatched = false;
  for (const pattern of JOB_URL_PATTERNS) {
    if (pattern.test(pathname) || pattern.test(url)) {
      if (!urlPatternMatched) {
        reasons.push(`URL path matches job keyword (${pathname})`);
        urlPatternMatched = true;
      }
      confidence += 3;
      break;
    }
  }

  // --- 6. DOM structural signals (fast querySelector) ---
  let domHits = 0;
  for (const selector of JOB_DOM_SELECTORS) {
    if (document.querySelector(selector)) {
      domHits += 1;
      if (domHits === 1) {
        reasons.push(`DOM contains job page structure (${selector})`);
      }
      if (domHits >= 2) break;
    }
  }
  confidence += Math.min(domHits * 2, 4);

  // --- 7. Heading text scan (h1 / h2 only — fast) ---
  const headings = Array.from(document.querySelectorAll<HTMLElement>("h1, h2")).slice(0, 10);
  for (const h of headings) {
    const text = (h.textContent || "").trim();
    if (JOB_HEADING_RE.test(text)) {
      reasons.push(`Heading/Section contains job keyword: "${text.slice(0, 60)}"`);
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
      ? "No job listing signals detected (domain, URL, DOM structure, and structured data do not match)"
      : `Insufficient confidence (${confidence}/${THRESHOLD}): ${reasons.join("; ")}`;

  return { isJobPage: false, confidence, reasons, skipReason };
}
