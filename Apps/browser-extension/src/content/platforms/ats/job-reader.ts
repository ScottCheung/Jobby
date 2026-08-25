import type {
  AtsJobSnapshot,
  PageInspection,
} from "../../../shared/contracts/page-inspection";
import { extractTechnologyKeywords } from "../../technology-keywords";
import { extractStructuredText } from "../../text-utils";
import { capturedJobDateFields } from "../../../shared/utils/date-formatter";
import {
  datePostedFromDom,
  jobPostingFromMicrodata,
  jobPostingFromStructuredData,
  stableId,
} from "../generic/job-reader";

export type AtsJobPlatform = AtsJobSnapshot["platform"];

type AtsJobConfig = {
  roots: readonly string[];
  title: readonly string[];
  company: readonly string[];
  location: readonly string[];
  description: readonly string[];
  apply: readonly string[];
  id: readonly string[];
  idFromUrl: (url: URL) => string;
  idFromRoot?: (root: ParentNode) => string;
  locationFromRoot?: (root: ParentNode) => string;
  dateFromPage?: (externalId: string) => string | undefined;
};

const CONFIGS: Record<AtsJobPlatform, AtsJobConfig> = {
  glassdoor: {
    roots: ["[class*='JobDetails_jobDetailsContainer']", "[data-test='job-details-header']"],
    title: ["[id^='jd-job-title-']", "[data-test='job-title']", "h1"],
    company: ["[data-test='job-details-header'] h4", "[data-test='employer-name']"],
    location: ["[data-test='location']", "[data-test='job-location']"],
    description: ["[class*='JobDetails_jobDescription']", "[data-test='job-description']"],
    apply: ["[data-test='applyButton']", "a[href*='/partner/jobListing.htm']"],
    id: ["[data-jobid]", "[data-job-id]"],
    idFromUrl: (url) => url.searchParams.get("jl") || url.searchParams.get("jobListingId") || "",
    idFromRoot: glassdoorIdFromRoot,
    dateFromPage: glassdoorDateFromPage,
  },
  workday: {
    roots: ["[data-automation-id='jobPostingPage']", "[data-automation-id='jobDetails']"],
    title: ["[data-automation-id='jobPostingHeader'] h2", "[data-automation-id='jobPostingHeader']", "h1", "h2"],
    company: ["[data-automation-id='company']", "[data-automation-id='companyName']"],
    location: ["[data-automation-id='locations']", "[data-automation-id='location']"],
    description: ["[data-automation-id='jobPostingDescription']", "[data-automation-id='jobDescription']"],
    apply: ["[data-automation-id='applyButton']", "a[href*='/apply']"],
    id: ["[data-automation-id='jobReqId']", "[data-automation-id='requisitionId']"],
    idFromUrl: (url) => url.searchParams.get("jobRequisitionId") || url.pathname.match(/\b([A-Z]+-?\d{2,})\b/i)?.[1] || "",
    idFromRoot: workdayIdFromRoot,
  },
  greenhouse: {
    roots: [".job-post-container", "main.job-post", "#app_body", "[data-qa='job-post']", "main#main"],
    title: [".job__title h1", "h1.app-title", ".app-title", "h1"],
    company: [".company-name", "[data-company-name]", "[itemprop='hiringOrganization'] [itemprop='name']"],
    location: [".job__location", ".location", "[itemprop='jobLocation']"],
    description: [".job__description", "#job_description", "#content", "[data-qa='job-description']"],
    apply: ["button[aria-label='Apply']", "#apply_button", "a[href*='#app']", "button[type='submit']"],
    id: ["[data-job-id]", "input[name='job_id']"],
    idFromUrl: (url) => url.searchParams.get("gh_jid") || url.pathname.match(/\/jobs\/(\d+)/i)?.[1] || "",
  },
  lever: {
    roots: [".posting-page", "[data-qa='posting-page']", "main.posting"],
    title: [".posting-headline h2", "[data-qa='posting-name']", "h1"],
    company: ["[data-qa='company-name']", ".posting-company"],
    location: [".posting-categories .location", ".sort-by-location", "[data-qa='location']"],
    description: ["[data-qa='job-description']", ".posting-description", ".section-wrapper.page-full-width"],
    apply: ["a.postings-btn", "a[href$='/apply']", "button[type='submit']"],
    id: ["[data-posting-id]", "input[name='postingId']"],
    idFromUrl: lastJobPathSegment,
  },
  ashby: {
    roots: ["#root", ".ashby-job-posting-left-pane", "[data-testid='job-posting']", "[data-testid='job-posting-page']"],
    title: [".ashby-job-posting-heading", "[data-testid='job-title']", "h1"],
    company: ["[data-testid='company-name']"],
    location: ["[data-testid='job-location']", "[class*='location' i]"],
    description: [".ashby-job-posting-description", "[data-testid='job-description']", "[class*='description' i]"],
    apply: ["a[href$='/application']", "button[data-testid*='apply' i]"],
    id: ["[data-job-id]"],
    idFromUrl: lastJobPathSegment,
    locationFromRoot: (root) => valueAfterHeading(root, "Location"),
  },
  smartrecruiters: {
    roots: ["[data-test='job-detail']", "main.job-details", "[itemscope][itemtype*='JobPosting' i]"],
    title: ["[itemprop='title']", "[data-test='job-title']", "h1"],
    company: ["[itemprop='hiringOrganization'] [itemprop='name']", "[data-test='company-name']"],
    location: ["[itemprop='jobLocation']", "[data-test='job-location']"],
    description: ["[itemprop='description']", "[data-test='job-description']"],
    apply: ["[data-test='apply-button']", "a[href*='/apply']", "button[type='submit']"],
    id: ["[itemprop='identifier']", "[data-job-id]"],
    idFromUrl: lastJobPathSegment,
  },
  taleo: {
    roots: ["#requisitionDescriptionInterface", "#jobdetail", "[data-qa='job-detail']"],
    title: ["[id*='reqTitleLinkAction']", "[id*='job-title' i]", ".titlepage", "h1"],
    company: ["[id*='company' i]", "[class*='company' i]"],
    location: ["[id*='location' i]", "[class*='location' i]"],
    description: [".mastercontentpanel3", ".editablesection", ".jobdescription", "[id*='job-description' i]", "[class*='description' i]"],
    apply: ["[id*='apply' i]", "a[href*='apply']"],
    id: ["[data-job-id]", "[id*='requisition' i]"],
    idFromUrl: (url) => url.searchParams.get("job") || url.searchParams.get("jobid") || "",
    idFromRoot: taleoIdFromRoot,
  },
  icims: {
    roots: [".iCIMS_JobContainer", "#iCIMS_JobContent", "#iCIMS_SubHeader", ".iCIMS_MainWrapper", "[class*='iCIMS_Job']", "[id*='iCIMS']"],
    title: [".iCIMS_Header h1", ".iCIMS_JobHeader h1", ".iCIMS_JobTitle", "h1.iCIMS_Header", "h1"],
    company: [".iCIMS_Company", "[data-test='company-name']", ".iCIMS_JobHeaderGroup"],
    location: [".iCIMS_JobLocation", ".iCIMS_JobHeaderGroup .iCIMS_JobHeaderData", "[class*='iCIMS_JobHeaderLocation']", ".location"],
    description: [".iCIMS_JobContent", ".iCIMS_Expandable_Content", "[class*='iCIMS_JobDetails']", ".iCIMS_JobDescription"],
    apply: ["a.iCIMS_ApplyOnline", "a[href*='login=apply']", "[class*='iCIMS_ApplyButton']", "a[href*='apply']", "button[type='submit']"],
    id: ["[data-job-id]", "[data-jobid]", ".iCIMS_JobId"],
    idFromUrl: (url) => url.searchParams.get("jobId") || url.pathname.match(/\/jobs\/(\d+)/i)?.[1] || "",
  },
  successfactors: {
    roots: ["#rcm_job_details", ".jobDisplay", ".sf-job-detail", "[id*='jobDetail']", "#job-details-page"],
    title: [".jobTitle", "[id*='jobTitle']", "h1.title", "h1"],
    company: [".companyName", "[id*='company']"],
    location: [".jobLocation", "[id*='jobLocation']", ".location"],
    description: [".jobDescription", "[id*='jobDescription']", ".sf-description", "[class*='jobDisplay']"],
    apply: ["a[href*='apply']", "button[id*='apply']", "a.applyButton", "[data-automation-id='applyButton']"],
    id: ["[data-jobid]", "[id*='jobId']", ".jobId"],
    idFromUrl: (url) => url.searchParams.get("jobId") || url.searchParams.get("career_job_req_id") || url.pathname.match(/\/job\/[^/]+-(\d+)/i)?.[1] || "",
  },
  oracle: {
    roots: [".cx-job-details", "cx-job-details", "[data-qa='oracle-cloud-candidate-experience']", "#job-details", ".job-details-page"],
    title: [".cx-job-details__title", "h1.job-title", "h1", "[data-qa='job-title']"],
    company: [".cx-job-details__employer", "[data-qa='company-name']", ".company-name"],
    location: [".cx-job-details__location", "[data-qa='job-location']", ".job-location"],
    description: [".cx-job-details__description", "[data-qa='job-description']", ".job-description"],
    apply: ["button[data-qa='apply-button']", "a[data-qa='apply-button']", "a[href*='apply']"],
    id: ["[data-qa='job-id']", "[data-job-id]"],
    idFromUrl: (url) => url.searchParams.get("requisitionId") || url.pathname.match(/\/job\/(\d+)/i)?.[1] || "",
  },
  workable: {
    roots: ["[data-ui='overview']", "[data-ui='job-details']", "main", "#app"],
    title: ["[data-ui='job-title']", "h1"],
    company: ["[data-ui='company-name']", ".company-name"],
    location: ["[data-ui='job-location']", "[data-ui='job-workplace']", ".job-location"],
    description: ["[data-ui='job-description']", "[data-ui='job-requirements']", "[data-ui='job-overview']", "[data-ui='section']"],
    apply: ["[data-ui='application-form-tab']", "a[href*='/apply']", "[data-ui='apply-button']", "button[type='submit']"],
    id: ["[data-job-id]"],
    idFromUrl: lastJobPathSegment,
  },
  bamboohr: {
    roots: ["#BambooHR", "#BambooHR-ATS-Jobs-Item", ".BambooHR-ATS-Jobs-Item", "#job-details"],
    title: [".BambooHR-ATS-Jobs-Item h2", "h1.BambooHR-ATS-Jobs-Title", "h2", "h1"],
    company: [".BambooHR-ATS-Jobs-Company", "[data-company]"],
    location: [".BambooHR-ATS-Jobs-Location", "[data-location]"],
    description: [".BambooHR-ATS-Jobs-Description", "#jobDescription", ".BambooHR-ATS-Jobs-Item"],
    apply: ["a[href*='/apply']", "button[data-action='apply']", ".BambooHR-ATS-Jobs-ApplyButton"],
    id: ["[data-job-id]", "input[name='job_id']"],
    idFromUrl: (url) => url.searchParams.get("id") || url.searchParams.get("jobId") || lastJobPathSegment(url),
  },
};

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1) || "";
  return /^(?:apply|application)$/i.test(last) ? segments.at(-2) || "" : last;
}

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function visible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  let parent = element.parentElement;
  for (let depth = 0; parent && depth < 24; depth += 1) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === "none" || parentStyle.visibility === "hidden") return false;
    parent = parent.parentElement;
  }
  return true;
}

