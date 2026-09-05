import type { AtsProviderDefinition } from "../platform-definition";
import { adzunaJobSelection } from "./job-selection";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/details\/([0-9]+)/i) ||
    url.pathname.match(/\/land\/ad\/([0-9]+)/i) ||
    url.pathname.match(/\/jobs\/([0-9]+)/i);
  if (match?.[1]) return match[1];

  return url.searchParams.get("id") ||
    url.searchParams.get("ad_id") ||
    url.searchParams.get("aid") ||
    "";
}

function idFromRoot(root: ParentNode): string {
  const el = root instanceof HTMLElement ? root : (root as Element).parentElement || document.body;
  const card = el.closest<HTMLElement>("[data-aid], [data-id], [data-job-id], .job-details") ||
    el.querySelector<HTMLElement>("[data-aid], [data-id], [data-job-id]");

  const dataId = card?.getAttribute("data-aid") ||
    card?.getAttribute("data-id") ||
    card?.getAttribute("data-job-id") ||
    el.querySelector<HTMLElement>("[data-aid]")?.getAttribute("data-aid");
  if (dataId) return dataId;

  const matchId = (card?.id || el.id || "").match(/^(?:ad_|job_)?([0-9]+)$/i);
  if (matchId?.[1]) return matchId[1];
  return "";
}

function dateFromPage(_externalId: string): string | undefined {
  const dateEl = document.querySelector<HTMLElement>(
    ".posted, [data-testid='posted'], [data-testid='job-date'], .job-date, time, .date",
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

export const adzunaDefinition = {
  platform: "adzuna",
  detection: {
    host: /(?:^|\.)adzuna\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
    dom: "meta[content*='Adzuna' i], [data-adzuna], [data-aid]",
  },
  jobDescriptionRootSelectors: [
    ".job-details",
    ".ui-details",
    "[data-testid='job-details']",
    ".adp-body",
    ".job-header",
    "main",
  ],
  jobDescriptionSelectors: [
    ".job-description",
    "[data-testid='description']",
    "[data-testid='job-description']",
    ".adp-body",
    ".ui-details-description",
    ".description",
    "[class*='description']",
  ],
  jobDescriptionExpandSelectors: [
    "button[class*='show-more']",
    ".show-more",
    "[data-testid='show-more']",
  ],
  applicationRoots: [
    "form.apply-form",
    "form[action*='apply']",
    "form[action*='application']",
    "[data-testid='apply-form']",
    "[data-testid='application-form']",
    ".ui-apply-form",
  ],
  job: {
    roots: [
      ".job-details",
      ".ui-details",
      "[data-testid='job-details']",
      ".adp-body",
    ],
    title: [
      "h1.title",
      "h1[data-testid='title']",
      "h1[data-testid='job-title']",
      "h1.heading",
      "h1[class*='title']",
      "h1",
      "h2.title",
    ],
    company: [
      ".company",
      "[data-testid='company']",
      "[data-testid='company-name']",
      "a[href*='/company/']",
      ".ui-details-company",
      "[class*='company']",
      ".employer",
    ],
    location: [
      ".location",
      "[data-testid='location']",
      "[data-testid='job-location']",
      ".ui-details-location",
      "[class*='location']",
      ".city",
    ],
    description: [
      ".job-description",
      "[data-testid='description']",
      "[data-testid='job-description']",
      ".adp-body",
      ".ui-details-description",
      "[class*='description']",
      ".description",
    ],
    qualifications: [
      ".job-skills [class*='skill']",
      "[data-testid='skills'] [data-testid*='skill']",
      ".skills-tag",
    ],
    apply: [
      "a[href*='/land/']",
      "a[href*='apply']",
      "button[data-testid='apply-button']",
      ".apply-button",
      "a.button.primary",
      "a[data-testid='apply-link']",
    ],
    id: ["[data-aid]", "[data-id]", "[data-job-id]"],
    idFromUrl,
    idFromRoot,
    dateFromPage,
    companyFromPage,
  },
  jobSelection: adzunaJobSelection,
} satisfies AtsProviderDefinition<"adzuna">;
