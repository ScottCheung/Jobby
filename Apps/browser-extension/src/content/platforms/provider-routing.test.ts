// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import { detectDedicatedPlatform } from "./provider-routing";

function locationFor(hostname: string, pathname = "/"): Pick<Location, "hostname" | "pathname"> {
  return { hostname, pathname } as Pick<Location, "hostname" | "pathname">;
}

describe("platform provider routing", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it.each([
    ["www.linkedin.com", "/jobs/view/1", "linkedin"],
    ["www.seek.com.au", "/job/1", "seek"],
    ["www.seek.co.nz", "/job/1", "seek"],
    ["au.indeed.com", "/viewjob", "indeed"],
    ["au.indeed.com.au", "/viewjob", "indeed"],
    ["www.indeed.de", "/viewjob", "indeed"],
    ["www.glassdoor.com.au", "/Job/australia-software-engineer-jobs.htm", "glassdoor"],
    ["tenant.myworkdayjobs.com", "/job/role/R-1", "workday"],
    ["job-boards.greenhouse.io", "/company/jobs/1", "greenhouse"],
    ["jobs.eu.lever.co", "/company/role", "lever"],
    ["jobs.ashbyhq.com", "/company/role", "ashby"],
    ["jobs.smartrecruiters.com", "/Company/role", "smartrecruiters"],
    ["jobs.taleo.net", "/careersection/jobdetail.ftl", "taleo"],
    ["careers-acme.icims.com", "/jobs/123/role", "icims"],
    ["career4.successfactors.com", "/career?jobId=123", "successfactors"],
    ["fa.ocs.oraclecloud.com", "/hcmUI/CandidateExperience/en/sites/CX/job/123", "oracle"],
    ["apply.workable.com", "/company/j/123ABC", "workable"],
    ["acme.bamboohr.com", "/careers/123", "bamboohr"],
  ] as const)("routes %s%s to %s", (hostname, pathname, expected) => {
    expect(detectDedicatedPlatform(locationFor(hostname, pathname))).toBe(expected);
  });

  it("recognises a white-label ATS only from a dedicated component marker", () => {
    document.body.innerHTML = "<div data-automation-id='jobApplicationPage'></div>";
    expect(detectDedicatedPlatform(locationFor("careers.example.com"))).toBe("workday");
  });

  it.each([
    ["<main class='job-post-container'></main>", "greenhouse"],
    ["<main class='posting-page'></main>", "lever"],
    ["<h1 class='ashby-job-posting-heading'></h1>", "ashby"],
    ["<div id='iCIMS_Header'></div>", "icims"],
    ["<div id='rcm_job_details'></div>", "successfactors"],
    ["<div data-qa='oracle-cloud-candidate-experience'></div>", "oracle"],
    ["<div data-ui='job-title'></div>", "workable"],
    ["<div id='BambooHR'></div>", "bamboohr"],
  ] as const)("routes a current white-label marker to %s", (html, platform) => {
    document.body.innerHTML = html;
    expect(detectDedicatedPlatform(locationFor("careers.example.com"))).toBe(platform);
  });

  it("leaves unknown job sites for the generic fallback", () => {
    document.body.innerHTML = "<main><h1>Software Engineer</h1></main>";
    expect(detectDedicatedPlatform(locationFor("careers.example.com"))).toBeNull();
  });
});
