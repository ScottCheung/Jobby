// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { readLinkedInPage } from "./linkedin/job-reader";
import { readSeekPage } from "./seek/job-reader";
import { readIndeedJobPage } from "./indeed/job-reader";
import { readGenericJobPage } from "./generic/job-reader";
import { classifyCurrentPage } from "../page-classifier";
import { parseAndFormatJobDate } from "../../shared/utils/date-formatter";

describe("E2E Date Extraction Across All Platforms", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  describe("LinkedIn", () => {
    it("extracts posted date from LinkedIn primary description container", () => {
      document.body.innerHTML = `
        <div class="jobs-details__main-content">
          <h1>Senior Software Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Acme Corp</div>
          <div class="job-details-jobs-unified-top-card__primary-description-container">
            <span>Sydney, NSW, Australia</span>
            <span>·</span>
            <span>2 weeks ago</span>
            <span>·</span>
            <span>45 applicants</span>
          </div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              We are seeking an experienced Senior Software Engineer to join our core team in Sydney. Requirements include TypeScript, Node.js, and React.
            </div>
          </div>
        </div>
      `;
      // Set window location
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/123456789/"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("2 weeks ago");
        expect(inspection.snapshot.url).toBe("https://www.linkedin.com/jobs/view/123456789/");
        const formatted = parseAndFormatJobDate(inspection.snapshot.datePosted!);
        expect(formatted.displayText).toBe("2 weeks ago");
        expect(formatted.isNotFresh).toBe(false);
      }
    });

    it("extracts posted date from LinkedIn short unit text (e.g. 3d ago)", () => {
      document.body.innerHTML = `
        <div class="jobs-details__main-content">
          <h1>Fullstack Developer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">TechCorp</div>
          <div class="job-details-jobs-unified-top-card__primary-description">
            <span class="tvm__text">Melbourne, VIC · Posted 3d ago · 12 applicants</span>
          </div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              Building modern web applications using React, Next.js, TypeScript and Node.js.
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/987654321/"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("3d ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.datePosted!);
        expect(formatted.displayText).toBe("3 days ago");
        expect(formatted.isNotFresh).toBe(false);
      }
    });

    it("uses the selected detail card rather than a conflicting result-list date", () => {
      document.body.innerHTML = `
        <aside class="jobs-search-results-list">
          <a href="/jobs/view/4447639577/">Full Stack Engineer</a>
          <span>6 days ago</span>
        </aside>
        <main class="jobs-details__main-content">
          <div class="job-details-jobs-unified-top-card">
            <h1><a href="/jobs/view/4447639577/">Full Stack Engineer</a></h1>
            <div class="job-details-jobs-unified-top-card__company-name">Just Digital People</div>
            <div class="job-details-jobs-unified-top-card__primary-description-container">
              Sydney, New South Wales, Australia · 1 week ago · Over 100 applicants
            </div>
          </div>
          <div class="jobs-description__content"><div class="jobs-box__html-content">
            Build and maintain full-stack product experiences using React, TypeScript, Node.js, and cloud services.
          </div></div>
        </main>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/4447639577/"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("1 week ago");
        expect(inspection.snapshot.url).toBe("https://www.linkedin.com/jobs/view/4447639577/");
        expect(parseAndFormatJobDate(inspection.snapshot.datePosted!).displayText).toBe("1 week ago");
      }
    });

    it("extracts date from Chinese LinkedIn page", () => {
      document.body.innerHTML = `
        <div class="jobs-details__main-content">
          <h1>高级前端工程师</h1>
          <div class="job-details-jobs-unified-top-card__company-name">创新科技</div>
          <div class="job-details-jobs-unified-top-card__primary-description-container">
            <span>上海 · 发布于3天前</span>
          </div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              负责前端架构设计与核心代码编写，熟练掌握 React、TypeScript。
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/555444333/"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("3天前");
        const formatted = parseAndFormatJobDate(inspection.snapshot.datePosted!);
        expect(formatted.displayText).toBe("3 days ago");
      }
    });

    it("extracts posted date from LinkedIn search list card when detail view does not contain date yet", () => {
      document.body.innerHTML = `
        <div class="jobs-search-results-list">
          <div class="job-card-container">
            <a href="/jobs/view/777888999/?currentJobId=777888999">Staff Software Engineer</a>
            <div class="job-card-container__metadata-wrapper">
              <time datetime="2026-08-11T00:00:00Z">2 days ago</time>
            </div>
          </div>
        </div>
        <div class="jobs-details__main-content">
          <h1><a href="/jobs/view/777888999/">Staff Software Engineer</a></h1>
          <div class="job-details-jobs-unified-top-card__company-name">Acme Corp</div>
          <!-- Detail panel description rendered, but top-card date element not rendered yet -->
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              Staff Software Engineer position requiring TypeScript, distributed systems, architecture leadership.
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/search/?currentJobId=777888999"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("2026-08-11T00:00:00Z");
      }
    });

    it("reads date from the active card (3rd in list) not the first card, using data-occludable-job-id", () => {
      // Simulate: 3 job cards in the sidebar, the THIRD one is selected.
      // The first card is for job 111111111 (posted 30 days ago — stale).
      // The active card is for job 333333333 (posted 1 day ago — fresh).
      // The detail panel shows job 333333333 but has no date element yet.
      document.body.innerHTML = `
        <div class="jobs-search-results-list">
          <li data-occludable-job-id="111111111" class="jobs-search-results__list-item">
            <a href="/jobs/view/111111111/">Backend Engineer</a>
            <time datetime="2026-07-14T00:00:00Z">30 days ago</time>
          </li>
          <li data-occludable-job-id="222222222" class="jobs-search-results__list-item">
            <a href="/jobs/view/222222222/">DevOps Engineer</a>
            <time datetime="2026-08-06T00:00:00Z">7 days ago</time>
          </li>
          <li data-occludable-job-id="333333333" class="jobs-search-results__list-item">
            <a href="/jobs/view/333333333/">Frontend Engineer</a>
            <time datetime="2026-08-12T00:00:00Z">1 day ago</time>
          </li>
        </div>
        <div class="jobs-search__job-details--detail-view">
          <h1><a href="/jobs/view/333333333/">Frontend Engineer</a></h1>
          <div class="job-details-jobs-unified-top-card__company-name">Startup Co</div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              Frontend Engineer role needing React, TypeScript, CSS, and strong UI skills.
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/search/?currentJobId=333333333"),
      });

      const inspection = readLinkedInPage();
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("2026-08-12T00:00:00Z");
        expect(inspection.snapshot.externalId).toBe("333333333");
      }
    });

    it("extracts job information correctly from real-world LinkedIn markup with aria-hidden and visually-hidden spans", () => {
      document.body.innerHTML = `
        <div class="jobs-details__main-content">
          <span class="job-details-jobs-unified-top-card__job-title">
            <h1 class="t-24">
              <a href="/jobs/view/9988776655/">
                <strong aria-hidden="true">Lead Cloud Architect</strong>
                <span class="visually-hidden">Lead Cloud Architect</span>
              </a>
            </h1>
          </span>
          <div class="job-details-jobs-unified-top-card__company-name">
            <a href="/company/cloud-innovations/">
              <span aria-hidden="true">Cloud Innovations</span>
              <span class="visually-hidden">Cloud Innovations</span>
            </a>
          </div>
          <div class="job-details-jobs-unified-top-card__primary-description-container">
            <span>Sydney, New South Wales, Australia</span>
            <span>·</span>
            <span>3 days ago</span>
          </div>
          <div id="job-details" class="jobs-box__html-content">
            Looking for a Lead Cloud Architect skilled in AWS, Kubernetes, Terraform, and Go.
          </div>
          <button class="jobs-apply-button" aria-label="Easy Apply to Lead Cloud Architect">Easy Apply</button>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/9988776655/"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("Lead Cloud Architect");
        expect(inspection.snapshot.company).toBe("Cloud Innovations");
        expect(inspection.snapshot.location).toBe("Sydney, New South Wales, Australia");
        expect(inspection.snapshot.datePosted).toBe("3 days ago");
        expect(inspection.snapshot.description).toContain("Lead Cloud Architect");
        expect(inspection.snapshot.easyApply).toBe(true);
      }
    });

    it("extracts LinkedIn job ID from DOM when URL is /jobs/search/ without currentJobId query", () => {
      document.body.innerHTML = `
        <div class="jobs-search-results-list">
          <div class="job-card-container--clickable" data-job-id="5544332211">
            <a href="/jobs/view/5544332211/">Principal Engineer</a>
          </div>
        </div>
        <div class="jobs-search__job-details">
          <h1>Principal Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Enterprise Org</div>
          <div id="job-details">
            Architecting large scale systems using Python, Rust, and PostgreSQL.
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/search/?keywords=Principal"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("5544332211");
        expect(inspection.snapshot.title).toBe("Principal Engineer");
        expect(inspection.snapshot.company).toBe("Enterprise Org");
      }
    });
  });

  describe("SEEK", () => {
    it("extracts posted date from Seek job-detail-date attribute", () => {
      document.body.innerHTML = `
        <h1 data-automation="job-detail-title">Senior DevOps Engineer</h1>
        <span data-automation="job-detail-company">Cloud Scale Solutions</span>
        <span data-automation="job-detail-location">Sydney NSW</span>
        <span data-automation="job-detail-date">Posted 2d ago</span>
        <div data-automation="jobAdDetails">
          We are looking for a Senior DevOps Engineer with Terraform, AWS, Docker and Kubernetes experience to automate infrastructure.
        </div>
        <button data-automation="job-detail-apply">Apply for job</button>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.seek.com.au/job/789101112"),
      });

      const inspection = readSeekPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("Posted 2d ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.datePosted!);
        expect(formatted.displayText).toBe("2 days ago");
      }
    });

    it("extracts job on SEEK search split-view correctly when left list has multiple cards", () => {
      document.body.innerHTML = `
        <div class="search-results-list">
          <article data-automation="job-card" data-job-id="11111111">
            <a data-automation="jobTitle" href="/job/11111111">Junior Helpdesk Technician</a>
            <span data-automation="advertiser-name">First Company in List</span>
          </article>
          <article data-automation="job-card" data-selected="true" data-job-id="88776655">
            <a data-automation="jobTitle" href="/job/88776655">Senior React Developer</a>
            <span data-automation="advertiser-name">Awesome Tech Pty Ltd</span>
          </article>
        </div>
        <div data-automation="jobDetails" data-job-id="88776655">
          <h1 data-automation="job-detail-title">Senior React Developer</h1>
          <span data-automation="advertiser-name">Awesome Tech Pty Ltd</span>
          <span data-automation="job-detail-location">Melbourne VIC</span>
          <span data-automation="job-detail-date">Posted 1d ago</span>
          <div data-automation="jobAdDetails">
            Looking for Senior React Developer with TypeScript, Next.js, and TailwindCSS experience.
          </div>
          <a data-automation="job-detail-apply" href="/job/88776655/apply">Apply</a>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.seek.com.au/jobs-in-information-communication-technology?jobId=88776655"),
      });

      const inspection = readSeekPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        // Must extract the SELECTED card in the right pane (88776655 / Senior React Developer), NOT the first card (11111111 / Junior Helpdesk)
        expect(inspection.snapshot.externalId).toBe("88776655");
        expect(inspection.snapshot.title).toBe("Senior React Developer");
        expect(inspection.snapshot.company).toBe("Awesome Tech Pty Ltd");
        expect(inspection.snapshot.location).toBe("Melbourne VIC");
        expect(inspection.snapshot.datePosted).toBe("Posted 1d ago");
        expect(inspection.snapshot.technologies).toContain("React");
        expect(inspection.snapshot.technologies).toContain("TypeScript");
      }
    });

    it("extracts distinct dates per card on SEEK search results without falling back to the first card's date", () => {
      document.body.innerHTML = `
        <div class="search-results-list">
          <article data-automation="job-card" data-job-id="10000001">
            <a data-automation="jobTitle" href="/job/10000001">First Job (Just Posted)</a>
            <span data-automation="jobListingDate">Just posted</span>
          </article>
          <article data-automation="job-card" data-job-id="10000002">
            <a data-automation="jobTitle" href="/job/10000002">Second Job (3 days ago)</a>
            <span data-automation="jobListingDate">3d ago</span>
          </article>
          <article data-automation="job-card" data-job-id="10000003">
            <a data-automation="jobTitle" href="/job/10000003">Third Job (14 days ago)</a>
            <span data-automation="jobListingDate">14d ago</span>
          </article>
        </div>
        <div data-automation="jobDetails" data-job-id="10000002">
          <h1 data-automation="job-detail-title">Second Job (3 days ago)</h1>
          <span data-automation="advertiser-name">Company Two</span>
          <div data-automation="jobAdDetails">Full description for job 2 with React and TypeScript.</div>
        </div>
      `;

      // Switching to Card 2
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.seek.com.au/jobs?jobId=10000002"),
      });

      const inspection2 = readSeekPage();
      expect(inspection2.kind).toBe("job");
      if (inspection2.kind === "job") {
        expect(inspection2.snapshot.externalId).toBe("10000002");
        expect(inspection2.snapshot.datePosted).toBe("3d ago");
        const formatted = parseAndFormatJobDate(inspection2.snapshot.datePosted!);
        expect(formatted.ageInDays).toBe(3);
      }

      // Now switch detail container and URL to Card 3
      const detailsEl = document.querySelector<HTMLElement>("[data-automation='jobDetails']")!;
      detailsEl.setAttribute("data-job-id", "10000003");
      detailsEl.querySelector("h1")!.textContent = "Third Job (14 days ago)";

      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.seek.com.au/jobs?jobId=10000003"),
      });

      const inspection3 = readSeekPage();
      expect(inspection3.kind).toBe("job");
      if (inspection3.kind === "job") {
        expect(inspection3.snapshot.externalId).toBe("10000003");
        expect(inspection3.snapshot.datePosted).toBe("14d ago");
        const formatted = parseAndFormatJobDate(inspection3.snapshot.datePosted!);
        expect(formatted.ageInDays).toBe(14);
      }
    });
  });

  describe("Indeed", () => {
    it("extracts posted date from Indeed JobMetadataFooter", () => {
      document.body.innerHTML = `
        <h1 data-testid="jobsearch-JobInfoHeader-title">Backend Engineer</h1>
        <div data-testid="inlineHeader-companyName">Database Inc</div>
        <div data-testid="job-location">Remote</div>
        <div id="jobDescriptionText">
          Backend Engineer position requiring PostgreSQL, Go, distributed systems experience and Kubernetes deployment skills.
        </div>
        <span data-testid="jobsearch-JobMetadataFooter-item">Posted 4 days ago</span>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/viewjob?jk=abc123456789"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("Posted 4 days ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.datePosted!);
        expect(formatted.displayText).toBe("4 days ago");
      }
    });

    it("extracts job on Indeed home/search page with vjk parameter in split view", () => {
      document.body.innerHTML = `
        <div class="jobsearch-LeftPane">
          <div class="job_seen_beacon" data-jk="111111111">
            <h2 class="jobTitle"><a href="/rc/clk?jk=111111111">Junior Software Developer</a></h2>
            <span data-testid="company-name">Transport For NSW</span>
          </div>
          <div class="job_seen_beacon" data-jk="2594f68539e2299a">
            <h2 class="jobTitle"><a href="/rc/clk?jk=2594f68539e2299a">Azure Integration Engineer</a></h2>
            <span data-testid="company-name">HCLTech - Australia and New Zealand</span>
          </div>
        </div>
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper">
            <h1 data-testid="jobsearch-JobInfoHeader-title">Azure Integration Engineer</h1>
            <div data-testid="inlineHeader-companyName">HCLTech - Australia and New Zealand</div>
            <div data-testid="inlineHeader-companyLocation">Sydney NSW • Hybrid work</div>
            <div id="jobDescriptionText">
              Azure Integration Engineer responsible for Azure Service Bus, Logic Apps, API Management, and CI/CD pipelines.
            </div>
            <span data-testid="jobsearch-JobMetadataFooter-item">Posted 3 days ago</span>
            <button aria-label="Apply with Indeed">Apply with Indeed</button>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/?vjk=2594f68539e2299a"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("2594f68539e2299a");
        expect(inspection.snapshot.title).toBe("Azure Integration Engineer");
        expect(inspection.snapshot.company).toBe("HCLTech - Australia and New Zealand");
        expect(inspection.snapshot.location).toBe("Sydney NSW • Hybrid work");
        expect(inspection.snapshot.datePosted).toBe("Posted 3 days ago");
        expect(inspection.snapshot.technologies).toContain("Azure");
        expect(inspection.snapshot.easyApply).toBe(true);
      }
    });
  });

  describe("Generic ATS", () => {
    it("prefers SmartRecruiters JobPosting microdata over its browser-support overlay", () => {
      document.body.innerHTML = `
        <section class="isn-overlay-dialog-header-wrapper">
          <h1 class="isn-overlay-dialog-header">
            Sorry, Internet Explorer 11 is no longer supported by SmartRecruiters
          </h1>
        </section>
        <main class="jobad-main job" itemscope itemtype="http://schema.org/JobPosting">
          <h1 class="job-title" itemprop="title">Frontend Engineer</h1>
          <div itemprop="hiringOrganization" itemscope itemtype="http://schema.org/Organization">
            <meta itemprop="name" content="Luxury Escapes" />
          </div>
          <div itemprop="jobLocation" itemscope itemtype="http://schema.org/Place">
            <meta itemprop="addressLocality" content="Sydney" />
            <meta itemprop="addressRegion" content="New South Wales" />
            <meta itemprop="addressCountry" content="Australia" />
          </div>
          <meta itemprop="datePosted" content="2026-08-17T07:41:39.323Z" />
          <div itemprop="description">
            Company Description
            Build high-quality customer experiences for a global travel platform.
            Job Description
            Design React and TypeScript features, integrate with Node.js microservices and AWS,
            write automated tests, and improve performance, accessibility, and reliability.
            Qualifications
            You have experience with JavaScript, CI/CD, REST APIs, and frontend architecture.
          </div>
          <a href="#apply" aria-label="Apply for this position">Apply now</a>
        </main>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://jobs.smartrecruiters.com/LuxuryEscapes/6000000001320869-frontend-engineer"),
      });

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = readGenericJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("Frontend Engineer");
        expect(inspection.snapshot.company).toBe("Luxury Escapes");
        expect(inspection.snapshot.location).toBe("Sydney, New South Wales, Australia");
        expect(inspection.snapshot.datePosted).toBe("2026-08-17T07:41:39.323Z");
        expect(inspection.snapshot.description).toContain("React and TypeScript");
        expect(inspection.snapshot.technologies).toEqual(expect.arrayContaining(["React", "TypeScript", "Node.js", "AWS"]));
      }
    });

    it("extracts date from meta published_time tag on Greenhouse / custom ATS", () => {
      document.head.innerHTML = `
        <meta property="article:published_time" content="2026-08-10T08:00:00Z">
      `;
      document.body.innerHTML = `
        <h1>Frontend Architect</h1>
        <div class="company">Innovate Web</div>
        <div id="job_description">
          Detailed job description for Frontend Architect requiring React, Next.js, Micro-frontends, CSS, and performance optimization skills.
        </div>
        <a href="#apply" aria-label="Apply for position">Apply Now</a>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://boards.greenhouse.io/company/jobs/12345"),
      });

      const inspection = readGenericJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.datePosted).toBe("2026-08-10T08:00:00Z");
        const formatted = parseAndFormatJobDate(inspection.snapshot.datePosted!, new Date("2026-08-13T00:00:00Z"));
        expect(formatted.displayText).toBe("2 days ago");
      }
    });
  });
});
