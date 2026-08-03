import { extractTechnologyKeywords } from "/src/content/technology-keywords.ts.js";
const JOB_TITLE_SELECTOR = [
  // Generic data attributes used by many ATSs
  "[data-testid*='job-title' i]",
  "[data-qa*='job-title' i]",
  "[data-test*='job-title' i]",
  "[data-automation*='job-title' i]",
  // Class-based patterns
  "[class*='job-title' i]",
  "[class*='jobtitle' i]",
  "[class*='job__title' i] h1",
  "[class*='job__title' i]",
  "[class*='posting-headline'] h2",
  "[class*='posting-headline']",
  // Greenhouse / Lever / Workday headings
  "#app_body h1",
  ".posting-headline h2",
  ".app-title",
  // Fallbacks
  "main h1",
  "article h1",
  "[role='main'] h1",
  "h1"
].join(", ");
const DESCRIPTION_SELECTOR = [
  // Generic attribute-based
  "[data-testid*='job-description' i]",
  "[data-qa*='job-description' i]",
  "[data-automation*='job-description' i]",
  // Class-based patterns
  "[class*='job-description' i]",
  "[class*='jobdescription' i]",
  "[class*='job__description' i]",
  "[id*='job-description' i]",
  "[id*='jobdescription' i]",
  // Greenhouse / Lever / Workday containers
  "#job_description",
  "#jobDescriptionText",
  ".posting-description",
  "[class*='posting-description']",
  "section[class*='description']",
  // Fallbacks
  "main article",
  "article",
  "[role='main']",
  "main"
].join(", ");
const APPLY_SELECTOR = "button, a, input[type='submit'], [role='button']";
const JOB_HEADING_PATTERN = /\b(job description|about (?:the )?(?:job|role)|position description|role overview|responsibilities|what you(?:'|’)ll do|qualifications|requirements)\b|职位描述|岗位职责|任职要求/i;
const APPLY_PATTERN = /\b(apply(?:\s+now)?|quick apply|easy apply|submit application|express interest)\b|立即申请|申请职位|投递简历/i;
const URL_JOB_PATTERN = /(?:^|[/_.-])(job|jobs|career|careers|position|positions|vacancy|vacancies|role|roles|jd|posting|postings|opening|openings|requisition)(?:[/_.?-]|$)/i;
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}
function isVisible(element) {
  const html = element;
  if (html.hidden || html.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(html);
  return style.display !== "none" && style.visibility !== "hidden";
}
function queryRoots() {
  const roots = [document];
  const seen = new Set(roots);
  for (let index = 0; index < roots.length && roots.length < 80; index += 1) {
    const root = roots[index];
    if (!root) continue;
    for (const element of Array.from(root.querySelectorAll("*"))) {
      if (element.shadowRoot && !seen.has(element.shadowRoot)) {
        seen.add(element.shadowRoot);
        roots.push(element.shadowRoot);
      }
    }
  }
  return roots;
}
function elements(selectors, roots) {
  return roots.flatMap(
    (root) => Array.from(root.querySelectorAll(selectors)).filter(isVisible)
  );
}
function firstUsefulText(candidates, minLength = 2, maxLength = 180) {
  for (const candidate of candidates) {
    const text = cleanText(candidate.textContent);
    if (text.length >= minLength && text.length <= maxLength) return text;
  }
  return "";
}
function labelledValue(labels, roots) {
  const labelPattern = new RegExp(`^\\s*(?:${labels.join("|")})\\s*:?\\s*$`, "i");
  for (const element of elements("dt, th, label, strong, b, span, div, p", roots).slice(0, 500)) {
    if (!labelPattern.test(cleanText(element.textContent))) continue;
    const sibling = element.nextElementSibling;
    const siblingText = cleanText(sibling?.textContent);
    if (siblingText && siblingText.length <= 180) return siblingText;
    const parentText = cleanText(element.parentElement?.textContent);
    const match = parentText.match(new RegExp(`(?:${labels.join("|")})\\s*:\\s*([^|·•\\n]{2,120})`, "i"));
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}
function companyFromBranding(roots) {
  for (const image of elements("img[alt]", roots)) {
    const alt = cleanText(image.getAttribute("alt"));
    const match = alt.match(/^(.+?)\s+(?:logo|careers?)$/i);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}
function locationFromPage(roots) {
  const semanticLocation = firstUsefulText(
    elements("[class*='job__location' i], [class*='job-location' i], [data-testid*='job-location' i]", roots),
    2,
    180
  );
  return semanticLocation || labelledValue(["location", "work location", "location type"], roots);
}
function descriptionFromPage(roots) {
  const candidate = elements(DESCRIPTION_SELECTOR, roots).map((element) => cleanText(element.textContent)).filter((text) => text.length >= 120).sort((left, right) => right.length - left.length)[0];
  if (candidate) return truncate(candidate, 18e3);
  const heading = elements("h2, h3, h4", roots).find((element) => JOB_HEADING_PATTERN.test(cleanText(element.textContent)));
  const parentText = cleanText(heading?.parentElement?.textContent);
  return parentText.length >= 120 ? truncate(parentText, 18e3) : "";
}
function hasApplyAction(roots) {
  return elements(APPLY_SELECTOR, roots).some((element) => {
    const text = cleanText(
      element.getAttribute("aria-label") || element.getAttribute("value") || element.textContent
    );
    return APPLY_PATTERN.test(text);
  });
}
function jobPostingFromStructuredData() {
  const scripts = Array.from(document.querySelectorAll("script[type='application/ld+json']")).slice(0, 30);
  const visit = (value) => {
    if (!value || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const match = visit(item);
        if (match) return match;
      }
      return null;
    }
    const record = value;
    const type = record["@type"];
    if (type === "JobPosting" || Array.isArray(type) && type.includes("JobPosting")) return record;
    return visit(record["@graph"]);
  };
  for (const script of scripts) {
    try {
      const posting = visit(JSON.parse(script.textContent || ""));
      if (!posting) continue;
      const organization = posting.hiringOrganization;
      const location = posting.jobLocation;
      const firstLocation = Array.isArray(location) ? location[0] : location;
      const address = firstLocation?.address;
      const identifier = posting.identifier;
      const rawDesc = String(posting.description || "").replace(/<[^>]*>/g, " ");
      return {
        title: cleanText(String(posting.title || "")) || void 0,
        company: cleanText(String(organization?.name || "")) || void 0,
        location: cleanText(
          [address?.addressLocality, address?.addressRegion, address?.addressCountry].filter((value) => typeof value === "string").join(", ")
        ) || void 0,
        description: cleanText(rawDesc) || void 0,
        externalId: cleanText(
          typeof identifier === "string" ? identifier : String(identifier?.value || "")
        ) || void 0,
        datePosted: cleanText(String(posting.datePosted || "")) || void 0
      };
    } catch {
    }
  }
  return null;
}
function datePostedFromDom() {
  const timeEl = document.querySelector("time[datetime]");
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }
  const candidates = Array.from(
    document.querySelectorAll(
      [
        "[data-testid*='date' i]",
        "[class*='posted' i]",
        "[class*='date' i]",
        "[class*='age' i]",
        "[id*='date' i]"
      ].join(", ")
    )
  ).slice(0, 40);
  for (const el of candidates) {
    const text = cleanText(el.textContent);
    if (text.length > 60) continue;
    if (/\b(\d+\s*\+?\s*(?:minute|hour|day|week|month|year)s?\s+ago|today|yesterday|just\s+(?:now|posted)|reposted|posted\s+\d|\d+\s+days?)\b/i.test(text)) {
      return text;
    }
  }
  return void 0;
}
function stableId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `page-${(hash >>> 0).toString(16)}`;
}
export function readGenericJobPage() {
  const url = window.location.href;
  const roots = queryRoots();
  const structured = jobPostingFromStructuredData();
  const title = structured?.title || firstUsefulText(elements(JOB_TITLE_SELECTOR, roots), 3, 180) || "";
  const description = structured?.description || descriptionFromPage(roots);
  const company = structured?.company || labelledValue(["company", "employer", "organisation", "organization"], roots) || companyFromBranding(roots) || "";
  const location = structured?.location || locationFromPage(roots) || "";
  const hasJobHeading = elements("h2, h3, h4", roots).some((element) => JOB_HEADING_PATTERN.test(cleanText(element.textContent)));
  const applyAction = hasApplyAction(roots);
  const urlLooksLikeJob = URL_JOB_PATTERN.test(new URL(url).pathname);
  let confidence = 0;
  if (title) confidence += 2;
  if (description.length >= 180) confidence += 3;
  else if (description.length >= 90) confidence += 2;
  if (structured) confidence += 3;
  if (hasJobHeading) confidence += 2;
  if (applyAction) confidence += 2;
  if (company) confidence += 1;
  if (urlLooksLikeJob) confidence += 1;
  const enoughEvidence = Boolean(title) && (Boolean(structured) || description.length >= 90 && (applyAction || hasJobHeading || urlLooksLikeJob) || description.length >= 180 && confidence >= 5);
  if (!enoughEvidence) {
    return {
      kind: "unsupported_page",
      url,
      reason: "No job posting could be confirmed from the visible page content."
    };
  }
  const snapshot = {
    platform: "generic",
    externalId: structured?.externalId || stableId(`${url}|${title}|${company}`),
    url,
    title,
    company: company || "Unknown company",
    location: location || void 0,
    datePosted: structured?.datePosted || datePostedFromDom(),
    description: description || void 0,
    technologies: extractTechnologyKeywords(description),
    easyApply: applyAction
  };
  return { kind: "job", snapshot };
}
