import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/jobs\/([0-9]+)/i) ||
    url.pathname.match(/\/l\/([0-9a-zA-Z_-]+)/i) ||
    url.pathname.match(/\/jobs\/[^-]+-([0-9]+)/i);
  if (match?.[1]) return match[1];

  return url.searchParams.get("job_id") ||
    url.searchParams.get("listing_id") ||
    url.searchParams.get("id") ||
    "";
}

function idFromRoot(root: ParentNode): string {
  const el = root instanceof HTMLElement ? root : (root as Element).parentElement || document.body;
  const card = el.closest<HTMLElement>("[data-test='JobListing'], [data-job-id], [data-listing-id]") ||
    el.querySelector<HTMLElement>("[data-test='JobListing'], [data-job-id], [data-listing-id]");

  const dataId = card?.getAttribute("data-job-id") ||
    card?.getAttribute("data-listing-id");
  if (dataId) return dataId;

  const matchId = (card?.id || el.id || "").match(/^(?:job_|listing_)?([0-9]+)$/i);
  if (matchId?.[1]) return matchId[1];
  return "";
}

function dateFromPage(externalId: string): string | undefined {
  const dateEl = document.querySelector<HTMLElement>(
    "time, [class*='styles_posted'], [data-test='JobPostedTime'], [class*='posted']",
  );
  return cleanText(dateEl?.getAttribute("datetime") || dateEl?.textContent) || undefined;
}

function companyFromPage(title: string): string {
  const pageTitle = cleanText(document.title);
  const match = pageTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s+-\s+.*|$)/i);
  if (match?.[2]) return cleanText(match[2]);
  const dashMatch = pageTitle.match(/^(.+?)\s+-\s+(.+?)\s+-\s+.*$/i);
  if (dashMatch?.[2]) return cleanText(dashMatch[2]);
  return "";
}

export const wellfoundDefinition = {
  platform: "wellfound",
  detection: {
    host: /(?:^|\.)(?:wellfound\.com|angel\.co)$/i,
    dom: "meta[content*='Wellfound' i], meta[content*='AngelList' i], [data-wellfound]",
  },
  jobDescriptionRootSelectors: [
    "[data-test='JobListing']",
    "[class*='styles_jobListing']",
    "[class*='styles_jobDetails']",
    "[data-test='JobDescription']",
    "[class*='styles_layout']",
    "main",
  ],
  jobDescriptionSelectors: [
    "[data-test='JobDescription']",
    "[class*='styles_description']",
    "[class*='styles_jobDescription']",
    ".job-description",
    "section[class*='description']",
    "[class*='description']",
  ],
  jobDescriptionExpandSelectors: [
    "button[class*='styles_viewMore']",
    "button[class*='styles_expand']",
    "[data-test='JobDescription-expand']",
  ],
  applicationRoots: [
    "form[data-test='JobApplicationForm']",
    "form[class*='styles_applicationForm']",
    "form[action*='apply']",
    "form[action*='application']",
    "[data-test='JobApplication'] form",
  ],
  job: {
    roots: [
      "[data-test='JobListing']",
      "[class*='styles_jobListing']",
      "[class*='styles_jobDetails']",
      "[data-test='JobDescription']",
      "[class*='styles_layout']",
    ],
    title: [
      "h1[class*='styles_title']",
      "h1[class*='styles_header']",
      "h1[class*='title']",
      "h1",
      "h2[class*='styles_title']",
    ],
    company: [
      "[class*='styles_companyName']",
      "[class*='styles_companyTitle']",
      "[class*='styles_startupName']",
      "a[href*='/company/']",
      "h2[class*='styles_company']",
      "[class*='company']",
    ],
    location: [
      "[class*='styles_location']",
      "[class*='styles_meta'] span",
      "[class*='styles_bullet']",
      "[class*='location']",
    ],
    description: [
      "[data-test='JobDescription']",
      "[class*='styles_description']",
      "[class*='styles_jobDescription']",
      ".job-description",
      "section[class*='description']",
      "[class*='description']",
    ],
    qualifications: [
      "[class*='styles_skills'] [class*='styles_tag']",
      "[data-test='skills'] [data-test='skill-tag']",
    ],
    apply: [
      "button[data-test='JobApplyButton']",
      "button[class*='styles_applyButton']",
      "a[href*='/jobs/apply']",
      "button.primary",
      "button[data-test='apply-button']",
    ],
    id: ["[data-job-id]", "[data-listing-id]", "[data-test='JobListing']"],
    idFromUrl,
    idFromRoot,
    dateFromPage,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"wellfound">;
