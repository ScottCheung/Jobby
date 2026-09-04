import type { AtsProviderDefinition } from "../platform-definition";

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const jobsIndex = segments.findIndex((segment) => segment.toLowerCase() === "jobs");
  return jobsIndex >= 0 ? segments[jobsIndex + 1] || "" : segments.at(-1) || "";
}

export const dayforceDefinition = {
  platform: "dayforce",
  detection: {
    host: /(?:^|\.)dayforcehcm\.com$/i,
    dom: "[test-id='job-details-dayforce-jobs'], [test-id='job-detail-title'], [test-id='manual-application']",
  },
  applicationRoots: [
    "[test-id='manual-application']",
    "[test-id*='application' i] form",
    "form:not(#site-navigation):not([role='search']):not([id*='search' i]):not([id*='nav' i])",
  ],
  job: {
    roots: [
      "[test-id='job-details-dayforce-jobs']",
      "#job-details-dayforce-jobs",
      "[test-id='job-detail-body']",
    ],
    title: ["[test-id='job-detail-title']", "h1"],
    company: ["[test-id='job-detail-company']", "[data-company]"],
    location: ["[test-id='job-detail-location-name']", "[test-id='job-details-location-item']"],
    description: ["[test-id='job-detail-body']", "[test-id='job-detail-description']"],
    apply: ["[test-id='apply-button']", "a[href*='/apply']", "button"],
    id: ["[test-id='job-detail-job-req-id']", "[data-job-id]"],
    idFromUrl: lastJobPathSegment,
  },
} satisfies AtsProviderDefinition<"dayforce">;
