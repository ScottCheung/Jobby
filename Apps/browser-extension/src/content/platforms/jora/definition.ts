import type { AtsProviderDefinition } from "../platform-definition";
import { joraJobSelection } from "./job-selection";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/job\/(?:[^-/]+-)*([a-f0-9]{24,32})/i) ||
    url.pathname.match(/\/job\/([a-f0-9]{24,32})/i) ||
    url.pathname.match(/\/job\/rd\/([a-f0-9]{24,32})/i) ||
    url.pathname.match(/\/viewjob\/([a-f0-9]{24,32})/i);
  if (match?.[1]) return match[1];

  return url.searchParams.get("job_id") ||
    url.searchParams.get("job") ||
    url.searchParams.get("jl") ||
    url.searchParams.get("jk") ||
    "";
}

function idFromRoot(root: ParentNode): string {
  const el = root instanceof HTMLElement ? root : (root as Element).parentElement || document.body;

  const explicitJobId = el.getAttribute("job-id") ||
    el.querySelector<HTMLElement>("[job-id]")?.getAttribute("job-id");
  if (explicitJobId) {
    return explicitJobId.replace(/^j_/i, "");
  }

  const card = el.closest<HTMLElement>(".job-card, [data-job-card='true']") ||
    el.querySelector<HTMLElement>(".job-card[data-active='true'], .job-card, [data-job-card='true']");

  const dataId = card?.getAttribute("data-job-id") ||
    card?.getAttribute("data-jobid") ||
    el.querySelector<HTMLElement>("[data-job-id]")?.getAttribute("data-job-id") ||
    el.querySelector<HTMLElement>(".save-job-button[data-job-id]")?.getAttribute("data-job-id");
  if (dataId) return dataId;

  const idAttr = card?.id || el.id || "";
  const matchId = idAttr.match(/^(?:r_|j_)?([a-f0-9]{24,32})$/i);
  if (matchId?.[1]) return matchId[1];

  const rdLink = el.querySelector<HTMLAnchorElement>("a[href*='/job/rd/']")?.href ||
    document.querySelector<HTMLAnchorElement>("a[href*='/job/rd/']")?.href;
  if (rdLink) {
    const rdMatch = rdLink.match(/\/job\/rd\/([a-f0-9]{24,32})/i);
    if (rdMatch?.[1]) return rdMatch[1];
  }

  const brazeAttr = el.querySelector<HTMLElement>("a[data-braze]")?.getAttribute("data-braze") ||
    el.getAttribute("data-braze");
  if (brazeAttr) {
    try {
      const parsed = JSON.parse(brazeAttr);
      if (parsed.job_id) return String(parsed.job_id);
    } catch {}
  }

  const payload = card?.getAttribute("data-jd-payload") ||
    el.querySelector<HTMLElement>("[data-jd-payload]")?.getAttribute("data-jd-payload");
  if (payload) {
    try {
      const parsed = JSON.parse(payload);
      if (parsed.jobId) return String(parsed.jobId);
    } catch {}
  }
  return "";
}

function dateFromPage(externalId: string): string | undefined {
  const detailDateEl = document.querySelector<HTMLElement>(
    "#job-meta .listed-date, .job-details-page .listed-date, .jdv-panel .listed-date, .job-view-content .listed-date",
  );
  const detailText = cleanText(detailDateEl?.getAttribute("datetime") || detailDateEl?.textContent);
  if (detailText) return detailText;

  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(".job-card, [data-job-card='true']"),
  );
  const card = cards.find((candidate) =>
    candidate.getAttribute("data-job-id") === externalId ||
    candidate.id.includes(externalId)
  ) ||
    document.querySelector<HTMLElement>(".job-card[data-active='true']") ||
    cards[0];

  const dateEl = card?.querySelector<HTMLElement>(
    ".job-listed-date, .listed-date, [data-automation='jobListedDate'], .listing-date, time",
  );
  const text = cleanText(dateEl?.getAttribute("datetime") || dateEl?.textContent);
  return text || undefined;
}

