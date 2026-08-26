import type { AtsProviderDefinition } from "../platform-definition";

export const icimsDefinition = {
  platform: "icims",
  detection: {
    host: /(?:^|\.)(?:icims\.com|icims-candidateportal\.com)$/i,
    dom: "#iCIMS_Header, #iCIMS_JobContent, #iCIMS_SubHeader, [class*='iCIMS_'], [id*='icims' i], iframe[src*='icims.com']",
  },
  applicationRoots: [
    "#iCIMS_ApplicationContainer",
    "#iCIMS_JobContent",
    "#iCIMS_SubHeader",
    "form[action*='icims']",
    "[class*='iCIMS_Application']",
    "[data-test='application-form']",
  ],
  job: {
    roots: [".iCIMS_JobContainer", "#iCIMS_JobContent", "#iCIMS_SubHeader", ".iCIMS_MainWrapper", "[class*='iCIMS_Job']", "[id*='iCIMS']"],
    title: [".iCIMS_Header h1", ".iCIMS_JobHeader h1", ".iCIMS_JobTitle", "h1.iCIMS_Header", "h1"],
    company: [".iCIMS_Company", "[data-test='company-name']", ".iCIMS_JobHeaderGroup"],
    location: [".iCIMS_JobLocation", ".iCIMS_JobHeaderGroup .iCIMS_JobHeaderData", "[class*='iCIMS_JobHeaderLocation']", ".location"],
    description: [".iCIMS_JobContent", ".iCIMS_Expandable_Content", "[class*='iCIMS_JobDetails']", ".iCIMS_JobDescription"],
    apply: ["a.iCIMS_ApplyOnline", "a[href*='login=apply']", "[class*='iCIMS_ApplyButton']", "a[href*='apply']", "button[type='submit']"],
    id: ["[data-job-id]", "[data-jobid]", ".iCIMS_JobId"],
    idFromUrl: (url) => url.searchParams.get("jobId") || url.pathname.match(/\/jobs\/(\d+)/i)?.[1] || "",
  },
} satisfies AtsProviderDefinition<"icims">;