function firstElement(root: ParentNode, selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element && visible(element)) return element;
  }
  return null;
}

function firstText(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
      if (!visible(element)) continue;
      const value = cleanText(
        element.getAttribute("content") ||
          element.getAttribute("value") ||
          element.textContent,
      );
      if (value) return value;
    }
  }
  return "";
}

function descriptionText(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const values = Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter(visible)
      .map((element) => extractStructuredText(element))
      .filter((value) => value.length >= 40);
    if (values.length > 0) {
      return Array.from(new Set(values)).join("\n\n").slice(0, 18_000);
    }
  }
  return "";
}

function valueFromElement(element: HTMLElement | null): string {
  if (!element) return "";
  return cleanText(
    element.getAttribute("content") ||
      element.getAttribute("value") ||
      element.getAttribute("data-job-id") ||
      element.textContent,
  );
}

function firstValue(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const value = valueFromElement(root.querySelector<HTMLElement>(selector));
    if (value) return value;
  }
  return "";
}

function dateFromRoot(root: ParentNode): string | undefined {
  const element = root.querySelector<HTMLElement>(
    [
      "[itemprop='datePosted']",
      "[data-automation-id*='posted' i]",
      "[data-testid*='posted' i]",
      "[data-test*='posted' i]",
      "time[datetime]",
    ].join(", "),
  );
  const value = cleanText(
    element?.getAttribute("content") ||
      element?.getAttribute("datetime") ||
      element?.textContent,
  );
  return value || undefined;
}

