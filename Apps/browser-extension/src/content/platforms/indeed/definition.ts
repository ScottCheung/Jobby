import type { ProviderDefinition } from "../platform-definition";
import { readIndeedJobPage } from "./job-reader";
import { readIndeedPageWhenReady } from "./readiness";

export const indeedDefinition = {
  platform: "indeed",
  detection: {
    host: /(?:^|\.)indeed\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i,
  },
  jobDescriptionRootSelectors: [
    ".jobsearch-RightPane",
    ".jobsearch-ViewJobPaneWrapper",
    "#jobsearch-ViewjobPane",
    "#viewJobSSRRoot",
    ".jobsearch-JobComponent",
    ".fastviewjob",
    "[data-testid='jobsearch-ViewjobPane']",
    "#jobDescriptionText",
    "[class*='jobsearch-jobDescriptionText']",
    "[data-testid='jobsearch-jobDescriptionText']",
    "#jobDescriptionSection",
    "[data-testid='jobDescriptionText']",
    ".jobsearch-JobComponent-description",
  ],
  jobDescriptionSelectors: [
    "#jobDescriptionText",
    "[class*='jobsearch-jobDescriptionText']",
    "[data-testid='jobsearch-jobDescriptionText']",
    "#jobDescriptionSection",
    "[data-testid='jobDescriptionText']",
    ".jobsearch-JobComponent-description",
  ],
  applicationRoots: [
    "#ia-container",
    "[data-testid='ia-container']",
    "[data-testid='application-form']",
    "form[action*='indeed']",
  ],
  job: {
    read: () => readIndeedJobPage(),
    fallback: true,
    readiness: {
      readWhenReady: readIndeedPageWhenReady,
    },
  },
} satisfies ProviderDefinition<"indeed"> & {
  applicationRoots: readonly string[];
};
