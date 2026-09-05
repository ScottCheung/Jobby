import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/jobview\/(?:[^/]+\/)?([a-zA-Z0-9_-]+)/i) ||
    url.pathname.match(/\/jobs?\/(?:[^/]+\/)?([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1];

  return url.searchParams.get("job_id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("jobId") ||
    "";
}

function idFromRoot(root: ParentNode): string {
  const el = root instanceof HTMLElement ? root : (root as Element).parentElement || document.body;
  const container = el.closest<HTMLElement>("[data-job-id], [data-id], [data-jobid], [data-testid='job-details']") ||
    el.querySelector<HTMLElement>("[data-job-id], [data-id], [data-jobid]");

  const dataId = container?.getAttribute("data-job-id") ||
    container?.getAttribute("data-id") ||
    container?.getAttribute("data-jobid") ||
    el.querySelector<HTMLElement>("[data-job-id]")?.getAttribute("data-job-id");
  if (dataId) return dataId;

  const idAttr = container?.id || el.id || "";
  const matchId = idAttr.match(/^(?:job_|jobview_)?([a-zA-Z0-9_-]+)$/i);
  if (matchId?.[1] && !/^(?:details|description|content|container|header|view|main)$/i.test(matchId[1])) {
    return matchId[1];
  }
  return "";
}

function dateFromPage(externalId: string): string | undefined {
  const detailDateEl = document.querySelector<HTMLElement>(
    ".job-posted, .posted-time, [data-testid='posted-date'], [data-testid='job-age'], time",
  );
  const detailText = cleanText(detailDateEl?.getAttribute("datetime") || detailDateEl?.textContent);
  if (detailText) return detailText;

  const card = document.querySelector<HTMLElement>(`[data-job-id='${externalId}'], [data-id='${externalId}']`);
  const dateEl = card?.querySelector<HTMLElement>(".job-posted, .posted-time, time");
  return cleanText(dateEl?.getAttribute("datetime") || dateEl?.textContent) || undefined;
}

function companyFromPage(_title: string): string {
  const pageTitle = cleanText(document.title);
  const pipeMatch = pageTitle.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*CareerOne/i);
  if (pipeMatch?.[2]) return cleanText(pipeMatch[2]);
  const dashMatch = pageTitle.match(/^(.+?)\s*-\s*(.+?)\s*-\s*CareerOne/i);
  if (dashMatch?.[2]) return cleanText(dashMatch[2]);
  const atMatch = pageTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s+in\s+.*|\s+-\s+.*|$)/i);
  if (atMatch?.[2]) return cleanText(atMatch[2]);
  return "";
}

export const careeroneDefinition = {
  platform: "careerone",
  detection: {
    host: /(?:^|\.)careerone\.com\.au$/i,
    dom: "meta[content*='CareerOne' i], [data-careerone]",
  },
  jobDescriptionRootSelectors: [
    "[data-testid='job-details']",
    "[data-testid='jobview']",
    ".jobview-container",
    ".job-view",
    ".job-details",
    ".job-details-page",
    "main",
  ],
  jobDescriptionSelectors: [
    "[data-testid='job-description']",
    ".job-description",
    "[class*='jobDescription']",
    "[class*='job-description']",
    ".job-details-content",
    "#job-description",
    ".description",
    "[class*='description']",
  ],
  jobDescriptionExpandSelectors: [
    "button[class*='showMore']",
    "button[class*='read_more']",
    "[data-testid='show-more']",
    "button[aria-label*='Show full job description']",
  ],
  applicationRoots: [
    "form[action*='apply']",
    "form[action*='application']",
    "[data-testid='application-form']",
    "[data-testid='job-apply-form']",
    ".apply-form",
    "[data-testid='apply-modal'] form",
  ],
  job: {
    roots: [
      "[data-testid='job-details']",
      "[data-testid='jobview']",
      ".jobview-container",
      ".job-view",
      ".job-details",
      ".job-details-page",
      "main",
    ],
    title: [
      "h1[data-testid='job-title']",
      "h1[data-testid='jobview-title']",
      "h1.job-title",
      "h1.title",
      "h1[class*='title']",
      "h1",
    ],
    company: [
      "a[href*='/jobs/br_']",
      "[data-testid='company-name']",
      "[data-testid='company']",
      ".company-name",
      "a.company",
      "[class*='company']",
    ],
    location: [
      "a[href*='/jobs/in-']",
      "[data-testid='job-location']",
      "[data-testid='location']",
      ".job-location",
      ".location",
      "[class*='location']",
    ],
    description: [
      "[data-testid='job-description']",
      ".job-description",
      "[class*='jobDescription']",
      "[class*='job-description']",
      ".job-details-content",
      "#job-description",
      ".description",
      "[class*='description']",
    ],
    qualifications: [
      "[data-testid='skills'] [class*='skill']",
      ".skills-list .skill",
      "[data-testid='qualification']",
    ],
    apply: [
      "a[href*='apply']",
      "button[data-testid='apply-button']",
      ".apply-button",
      "button.btn-apply",
      "button.primary",
    ],
    id: ["[data-job-id]", "[data-id]", "[data-jobid]", "input[name='job_id']"],
    idFromUrl,
    idFromRoot,
    dateFromPage,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"careerone">;