function companyFromMetadata(): string {
  return cleanText(
    document.querySelector<HTMLMetaElement>("meta[property='og:site_name']")?.content ||
      document.querySelector<HTMLMetaElement>("meta[name='application-name']")?.content,
  );
}

function glassdoorIdFromRoot(root: ParentNode): string {
  const titleId = root.querySelector<HTMLElement>("[id^='jd-job-title-']")?.id || "";
  const titleMatch = titleId.match(/^jd-job-title-(\d+)$/);
  if (titleMatch?.[1]) return titleMatch[1];

  const brandViews = (
    root instanceof HTMLElement && root.hasAttribute("data-brandviews")
      ? root
      : root.querySelector<HTMLElement>("[data-brandviews]")
  )?.getAttribute("data-brandviews") || "";
  const brandViewsMatch = brandViews.match(/(?:^|[&;,:])jlid=(\d+)/i);
  if (brandViewsMatch?.[1]) return brandViewsMatch[1];

  return glassdoorSelectedCard()?.getAttribute("data-jobid") || "";
}

function glassdoorSelectedCard(): HTMLElement | null {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-test='jobListing'][data-jobid]"),
  ).find((candidate) =>
    candidate.getAttribute("data-selected") === "true" ||
    candidate.getAttribute("aria-selected") === "true" ||
    Boolean(candidate.querySelector("[data-selected='true'], [aria-selected='true']")) ||
    candidate.classList.contains("selected") ||
    /(?:^|\s)[^\s]*[_-]selected__[^\s]*(?:\s|$)/i.test(candidate.className)
  ) || null;
}