function companyFromPage(_title: string): string {
  const pageTitle = cleanText(document.title);
  const match = pageTitle.match(/^(.+?)\s+-\s+(.+?)\s+-\s+.*$/i);
  if (match?.[2]) return cleanText(match[2]);
  const twoPart = pageTitle.match(/^(.+?)\s+-\s+(.+?)$/i);
  if (twoPart?.[2] && !/jora/i.test(twoPart[2])) return cleanText(twoPart[2]);
  return "";
}

export const joraDefinition = {
  platform: "jora",
  detection: {
    host: /(?:^|\.)jora\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
    dom: "[data-js-split-view], .jdv-panel, #job-view, .job-details-page, .site-au.brand-jora, [class*='brand-jora']",
  },
  jobDescriptionRootSelectors: [
    "#job-view",
    ".job-view-content",
    ".job-details-page",
    "#job-description-container",
    "[class*='jdv-content']",
    ".jdv-content",
    ".jdv-panel",
    "[class*='job-details']",
    "[class*='job_description']",
    ".job-view",
    ".job-container",
  ],
  jobDescriptionSelectors: [
    "#job-description-container",
    "[id*='job-description']",
    "[class*='job-description']",
    ".job-description",
    "#job-description",
    ".jd-content",
    ".templatetext",
    ".description-content",
    "[data-automation='jobDescription']",
    ".job-view-content",
    "[class*='jdv-content']",
    ".jdv-content",
    ".job-abstract",
  ],
  jobDescriptionExpandSelectors: [
    "button[class*='show-more']",
    "[data-automation*='showMore']",
    "button.show-more",
    "[class*='JobDetails_showMore']",
  ],
  applicationRoots: [
    "form.application-form",
    "form[action*='/apply']",
    "form[action*='/applications']",
    ".quick-apply-modal form",
    "[data-quick-apply-form]",
    "[data-controller='quick-apply'] form",
    "form[action*='/users/sign_in']",
    ".login-form form",
  ],
  job: {
    roots: [
      ".job-details-page",
      "#job-view",
      ".job-view-content",
      ".jdv-content:not([data-hidden='true'])",
      ".jdv-content",
      ".jdv-panel:not([data-hidden='true'])",
      ".jdv-panel",
      ".job-container",
    ],
    title: [
      "#job-info-container h1",
      ".job-title.heading",
      ".job-title",
      "h1.job-title",
      "h1.heading",
      "h2.job-title",
      ".job-title a",
      "[data-automation='jobTitle']",
      "h1",
    ],
    company: [
      "#company-location-container .company",
      ".company",
      ".job-company",
      "[data-automation='jobCompany']",
      ".employer-name",
      "[class*='company-name']",
      "[class*='company']",
    ],
    location: [
      "#company-location-container .location",
      ".location",
      ".job-location",
      "a.job-location",
      "[data-automation='jobLocation']",
    ],
    description: [
      "#job-description-container",
      "[id*='job-description']",
      "[class*='job-description']",
      ".job-description",
      "#job-description",
      ".jd-content",
      ".templatetext",
      ".description-content",
      "[data-automation='jobDescription']",
      "[class*='jdv-content']",
      ".jdv-content",
      ".job-abstract",
    ],
    qualifications: [
      "[data-automation='qualifications'] .badge",
      "[class*='qualifications'] .tag",
    ],
    apply: [
      "a.apply-button",
      "a[href*='/job/rd/']",
      "a[href*='/apply']",
      "button[data-gtm*='apply']",
      "a[data-gtm*='apply']",
      ".quick-apply-button",
      "button.rounded-button.-primary",
      "a.job-link",
    ],
    id: ["[job-id]", "[data-job-id]", "[data-jobid]", "[data-jd-payload]", "a[href*='/job/rd/']"],
    idFromUrl,
    idFromRoot,
    dateFromPage,
    companyFromPage,
  },
  jobSelection: joraJobSelection,
} satisfies AtsProviderDefinition<"jora">;
