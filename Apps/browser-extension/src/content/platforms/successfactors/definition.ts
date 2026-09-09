import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromSuccessFactorsRoot(root: ParentNode): string {
  for (const selector of [
    "#career_job_req_id",
    "#jobReqId",
    "[data-job-id]",
    "[data-jobid]",
    ".jobId",
  ]) {
    const element = root.querySelector<HTMLElement>(selector);
    const value = cleanText(
      element?.getAttribute("data-job-id") ||
        element?.getAttribute("value") ||
        element?.textContent,
    );
    if (value) return value;
  }

  const title = cleanText(root.querySelector<HTMLElement>("h1")?.textContent);
  return title.match(/\(([^()]+)\)\s*$/)?.[1] || "";
}

function companyFromSuccessFactorsPage(): string {
  const logoAlt = cleanText(
    document.querySelector<HTMLImageElement>("img.logo[alt], header img[alt]")?.alt,
  );
  if (logoAlt && !/successfactors/i.test(logoAlt)) return logoAlt;
  return "";
}

export const successFactorsDefinition = {
  platform: "successfactors",
  detection: {
    host: /(?:^|\.)(?:successfactors|sapsf)\.(?:com|eu)$/i,
    dom: "#rcm_job_details, #rcmJobApplicationCtr, #careerform, .jobDisplay, .sf-job-detail, [data-testid='sfTextField']",
  },
  applicationRoots: [
    "#rcmJobApplicationCtr",
    "#careerform",
    "#rcm_job_application",
    ".sf-application-form",
    "form[action*='successfactors']",
    "form[id*='jobApply']",
    "[data-qa='application-form']",
  ],
  job: {
    applicationPage: true,
    roots: ["#rcm_job_details", ".jobDisplay", ".sf-job-detail", "[id*='jobDetail']", "#job-details-page", "#rcmJobApplicationCtr"],
    title: [".jobTitle", "[id*='jobTitle']", "h1.title", "#rcmJobApplicationCtr h1", "h1"],
    company: [".companyName", "[id*='company']", "[data-company]"],
    companyFromPage: companyFromSuccessFactorsPage,
    location: [".jobLocation", "[id*='jobLocation']", ".location", "[data-location]"],
    description: [".jobDescription", "#jobDescription", "[id*='jobDescription']", ".sf-description", ".jobdescription", "[class*='jobDisplay']"],
    apply: ["#rcmJobApplicationCtr [id*='_submitBtn']", "#rcmJobApplicationCtr [id*='apply' i]", "a[href*='apply']", "button[id*='apply' i]", "a.applyButton", "[data-automation-id='applyButton']"],
    id: ["[data-jobid]", "[data-job-id]", "[id*='jobId']", ".jobId"],
    idFromRoot: idFromSuccessFactorsRoot,
    idFromUrl: (url) => url.searchParams.get("jobId") || url.searchParams.get("career_job_req_id") || url.pathname.match(/\/job\/[^/]+-(\d+)/i)?.[1] || "",
  },
} satisfies AtsProviderDefinition<"successfactors">;
