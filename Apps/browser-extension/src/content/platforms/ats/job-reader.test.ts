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
    {
      platform: "jora",
      url: "https://au.jora.com/job/Senior-Software-Engineer-4ed7e4a8ac7496963d7be06e2ba13ddc",
      html: `<div class="jdv-panel"><div class="jdv-content">
        <h1 class="heading -size-large">Senior Software Engineer</h1>
        <div class="job-company">Canva</div>
        <div class="job-location">Sydney NSW</div>
        <div class="job-description">${LONG_DESCRIPTION}</div>
        <a href="/apply" class="rounded-button -primary">Apply</a>
      </div></div>`,
      title: "Senior Software Engineer",
      company: "Canva",
      pageTitle: "Senior Software Engineer - Canva - Jora",
    },
    {
      platform: "ziprecruiter",
      url: "https://www.ziprecruiter.com/job/123456",
      html: `<div data-testid="job-details">
        <h1 data-testid="job-title">ZipRecruiter Lead Architect</h1>
        <div class="hiring_company_text">Acme Inc</div>
        <div class="location_text">Austin, TX</div>
        <div class="jobDescriptionSection">${LONG_DESCRIPTION}</div>
      </div>`,
      title: "ZipRecruiter Lead Architect",
      company: "Acme Inc",
      pageTitle: "ZipRecruiter Lead Architect at Acme Inc in Austin, TX",
    },
    {
      platform: "adzuna",
      url: "https://www.adzuna.com.au/details/123456",
      html: `<div class="job-details">
        <h1 class="title">Adzuna Data Engineer</h1>
        <div class="company">DataCorp</div>
        <div class="location">Melbourne VIC</div>
        <div class="job-description">${LONG_DESCRIPTION}</div>
      </div>`,
      title: "Adzuna Data Engineer",
      company: "DataCorp",
      pageTitle: "Adzuna Data Engineer - DataCorp - Adzuna",
    },
    {
      platform: "wellfound",
      url: "https://wellfound.com/jobs/123456-founder-engineer",
      html: `<div data-test="JobListing">
        <h1 class="styles_title__abc">Wellfound Founder Engineer</h1>
        <div class="styles_companyName__xyz">Startup Labs</div>
        <div class="styles_location__123">Remote</div>
        <div data-test="JobDescription">${LONG_DESCRIPTION}</div>
      </div>`,
      title: "Wellfound Founder Engineer",
      company: "Startup Labs",
      pageTitle: "Wellfound Founder Engineer at Startup Labs",
    },
    {
      platform: "dice",
      url: "https://www.dice.com/job-detail/123456",
      html: `<div data-cy="job-details">
        <h1 data-cy="jobTitle">Dice Cloud Security Engineer</h1>
        <div data-cy="companyName">SecureCloud</div>
        <div data-cy="jobLocation">New York, NY</div>
        <div id="jobdescSec">${LONG_DESCRIPTION}</div>
      </div>`,
      title: "Dice Cloud Security Engineer",
      company: "SecureCloud",
      pageTitle: "Dice Cloud Security Engineer - SecureCloud - Dice",
    },
    {
      platform: "simplyhired",
      url: "https://www.simplyhired.com.au/job/123456",
      html: `<div data-testid="viewJobBody">
        <h1 data-testid="viewJobTitle">SimplyHired Staff SRE</h1>
        <div data-testid="viewJobCompany">Infra Systems</div>
        <div data-testid="viewJobLocation">Sydney NSW</div>
        <div class="viewjob-description">${LONG_DESCRIPTION}</div>
      </div>`,
      title: "SimplyHired Staff SRE",
      company: "Infra Systems",
      pageTitle: "SimplyHired Staff SRE - Infra Systems - SimplyHired",
    },
    {
      platform: "careerone",
      url: "https://www.careerone.com.au/jobview/aff-46/1414e5c6-a0d2-11f1-bc76-0231708ce3cd",
      html: `<div data-testid="job-details">
        <h1 class="job-title">Mid-Level Full Stack Developer</h1>
        <a href="/jobs/br_yurra-pty-ltd" class="company-name">Yurra Pty Ltd</a>
        <a href="/jobs/in-perth-wa-6000" class="job-location">Perth WA 6000</a>
        <div class="job-description">${LONG_DESCRIPTION}</div>
      </div>`,
      title: "Mid-Level Full Stack Developer",
      company: "Yurra Pty Ltd",
      pageTitle: "Mid-Level Full Stack Developer | Yurra Pty Ltd | CareerOne",
    },
    {
      platform: "micro1",
      url: "https://jobs.micro1.ai/post/aeda6c13-c58d-4e11-bf6a-edcb9fdf65c2?first_page=/home&last_page=/experts",
      html: `<main>
        <section class="mt-6">
          <h1 class="job-title">Substance Use - Adolescent Addiction Specialist</h1>
          <div data-testid="company" class="company">micro1</div>
          <div data-testid="location" class="location">Remote</div>
          <div class="job-description">${LONG_DESCRIPTION}</div>
        </section>
      </main>`,
      title: "Substance Use - Adolescent Addiction Specialist",
      company: "micro1",
      pageTitle: "Substance Use - Adolescent Addiction Specialist | Apply on Job",
    },
    {
      platform: "avature",
      url: "https://careers.avature.net/en_US/main/JobDetail?jobId=4848",
      html: `<article class="article article--job-detail">
        <header class="article__header">
          <h1 class="article__header__title">Avature Staff Platform Engineer</h1>
          <div class="article__header__subtitle">Avature</div>
          <div class="article__header__location">Melbourne, Australia</div>
        </header>
        <div class="article__content">${LONG_DESCRIPTION}</div>
        <a href="/en_US/careers/ApplicationConfirmation?jobId=4848" class="button">Apply now</a>
      </article>`,
      title: "Avature Staff Platform Engineer",
      company: "Avature",
      pageTitle: "Avature Staff Platform Engineer - Avature Careers",
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

  it("combines Workable description, requirements, and benefits", () => {
    setLocation("https://apply.workable.com/acme/j/WORK123/");
    document.title = "Acme - Workable Frontend Engineer";
    document.body.innerHTML = `<div data-ui="overview"><h1 data-ui="job-title">Workable Frontend Engineer</h1>
      <section data-ui="job-description">Build customer-facing TypeScript products with reliable APIs and automated testing.</section>
      <section data-ui="job-requirements">You bring React experience, strong communication, and a focus on code quality.</section>
      <section data-ui="job-benefits">Hybrid work, a learning budget, and a supportive team.</section>
      <a data-ui="apply-button" href="/acme/j/WORK123/apply/">Apply</a></div>`;

    const inspection = readAtsJobPage("workable");

    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.description).toContain("Build customer-facing TypeScript products");
    expect(inspection.snapshot.description).toContain("You bring React experience");
    expect(inspection.snapshot.description).toContain("Hybrid work, a learning budget");
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
    expect(inspection.snapshot.platform).toBe("workday");
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

  it("rapidly identifies a non-job generic page without redundant delay", async () => {
    setLocation("https://www.example.com/about-us");
    document.body.innerHTML = `
      <h1>About Example Corp</h1>
      <p>We build web tools for people worldwide.</p>
    `;

    const inspection = await readCurrentPageWhenReady();
    expect(inspection.kind).toBe("unsupported_page");
  });

  it("rapidly identifies a non-job LinkedIn page without waiting for 20 attempts", async () => {
    setLocation("https://www.linkedin.com/feed/");
    document.body.innerHTML = `
      <h1>LinkedIn Feed</h1>
      <div>Posts from connections</div>
    `;

    const inspection = await readCurrentPageWhenReady();
    expect(inspection.kind).toBe("unsupported_page");
  });

  it("rapidly identifies an Indeed home/search page with no active job selected", async () => {
    setLocation("https://www.indeed.com/career-advice");
    document.body.innerHTML = `
      <h1>Career Advice</h1>
      <p>How to write a resume</p>
    `;

    const inspection = await readCurrentPageWhenReady();
    expect(inspection.kind).toBe("unsupported_page");
  });

  it("extracts complete job posting from Jora standalone job page structure", () => {
    setLocation("https://au.jora.com/job/Financial-Accountant-Sydney-NSW-4ed7e4a8ac7496963d7be06e2ba13ddc");
    document.title = "Financial Accountant - Appreciating Talent - Sydney NSW - Jora";
    document.body.innerHTML = `
      <div class="job-details-page content-container -width-xl grid-container -two-columns">
        <div class="job-view-content grid-content" id="job-view" job-id="j_4ed7e4a8ac7496963d7be06e2ba13ddc">
          <div class="-desktop-no-padding-top" id="job-info-container">
            <h1 class="job-title heading -size-xxlarge -weight-700">Financial Accountant</h1>
            <div class="font-small" id="company-location-container">
              <span class="company">Appreciating Talent</span>
              <span class="divider">&ndash;</span>
              <span class="location">Sydney NSW</span>
            </div>
            <div class="badge -default-badge"><div class="content">Full time, Permanent</div></div>
            <div class="font-xsmall" id="job-meta">
              <span class="listed-date">12h ago</span>, from <span class="site">Appreciating Talent</span>
            </div>
          </div>
          <div class="job-view-actions-container top-actions-container">
            <a class="apply-button rounded-button -primary" href="/job/rd/4ed7e4a8ac7496963d7be06e2ba13ddc">Apply on company site</a>
          </div>
          <div class="-desktop-no-padding-top" id="job-description-container">
            <div>
              <div>
                <p>We are seeking an experienced Financial Accountant to join our high-performing finance team.</p>
                <p>${LONG_DESCRIPTION}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const inspection = readAtsJobPage("jora");
    expect(inspection.kind).toBe("job");
    if (inspection.kind === "job") {
      expect(inspection.snapshot.platform).toBe("jora");
      expect(inspection.snapshot.title).toBe("Financial Accountant");
      expect(inspection.snapshot.company).toBe("Appreciating Talent");
      expect(inspection.snapshot.location).toBe("Sydney NSW");
      expect(inspection.snapshot.externalId).toBe("4ed7e4a8ac7496963d7be06e2ba13ddc");
      expect(inspection.snapshot.description).toContain("experienced Financial Accountant");
      expect(inspection.snapshot.description).toContain("Build reliable customer-facing products");
      expect(inspection.snapshot.postingDateRaw?.label).toBe("12h ago");
    }
  });

  it("extracts complete job posting from a Dayforce career portal", () => {
    setLocation("https://jobs.dayforcehcm.com/en-US/acme/CANDIDATEPORTAL/jobs/12345");
    document.body.innerHTML = `
      <main test-id="job-details-dayforce-jobs">
        <header test-id="job-detail-header">
          <h1 test-id="job-detail-title">Senior Software Engineer</h1>
          <div test-id="job-detail-location-list">
            <span test-id="job-detail-location-name">Sydney, NSW</span>
          </div>
        </header>
        <section test-id="job-detail-body">${LONG_DESCRIPTION}</section>
        <a test-id="apply-button" href="/apply">Apply</a>
      </main>
    `;

    const inspection = readAtsJobPage("dayforce");
    expect(inspection.kind).toBe("job");
    if (inspection.kind === "job") {
      expect(inspection.snapshot.platform).toBe("dayforce");
      expect(inspection.snapshot.title).toBe("Senior Software Engineer");
      expect(inspection.snapshot.location).toBe("Sydney, NSW");
      expect(inspection.snapshot.externalId).toBe("12345");
      expect(inspection.snapshot.description).toContain("customer-facing products");
    }
  });
});
