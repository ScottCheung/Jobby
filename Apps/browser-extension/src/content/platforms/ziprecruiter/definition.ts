import type { AtsProviderDefinition } from "../platform-definition";
import { ziprecruiterJobSelection } from "./job-selection";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/job\/(?:[^-/]+-)*([a-zA-Z0-9_-]+)/i) ||
    url.pathname.match(/\/c\/[^/]+\/Job\/([^/?]+)/i) ||
    url.pathname.match(/\/jobs\/([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1];

  return url.searchParams.get("job_id") ||
    url.searchParams.get("jid") ||
    url.searchParams.get("mid") ||
    url.searchParams.get("job_key") ||
    url.searchParams.get("jk") ||
    "";
}

function idFromRoot(root: ParentNode): string {
  const el = root instanceof HTMLElement ? root : (root as Element).parentElement || document.body;
  const card = el.closest<HTMLElement>(".job_result, [data-testid='job-details'], [data-job-id]") ||
    el.querySelector<HTMLElement>("[data-job-id], [data-testid='job-details']");

  const dataId = card?.getAttribute("data-job-id") ||
    card?.getAttribute("data-job-key") ||
    card?.getAttribute("data-jid") ||
    el.querySelector<HTMLElement>("[data-job-id]")?.getAttribute("data-job-id") ||
    el.querySelector<HTMLElement>("[data-job-key]")?.getAttribute("data-job-key");
  if (dataId) return dataId;

  const idAttr = card?.id || el.id || "";
  const matchId = idAttr.match(/^(?:job_|job_result_)?([a-zA-Z0-9_-]+)$/i);
  if (matchId?.[1] && !/^(?:details|description|content|container|header|result)$/i.test(matchId[1])) {
    return matchId[1];
  }
  return "";
}

function dateFromPage(externalId: string): string | undefined {
  const detailDateEl = document.querySelector<HTMLElement>(
    ".job_age, [data-testid='job-posted-time'], [data-testid='job-age'], .posted_time, .posted-date, time",
  );
  const detailText = cleanText(detailDateEl?.getAttribute("datetime") || detailDateEl?.textContent);
  if (detailText) return detailText;

  const card = document.querySelector<HTMLElement>(`.job_result[data-job-id='${externalId}'], .job_result, [data-testid='job-listing']`);
  const dateEl = card?.querySelector<HTMLElement>(".job_age, .posted_time, time");
  return cleanText(dateEl?.getAttribute("datetime") || dateEl?.textContent) || undefined;
}

function companyFromPage(_title: string): string {
  const pageTitle = cleanText(document.title);
  const match = pageTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s+in\s+.*|\s+-\s+.*|$)/i);
  if (match?.[2]) return cleanText(match[2]);
  const dashMatch = pageTitle.match(/^(.+?)\s+-\s+(.+?)\s+-\s+.*$/i);
  if (dashMatch?.[2]) return cleanText(dashMatch[2]);
  return "";
}

export const ziprecruiterDefinition = {
  platform: "ziprecruiter",
  detection: {
    host: /(?:^|\.)ziprecruiter\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
    dom: "[data-ziprecruiter], meta[content*='ZipRecruiter' i], .zr-job-details",
  },
  jobDescriptionRootSelectors: [
    "[data-testid='job-details']",
    ".job_details",
    ".job_content",
    ".job-details-container",
    ".jobDescriptionSection",
    "main",
  ],
  jobDescriptionSelectors: [
    ".jobDescriptionSection",
    "[data-testid='job-description']",
    ".job_description",
    ".job_description_container",
    ".job_details_text",
    "#job_desc",
    ".job_content",
    "[class*='description']",
  ],
  jobDescriptionExpandSelectors: [
    "button[class*='showMore']",
    "button[class*='read_more']",
    "[data-testid='show-more']",
    "button[aria-label*='Show full job description']",
  ],
  applicationRoots: [
    "form.job_apply_form",
    "form[action*='apply']",
    "form[action*='application']",
    "[data-testid='application-form']",
    "[data-testid='job-apply-form']",
    ".quick_apply_form",
    ".one-click-apply-form",
    "[data-testid='quick-apply-modal'] form",
  ],
  job: {
    roots: [
      "[data-testid='job-details']",
      ".job_details",
      ".job_content",
      ".job-details-container",
      ".jobDescriptionSection",
    ],
    title: [
      "h1[data-testid='job-title']",
      "h1.job_title",
      "h1.jobTitle",
      "h1.title",
      "h1[class*='title']",
      "h1",
    ],
    company: [
      ".hiring_company_text",
      "[data-testid='hiring-company']",
      "[data-testid='company-name']",
      "a.hiring_company",
      ".company_name",
      "a.company",
      "[class*='company']",
    ],
    location: [
      ".location_text",
      "[data-testid='job-location']",
      "[data-testid='location']",
      ".company_location",
      ".location",
      "[class*='location']",
    ],
    description: [
      ".jobDescriptionSection",
      "[data-testid='job-description']",
      ".job_description",
      ".job_description_container",
      ".job_details_text",
      "#job_desc",
      ".job_content",
      "[class*='description']",
    ],
    qualifications: [
      "[data-testid='job-skills'] [class*='skill']",
      ".skills_list .skill",
    ],
    apply: [
      "a[href*='apply']",
      "button[data-testid='apply-button']",
      "button[data-testid='1-click-apply-button']",
      ".apply_button",
      ".one_click_apply",
      "button.primary",
    ],
    id: ["[data-job-id]", "[data-jid]", "[data-job-key]", "input[name='job_id']"],
    idFromUrl,
    idFromRoot,
    dateFromPage,
    companyFromPage,
  },
  jobSelection: ziprecruiterJobSelection,
} satisfies AtsProviderDefinition<"ziprecruiter">;