function glassdoorDateFromPage(externalId: string): string | undefined {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-test='jobListing'][data-jobid]"),
  );
  const card = cards.find((candidate) => candidate.getAttribute("data-jobid") === externalId) ||
    glassdoorSelectedCard();
  const age = card?.querySelector<HTMLElement>(
    "[data-test='job-age'], [class*='listingAge'], time",
  );
  const value = cleanText(age?.getAttribute("datetime") || age?.textContent);
  return value || undefined;
}

function workdayIdFromRoot(root: ParentNode): string {
  const value = firstValue(root, [
    "[data-automation-id='jobReqId']",
    "[data-automation-id='requisitionId']",
  ]);
  return value.match(/([A-Z]{1,10}[-_]\d{2,})/)?.[1] || value;
}

function taleoIdFromRoot(root: ParentNode): string {
  return firstValue(root, [
    "[id*='reqContestNumberValue']",
    "[id*='jobNumber']",
    "[data-job-id]",
  ]);
}

function valueAfterHeading(root: ParentNode, label: string): string {
  const heading = Array.from(root.querySelectorAll<HTMLElement>("h2, h3, h4, dt"))
    .find((candidate) => cleanText(candidate.textContent).toLowerCase() === label.toLowerCase());
  if (!heading) return "";
  const section = heading.closest<HTMLElement>("section, [class*='section' i]") || heading.parentElement;
  const candidates = section
    ? Array.from(section.querySelectorAll<HTMLElement>("p, dd, [class*='value' i]"))
    : [];
  return candidates.map((candidate) => cleanText(candidate.textContent)).find(Boolean) ||
    cleanText(heading.nextElementSibling?.textContent);
}

