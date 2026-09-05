import type { AtsProviderDefinition } from "../platform-definition";
import { glassdoorJobSelection } from "./job-selection";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function selectedJobCard(): HTMLElement | null {
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

function idFromRoot(root: ParentNode): string {
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

  return selectedJobCard()?.getAttribute("data-jobid") || "";
}

function dateFromPage(externalId: string): string | undefined {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-test='jobListing'][data-jobid]"),
  );
  const card = cards.find((candidate) => candidate.getAttribute("data-jobid") === externalId) ||
    selectedJobCard();
  const age = card?.querySelector<HTMLElement>(
    "[data-test='job-age'], [class*='listingAge'], time",
  );
  const value = cleanText(age?.getAttribute("datetime") || age?.textContent);
  return value || undefined;
}

export const glassdoorDefinition = {
  platform: "glassdoor",
  detection: {
    host: /(?:^|\.)glassdoor\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
  },
  jobDescriptionRootSelectors: [
    "[class*='JobDetails_jobDetailsContainer']",
    "[data-test='job-details-header']",
    "[data-test='job-description-container']",
  ],
  jobDescriptionSelectors: [
    "[class*='JobDetails_jobDescription']",
    "[class*='JobDetails_jobDescriptionWrapper']",
    "[data-test='job-description']",
  ],
  jobDescriptionExpandSelectors: [
    "button[class*='JobDetails_showMore' i]",
    "button[class*='ShowMore' i]",
    "button[class*='showMore' i]",
    "button[class*='show-more' i]",
    "[data-test='show-more-button']",
    "[data-test='job-description-show-more']",
    "[data-test='show-more']",
    "[data-test='showMore']",
    "[class*='JobDetails_showMoreButton' i]",
    "[class*='JobDetails_showMore' i] button",
    "[class*='JobDetails_jobDescription' i] button",
    "[class*='JobDetails_jobDescriptionWrapper' i] button",
    "[class*='JobDetails_jobDetailsContainer' i] button",
  ],
  applicationRoots: [
    "[data-test='application-form']",
    "[data-testid='application-form']",
    "[data-test*='easy-apply' i] form",
    "form[action*='/apply']",
  ],
  job: {
    roots: ["[class*='JobDetails_jobDetailsContainer']", "[data-test='job-details-header']"],
    title: ["[id^='jd-job-title-']", "[data-test='job-title']", "h1"],
    company: ["[data-test='job-details-header'] h4", "[data-test='employer-name']"],
    location: ["[data-test='location']", "[data-test='job-location']"],
    description: ["[class*='JobDetails_jobDescription']", "[data-test='job-description']"],
    qualifications: [
      "[class*='JobDetails_qualifications']",
      "[class*='qualificationsSection']",
      "[data-test='job-qualifications']",
      "[data-test='qualifications']",
      "[class*='Qualifications_']",
      "[class*='qualifications' i]",
    ],
    apply: ["[data-test='applyButton']", "a[href*='/partner/jobListing.htm']"],
    id: ["[data-jobid]", "[data-job-id]"],
    idFromUrl: (url) => url.searchParams.get("jl") || url.searchParams.get("jobListingId") || "",
    idFromRoot,
    dateFromPage,
    readinessWaitUntilAttempt: 14,
    postingDateWaitUntilAttempt: 14,
  },
  jobSelection: glassdoorJobSelection,
} satisfies AtsProviderDefinition<"glassdoor">;
