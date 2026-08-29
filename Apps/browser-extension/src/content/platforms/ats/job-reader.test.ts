// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readCurrentPage, readCurrentPageWhenReady } from "../../page-reader";
import { pageInspectionSchema } from "../../../shared/contracts/page-inspection";
import { readAtsJobPage, type AtsJobPlatform } from "./job-reader";

function setLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: new URL(url),
  });
}

const LONG_DESCRIPTION = "Build reliable customer-facing products with TypeScript, React, APIs, automated testing, observability, and close collaboration across the engineering team.";

describe("ATS-specific job readers", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it.each([
    {
      platform: "glassdoor",
      url: "https://www.glassdoor.com.au/Job/software-engineer-jobs.htm?countryRedirect=true",
      html: `<li data-test="jobListing" data-jobid="1010229186976" class="selected">
        <div data-test="job-age" class="JobCard_listingAge__abc">27d</div>
      </li><div class="JobDetails_jobDetailsContainer__abc">
        <header data-test="job-details-header" data-brandviews="jlid=1010229186976"><h4>Fliteboard</h4>
          <h1 id="jd-job-title-1010229186976">Senior Software Engineer</h1><span data-test="location">Byron Bay</span></header>
        <section class="JobDetails_jobDescription__abc">${LONG_DESCRIPTION}</section>
        <button data-test="applyButton">Apply now</button>
      </div>`,
      title: "Senior Software Engineer",
      company: "Fliteboard",
      pageTitle: "",
    },
    {
      platform: "workday",
      url: "https://tenant.myworkdayjobs.com/en-US/jobs/job/Sydney/Senior-Engineer_R-1042",
      html: `<header><h1>Careers at Workday</h1></header><section data-automation-id="jobPostingPage">
        <header data-automation-id="jobPostingHeader"><h2>Senior Workday Engineer</h2></header>
        <div data-automation-id="locations">Sydney</div>
        <div data-automation-id="jobPostingDescription">${LONG_DESCRIPTION}</div>
        <span data-automation-id="requisitionId">job requisition idJR-0108761</span><time data-automation-id="postedOn" datetime="2026-08-20">5 days ago</time>
        <button data-automation-id="applyButton">Apply</button>
      </section>`,
      title: "Senior Workday Engineer",
      company: "Workday",
      pageTitle: "",
    },
    {
      platform: "greenhouse",
      url: "https://job-boards.greenhouse.io/greenhouse/jobs/5012",
      html: `<main class="main font-secondary job-post"><div class="job-post-container">
        <div class="job__title"><h1>Greenhouse Platform Engineer</h1></div><div class="job__location">Melbourne</div>
        <section class="job__description">${LONG_DESCRIPTION}</section><button aria-label="Apply">Apply</button>
      </div></main>`,
      title: "Greenhouse Platform Engineer",
      company: "Greenhouse",
      pageTitle: "Job Application for Greenhouse Platform Engineer at Greenhouse",
    },
    {
      platform: "lever",
      url: "https://jobs.lever.co/acme/lever-5012",
      html: `<main class="posting-page"><div class="posting-headline"><h2>Lever Backend Engineer</h2></div>
        <div class="posting-categories"><span class="location">Remote</span></div>
        <section class="posting-description">${LONG_DESCRIPTION}</section><a class="postings-btn" href="/acme/lever-5012/apply">Apply</a>
      </main>`,
      title: "Lever Backend Engineer",
      company: "Acme",
      pageTitle: "Acme - Lever Backend Engineer",
    },
    {
      platform: "ashby",
      url: "https://jobs.ashbyhq.com/acme/ashby-5012",
      html: `<div id="root"><main class="ashby-job-posting-left-pane"><h1 class="ashby-job-posting-heading">Ashby Product Engineer</h1>
        <section><h2>Location</h2><p>Brisbane</p></section>
        <section class="ashby-job-posting-description">${LONG_DESCRIPTION}</section>
        <a href="/acme/ashby-5012/application">Apply</a></main></div>`,
      title: "Ashby Product Engineer",
      company: "Acme",
      pageTitle: "Ashby Product Engineer @ Acme",
    },
    {
      platform: "smartrecruiters",
      url: "https://jobs.smartrecruiters.com/Acme/7430001-cloud-engineer",
      html: `<main itemscope itemtype="https://schema.org/JobPosting"><h1 itemprop="title">SmartRecruiters Cloud Engineer</h1>
        <div itemprop="hiringOrganization"><span itemprop="name">Acme</span></div>
        <div itemprop="jobLocation"><span itemprop="addressLocality">Perth</span></div>
        <section itemprop="description">${LONG_DESCRIPTION}</section><meta itemprop="identifier" content="7430001" />
        <button data-test="apply-button">Apply</button></main>`,
      title: "SmartRecruiters Cloud Engineer",
      company: "Acme",
      pageTitle: "",
    },
    {
      platform: "taleo",
      url: "https://woodforest.taleo.net/careersection/4/jobdetail.ftl",
      html: `<img alt="Woodforest Taleo" /><main id="requisitionDescriptionInterface">
        <span class="titlepage">Job Description</span>
        <span class="titlepage" id="requisitionDescriptionInterface.reqTitleLinkAction.row1">Taleo Systems Engineer</span>
        <span id="requisitionDescriptionInterface.reqContestNumberValue.row1">073949</span>
        <section class="mastercontentpanel3">${LONG_DESCRIPTION}</section>
        <input id="requisitionDescriptionInterface.UP_APPLY_ON_REQ.row1" value="Apply Online" />
      </main>`,
      title: "Taleo Systems Engineer",
      company: "Woodforest",
      pageTitle: "",
    },
    {
      platform: "icims",
      url: "https://careers-acme.icims.com/jobs/5012/senior-software-engineer/job",
      html: `<div class="iCIMS_JobContainer"><div class="iCIMS_Header"><h1>Senior Software Engineer</h1></div>
        <div class="iCIMS_Company">Acme Corp</div><div class="iCIMS_JobLocation">Sydney, NSW</div>
        <div class="iCIMS_JobContent">${LONG_DESCRIPTION}</div>
        <a class="iCIMS_ApplyOnline" href="https://careers-acme.icims.com/jobs/5012/login=apply">Apply</a></div>`,
      title: "Senior Software Engineer",
      company: "Acme Corp",
      pageTitle: "",
    },
    {
      platform: "successfactors",
      url: "https://career4.successfactors.com/career?company=acme&career_job_req_id=8901",
      html: `<div id="rcm_job_details"><h1 class="jobTitle">SuccessFactors Developer</h1>
        <div class="companyName">Acme SAP</div><div class="jobLocation">Melbourne</div>
        <div class="jobDescription">${LONG_DESCRIPTION}</div>
        <a class="applyButton" href="/apply">Apply</a></div>`,
      title: "SuccessFactors Developer",
      company: "Acme SAP",
      pageTitle: "",
    },
    {
      platform: "oracle",
      url: "https://fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3041",
      html: `<div class="cx-job-details"><h1 class="cx-job-details__title">Oracle Cloud Architect</h1>
        <div class="cx-job-details__employer">Acme Cloud</div><div class="cx-job-details__location">Brisbane</div>
        <div class="cx-job-details__description">${LONG_DESCRIPTION}</div>
        <button data-qa="apply-button">Apply Now</button></div>`,
      title: "Oracle Cloud Architect",
      company: "Acme Cloud",
      pageTitle: "",
    },
    {
      platform: "workable",
      url: "https://apply.workable.com/acme/j/WORK123/",
      html: `<div data-ui="overview"><h1 data-ui="job-title">Workable Frontend Engineer</h1>
        <div data-ui="company-name">Acme Tech</div><div data-ui="job-location">Remote</div>
        <div data-ui="job-description">${LONG_DESCRIPTION}</div>
        <button data-ui="application-form-tab">Apply for this job</button></div>`,
      title: "Workable Frontend Engineer",
      company: "Acme Tech",
      pageTitle: "Acme Tech - Workable Frontend Engineer",
    },
    {
      platform: "bamboohr",
      url: "https://acme.bamboohr.com/careers/99",
      html: `<div id="BambooHR"><div class="BambooHR-ATS-Jobs-Item">
        <h2>BambooHR Fullstack Engineer</h2><div class="BambooHR-ATS-Jobs-Company">Acme HR</div>
        <div class="BambooHR-ATS-Jobs-Location">Sydney</div>
        <div class="BambooHR-ATS-Jobs-Description">${LONG_DESCRIPTION}</div>
        <a class="BambooHR-ATS-Jobs-ApplyButton" href="/careers/99/apply">Apply for this Position</a>
      </div></div>`,
      title: "BambooHR Fullstack Engineer",
      company: "Acme HR",
      pageTitle: "Acme HR - BambooHR Fullstack Engineer",
    },
  ] as const)("extracts the current $platform posting from its owned root", ({ platform, url, html, title, company, pageTitle }) => {
    setLocation(url);
    document.title = pageTitle;
    document.body.innerHTML = `
      <aside><h1>Recommended Sales Manager</h1><div class="job-description">A different recommended job with unrelated content.</div></aside>
      ${html}
      <footer>${"Navigation and company marketing. ".repeat(10)}</footer>
    `;

    const inspection = readAtsJobPage(platform as AtsJobPlatform);
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.platform).toBe(platform);
    expect(inspection.snapshot.title).toBe(title);
    expect(inspection.snapshot.company).toBe(company);
    expect(inspection.snapshot.description).toContain("TypeScript");
    expect(inspection.snapshot.description).not.toContain("recommended job");
    expect(inspection.snapshot.description).not.toContain("company marketing");
    if (platform === "glassdoor") expect(inspection.snapshot.postingDateRaw?.label).toBe("27d");
    if (platform === "workday") {
      expect(inspection.snapshot.externalId).toBe("JR-0108761");
      expect(inspection.snapshot.lastPostedAt).toBe("2026-08-20T00:00:00.000Z");
    }
    if (platform === "taleo") expect(inspection.snapshot.externalId).toBe("073949");
    expect(() => pageInspectionSchema.parse(inspection)).not.toThrow();
  });

  it("updates the Glassdoor identity when a card changes without changing the URL", () => {
    setLocation("https://www.glassdoor.com.au/Job/software-engineer-jobs.htm?countryRedirect=true");
    document.body.innerHTML = `<div class="JobDetails_jobDetailsContainer__abc">
      <header data-test="job-details-header"><h4>First Company</h4><h1 id="jd-job-title-101">First Engineer</h1></header>
      <section class="JobDetails_jobDescription__abc">${LONG_DESCRIPTION}</section>
      <button data-test="applyButton">Apply now</button>
    </div>`;

    const first = readCurrentPage();
    expect(first.kind).toBe("job");
    if (first.kind !== "job") return;
    expect(first.snapshot.platform).toBe("glassdoor");
    expect(first.snapshot.externalId).toBe("101");

    document.querySelector("h1")!.id = "jd-job-title-202";
    document.querySelector("h1")!.textContent = "Second Engineer";
    document.querySelector("h4")!.textContent = "Second Company";

    const second = readCurrentPage();
    expect(second.kind).toBe("job");
    if (second.kind !== "job") return;
    expect(second.snapshot.platform).toBe("glassdoor");
    expect(second.snapshot.externalId).toBe("202");
    expect(second.snapshot.title).toBe("Second Engineer");
    expect(second.snapshot.company).toBe("Second Company");
  });

  it("reads the Glassdoor age from its colon-delimited detail identity", () => {
    setLocation("https://www.glassdoor.com.au/Job/software-engineer-jobs.htm?countryRedirect=true");
    document.body.innerHTML = `
      <li data-test="jobListing" data-jobid="1010229186976">
        <div data-test="job-card-wrapper" data-selected="true">
          <div data-test="job-age">11d</div>
        </div>
      </li>
      <div class="JobDetails_jobDetailsContainer__current">
        <header data-test="job-details-header" data-brandviews="MODULE:n=joblisting-header:eid=0:jlid=1010229186976">
          <h4>Fliteboard</h4>
          <h1 data-test="job-title">Senior Software Engineer</h1>
        </header>
        <section class="JobDetails_jobDescription__current">${LONG_DESCRIPTION}</section>
        <button data-test="applyButton">Apply now</button>
      </div>
    `;

    const inspection = readAtsJobPage("glassdoor");
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.externalId).toBe("1010229186976");
    expect(inspection.snapshot.postingDateRaw?.label).toBe("11d");
  });

  it("uses Glassdoor's inner selected wrapper without matching divider classes", () => {
    setLocation("https://www.glassdoor.com.au/Job/software-engineer-jobs.htm?countryRedirect=true");
    document.body.innerHTML = `
      <li class="JobsList_dividerWithSelected__decoy" data-test="jobListing" data-jobid="9000000000001">
        <div data-test="job-card-wrapper" data-selected="false"><div data-test="job-age">30d+</div></div>
      </li>
      <li data-test="jobListing" data-jobid="9000000000002">
        <div data-test="job-card-wrapper" data-selected="true"><div data-test="job-age">4d</div></div>
      </li>
      <div class="JobDetails_jobDetailsContainer__current">
        <header data-test="job-details-header"><h4>Current Company</h4><h1 data-test="job-title">Current Engineer</h1></header>
        <section class="JobDetails_jobDescription__current">${LONG_DESCRIPTION}</section>
        <button data-test="applyButton">Apply now</button>
      </div>
    `;

    const inspection = readAtsJobPage("glassdoor");
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.externalId).toBe("9000000000002");
    expect(inspection.snapshot.postingDateRaw?.label).toBe("4d");
  });

  it("waits for Glassdoor's separately rendered selected-card age", async () => {
    vi.useFakeTimers();
    try {
      setLocation("https://www.glassdoor.com.au/Job/software-engineer-jobs.htm?countryRedirect=true");
      document.body.innerHTML = `
        <li data-test="jobListing" data-jobid="7000000000001">
          <div data-test="job-card-wrapper" data-selected="true"></div>
        </li>
        <div class="JobDetails_jobDetailsContainer__current">
          <header data-test="job-details-header" data-brandviews="MODULE:n=joblisting-header:eid=0:jlid=7000000000001">
            <h4>Late Metadata Company</h4><h1 data-test="job-title">Late Metadata Engineer</h1>
          </header>
          <section class="JobDetails_jobDescription__current">${LONG_DESCRIPTION}</section>
          <button data-test="applyButton">Apply now</button>
        </div>
      `;

      window.setTimeout(() => {
        const age = document.createElement("div");
        age.setAttribute("data-test", "job-age");
        age.textContent = "6d";
        document.querySelector("[data-test='job-card-wrapper']")?.append(age);
      }, 700);

      const pending = readCurrentPageWhenReady();
      await vi.advanceTimersByTimeAsync(1_000);
      const inspection = await pending;
      expect(inspection.kind).toBe("job");
      if (inspection.kind !== "job") return;
      expect(inspection.snapshot.postingDateRaw?.label).toBe("6d");
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for Glassdoor's initial first-card detail pane before returning", async () => {
    vi.useFakeTimers();
    try {
      setLocation("https://www.glassdoor.com.au/Job/software-engineer-jobs.htm");
      document.body.innerHTML = `
        <li data-test="jobListing" data-jobid="8000000000001">
          <div data-test="job-card-wrapper">First Engineer</div>
        </li>
      `;

      window.setTimeout(() => {
        document.body.insertAdjacentHTML(
          "beforeend",
          `<div class="JobDetails_jobDetailsContainer__current">
            <header data-test="job-details-header" data-brandviews="MODULE:jlid=8000000000001">
              <h4>First Company</h4>
              <h1 data-test="job-title">First Engineer</h1>
            </header>
            <section class="JobDetails_jobDescription__current">${LONG_DESCRIPTION}</section>
            <button data-test="applyButton">Apply now</button>
          </div>`,
        );
      }, 700);

      const pending = readCurrentPageWhenReady();
      await vi.advanceTimersByTimeAsync(1_600);
      const inspection = await pending;

      expect(inspection.kind).toBe("job");
      if (inspection.kind !== "job") return;
      expect(inspection.snapshot.platform).toBe("glassdoor");
      expect(inspection.snapshot.externalId).toBe("8000000000001");
      expect(inspection.snapshot.title).toBe("First Engineer");
      expect(inspection.snapshot.company).toBe("First Company");
    } finally {
      vi.useRealTimers();
    }
  });

  it("extracts skills from Glassdoor qualifications section along with description and title", () => {
    setLocation("https://www.glassdoor.com.au/Job/designer-jobs-SRCH_KO0,8.htm");
    document.body.innerHTML = `
      <div class="JobDetails_jobDetailsContainer__abc">
        <header data-test="job-details-header" data-brandviews="jlid=1010238586194">
          <h4>The Purple Panda Agency</h4>
          <h1 id="jd-job-title-1010238586194">Web Designer</h1>
          <span data-test="location">Hurstville Grove</span>
        </header>
        <div class="JobDetails_qualificationsSection__xyz" data-test="job-qualifications">
          <h2>Your qualifications for this job</h2>
          <ul>
            <li>UX</li>
            <li>Responsive web design</li>
            <li>E-commerce</li>
            <li>Shopify</li>
            <li>WordPress</li>
            <li>SEO</li>
            <li>Communication skills</li>
          </ul>
          <div>
            <h3>Do you also have these qualifications?</h3>
            <span>UI design</span>
            <span>Time management</span>
          </div>
        </div>
        <section class="JobDetails_jobDescription__abc">
          <p>We are looking for a Web Designer with HTML, CSS, and Figma skills.</p>
        </section>
        <button data-test="applyButton">Apply now</button>
      </div>
    `;

    const inspection = readAtsJobPage("glassdoor");
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.technologies).toEqual([
      "UX",
      "Responsive Web Design",
      "E-commerce",
      "Shopify",
      "WordPress",
      "SEO",
      "Communication Skills",
      "UI Design",
      "Time Management",
      "Web Design",
      "HTML",
      "CSS",
      "Figma",
    ]);
  });

  it("keeps technology-rich Glassdoor jobs within the inspection contract", () => {
    setLocation("https://www.glassdoor.com.au/Job/software-engineer-jobs.htm");
    const qualifications = Array.from(
      { length: 35 },
      (_, index) => `<li>Specialized Skill ${index + 1}</li>`,
    ).join("");
    document.body.innerHTML = `
      <div class="JobDetails_jobDetailsContainer__current">
        <header data-test="job-details-header" data-brandviews="MODULE:jlid=9000000000001">
          <h4>Technology Company</h4>
          <h1 data-test="job-title">Staff Software Engineer</h1>
        </header>
        <section class="JobDetails_jobDescription__current">${LONG_DESCRIPTION}</section>
        <section class="JobDetails_qualifications__current"><ul>${qualifications}</ul></section>
        <button data-test="applyButton">Apply now</button>
      </div>
    `;

    const inspection = readAtsJobPage("glassdoor");

    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.technologies).toHaveLength(30);
    expect(pageInspectionSchema.safeParse(inspection).success).toBe(true);
  });

  it("updates the Taleo identity when detail pagination keeps the same URL", () => {
    setLocation("https://woodforest.taleo.net/careersection/4/jobdetail.ftl");
    document.body.innerHTML = `<img alt="Woodforest Taleo" /><main id="requisitionDescriptionInterface">
      <span id="requisitionDescriptionInterface.reqTitleLinkAction.row1">First Banker</span>
      <span id="requisitionDescriptionInterface.reqContestNumberValue.row1">073949</span>
      <section class="mastercontentpanel3">${LONG_DESCRIPTION}</section>
      <input id="requisitionDescriptionInterface.UP_APPLY_ON_REQ.row1" value="Apply Online" />
    </main>`;

    const first = readCurrentPage();
    expect(first.kind).toBe("job");
    if (first.kind !== "job") return;
    expect(first.snapshot.externalId).toBe("073949");

    document.querySelector<HTMLElement>("[id*='reqTitleLinkAction']")!.textContent = "Second Banker";
    document.querySelector<HTMLElement>("[id*='reqContestNumberValue']")!.textContent = "073950";

    const second = readCurrentPage();
    expect(second.kind).toBe("job");
    if (second.kind !== "job") return;
    expect(second.snapshot.externalId).toBe("073950");
    expect(second.snapshot.title).toBe("Second Banker");
  });

  it("routes a supported platform to its provider before generic selectors", () => {
    setLocation("https://tenant.myworkdayjobs.com/en-US/jobs/job/role/R-777");
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Wrong recommended JSON-LD title",
      description: LONG_DESCRIPTION,
      identifier: { value: "R-999" },
    })}</script>`;
    document.body.innerHTML = `
      <aside><h1 class="job-title">Wrong recommended title</h1><div class="job-description">${LONG_DESCRIPTION}</div></aside>
      <section data-automation-id="jobPostingPage">
        <div data-automation-id="jobPostingHeader"><h2>Correct Workday Role</h2></div>
        <div data-automation-id="companyName">Acme</div>
        <div data-automation-id="jobPostingDescription">${LONG_DESCRIPTION}</div>
        <button data-automation-id="applyButton">Apply</button>
      </section>
    `;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.platform).toBe("workday");
    expect(inspection.snapshot.title).toBe("Correct Workday Role");
  });

  it("reads Ashby datePosted from page-level JobPosting JSON-LD", () => {
    setLocation("https://jobs.ashbyhq.com/airtasker/9c673176-8d48-4c7e-af79-3fd96ecc5b84");
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Senior Software Engineer",
      description: LONG_DESCRIPTION,
      identifier: { value: "9c673176-8d48-4c7e-af79-3fd96ecc5b84" },
      hiringOrganization: { name: "Airtasker" },
      datePosted: "2026-07-16",
    })}</script>`;
    document.body.innerHTML = `<div id="root">
      <main class="ashby-job-posting-left-pane">
        <h1 class="ashby-job-posting-heading">Senior Software Engineer</h1>
        <div class="ashby-job-posting-description">${LONG_DESCRIPTION}</div>
      </main>
    </div>`;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.platform).toBe("ashby");
    expect(inspection.snapshot.lastPostedAt).toBe("2026-07-16T00:00:00.000Z");
  });

  it("selects the structured posting that matches the current job instead of the first recommendation", () => {
    setLocation("https://careers.example.com/jobs/target-222");
    document.body.innerHTML = `<main><h1>Target Platform Engineer</h1><button>Apply now</button></main>`;
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify([
      {
        "@type": "JobPosting",
        title: "Recommended Sales Manager",
        description: "This is an unrelated recommended role with enough description content to look plausible.",
        identifier: { value: "recommended-111" },
      },
      {
        "@type": "JobPosting",
        title: "Target Platform Engineer",
        description: LONG_DESCRIPTION,
        identifier: { value: "target-222" },
        hiringOrganization: { name: "Acme" },
      },
    ])}</script>`;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.title).toBe("Target Platform Engineer");
    expect(inspection.snapshot.externalId).toBe("target-222");
    expect(inspection.snapshot.description).not.toContain("unrelated recommended role");
  });

  it("uses generic only after the selected provider cannot find its job root", () => {
    setLocation("https://tenant.myworkdayjobs.com/custom/jobs/engineering-role");
    document.body.innerHTML = `<main>
      <h1 class="job-title">White-label Engineering Role</h1>
      <article class="job-description">${LONG_DESCRIPTION}</article>
      <button>Apply now</button>
    </main>`;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.platform).toBe("generic");
    expect(inspection.snapshot.title).toBe("White-label Engineering Role");
  });

  it("keeps unknown ATS pages on the generic reader", () => {
    setLocation("https://careers.example.com/jobs/platform-engineer");
    document.body.innerHTML = `<main>
      <h1 class="job-title">Unknown ATS Platform Engineer</h1>
      <article class="job-description">${LONG_DESCRIPTION}</article>
      <button>Apply now</button>
    </main>`;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.platform).toBe("generic");
    expect(inspection.snapshot.title).toBe("Unknown ATS Platform Engineer");
  });

  it("generic detection prefers primary semantic fields over sidebar recommendations", () => {
    setLocation("https://careers.example.com/jobs/current-role");
    document.body.innerHTML = `
      <aside>
        <h1 class="job-title">Recommended Account Executive</h1>
        <div class="job-description">${"Recommended role content. ".repeat(12)}</div>
      </aside>
      <main>
        <h1 data-testid="job-title">Current Generic Engineer</h1>
        <article data-testid="job-description">${LONG_DESCRIPTION}</article>
        <button>Apply now</button>
      </main>
      <footer>${"Footer navigation. ".repeat(20)}</footer>
    `;

    const inspection = readCurrentPage();
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.title).toBe("Current Generic Engineer");
    expect(inspection.snapshot.description).toContain("customer-facing products");
    expect(inspection.snapshot.description).not.toContain("Recommended role content");
    expect(inspection.snapshot.description).not.toContain("Footer navigation");
  });

  it("extracts all sections in modern Lever multi-section job postings", () => {
    setLocation("https://jobs.lever.co/megaport/530b1eda-741e-4902-b651-1f000acf414b");
    document.title = "Megaport - Frontend Software Engineer";
    document.body.innerHTML = `
      <div class="content-wrapper posting-page">
        <div class="content">
          <div class="section-wrapper accent-section page-full-width">
            <div class="section page-centered posting-header">
              <div class="posting-headline"><h2>Frontend Software Engineer</h2></div>
              <div class="posting-categories"><div class="sort-by-time posting-category medium-category-label width-full capitalize-labels location">Australia / Brisbane</div></div>
              <div class="postings-btn-wrapper"><a class="postings-btn" href="/megaport/530b1eda/apply">Apply</a></div>
            </div>
          </div>
          <div class="section-wrapper page-full-width">
            <div class="section page-centered" data-qa="job-description">
              <h3>About Megaport</h3>
              <p>We are a global cloud connectivity company building next-generation network tools.</p>
            </div>
            <div class="section page-centered">
              <div>
                <h3>What You’ll Be Doing</h3>
                <div class="posting-requirements plain-list" data-qa="posting-requirements">
                  <ul>
                    <li>Build and ship features across the Megaport Portal in Vue 3, TypeScript, and Vite.</li>
                    <li>Write tests using Vitest and Playwright.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="section page-centered">
              <div>
                <h3>What We Offer</h3>
                <div class="posting-requirements plain-list" data-qa="posting-requirements">
                  <ul>
                    <li>Flexible working environments and generous leave.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="section page-centered" data-qa="closing-description">
              <p>All applications will be treated in confidence. Contact Careers@megaport.com for questions.</p>
            </div>
            <div class="section page-centered" data-qa="ai-disclaimer">
              <p>We may use artificial intelligence (AI) tools to assist our recruitment process.</p>
            </div>
            <div class="section page-centered last-section-apply" data-qa="btn-apply-bottom">
              <a class="postings-btn" href="/megaport/530b1eda/apply">Apply for this job</a>
            </div>
          </div>
        </div>
      </div>
    `;

    const inspection = readAtsJobPage("lever");
    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.title).toBe("Frontend Software Engineer");
    expect(inspection.snapshot.company).toBe("Megaport");
    expect(inspection.snapshot.description).toContain("About Megaport");
    expect(inspection.snapshot.description).toContain("What You’ll Be Doing");
    expect(inspection.snapshot.description).toContain("Vue 3, TypeScript, and Vite");
    expect(inspection.snapshot.description).toContain("What We Offer");
    expect(inspection.snapshot.description).toContain("All applications will be treated in confidence");
    expect(inspection.snapshot.description).not.toContain("Apply for this job");
    expect(inspection.snapshot.description).not.toContain("We may use artificial intelligence");
    expect(inspection.snapshot.technologies).toContain("Vue.js");
    expect(inspection.snapshot.technologies).toContain("TypeScript");
    expect(inspection.snapshot.technologies).toContain("Vitest");
  });
});
