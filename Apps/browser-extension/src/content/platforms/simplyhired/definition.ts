import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/job\/([a-zA-Z0-9_-]+)/i) ||
    url.pathname.match(/\/jobs\/([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1];

  return url.searchParams.get("jk") ||
    url.searchParams.get("job_key") ||
    url.searchParams.get("job") ||
    url.searchParams.get("id") ||
    "";
}

function idFromRoot(root: ParentNode): string {
  const el = root instanceof HTMLElement ? root : (root as Element).parentElement || document.body;
  const card = el.closest<HTMLElement>("[data-jobkey], [data-testid='viewJobBody'], [data-job-id]") ||
    el.querySelector<HTMLElement>("[data-jobkey], [data-testid='viewJobBody'], [data-job-id]");

  const dataId = card?.getAttribute("data-jobkey") ||
    card?.getAttribute("data-job-id") ||
    el.querySelector<HTMLElement>("[data-jobkey]")?.getAttribute("data-jobkey");
  if (dataId) return dataId;

  const matchId = (card?.id || el.id || "").match(/^(?:job_)?([a-zA-Z0-9_-]+)$/i);
  if (matchId?.[1]) return matchId[1];
  return "";
}

function dateFromPage(externalId: string): string | undefined {
  const dateEl = document.querySelector<HTMLElement>(
    "[data-testid='viewJobAge'], [data-testid='viewJobPostedTime'], [data-testid='viewJobDate'], .viewjob-age, time",
  );
  return cleanText(dateEl?.getAttribute("datetime") || dateEl?.textContent) || undefined;
}

function companyFromPage(title: string): string {
  const pageTitle = cleanText(document.title);
  const match = pageTitle.match(/^(.+?)\s+-\s+(.+?)\s+-\s+.*$/i);
  if (match?.[2]) return cleanText(match[2]);
  const atMatch = pageTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s+-\s+.*|\s+in\s+.*|$)/i);
  if (atMatch?.[2]) return cleanText(atMatch[2]);
  return "";
}

export const simplyHiredDefinition = {
  platform: "simplyhired",
  detection: {
    host: /(?:^|\.)simplyhired\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
    dom: "meta[content*='SimplyHired' i], [data-simplyhired]",
  },
  jobDescriptionRootSelectors: [
    "[data-testid='viewJobBody']",
    ".viewjob-content",
    "[data-testid='viewJobSection']",
    "#job-details",
    ".viewjob-pane",
    "main",
  ],
  jobDescriptionSelectors: [
    "[data-testid='viewJobBody'] [data-testid='jobDescriptionText']",
    "[data-testid='viewJobBody'] [data-testid='viewJobDescription']",
    "[data-testid='jobDescriptionText']",
    "#jobDescriptionText",
    ".viewjob-description",
    "[data-testid='jobDescription']",
    "[data-testid='viewJobBody'] .job-description",
    "[data-testid='viewJobBody'] div[class*='description']",
    "[data-testid='viewJobBody']",
    ".job-description",
    "#job-description",
  ],
  jobDescriptionExpandSelectors: [
    "button[data-testid='viewJobExpandButton']",
    "button[class*='showMore']",
  ],
  applicationRoots: [
    "form[data-testid='applyForm']",
    "form.viewjob-applyForm",
    "form[action*='apply']",
    "form[action*='application']",
    "[data-testid='applicationForm']",
  ],
  job: {
    roots: [
      "[data-testid='viewJobBody']",
      ".viewjob-content",
      "[data-testid='viewJobSection']",
      "#job-details",
      ".viewjob-pane",
    ],
    title: [
      "[data-testid='viewJobTitle']",
      "h2.viewjob-jobTitle",
      "h1.viewjob-title",
      "h1[class*='title']",
      "h1",
    ],
    company: [
      "[data-testid='viewJobCompany']",
      ".viewjob-company",
      "[data-testid='companyName']",
      "[class*='company']",
      ".company",
    ],
    location: [
      "[data-testid='viewJobLocation']",
      ".viewjob-location",
      "[data-testid='location']",
      "[class*='location']",
      ".location",
    ],
    description: [
      "[data-testid='viewJobBody'] [data-testid='jobDescriptionText']",
      "[data-testid='viewJobBody'] [data-testid='viewJobDescription']",
      "[data-testid='jobDescriptionText']",
      "#jobDescriptionText",
      ".viewjob-description",
      "[data-testid='jobDescription']",
      "[data-testid='viewJobBody'] .job-description",
      "[data-testid='viewJobBody'] div[class*='description']",
      "[data-testid='viewJobBody']",
      ".job-description",
      "#job-description",
    ],
    qualifications: [
      "[data-testid='viewJobQualifications'] [data-testid='qualificationItem']",
      ".viewjob-skills .pill",
    ],
    apply: [
      "a[data-testid='applyButton']",
      "button[data-testid='applyButton']",
      ".viewjob-applyButton",
      "a[href*='apply']",
    ],
    id: ["[data-jobkey]", "[data-job-id]", "[data-testid='viewJobBody']"],
    idFromUrl,
    idFromRoot,
    dateFromPage,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"simplyhired">;
