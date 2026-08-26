import type { AtsProviderDefinition } from "../platform-definition";

export const oracleDefinition = {
  platform: "oracle",
  detection: {
    host: /(?:^|\.)(?:oraclecloud|fa\.ocs\.oraclecloud)\.com$/i,
    dom: "[data-qa='oracle-cloud-candidate-experience'], .cx-job-details, cx-job-details, [id*='oracle' i]",
  },
  applicationRoots: [
    ".cx-application-flow",
    "form[action*='oraclecloud']",
    "form[action*='candidateExperience']",
    "[data-qa='application-form']",
    "#job-apply-page",
  ],
  job: {
    roots: [".cx-job-details", "cx-job-details", "[data-qa='oracle-cloud-candidate-experience']", "#job-details", ".job-details-page"],
    title: [".cx-job-details__title", "h1.job-title", "h1", "[data-qa='job-title']"],
    company: [".cx-job-details__employer", "[data-qa='company-name']", ".company-name"],
    location: [".cx-job-details__location", "[data-qa='job-location']", ".job-location"],
    description: [".cx-job-details__description", "[data-qa='job-description']", ".job-description"],
    apply: ["button[data-qa='apply-button']", "a[data-qa='apply-button']", "a[href*='apply']"],
    id: ["[data-qa='job-id']", "[data-job-id]"],
    idFromUrl: (url) => url.searchParams.get("requisitionId") || url.pathname.match(/\/job\/(\d+)/i)?.[1] || "",
  },
} satisfies AtsProviderDefinition<"oracle">;
