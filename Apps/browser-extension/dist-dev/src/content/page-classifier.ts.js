const DEDICATED_ATS_HOSTS = [
  /^(?:www\.)?myworkdayjobs\.com$/,
  /^(?:[a-z0-9-]+\.)+myworkdayjobs\.com$/,
  /^boards\.greenhouse\.io$/,
  /^jobs\.lever\.co$/,
  /^jobs\.ashbyhq\.com$/,
  /^apply\.workable\.com$/,
  /^jobs\.jobvite\.com$/,
  /^(?:www\.)?taleo\.net$/,
  /^(?:[a-z0-9-]+\.)+taleo\.net$/,
  /^(?:www\.)?icims\.com$/,
  /^(?:[a-z0-9-]+\.)+icims\.com$/,
  /^(?:www\.)?bamboohr\.com$/,
  /^(?:[a-z0-9-]+\.)+bamboohr\.com$/,
  /^(?:www\.)?recruitee\.com$/,
  /^(?:www\.)?breezy\.hr$/,
  /^ats\.rippling\.com$/,
  /^(?:www\.)?recruitcrm\.io$/,
  /^app\.vbench\.com\.au$/,
  /(?:^|\.)t1cloud\.com$/
];
export const MAJOR_PLATFORM_RULES = [
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
      /^\/search(?:\/|$)/i,
      /^\/company\/(?:[^/]+\/?$|[^/]+\/(?:about|life|people|posts|videos|insights)\/?$)/i
    ],
    jobPatterns: [
      /\/jobs\/view\//i,
      /[?&](?:currentJobId|jobId)=\d+/i
    ],
    nonJobDescription: (pathname) => /^\/help/i.test(pathname) ? "LinkedIn Help page is not a job listing" : /^\/feed/i.test(pathname) ? "LinkedIn Feed is not a job listing" : /^\/in\//i.test(pathname) ? "LinkedIn Profile page is not a job listing" : `LinkedIn non-job page (${pathname}) is not a job listing`
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
      /^\/?$/i
    ],
    jobPatterns: [
      /\/job\/\d+/i,
      /[?&]jobId=\d+/i
    ],
    nonJobDescription: (pathname) => /^\/profile/i.test(pathname) ? "SEEK Profile page is not a job listing" : /^\/career-advice/i.test(pathname) ? "SEEK Career Advice article is not a job listing" : `SEEK non-job page (${pathname}) is not a job listing`
  },
  {
    name: "Indeed",
    hostRegex: /^(?:[a-z0-9-]+\.)*indeed\.com$/i,
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
      /^\/?$/i
    ],
    jobPatterns: [
      /\/viewjob\b/i,
      /\/rc\/clk\b/i,
      /\/pagead\/clk\b/i,
      /[?&](?:jk|vjk|jobkey)=[a-z0-9]+/i
    ],
    nonJobDescription: (pathname) => /^\/salaries/i.test(pathname) ? "Indeed Salary page is not a job listing" : /^\/career-advice/i.test(pathname) ? "Indeed Career Advice page is not a job listing" : `Indeed non-job page (${pathname}) is not a job listing`
  },
  {
    name: "Glassdoor",
    hostRegex: /^(?:[a-z0-9-]+\.)*glassdoor\.(?:com(?:\.au)?)$/i,
    nonJobPatterns: [
      /^\/Reviews\//i,
      /^\/Salaries\//i,
      /^\/Interview\//i,
      /^\/Overview\//i,
      /^\/Benefits\//i,
      /^\/member\//i,
      /^\/community\//i,
      /^\/guide\//i,
      /^\/?$/i
    ],
    jobPatterns: [
      /\/Job\//i,
      /\/job-listing\//i,
      /[?&](?:jobListingId|jl)=\d+/i
    ],
    nonJobDescription: (pathname) => `Glassdoor non-job page (${pathname}) is not a job listing`
  }
];
const JOB_URL_PATTERNS = [
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
  /[?&]jk=/i,
  // Indeed job key
  /[?&]job_id=/i,
  /[?&]jobId=/i,
  /[?&]jobid=/i,
  /[?&]position=/i,
  /\/viewjob\b/i,
  /\/jobs\/view\//i,
  /\/job-detail\//i,
  /\/job-posting\//i,
  /\/job-description\//i
];
const JOB_DOM_SELECTORS = [
  "script[type='application/ld+json']",
  "[data-testid*='job-title' i]",
  "[data-testid*='jobsearch' i]",
  "#jobDescriptionText",
  "[class*='jobsearch-JobInfoHeader' i]",
  "[class*='job-description' i]",
  "[class*='job__title' i]",
  "[class*='posting-headline' i]",
  "#app_body",
  // Greenhouse
  ".posting-description",
  // Lever
  "[data-automation='jobTitle']",
  // Seek
  "[data-automation='job-detail-title']",
  "[class*='jobs-unified-top-card' i]",
  // LinkedIn
  "[class*='job-view-layout' i]",
  "[data-job-id]",
  "[data-jobid]",
  "[id*='job-description' i]",
  "[class*='t1-' i]",
  "[class*='application-wizard' i]",
  "[class*='wizard' i]"
];
const JOB_HEADING_RE = /\b(responsibilities|qualifications|requirements|about the role|about the job|position overview|job description|what you.ll do|who you are|key skills|we.re looking for)\b/i;
export function classifyCurrentPage() {
  const url = window.location.href;
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname;
  const reasons = [];
  let confidence = 0;
  let autoQualify = false;
  const ldScripts = Array.from(
    document.querySelectorAll("script[type='application/ld+json']")
  ).slice(0, 20);
  let hasJobPosting = false;
  for (const script of ldScripts) {
    try {
      const raw = JSON.parse(script.textContent || "");
      const types = Array.isArray(raw?.["@type"]) ? raw["@type"] : [raw?.["@type"]];
      const graphItems = raw?.["@graph"] ?? [];
      const allTypes = [
        ...types,
        ...graphItems.flatMap(
          (item) => Array.isArray(item["@type"]) ? item["@type"] : [item["@type"] ?? ""]
        )
      ];
      if (allTypes.includes("JobPosting")) {
        hasJobPosting = true;
        break;
      }
    } catch {
    }
  }
  const matchedPlatform = MAJOR_PLATFORM_RULES.find((rule) => rule.hostRegex.test(hostname));
  if (matchedPlatform) {
    const isExplicitNonJob = matchedPlatform.nonJobPatterns.some((pattern) => pattern.test(pathname));
    if (isExplicitNonJob && !hasJobPosting) {
      const skipReason2 = matchedPlatform.nonJobDescription(pathname);
      return {
        isJobPage: false,
        confidence: 0,
        reasons: [`Explicit non-job path on ${matchedPlatform.name}: ${pathname}`],
        skipReason: skipReason2
      };
    }
    const isJobUrl = matchedPlatform.jobPatterns.some((pattern) => pattern.test(pathname) || pattern.test(url));
    if (isJobUrl) {
      reasons.push(`Job posting URL pattern on ${matchedPlatform.name}: ${pathname}`);
      confidence += 5;
      autoQualify = true;
    } else if (hasJobPosting) {
      reasons.push(`Page on ${matchedPlatform.name} contains JSON-LD JobPosting structured data`);
      confidence += 5;
      autoQualify = true;
    } else {
      const skipReason2 = `${matchedPlatform.name} page (${pathname}) does not match an identified job listing URL pattern`;
      return {
        isJobPage: false,
        confidence: 0,
        reasons: [`Not a job listing URL pattern on ${matchedPlatform.name}: ${pathname}`],
        skipReason: skipReason2
      };
    }
  }
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
  if (hasJobPosting && !autoQualify) {
    reasons.push("Page contains JSON-LD JobPosting structured data");
    confidence += 4;
    autoQualify = true;
  }
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
  const headings = Array.from(document.querySelectorAll("h1, h2")).slice(0, 10);
  for (const h of headings) {
    const text = (h.textContent || "").trim();
    if (JOB_HEADING_RE.test(text)) {
      reasons.push(`Heading/Section contains job keyword: "${text.slice(0, 60)}"`);
      confidence += 2;
      break;
    }
  }
  const THRESHOLD = 3;
  if (autoQualify || confidence >= THRESHOLD) {
    return { isJobPage: true, confidence, reasons };
  }
  const skipReason = reasons.length === 0 ? "No job listing signals detected (domain, URL, DOM structure, and structured data do not match)" : `Insufficient confidence (${confidence}/${THRESHOLD}): ${reasons.join("; ")}`;
  return { isJobPage: false, confidence, reasons, skipReason };
}
