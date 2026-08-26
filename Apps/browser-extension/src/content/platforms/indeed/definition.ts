import type { ProviderDefinition } from "../platform-definition";

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
} satisfies ProviderDefinition<"indeed"> & {
  applicationRoots: readonly string[];
};
