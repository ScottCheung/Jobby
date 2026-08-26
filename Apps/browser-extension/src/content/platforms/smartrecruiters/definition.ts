import type { AtsProviderDefinition } from "../platform-definition";
import { ensureSmartRecruitersResumeField } from "./file-adapter";

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1) || "";
  return /^(?:apply|application)$/i.test(last) ? segments.at(-2) || "" : last;
}

export const smartRecruitersDefinition = {
  platform: "smartrecruiters",
  detection: {
    host: /(?:^|\.)smartrecruiters\.com$/i,
    dom: "spl-input, spl-autocomplete, spl-dropzone, oc-application",
  },
  applicationRoots: [
    "oc-application",
    "oc-application-form",
    "[data-test='application-form']",
    "[data-testid='application-form']",
    "form[action*='smartrecruiters']",
  ],
  adaptFormFields: (fields, root) =>
    ensureSmartRecruitersResumeField("smartrecruiters", fields, root),
  job: {
    roots: ["[data-test='job-detail']", "main.job-details", "[itemscope][itemtype*='JobPosting' i]"],
    title: ["[itemprop='title']", "[data-test='job-title']", "h1"],
    company: ["[itemprop='hiringOrganization'] [itemprop='name']", "[data-test='company-name']"],
    location: ["[itemprop='jobLocation']", "[data-test='job-location']"],
    description: ["[itemprop='description']", "[data-test='job-description']"],
    apply: ["[data-test='apply-button']", "a[href*='/apply']", "button[type='submit']"],
    id: ["[itemprop='identifier']", "[data-job-id]"],
    idFromUrl: lastJobPathSegment,
  },
} satisfies AtsProviderDefinition<"smartrecruiters">;
