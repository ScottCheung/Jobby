import type { AtsProviderDefinition } from "../platform-definition";
import { diceJobSelection } from "./job-selection";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/job-detail\/([a-zA-Z0-9_-]+)/i) ||
    url.pathname.match(/\/jobs\/detail\/([a-zA-Z0-9_-]+)/i) ||
    url.pathname.match(/\/job(?:s)?\/([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1];

  return url.searchParams.get("selectedJobId") ||
    url.searchParams.get("jobId") ||
    url.searchParams.get("job_id") ||
    url.searchParams.get("id") ||
    "";
}

function idFromRoot(root: ParentNode): string {
  const el = root instanceof HTMLElement ? root : (root as Element).parentElement || document.body;
  const card = el.closest<HTMLElement>(
    "dhi-sjt-job-details, [data-cy='sjt-job-details'], [data-cy='job-details'], dhi-candidate-job-details, dhi-search-card, [data-jobid], [data-testid='job-details']",
  ) ||
    el.querySelector<HTMLElement>(
      "dhi-sjt-job-details, [data-cy='sjt-job-details'], [data-cy='job-details'], dhi-candidate-job-details, [data-jobid], [data-testid='job-details']",
    );

  const dataId = card?.getAttribute("data-cy-jobid") ||
    card?.getAttribute("data-jobid") ||
    card?.getAttribute("data-job-id") ||
    card?.getAttribute("data-selected-job-id") ||
    card?.getAttribute("job-id") ||
    el.querySelector<HTMLElement>("[data-cy='jobId']")?.getAttribute("data-cy-jobId") ||
    el.querySelector<HTMLElement>("[data-jobid]")?.getAttribute("data-jobid");
  if (dataId) return dataId;

  const idCandidate = card?.id || el.id || "";
  const matchId = idCandidate.match(/^(?:job_|dhi_)?([a-zA-Z0-9_-]+)$/i);
  if (matchId?.[1] && !/^(?:desc|details|description|body|info|view|header|jobdesc|jobdescsec|jobdescription|jobdescriptiontext|sjt)$/i.test(matchId[1])) {
    return matchId[1];
  }
  return "";
}

function dateFromPage(_externalId: string): string | undefined {
  const dateEl = document.querySelector<HTMLElement>(
    "[data-cy='postedDate'], [data-cy='posted-date'], [data-testid='posted-date'], [data-cy='postedOn'], .posted-date, time",
  );
  return cleanText(dateEl?.getAttribute("datetime") || dateEl?.textContent) || undefined;
}

function companyFromPage(_title: string): string {
  const pageTitle = cleanText(document.title);
  const match = pageTitle.match(/^(.+?)\s+-\s+(.+?)\s+-\s+.*$/i);
  if (match?.[2]) return cleanText(match[2]);
  const atMatch = pageTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s+-\s+.*|\s+in\s+.*|$)/i);
  if (atMatch?.[2]) return cleanText(atMatch[2]);
  return "";
}

export const diceDefinition = {
  platform: "dice",
  detection: {
    host: /(?:^|\.)dice\.com$/i,
    dom: "dhi-sjt-job-details, [data-cy='sjt-job-details'], dhi-candidate-job-details, [data-cy='job-details'], #jobdescSec, #jobDescriptionText, [data-cy='jobDescriptionText'], dhi-search-card, .dice-btn-apply",
  },
  jobDescriptionRootSelectors: [
    "dhi-sjt-job-details",
    "[data-cy='sjt-job-details'], [data-cy='search-details']",
    "dhi-candidate-job-details",
    "[data-cy='job-details']",
    "[data-testid='job-details']",
    "#jobdescSec",
    "#jobDescriptionText",
    ".job-details-pane",
    ".job-details",
    ".job-info",
    "main",
  ],
  jobDescriptionSelectors: [
    "[data-cy='jobDescriptionText']",
    "#jobDescriptionText",
    "#jobdescSec",
    "div#jobdescSec",
    "[data-testid='jobDescriptionText']",
    "[data-testid='job-description']",
    ".job-description",
    ".jobDescription",
    "[class*='jobDescription']",
    "[class*='job-description']",
    "#jobDescription",
    ".highlight-black",
  ],
  jobDescriptionExpandSelectors: [
    "button[data-cy='jobDescriptionToggle']",
    "button[class*='showMore']",
    "button[class*='readMore']",
  ],
  applicationRoots: [
    "form[data-cy='easyApplyForm']",
    "form.dice-apply-form",
    "form[action*='apply']",
    "form[action*='application']",
    "[data-cy='apply-form']",
    "[data-testid='apply-form']",
  ],
  job: {
    roots: [
      "dhi-sjt-job-details",
      "[data-cy='sjt-job-details']",
      "[data-cy='search-details']",
      "[data-cy='job-details-pane']",
      "dhi-candidate-job-details",
      "[data-cy='job-details']",
      "[data-testid='job-details']",
      "[data-testid='selected-job-details']",
      "#job-details-pane",
      "#jobdescSec",
      "#jobDescriptionText",
      ".job-details-pane",
      ".job-details",
      ".job-info",
    ],
    title: [
      "h1[data-cy='jobTitle']",
      "h1#jobTitle",
      "h1[data-testid='jobTitle']",
      "h1.jobTitle",
      "h1.job-title",
      "h1[class*='jobTitle']",
      "h1[class*='title']",
      "h1",
    ],
    company: [
      "[data-cy='companyName']",
      "a[data-cy='companyDescriptionLink']",
      "[data-cy='company-overview-link']",
      "a[href*='/company-profile/']",
      "a[href*='/company/']",
      "[data-testid='employer-name']",
      ".company-name",
      "a.company",
      ".employer",
      "[class*='company']",
    ],
    location: [
      "[data-cy='jobLocation']",
      "[data-cy='companyLocation']",
      "[data-testid='job-location']",
      ".job-location",
      "[class*='location']",
      ".location",
    ],
    description: [
      "[data-cy='jobDescriptionText']",
      "#jobDescriptionText",
      "#jobdescSec",
      "div#jobdescSec",
      "[data-testid='jobDescriptionText']",
      "[data-testid='job-description']",
      ".job-description",
      ".jobDescription",
      "[class*='jobDescription']",
      "[class*='job-description']",
      "#jobDescription",
      ".highlight-black",
    ],
    qualifications: [
      "[data-cy='skills'] [data-cy*='skill']",
      "[data-testid='skills'] [data-testid*='skill']",
      ".job-skills .skill",
    ],
    apply: [
      "button[data-cy='applyButton']",
      "button[data-testid='apply-button']",
      "[data-cy='easyApplyButton']",
      ".dice-btn-apply",
      "a[data-cy='apply-button']",
      "a[href*='/apply']",
      "button.btn-primary",
      "button.primary",
    ],
    id: ["[data-cy='jobId']", "[data-jobid]", "[data-job-id]", "[job-id]"],
    idFromUrl,
    idFromRoot,
    dateFromPage,
    companyFromPage,
  },
  jobSelection: diceJobSelection,
} satisfies AtsProviderDefinition<"dice">;
