// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { readLinkedInPage } from "./linkedin/job-reader";
import { readSeekPage } from "./seek/job-reader";
import { readIndeedJobPage } from "./indeed/job-reader";
import { readGenericJobPage } from "./generic/job-reader";
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
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        // Must read from the ACTIVE card (333333333), not the first card (111111111)
        expect(inspection.snapshot.datePosted).toBe("2026-08-12T00:00:00Z");
        expect(inspection.snapshot.externalId).toBe("333333333");
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
  });

  describe("Generic ATS", () => {
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