function companyFromPageTitle(platform: AtsJobPlatform, title: string): string {
  if (platform === "workday") {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("header h1, h1"))) {
      const match = cleanText(element.textContent).match(/^Careers at (.+)$/i);
      if (match?.[1]) return cleanText(match[1]);
    }
  }
  if (platform === "taleo") {
    const alt = document.querySelector<HTMLImageElement>("img[alt$=' Taleo']")?.alt || "";
    if (alt) return cleanText(alt.replace(/\s+Taleo$/i, ""));
  }

  const pageTitle = cleanText(document.title);
  if (!pageTitle) return "";

  if (platform === "greenhouse") {
    const prefix = `Job Application for ${title} at `;
    return pageTitle.startsWith(prefix) ? cleanText(pageTitle.slice(prefix.length)) : "";
  }
  if (platform === "lever") {
    const suffix = ` - ${title}`;
    return pageTitle.endsWith(suffix) ? cleanText(pageTitle.slice(0, -suffix.length)) : "";
  }
  if (platform === "ashby") {
    const prefix = `${title} @ `;
    return pageTitle.startsWith(prefix) ? cleanText(pageTitle.slice(prefix.length)) : "";
  }
  if (platform === "workable") {
    const suffix = ` - ${title}`;
    if (pageTitle.endsWith(suffix)) return cleanText(pageTitle.slice(0, -suffix.length));
    const prefix = `${title} - `;
    if (pageTitle.startsWith(prefix)) return cleanText(pageTitle.slice(prefix.length));
  }
  if (platform === "bamboohr") {
    const match = pageTitle.match(/^(.+?)\s+-\s+.*$/i);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

export function readAtsJobPage(platform: AtsJobPlatform): PageInspection {
  const config = CONFIGS[platform];
  const url = window.location.href;
  const root = firstElement(document, config.roots);
  const structured = jobPostingFromStructuredData() || jobPostingFromMicrodata();

  // A supported hostname can also host search, account, and application
  // routes. Without a platform job root or JobPosting data this provider is
  // explicitly unable to handle the page, allowing the router to try generic.
  if (!root && !structured) {
    return {
      kind: "not_job_page",
      platform,
      url,
      reason: `No ${platform} job detail root or JobPosting data was found.`,
    };
  }

  const source = root || document;
  const domTitle = root ? firstText(source, config.title) : "";
  const structuredMatchesRoot = !domTitle || Boolean(structured?.title && (() => {
    const left = cleanText(domTitle).toLowerCase();
    const right = cleanText(structured.title).toLowerCase();
    return left === right || left.includes(right) || right.includes(left);
  })());
  const rootStructured = structuredMatchesRoot ? structured : null;
  const title = domTitle || rootStructured?.title || "";
  const description = descriptionText(source, config.description) || rootStructured?.description || "";
  const company = firstText(source, config.company) || rootStructured?.company || companyFromPageTitle(platform, title) || companyFromMetadata();
  const location = firstText(source, config.location) || config.locationFromRoot?.(source) || rootStructured?.location || "";
  const applyAction = Boolean(firstElement(source, config.apply));
  const enoughEvidence = Boolean(title) && (
    Boolean(rootStructured) || description.length >= 40 || (Boolean(company) && applyAction)
  );

  if (!enoughEvidence) {
    return {
      kind: "not_job_page",
      platform,
      url,
      reason: `The ${platform} provider could not confirm a complete job posting.`,
    };
  }

  const parsedUrl = new URL(url);
  const externalId =
    config.idFromRoot?.(source) ||
    firstValue(source, config.id) ||
    config.idFromUrl(parsedUrl) ||
    rootStructured?.externalId ||
    stableId(`${platform}|${url}|${title}|${company}`);

  const rawDatePosted =
    rootStructured?.datePosted ||
    config.dateFromPage?.(externalId) ||
    dateFromRoot(source) ||
    (!root ? datePostedFromDom() : undefined);
  const snapshot: AtsJobSnapshot = {
    platform,
    externalId,
    url,
    title,
    company: company || "Unknown company",
    location: location || undefined,
    ...capturedJobDateFields(rawDatePosted),
    description: description || undefined,
    technologies: extractTechnologyKeywords(description),
  };
  return { kind: "job", snapshot };
}
