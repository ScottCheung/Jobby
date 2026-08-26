import type { AtsProviderDefinition } from "../platform-definition";

export const successFactorsDefinition = {
  platform: "successfactors",
  detection: {
    host: /(?:^|\.)(?:successfactors|sapsf)\.(?:com|eu)$/i,
    dom: "#rcm_job_details, .jobDisplay, .sf-job-detail, [id*='successfactors' i], [class*='successfactors' i]",
  },
  applicationRoots: [
    "#rcm_job_application",
    ".sf-application-form",
    "form[action*='successfactors']",
    "form[id*='jobApply']",
    "[data-qa='application-form']",
  ],
  job: {
    roots: ["#rcm_job_details", ".jobDisplay", ".sf-job-detail", "[id*='jobDetail']", "#job-details-page"],
    title: [".jobTitle", "[id*='jobTitle']", "h1.title", "h1"],
    company: [".companyName", "[id*='company']"],
    location: [".jobLocation", "[id*='jobLocation']", ".location"],
    description: [".jobDescription", "[id*='jobDescription']", ".sf-description", "[class*='jobDisplay']"],
    apply: ["a[href*='apply']", "button[id*='apply']", "a.applyButton", "[data-automation-id='applyButton']"],
    id: ["[data-jobid]", "[id*='jobId']", ".jobId"],
    idFromUrl: (url) => url.searchParams.get("jobId") || url.searchParams.get("career_job_req_id") || url.pathname.match(/\/job\/[^/]+-(\d+)/i)?.[1] || "",
  },
} satisfies AtsProviderDefinition<"successfactors">;
