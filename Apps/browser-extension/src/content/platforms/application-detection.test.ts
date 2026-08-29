// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import { readCurrentForm } from "../page-reader";
import { linkedinAdapter } from "./linkedin/adapter";

function visibleRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 480,
    height: 48,
    top: 0,
    right: 480,
    bottom: 48,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function setLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: new URL(url),
  });
}

describe("platform-specific application question detection", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    linkedinAdapter.invalidateApplicationRootCache();
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 480 });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 48 });
    HTMLElement.prototype.getBoundingClientRect = visibleRect;
  });

  it.each([
    {
      platform: "linkedin",
      url: "https://www.linkedin.com/jobs/view/123",
      root: `<section role="dialog" aria-modal="true"><h2>Apply to Acme</h2>
        <label for="platform-question">LinkedIn custom question *</label>
        <input id="platform-question" name="linkedin_question" />
        <button>Next</button></section>`,
      label: "LinkedIn custom question",
    },
    {
      platform: "seek",
      url: "https://www.seek.com.au/job/123/apply",
      root: `<form data-automation="applicationForm" action="/job/123/apply">
        <label for="platform-question">SEEK custom question *</label>
        <input id="platform-question" name="seek_question" />
        <button>Continue</button></form>`,
      label: "SEEK custom question",
    },
    {
      platform: "indeed",
      url: "https://au.indeed.com/viewjob?jk=123",
      root: `<section id="ia-container">
        <label for="platform-question">Indeed custom question *</label>
        <input id="platform-question" name="indeed_question" />
        <button>Continue</button></section>`,
      label: "Indeed custom question",
    },
    {
      platform: "glassdoor",
      url: "https://www.glassdoor.com.au/Job/software-engineer-jobs.htm?jl=123",
      root: `<form data-test="application-form" action="/apply">
        <label for="platform-question">Glassdoor custom question *</label>
        <input id="platform-question" name="glassdoor_question" />
        <button>Continue</button></form>`,
      label: "Glassdoor custom question",
    },
    {
      platform: "workday",
      url: "https://tenant.myworkdayjobs.com/en-US/jobs/apply/123",
      root: `<section data-automation-id="jobApplicationPage">
        <label for="platform-question">Workday custom question *</label>
        <input id="platform-question" name="workday_question" />
        <button>Continue</button></section>`,
      label: "Workday custom question",
    },
    {
      platform: "workday",
      url: "https://tenant.myworkdayjobs.com/en-US/Careers/job/Sydney/UI-Engineer_JR1043041/apply/applyManually",
      root: `<section data-automation-id="applyFlowPage">
        <div data-automation-id="formField-legalName--firstName"><label for="platform-question">Given Name *</label>
          <input id="platform-question" name="legalName--firstName" /></div>
        <button data-automation-id="pageFooterNextButton">Save and Continue</button>
      </section>`,
      label: "Given Name",
    },
    {
      platform: "greenhouse",
      url: "https://boards.greenhouse.io/acme/jobs/123#app",
      root: `<form id="application-form" class="application--form">
        <label for="platform-question">Greenhouse custom question *</label>
        <input id="platform-question" name="greenhouse_question" />
        <button>Submit application</button></form>`,
      label: "Greenhouse custom question",
    },
    {
      platform: "lever",
      url: "https://jobs.lever.co/acme/123/apply",
      root: `<form id="application-form">
        <label for="platform-question">Lever custom question *</label>
        <input id="platform-question" name="lever_question" />
        <button>Submit application</button></form>`,
      label: "Lever custom question",
    },
    {
      platform: "smartrecruiters",
      url: "https://jobs.smartrecruiters.com/Acme/123/apply",
      root: `<oc-application>
        <label for="platform-question">SmartRecruiters custom question *</label>
        <input id="platform-question" name="smartrecruiters_question" />
        <button>Continue</button></oc-application>`,
      label: "SmartRecruiters custom question",
    },
    {
      platform: "ashby",
      url: "https://jobs.ashbyhq.com/Acme/123/application",
      root: `<div id="form" class="ashby-application-form-container">
        <label for="platform-question">Ashby custom question *</label>
        <input id="platform-question" name="ashby_question" />
        <button>Submit application</button></div>`,
      label: "Ashby custom question",
    },
    {
      platform: "taleo",
      url: "https://jobs.taleo.net/careersection/application.ftl?job=123",
      root: `<form id="candidateApplication" action="/careersection/application.ftl">
        <label for="platform-question">Taleo custom question *</label>
        <input id="platform-question" name="taleo_question" />
        <button>Continue</button></form>`,
      label: "Taleo custom question",
    },
    {
      platform: "icims",
      url: "https://careers-acme.icims.com/jobs/123/apply",
      root: `<div id="iCIMS_ApplicationContainer">
        <label for="platform-question">iCIMS custom question *</label>
        <input id="platform-question" name="icims_question" />
        <button>Submit</button></div>`,
      label: "iCIMS custom question",
    },
    {
      platform: "successfactors",
      url: "https://career4.successfactors.com/career?jobId=123&apply=true",
      root: `<div id="rcm_job_application">
        <label for="platform-question">SuccessFactors custom question *</label>
        <input id="platform-question" name="successfactors_question" />
        <button>Apply</button></div>`,
      label: "SuccessFactors custom question",
    },
    {
      platform: "oracle",
      url: "https://fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/123/apply",
      root: `<div class="cx-application-flow">
        <label for="platform-question">Oracle custom question *</label>
        <input id="platform-question" name="oracle_question" />
        <button>Submit</button></div>`,
      label: "Oracle custom question",
    },
    {
      platform: "workable",
      url: "https://apply.workable.com/acme/j/123/apply",
      root: `<form data-ui="application-form">
        <label for="platform-question">Workable custom question *</label>
        <input id="platform-question" name="workable_question" />
        <button>Submit application</button></form>`,
      label: "Workable custom question",
    },
    {
      platform: "bamboohr",
      url: "https://acme.bamboohr.com/careers/123/apply",
      root: `<div id="BambooHR-ATS-Jobs-Apply">
        <label for="platform-question">BambooHR custom question *</label>
        <input id="platform-question" name="bamboohr_question" />
        <button>Submit Application</button></div>`,
      label: "BambooHR custom question",
    },
  ] as const)("uses the $platform form root instead of unrelated page controls", ({ platform, url, root, label }) => {
    setLocation(url);
    document.body.innerHTML = `
      <form id="site-navigation">
        <label for="job-search">Search jobs</label><input id="job-search" />
        <label for="email-signup">Job alert email</label><input id="email-signup" type="email" />
      </form>
      ${root}
    `;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.platform).toBe(platform);
    expect(inspection.fields).toEqual([
      expect.objectContaining({ label, required: true, type: "text" }),
    ]);
    expect(inspection.fields.some((field) => field.label === "Search jobs")).toBe(false);
    expect(inspection.fields.some((field) => field.label === "Job alert email")).toBe(false);
  });

  it("extracts all supported question types, accessible labels, options, and required state", () => {
    setLocation("https://tenant.myworkdayjobs.com/en-US/jobs/apply/123");
    document.body.innerHTML = `
      <label for="global-search">Search all jobs</label><input id="global-search" />
      <section data-automation-id="jobApplicationPage">
        <div class="form-field required"><span id="name-label">Preferred name</span><div><input id="preferred-name" aria-labelledby="name-label" /></div></div>
        <label for="motivation">Why do you want this role? (Optional)</label><textarea id="motivation"></textarea>
        <label for="years">Years of experience *</label><input id="years" type="number" />
        <label for="available">Available start date</label><input id="available" type="date" />
        <label for="work-rights">Work rights *</label>
        <select id="work-rights"><option value="">Select an option</option><option value="yes">Yes</option><option value="no">No</option></select>
        <fieldset><legend>Do you need sponsorship? *</legend>
          <label><input type="radio" name="sponsorship" value="yes" />Yes</label>
          <label><input type="radio" name="sponsorship" value="no" />No</label>
        </fieldset>
        <fieldset><legend>Which languages do you use? (Optional)</legend>
          <label><input type="checkbox" name="languages[]" value="typescript" />TypeScript</label>
          <label><input type="checkbox" name="languages[]" value="python" />Python</label>
        </fieldset>
        <label><input id="privacy" type="checkbox" required /> I agree to the privacy notice</label>
        <span id="location-label">Preferred office *</span>
        <div id="office" role="combobox" aria-labelledby="location-label" aria-controls="office-options">Choose</div>
        <div hidden><label for="old-question">Old hidden question</label><input id="old-question" /></div>
        <label for="duplicate-a">Employee referral</label><input id="duplicate-a" name="referral" />
        <label for="duplicate-b">Employee referral</label><input id="duplicate-b" name="referral" />
        <p id="email-error" role="alert">Email address is invalid</p>
        <button>Continue</button>
      </section>
      <div id="office-options" role="listbox"><div role="option">Sydney</div><div role="option">Melbourne</div></div>
    `;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;

    const fields = inspection.fields;
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Preferred name", type: "text", required: true }),
      expect.objectContaining({ label: "Why do you want this role?", type: "textarea", required: false }),
      expect.objectContaining({ label: "Years of experience", type: "number", required: true }),
      expect.objectContaining({ label: "Available start date", type: "date" }),
      expect.objectContaining({
        label: "Work rights",
        type: "select",
        required: true,
        options: [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }],
      }),
      expect.objectContaining({
        label: "Do you need sponsorship?",
        type: "radio",
        required: true,
        options: [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }],
      }),
      expect.objectContaining({
        label: "Which languages do you use?",
        type: "checkbox",
        required: false,
        options: [{ label: "TypeScript", value: "typescript" }, { label: "Python", value: "python" }],
      }),
      expect.objectContaining({ label: "I agree to the privacy notice", type: "checkbox", required: true }),
      expect.objectContaining({
        label: "Preferred office",
        type: "select",
        required: true,
        options: [{ label: "Sydney", value: "Sydney" }, { label: "Melbourne", value: "Melbourne" }],
      }),
    ]));
    expect(fields.filter((field) => field.label === "Employee referral")).toHaveLength(1);
    expect(fields.some((field) => field.label === "Old hidden question")).toBe(false);
    expect(fields.some((field) => /invalid/i.test(field.label))).toBe(false);
    expect(fields.some((field) => field.label === "Search all jobs")).toBe(false);
  });

  it("reads dynamically mounted fields inside open SmartRecruiters shadow roots", () => {
    setLocation("https://jobs.smartrecruiters.com/Acme/123/apply");
    const host = document.createElement("oc-application");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<spl-input label="City"></spl-input><button>Continue</button>`;
    shadow.querySelector("spl-input")?.attachShadow({ mode: "open" }).append(
      Object.assign(document.createElement("input"), { id: "city" }),
    );

    let inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "city", label: "City" }),
    ]));

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<label for="portfolio">Portfolio URL</label><input id="portfolio" type="url" />`;
    shadow.append(wrapper);
    inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "portfolio", label: "Portfolio URL", type: "url" }),
    ]));
  });

  it("targets Ashby's real resume field instead of its autofill-from-resume helper", () => {
    setLocation("https://jobs.ashbyhq.com/fetch-pet-health/e957bc51-1932-4c97-a9ac-eb1787594aec/application");
    document.body.innerHTML = `<div id="form">
      <div class="ashby-application-form-autofill-pane">
        <div role="presentation" class="ashby-application-form-autofill-input-root">
          <h3>Autofill from resume</h3><input type="file" accept="application/pdf,.pdf" />
        </div>
      </div>
      <div class="ashby-application-form-container">
        <div class="ashby-application-form-field-entry">
          <label for="_systemfield_resume">Resume *</label>
          <input id="_systemfield_resume" type="file" accept="application/pdf,.pdf" />
        </div>
        <button>Submit application</button>
      </div>
    </div>`;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.platform).toBe("ashby");
    expect(inspection.fields.filter((field) => field.type === "file")).toEqual([
      expect.objectContaining({
        id: "_systemfield_resume",
        label: "Resume",
        required: true,
      }),
    ]);
  });

  it("falls back to generic inspection only when a known provider has no owned form root", () => {
    setLocation("https://tenant.myworkdayjobs.com/custom/apply");
    document.body.innerHTML = `<form class="custom-application"><label for="email">Email</label><input id="email" type="email" /><button>Continue</button></form>`;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.platform).toBe("workday");
    expect(inspection.fields).toEqual([
      expect.objectContaining({ label: "Email", type: "email" }),
    ]);
  });

  it("keeps unknown application sites on generic fallback", () => {
    setLocation("https://careers.example.com/apply/123");
    document.body.innerHTML = `<form><label for="question">Tell us about yourself</label><textarea id="question"></textarea><button>Submit application</button></form>`;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.platform).toBe("generic");
    expect(inspection.fields[0]).toEqual(expect.objectContaining({ label: "Tell us about yourself", type: "textarea" }));
  });

  it("does not turn generic search and navigation controls into application questions", () => {
    setLocation("https://careers.example.com/jobs");
    document.body.innerHTML = `<nav><form><label for="search">Search jobs</label><input id="search" /><button>Search</button></form></nav>`;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("not_application_form");
    if (inspection.kind !== "not_application_form") return;
    expect(inspection.platform).toBe("generic");
  });

  it("merges an application consent field without importing unrelated document controls", () => {
    setLocation("https://careers.example.com/apply/123");
    document.body.innerHTML = `
      <nav><label for="global-search">Search jobs</label><input id="global-search" /></nav>
      <form class="application-form">
        <h2>Candidate information</h2>
        <label for="candidate-email">Email</label><input id="candidate-email" type="email" />
        <button>Continue</button>
      </form>
      <section><label><input id="privacy-consent" type="checkbox" required /> I agree to the privacy notice</label></section>
    `;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "candidate-email", label: "Email" }),
      expect.objectContaining({ id: "privacy-consent", label: "I agree to the privacy notice" }),
    ]));
    expect(inspection.fields.some((field) => field.id === "global-search")).toBe(false);
  });
});
