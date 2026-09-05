// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import { readCurrentForm } from "../page-reader";
import { fillFormField } from "../dom/form-driver";
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
      url: "https://au.seek.com/job/94231469/apply?token=1~1bfade42-e6cc-4128-8e62-8334db0b2873",
      root: `<form data-automation="applicationForm" action="/job/94231469/apply">
        <label for="platform-question">SEEK custom question *</label>
        <input id="platform-question" name="seek_question" />
        <button>Continue</button></form>`,
      label: "SEEK custom question",
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
    {
      platform: "jora",
      url: "https://au.jora.com/job/Senior-Engineer-4ed7e4a8ac7496963d7be06e2ba13ddc/apply",
      root: `<form class="application-form" action="/apply">
        <label for="platform-question">Jora custom question *</label>
        <input id="platform-question" name="jora_question" />
        <button type="submit">Submit application</button></form>`,
      label: "Jora custom question",
    },
    {
      platform: "ziprecruiter",
      url: "https://www.ziprecruiter.com/job/123/apply",
      root: `<form class="job_apply_form" action="/apply">
        <label for="platform-question">ZipRecruiter custom question *</label>
        <input id="platform-question" name="ziprecruiter_question" />
        <button type="submit">Submit</button></form>`,
      label: "ZipRecruiter custom question",
    },
    {
      platform: "adzuna",
      url: "https://www.adzuna.com.au/details/123/apply",
      root: `<form class="apply-form" action="/apply">
        <label for="platform-question">Adzuna custom question *</label>
        <input id="platform-question" name="adzuna_question" />
        <button type="submit">Submit</button></form>`,
      label: "Adzuna custom question",
    },
    {
      platform: "wellfound",
      url: "https://wellfound.com/jobs/123/apply",
      root: `<form data-test="JobApplicationForm" action="/apply">
        <label for="platform-question">Wellfound custom question *</label>
        <input id="platform-question" name="wellfound_question" />
        <button type="submit">Submit</button></form>`,
      label: "Wellfound custom question",
    },
    {
      platform: "dice",
      url: "https://www.dice.com/job-detail/123/apply",
      root: `<form data-cy="easyApplyForm" action="/apply">
        <label for="platform-question">Dice custom question *</label>
        <input id="platform-question" name="dice_question" />
        <button type="submit">Submit</button></form>`,
      label: "Dice custom question",
    },
    {
      platform: "simplyhired",
      url: "https://www.simplyhired.com.au/job/123/apply",
      root: `<form data-testid="applyForm" action="/apply">
        <label for="platform-question">SimplyHired custom question *</label>
        <input id="platform-question" name="simplyhired_question" />
        <button type="submit">Submit</button></form>`,
      label: "SimplyHired custom question",
    },
    {
      platform: "micro1",
      url: "https://jobs.micro1.ai/post/aeda6c13-c58d-4e11-bf6a-edcb9fdf65c2?first_page=/home&last_page=/experts",
      root: `<form action="/apply">
        <label for="platform-question">micro1 custom question *</label>
        <input id="platform-question" name="micro1_question" />
        <button type="submit">Apply</button></form>`,
      label: "micro1 custom question",
    },
    {
      platform: "dayforce",
      url: "https://jobs.dayforcehcm.com/en-US/acme/CANDIDATEPORTAL/jobs/12345/apply",
      root: `<form test-id="manual-application">
        <label for="platform-question">Dayforce custom question *</label>
        <input id="platform-question" name="dayforce_question" />
        <button type="submit">Next</button></form>`,
      label: "Dayforce custom question",
    },
    {
      platform: "avature",
      url: "https://recruitment.macquarie.com/en_US/careers/ApplicationConfirmation?jobId=19902&source=LinkedIn.com&record=19902",
      root: `<div class="wizard" id="wizard-id-96"><form class="form--methods" id="manualRegisterMethodsForm">
        <label for="platform-question">Avature custom question *</label>
        <input id="platform-question" name="avature_question" />
        <button type="submit">Submit</button></form></div>`,
      label: "Avature custom question",
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

  it("extracts Avature form fields including MonthAndYearDateField and select controls", () => {
    setLocation("https://recruitment.macquarie.com/en_US/careers/ApplicationConfirmation?jobId=19902&source=LinkedIn.com&record=19902");
    document.head.innerHTML = `<meta name="avature.wizard.registrars" content="[{\"wizardId\":96}]">`;
    document.body.innerHTML = `
      <div class="wizard" id="wizard-id-96">
        <form class="form--methods" id="manualRegisterMethodsForm">
          <div class="fieldSpec StringField fieldSpecPadder" id="fieldSpecContainer5747">
            <label for="5747" id="5747-label" class="WizardFieldLabel tc_formLabel">First Name <span class="required">*</span></label>
            <input type="text" id="5747" name="5747" value="" class="field_5747" />
          </div>
          <div class="fieldSpec DropdownField fieldSpecPadder" id="fieldSpecContainer5748">
            <label for="5748" id="5748-label" class="WizardFieldLabel tc_formLabel">Country <span class="required">*</span></label>
            <select id="5748" name="5748">
              <option value="">Select country</option>
              <option value="AU">Australia</option>
            </select>
          </div>
          <div class="fieldSpec MonthAndYearDateField fieldSpecPadder" id="fieldSpecContainer5749">
            <label id="5749-label" class="WizardFieldLabel tc_formLabel">Availability Date <span class="required">*</span></label>
            <select id="5749_month" name="5749_month">
              <option value="">Month</option>
              <option value="01">January</option>
            </select>
            <select id="5749_year" name="5749_year">
              <option value="">Year</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <button type="submit">Save and continue</button>
        </form>
      </div>
    `;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.platform).toBe("avature");
    expect(inspection.fields).toEqual([
      expect.objectContaining({ label: "First Name", required: true, type: "text" }),
      expect.objectContaining({ label: "Country", required: true, type: "select" }),
      expect.objectContaining({ label: "Availability Date - Month", required: true, type: "select" }),
      expect.objectContaining({ label: "Availability Date - Year", required: true, type: "select" }),
    ]);
  });

  it("recognises Workday's application sign-in form", () => {
    setLocation("https://tenant.myworkdayjobs.com/en-US/Careers/login?redirect=%2Fen-US%2FCareers%2Fjob%2FSydney%2FUI-Engineer_JR1043041%2Fapply");
    document.body.innerHTML = `
      <main data-automation-id="signInContent">
        <form>
          <label for="email">Email Address *</label><input id="email" type="text" autocomplete="email" />
          <label for="password">Password *</label><input id="password" type="password" autocomplete="current-password" />
          <label for="website">Enter website. This input is for robots only, do not enter if you're human.</label>
          <input id="website" name="website" />
          <button data-automation-id="signInSubmitButton">Sign In</button>
        </form>
      </main>
    `;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.platform).toBe("workday");
    expect(inspection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "email", label: "Email Address", type: "text" }),
      expect.objectContaining({ id: "password", label: "Password", type: "password" }),
    ]));
    expect(inspection.fields.some((field) => field.id === "website")).toBe(false);
  });

  it("recognises SEEK's form controls when the application page has no form element", () => {
    setLocation(
      "https://au.seek.com/job/94120995/apply?token=1~1bfade42-e6cc-4128-8e62-8334db0b2873",
    );
    document.body.innerHTML = `
      <div data-automation="job-header"><h1>Senior Software Engineer</h1></div>
      <fieldset role="radiogroup" aria-label="Resumé">
        <label><input name="document-select" type="radio" value="resume-1" />CV.pdf</label>
      </fieldset>
      <div data-testid="resumeFileInput">
        <label for="resume-fileFile">Upload a reséumé</label>
        <input id="resume-fileFile" data-testid="file-input" type="file" style="display: none" />
        <button data-testid="upload-button">Upload</button>
      </div>
      <label for="cover-letter">Write a cover letter</label>
      <textarea id="cover-letter" data-testid="coverLetterTextInput"></textarea>
      <button data-testid="continue-button">Continue</button>
    `;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.action).toBe("next");
    expect(inspection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Resumé", type: "radio" }),
      expect.objectContaining({ id: "resume-fileFile", type: "file" }),
      expect.objectContaining({ id: "cover-letter", type: "textarea" }),
    ]));
  });

  it("recognises SEEK generated questionnaire radio groups by their labelled fieldset", () => {
    setLocation("https://au.seek.com/job/94310194/apply/role-requirements");
    document.body.innerHTML = `
      <fieldset id="question-1" role="radiogroup" aria-labelledby="question-1-label">
        <legend id="question-1-label"><strong>Do you currently have Australian working rights?</strong></legend>
        <div><input id="id-_r_31_" style="opacity: 0; position: absolute" type="radio" name="questionnaire.indirect_question-1" value="generated_0" />
          <label for="id-_r_31_"><span>Australian Citizen</span></label></div>
        <div><input id="id-_r_34_" style="opacity: 0; position: absolute" type="radio" name="questionnaire.indirect_question-1" value="generated_1" />
          <label for="id-_r_34_"><span>Permanent Resident</span></label></div>
      </fieldset>
      <button>Continue</button>
    `;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.fields).toEqual([
      expect.objectContaining({
        key: "questionnaire.indirect_question-1",
        type: "radio",
        label: "Do you currently have Australian working rights?",
        options: [
          { label: "Australian Citizen", value: "generated_0" },
          { label: "Permanent Resident", value: "generated_1" },
        ],
      }),
    ]);
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

  it("reads Ashby's main form and Diversity Survey, then fills multi-value answers", async () => {
    setLocation("https://jobs.ashbyhq.com/mitti/fede1e72-bb71-4ded-8305-b46e8ec54c86/application");
    document.body.innerHTML = `<div id="form">
      <div class="ashby-application-form-container">
        <div class="ashby-application-form-field-entry">
          <label for="_systemfield_name">Full name *</label>
          <input id="_systemfield_name" name="_systemfield_name" required />
        </div>
      </div>
      <div class="ashby-survey-form-container" aria-hidden="true" data-aria-hidden="true">
        <div data-field-path="survey.gender" data-field-entry-id="gender-entry">
          <fieldset class="ashby-application-form-field-entry ashby-application-form-input-radio-group">
            <label class="ashby-application-form-question-title">What is your gender identity?</label>
            <span><input id="gender-man" type="radio" name="gender" /></span><label for="gender-man">Man</label>
            <span><input id="gender-woman" type="radio" name="gender" /></span><label for="gender-woman">Woman</label>
            <span><input id="gender-private" type="radio" name="gender" /></span><label for="gender-private">I prefer not to answer</label>
          </fieldset>
        </div>
        <div class="ashby-application-form-field-entry" data-field-entry-id="ethnicity-entry">
          <div data-field-path="survey.ethnicity">
            <div class="ashby-application-form-question-title">How would you describe your ethnicity?</div>
            <div class="ashby-application-form-input-checkbox-group">
              <label><input id="ethnicity-asian" type="checkbox" name="Asian" /> Asian</label>
              <label><input id="ethnicity-white" type="checkbox" name="White" /> White</label>
              <label><input id="ethnicity-mixed" type="checkbox" name="Mixed" /> Mixed or multiple ethnic groups</label>
            </div>
          </div>
        </div>
      </div>
      <button>Submit application</button>
    </div>`;

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Full name", type: "text" }),
      expect.objectContaining({
        key: "survey.gender",
        label: "What is your gender identity?",
        type: "radio",
        options: [
          { label: "Man", value: "Man" },
          { label: "Woman", value: "Woman" },
          { label: "I prefer not to answer", value: "I prefer not to answer" },
        ],
      }),
      expect.objectContaining({
        key: "survey.ethnicity",
        label: "How would you describe your ethnicity?",
        type: "multiselect",
        options: [
          { label: "Asian", value: "Asian" },
          { label: "White", value: "White" },
          { label: "Mixed or multiple ethnic groups", value: "Mixed or multiple ethnic groups" },
        ],
      }),
    ]));
    expect(inspection.fields.some((field) => field.label === "Asian")).toBe(false);

    const ethnicity = inspection.fields.find((field) => field.type === "multiselect");
    if (!ethnicity) throw new Error("Ashby ethnicity multi-select was not detected");
    const fillResult = await fillFormField({
      type: "content.fill-field",
      commandId: "ashby-multiselect",
      source: "backend",
      target: {
        key: ethnicity.key,
        id: ethnicity.id,
        name: ethnicity.name,
        type: ethnicity.type,
        label: ethnicity.label,
      },
      value: ["Asian", "White"],
    }, document.getElementById("form") || document);

    expect(fillResult.status).toBe("filled");
    expect(document.querySelector<HTMLInputElement>("#ethnicity-asian")?.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#ethnicity-white")?.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#ethnicity-mixed")?.checked).toBe(false);

    const gender = inspection.fields.find((field) => field.key === "survey.gender");
    if (!gender) throw new Error("Ashby gender radio group was not detected");
    const genderResult = await fillFormField({
      type: "content.fill-field",
      commandId: "ashby-radio",
      source: "backend",
      target: {
        key: gender.key,
        id: gender.id,
        name: gender.name,
        type: gender.type,
        label: gender.label,
      },
      value: "Woman",
    }, document.getElementById("form") || document);
    expect(genderResult.status).toBe("filled");
    expect(document.querySelector<HTMLInputElement>("#gender-woman")?.checked).toBe(true);
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
