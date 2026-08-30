// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { readCurrentPageWhenReady } from "../page-reader";
import { readLinkedInPage } from "./linkedin/job-reader";
import { readSeekPage } from "./seek/job-reader";
import { readIndeedJobPage } from "./indeed/job-reader";
import { readGenericJobPage } from "./generic/job-reader";
import { classifyCurrentPage } from "../page-classifier";
import { parseAndFormatJobDate } from '@jobby/ui/lib/date-formatter';
import { pageInspectionSchema } from "../../shared/contracts/page-inspection";

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
        expect(inspection.snapshot.postingDateRaw?.label).toContain("2 weeks ago");
        expect(inspection.snapshot.url).toBe("https://www.linkedin.com/jobs/view/123456789/");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!);
        expect(formatted.displayText).toBe("14 days ago");
        expect(formatted.isNotFresh).toBe(false);
      }
    });

    it.each([
      ["software-engineer-at-stake-4458160309", "4458160309"],
      ["software-engineer-net-ai-at-corto-4455221406", "4455221406"],
      ["software-engineer-at-macquarie-group-4448451118", "4448451118"],
      ["software-engineer-at-propeller-4434953356", "4434953356"],
      ["software-engineer-at-weave-recruitment-4452894753", "4452894753"],
    ])("recognizes LinkedIn slug job URL %s", (slug, externalId) => {
      document.body.innerHTML = `
        <main>
          <h1>Software Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Test Company</div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              Build and maintain production software using TypeScript and React.
            </div>
          </div>
        </main>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL(`https://au.linkedin.com/jobs/view/${slug}`),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe(externalId);
        expect(inspection.snapshot.title).toBe("Software Engineer");
        expect(inspection.snapshot.url).toBe(
          `https://www.linkedin.com/jobs/view/${externalId}/`,
        );
      }
    });

    it("keeps technology-rich LinkedIn jobs within the inspection contract", () => {
      document.body.innerHTML = `
        <main>
          <h1>Staff Software Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Technology Company</div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              ${Array.from({ length: 45 }, (_, index) => `Specialized Skill ${index + 1}`).join(" ")}
            </div>
          </div>
          <section class="job-details-preferences-and-skills-list">
            <ul>${Array.from({ length: 35 }, (_, index) => `<li>Explicit Skill ${index + 1}</li>`).join("")}</ul>
          </section>
        </main>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL(
          "https://au.linkedin.com/jobs/view/staff-software-engineer-at-technology-company-4458160309",
        ),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.technologies).toHaveLength(30);
        expect(pageInspectionSchema.safeParse(inspection).success).toBe(true);
      }
    });

    it("falls back to the LinkedIn page date when API enrichment has no timestamps", () => {
      document.body.innerHTML = `
        <div class="jobs-details__main-content">
          <h1>Senior Software Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Acme Corp</div>
          <div class="job-details-jobs-unified-top-card__primary-description-container">
            <span>Sydney · Reposted 2 days ago · 45 applicants</span>
          </div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              Build TypeScript and React applications.
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/123456789/"),
      });

      const inspection = readLinkedInPage({
        postingObservedAt: "2026-08-26T00:00:00.000Z",
        isReposted: false,
        postingDateRaw: {},
        easyApply: false,
      });

      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.lastPostedAt).toBeDefined();
        expect(inspection.snapshot.isReposted).toBe(true);
        expect(inspection.snapshot.postingDateRaw?.label).toContain("Reposted 2 days ago");
      }
    });

    it("waits for a late LinkedIn DOM date when the API omits timestamps", async () => {
      document.body.innerHTML = `
        <div class="jobs-details__main-content">
          <h1>Senior Software Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Acme Corp</div>
          <div class="job-details-jobs-unified-top-card__primary-description-container"></div>
          <div class="jobs-description__content">
            <div class="jobs-box__html-content">
              Build TypeScript and React applications.
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/123456789/"),
      });
      document.cookie = 'JSESSIONID="ajax:123"; path=/';
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      }));

      window.setTimeout(() => {
        const metadata = document.querySelector(
          ".job-details-jobs-unified-top-card__primary-description-container",
        );
        if (metadata) metadata.textContent = "Sydney · Posted 2 days ago · 45 applicants";
      }, 20);

      try {
        const inspection = await readCurrentPageWhenReady();
        expect(inspection.kind).toBe("job");
        if (inspection.kind === "job") {
          expect(inspection.snapshot.lastPostedAt).toBeDefined();
          expect(inspection.snapshot.postingDateRaw?.label).toContain("Posted 2 days ago");
        }
      } finally {
        vi.unstubAllGlobals();
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
        expect(inspection.snapshot.postingDateRaw?.label).toContain("3d ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!);
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
        expect(inspection.snapshot.postingDateRaw?.label).toContain("1 week ago");
        expect(inspection.snapshot.url).toBe("https://www.linkedin.com/jobs/view/4447639577/");
        expect(parseAndFormatJobDate(inspection.snapshot.lastPostedAt!).displayText).toBe("7 days ago");
      }
    });

    it("does not use LinkedIn work-type links as the job title", () => {
      document.title = "C# Developer | TechnologyOne | LinkedIn";
      document.body.innerHTML = `
        <main>
          <div data-display-contents="true">
            <a href="/company/technology-one/"><p>TechnologyOne</p></a>
            <p>C# Developer</p>
            <p>Brisbane, Queensland, Australia · 6 days ago</p>
            <a href="/jobs/view/4456324563/">Hybrid</a>
            <a href="/jobs/view/4456324563/">Full-time</a>
          </div>
          <div id="job-details">
            Build scalable C# and .NET applications for enterprise customers.
          </div>
        </main>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/4456324563/"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("C# Developer");
      }
    });

    it("prefers the direct LinkedIn page title over a stale DOM heading", () => {
      document.title = "C# Developer | TechnologyOne | LinkedIn";
      document.body.innerHTML = `
        <main>
          <h1>Similar .NET Developer role</h1>
          <a href="/company/technology-one/">TechnologyOne</a>
          <div data-display-contents="true">
            <p>TechnologyOne</p>
            <p>C# Developer</p>
            <p>Brisbane, Queensland, Australia · 6 days ago</p>
          </div>
          <div id="job-details">Build scalable C# applications.</div>
        </main>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/view/4456324563/"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("C# Developer");
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
        expect(inspection.snapshot.postingDateRaw?.label).toContain("3天前");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!);
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
        expect(inspection.snapshot.lastPostedAt).toBe("2026-08-11T00:00:00.000Z");
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
        expect(inspection.snapshot.lastPostedAt).toBe("2026-08-12T00:00:00.000Z");
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
      if (inspection.kind === "job" && inspection.snapshot.platform === "linkedin") {
        expect(inspection.snapshot.title).toBe("Lead Cloud Architect");
        expect(inspection.snapshot.company).toBe("Cloud Innovations");
        expect(inspection.snapshot.location).toBe("Sydney, New South Wales, Australia");
        expect(inspection.snapshot.postingDateRaw?.label).toContain("3 days ago");
        expect(inspection.snapshot.description).toContain("Lead Cloud Architect");
        expect(inspection.snapshot.easyApply).toBe(true);
      }
    });

    it("extracts job title and details from LinkedIn search-results page URL with currentJobId", () => {
      document.body.innerHTML = `
        <div class="scaffold-layout__list">
          <div class="jobs-search-results-list">
            <li data-occludable-job-id="4458174510" class="scaffold-layout__list-item jobs-search-results-list__list-item">
              <a class="job-card-list__title--link" href="/jobs/view/4458174510/?eBP=123">
                <strong aria-hidden="true">Staff Software Engineer</strong>
              </a>
              <div class="job-card-container__primary-description">Acme Technology</div>
              <time datetime="2026-08-20T00:00:00Z">6 days ago</time>
            </li>
          </div>
        </div>
        <div class="scaffold-layout__detail jobs-search-two-pane__job-details">
          <div class="job-details-jobs-unified-top-card">
            <h2 class="job-details-jobs-unified-top-card__job-title">
              <a href="/jobs/view/4458174510/?eBP=123">Staff Software Engineer</a>
            </h2>
            <div class="job-details-jobs-unified-top-card__company-name">
              <a href="/company/acme-technology/">Acme Technology</a>
            </div>
            <div class="job-details-jobs-unified-top-card__primary-description-container">
              <span>Sydney, New South Wales, Australia</span>
              <span>·</span>
              <span>6 days ago</span>
            </div>
          </div>
          <div id="job-details" class="jobs-box__html-content">
            Staff Software Engineer role requiring TypeScript, React, distributed systems, and GraphQL.
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/search-results/?currentJobId=4458174510&eBP"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("4458174510");
        expect(inspection.snapshot.title).toBe("Staff Software Engineer");
        expect(inspection.snapshot.company).toBe("Acme Technology");
        expect(inspection.snapshot.location).toBe("Sydney, New South Wales, Australia");
        expect(inspection.snapshot.url).toBe("https://www.linkedin.com/jobs/view/4458174510/");
      }
    });

    it("extracts job info from multi-column LinkedIn search-results with non-job headings", () => {
      document.body.innerHTML = `
        <div class="scaffold-layout__list">
          <ul class="jobs-search-results-list">
            <li class="jobs-search-results-list__list-item jobs-search-results-list__list-item--active" data-occludable-job-id="4450450603">
              <div class="job-card-container">
                <a class="job-card-container__link" href="/jobs/search-results/?currentJobId=4450450603&eBP=123">
                  <strong aria-hidden="true">Dotnet Developer</strong>
                </a>
                <div class="job-card-container__primary-description">Ad Astra Consultants</div>
                <span>Sydney, NSW (On-site)</span>
                <time datetime="2026-08-20T00:00:00Z">1 week ago</time>
              </div>
            </li>
            <li class="jobs-search-results-list__list-item" data-occludable-job-id="9988776655">
              <div class="job-card-container">
                <a class="job-card-container__link" href="/jobs/search-results/?currentJobId=9988776655">
                  <strong aria-hidden="true">C#.Net Developer</strong>
                </a>
                <div class="job-card-container__primary-description">TechnologyOne</div>
              </div>
            </li>
          </ul>
        </div>
        <div class="scaffold-layout__detail">
          <div class="jobs-details__main-content">
            <div class="job-details-jobs-unified-top-card">
              <h2 class="t-24 t-bold">Dotnet Developer</h2>
              <div class="job-details-jobs-unified-top-card__primary-description-container">
                <a href="/company/ad-astra-consultants/">Ad Astra Consultants</a>
                <span>·</span>
                <span>Sydney, New South Wales, Australia (On-site)</span>
                <span>·</span>
                <span>1 week ago</span>
              </div>
            </div>
            <div class="people-section">
              <h2>People you can reach out to</h2>
              <h3>Meet the hiring team</h3>
              <div>ASHWINI GHATODE</div>
            </div>
            <div class="about-section">
              <h2>About the job</h2>
              <div id="job-details" class="jobs-box__html-content">
                Hiring: Senior .NET Developer<br>
                We are looking for an experienced Senior .NET Developer with strong expertise in .NET Core/.NET 6+, C#, Microservices, REST APIs, Node.js, NestJS, AWS Cloud, and CI/CD practices.<br>
                Key Skills:<br>
                ✓ .NET Framework / .NET Core / C#<br>
                ✓ Microservices & REST API Development<br>
                ✓ Node.js & NestJS<br>
                ✓ Kafka / IBM MQ<br>
                ✓ SQL & NoSQL Databases<br>
                ✓ AWS (Lambda, S3, IAM, CloudWatch, Step Functions)<br>
                ✓ GitHub, GitHub Actions, TeamCity, UrbanCode Deploy<br>
                ✓ Agile, Jira & Confluence<br>
                Preferred: React.js, Next.js, TypeScript, Redux, Monitoring Tools (Grafana, Splunk), and Financial Services experience.
              </div>
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.linkedin.com/jobs/search-results/?currentJobId=4450450603&eBP=CwEAAAGgPjX5D8Usop"),
      });

      const inspection = readLinkedInPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("4450450603");
        expect(inspection.snapshot.title).toBe("Dotnet Developer");
        expect(inspection.snapshot.company).toBe("Ad Astra Consultants");
        expect(inspection.snapshot.location).toBe("Sydney, New South Wales, Australia (On-site)");
        expect(inspection.snapshot.url).toBe("https://www.linkedin.com/jobs/view/4450450603/");
        expect(inspection.snapshot.technologies).toContain(".NET");
        expect(inspection.snapshot.technologies).toContain("C#");
        expect(inspection.snapshot.technologies).toContain("Microservices");
        expect(inspection.snapshot.technologies).toContain("AWS");
        expect(inspection.snapshot.technologies).toContain("Agile");
        expect(inspection.snapshot.technologies).toContain("Jira");
        expect(inspection.snapshot.technologies).toContain("Confluence");
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
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 2d ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!);
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
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 1d ago");
        expect(inspection.snapshot.technologies).toContain("React");
        expect(inspection.snapshot.technologies).toContain("TypeScript");
      }
    });

    it("prefers the active SEEK detail identity when a card changes without changing the URL", () => {
      document.body.innerHTML = `
        <article data-automation="job-card" data-selected="true" data-job-id="20000001">
          <a data-automation="jobTitle" href="/job/20000001">First Engineer</a>
        </article>
        <article data-automation="job-card" data-job-id="20000002">
          <a data-automation="jobTitle" href="/job/20000002">Second Engineer</a>
        </article>
        <div data-automation="jobDetails" data-job-id="20000001">
          <h1 data-automation="job-detail-title">First Engineer</h1>
          <span data-automation="advertiser-name">First Company</span>
          <div data-automation="jobAdDetails">First current job description with React and TypeScript engineering responsibilities.</div>
          <a data-automation="job-detail-apply" href="/job/20000001/apply">Apply</a>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.seek.com.au/jobs?jobId=20000001"),
      });

      const first = readSeekPage();
      expect(first.kind).toBe("job");
      if (first.kind !== "job") return;
      expect(first.snapshot.externalId).toBe("20000001");

      const cards = document.querySelectorAll<HTMLElement>("[data-automation='job-card']");
      cards.item(0).removeAttribute("data-selected");
      cards.item(1).setAttribute("data-selected", "true");
      const detail = document.querySelector<HTMLElement>("[data-automation='jobDetails']")!;
      detail.setAttribute("data-job-id", "20000002");
      detail.querySelector("h1")!.textContent = "Second Engineer";
      detail.querySelector("[data-automation='advertiser-name']")!.textContent = "Second Company";
      detail.querySelector("a")!.setAttribute("href", "/job/20000002/apply");

      const second = readSeekPage();
      expect(second.kind).toBe("job");
      if (second.kind !== "job") return;
      expect(window.location.href).toContain("jobId=20000001");
      expect(second.snapshot.externalId).toBe("20000002");
      expect(second.snapshot.title).toBe("Second Engineer");
      expect(second.snapshot.company).toBe("Second Company");
    });

    it("reads the active identity from SEEK's current aria-selected card", () => {
      document.body.innerHTML = `
        <article data-testid="job-card" data-job-id="30000001" aria-selected="false">
          <a data-automation="jobTitle" href="/job/30000001">First Engineer</a>
        </article>
        <article data-testid="job-card" data-job-id="30000002" aria-selected="true">
          <a data-automation="jobTitle" href="/job/30000002">Second Engineer</a>
          <span data-automation="jobListingDate">2d ago</span>
        </article>
        <div data-automation="jobDetailsPage">
          <h1 data-automation="job-detail-title">Second Engineer</h1>
          <span data-automation="advertiser-name">Second Company</span>
          <div data-automation="jobAdDetails">Current SEEK description with React and TypeScript engineering responsibilities.</div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.seek.com/jobs?jobId=30000001"),
      });

      const inspection = readSeekPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind !== "job") return;
      expect(window.location.href).toContain("jobId=30000001");
      expect(inspection.snapshot.externalId).toBe("30000002");
      expect(inspection.snapshot.title).toBe("Second Engineer");
      expect(inspection.snapshot.postingDateRaw?.label).toBe("2d ago");
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
        expect(inspection2.snapshot.postingDateRaw?.label).toBe("3d ago");
        const formatted = parseAndFormatJobDate(inspection2.snapshot.lastPostedAt!);
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
        expect(inspection3.snapshot.postingDateRaw?.label).toBe("14d ago");
        const formatted = parseAndFormatJobDate(inspection3.snapshot.lastPostedAt!);
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
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 4 days ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!);
        expect(formatted.displayText).toBe("4 days ago");
      }
    });

    it("uses JSON-LD on a standalone Indeed job when the posting has no identifier", () => {
      document.body.innerHTML = `
        <script type="application/ld+json">
          {"@type":"JobPosting","title":"Standalone Role","hiringOrganization":{"name":"Standalone Company"},"datePosted":"2026-08-27T06:31:48.763Z","description":"A standalone role requiring TypeScript and React experience."}
        </script>
        <div id="viewJobSSRRoot">
          <h1 data-testid="jobsearch-JobInfoHeader-title">Standalone Role</h1>
          <div data-testid="inlineHeader-companyName">Standalone Company</div>
          <div id="jobDescriptionText">A standalone role requiring TypeScript and React experience.</div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/viewjob?jk=standalone-card"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("standalone-card");
        expect(inspection.snapshot.postingDateRaw?.label).toBe("2026-08-27T06:31:48.763Z");
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
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="2594f68539e2299a">
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
        expect(inspection.snapshot.platform).toBe("indeed");
        expect(inspection.snapshot.externalId).toBe("2594f68539e2299a");
        expect(inspection.snapshot.title).toBe("Azure Integration Engineer");
        expect(inspection.snapshot.company).toBe("HCLTech - Australia and New Zealand");
        expect(inspection.snapshot.location).toBe("Sydney NSW • Hybrid work");
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 3 days ago");
        expect(inspection.snapshot.technologies).toContain("Azure");
      }
    });

    it("correctly extracts data when switching cards in Indeed split view without stale card data contamination", () => {
      document.body.innerHTML = `
        <div class="jobsearch-LeftPane">
          <div class="job_seen_beacon" data-jk="card-111">
            <h2 class="jobTitle"><a href="/rc/clk?jk=card-111">Card 1 Title</a></h2>
            <span data-testid="company-name">Card 1 Company</span>
            <div data-testid="text-location">Sydney NSW</div>
            <span data-testid="myJobsStateDate">Posted 5 days ago</span>
          </div>
          <div class="job_seen_beacon" data-jk="card-222" aria-selected="true">
            <h2 class="jobTitle"><a href="/rc/clk?jk=card-222">Card 2 Title</a></h2>
            <span data-testid="company-name">Card 2 Company</span>
            <div data-testid="text-location">Melbourne VIC</div>
            <span data-testid="myJobsStateDate">Posted 1 day ago</span>
          </div>
        </div>
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="card-222">
            <h1 data-testid="jobsearch-JobInfoHeader-title">Card 2 Title</h1>
            <div data-testid="inlineHeader-companyName">Card 2 Company</div>
            <div data-testid="inlineHeader-companyLocation">Melbourne VIC</div>
            <div id="jobDescriptionText">
              Card 2 detailed description with Python, Django, PostgreSQL, and Docker.
            </div>
            <span data-testid="jobsearch-JobMetadataFooter-item">Posted 1 day ago</span>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/jobs?q=developer&vjk=card-222"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("indeed");
        expect(inspection.snapshot.externalId).toBe("card-222");
        expect(inspection.snapshot.title).toBe("Card 2 Title");
        expect(inspection.snapshot.company).toBe("Card 2 Company");
        expect(inspection.snapshot.location).toBe("Melbourne VIC");
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 1 day ago");
        expect(inspection.snapshot.description).toContain("Python, Django");
      }
    });

    it("does not contaminate extraction with previous card's detail pane when switching to a card whose detail pane is loading", () => {
      // User clicked card-333, URL has vjk=card-333 and left pane has card-333 selected.
      // But right pane still has data-jk="card-222" from the previous job.
      document.body.innerHTML = `
        <div class="jobsearch-LeftPane">
          <div class="job_seen_beacon" data-jk="card-222">
            <h2 class="jobTitle"><a href="/rc/clk?jk=card-222">Card 2 Title</a></h2>
            <span data-testid="company-name">Card 2 Company</span>
          </div>
          <div class="job_seen_beacon" data-jk="card-333" aria-selected="true">
            <h2 class="jobTitle"><a href="/rc/clk?jk=card-333">Card 3 Target Title</a></h2>
            <span data-testid="company-name">Card 3 Target Company</span>
            <div data-testid="text-location">Brisbane QLD</div>
            <span data-testid="myJobsStateDate">Posted 2 days ago</span>
          </div>
        </div>
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="card-222">
            <h1 data-testid="jobsearch-JobInfoHeader-title">Card 2 Title</h1>
            <div data-testid="inlineHeader-companyName">Card 2 Company</div>
            <div id="jobDescriptionText">
              Card 2 stale description.
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/jobs?q=developer&vjk=card-333"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("indeed");
        expect(inspection.snapshot.externalId).toBe("card-333");
        // Title and company should be from card-333, NOT from stale card-222
        expect(inspection.snapshot.title).toBe("Card 3 Target Title");
        expect(inspection.snapshot.company).toBe("Card 3 Target Company");
        expect(inspection.snapshot.location).toBe("Brisbane QLD");
        // Stale description from card-222 should NOT be leaked
        expect(inspection.snapshot.description).toBeUndefined();
      }
    });

    it("does not reuse the previous detail date when Indeed exposes its key only as fromjk", () => {
      document.body.innerHTML = `
        <div class="jobsearch-LeftPane">
          <div class="job_seen_beacon">
            <h2 class="jobTitle"><a data-jk="new-card" aria-pressed="true">New Card Title</a></h2>
            <span data-testid="company-name">New Card Company</span>
          </div>
        </div>
        <div class="fastviewjob">
          <a href="/cmp/Old-Company?fromjk=old-card">Old Company</a>
          <h1 data-testid="jobsearch-JobInfoHeader-title">Old Card Title</h1>
          <div id="jobDescriptionText">Old card description.</div>
          <span data-testid="jobsearch-JobMetadataFooter-item">Posted 2 days ago</span>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/jobs?q=developer&vjk=old-card"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("new-card");
        expect(inspection.snapshot.title).toBe("New Card Title");
        expect(inspection.snapshot.company).toBe("New Card Company");
        expect(inspection.snapshot.postingDateRaw).toBeUndefined();
        expect(inspection.snapshot.description).toBeUndefined();
      }
    });

    it("uses the selected card when Indeed leaves the previous vjk and JSON-LD in place", () => {
      document.body.innerHTML = `
        <div class="jobsearch-LeftPane">
          <div class="job_seen_beacon resultWithShelf" data-jk="old-card">
            <h2 class="jobTitle"><a href="/rc/clk?jk=old-card">Old Role</a></h2>
            <span data-testid="company-name">Old Company</span>
          </div>
          <div class="job_seen_beacon" data-jk="new-card" aria-selected="true">
            <h2 class="jobTitle"><a href="/rc/clk?jk=new-card">Newest Role</a></h2>
            <span data-testid="company-name">New Company</span>
          </div>
        </div>
        <script type="application/ld+json">
          {"@type":"JobPosting","title":"Old Role","datePosted":"2026-08-24"}
        </script>
        <div class="jobsearch-RightPane" data-jk="new-card">
          <h1 data-testid="jobsearch-JobInfoHeader-title">Newest Role</h1>
          <div data-testid="inlineHeader-companyName">New Company</div>
          <div id="jobDescriptionText">Newest role description with React, TypeScript, and testing.</div>
          <span data-testid="jobsearch-JobMetadataFooter-item">Posted today</span>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/jobs?q=developer&vjk=old-card"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("new-card");
        expect(inspection.snapshot.title).toBe("Newest Role");
        expect(inspection.snapshot.company).toBe("New Company");
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted today");
        expect(inspection.snapshot.description).toContain("Newest role description");
      }
    });

    it("reads the initially selected Indeed card when its job key is on the pressed link", () => {
      document.body.innerHTML = `
        <div class="job_seen_beacon">
          <h2 class="jobTitle"><a data-jk="first-card" aria-pressed="true">First Card Role</a></h2>
          <span data-testid="company-name">First Card Company</span>
          <span data-testid="myJobsStateDate">Posted 6 days ago</span>
        </div>
        <div class="job_seen_beacon">
          <h2 class="jobTitle"><a data-jk="second-card">Second Card Role</a></h2>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/jobs?q=developer"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.externalId).toBe("first-card");
        expect(inspection.snapshot.title).toBe("First Card Role");
        expect(inspection.snapshot.company).toBe("First Card Company");
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 6 days ago");
      }
    });

    it("keeps technology-rich Indeed jobs within the inspection contract", () => {
      const skills = Array.from(
        { length: 35 },
        (_, index) => `<li>Specialized Skill ${index + 1}</li>`,
      ).join("");
      document.body.innerHTML = `
        <article class="job_seen_beacon">
          <a data-jk="technology-rich" aria-pressed="true">Technology Rich Role</a>
        </article>
        <div class="jobsearch-JobComponent">
          <h1 data-testid="jobsearch-JobInfoHeader-title">Technology Rich Role</h1>
          <div data-testid="inlineHeader-companyName">Technology Company</div>
          <div id="jobDescriptionText">A detailed role using TypeScript, React, AWS, Docker, Kubernetes, and many specialist skills.</div>
          <section id="qualificationsSection"><ul>${skills}</ul></section>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/?vjk=technology-rich"),
      });

      const inspection = readIndeedJobPage();
      expect(() => pageInspectionSchema.parse(inspection)).not.toThrow();
      if (inspection.kind === "job") {
        expect(inspection.snapshot.technologies).toHaveLength(30);
      }
    });

    it("strips Indeed '- job post' and accessibility suffixes from job titles", () => {
      document.body.innerHTML = `
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="job-post-test">
            <h1 data-testid="jobsearch-JobInfoHeader-title">
              <span>Senior Full Stack Engineer</span>
              <span class="visually-hidden"> - job post</span>
            </h1>
            <div data-testid="inlineHeader-companyName">Tech Global</div>
            <div id="jobDescriptionText">Role requiring React and Node.js.</div>
            <div class="jobsearch-JobMetadataFooter">
              <ul>
                <li><span>Posted 2 days ago</span></li>
              </ul>
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/viewjob?jk=job-post-test"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("Senior Full Stack Engineer");
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 2 days ago");
      }
    });

    it("falls back to selected card date when detail pane does not contain date metadata", () => {
      document.body.innerHTML = `
        <div class="jobsearch-LeftPane">
          <div class="job_seen_beacon" data-jk="card-date-test" aria-selected="true">
            <h2 class="jobTitle"><span>DevOps Specialist - job post</span></h2>
            <span data-testid="company-name">Cloud Systems</span>
            <span data-testid="myJobsStateDate">Posted 5 days ago</span>
          </div>
        </div>
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="card-date-test">
            <h1 data-testid="jobsearch-JobInfoHeader-title">DevOps Specialist - job post</h1>
            <div data-testid="inlineHeader-companyName">Cloud Systems</div>
            <div id="jobDescriptionText">AWS, Terraform, CI/CD pipeline management.</div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/jobs?q=devops&vjk=card-date-test"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("DevOps Specialist");
        expect(inspection.snapshot.postingDateRaw?.label).toBe("Posted 5 days ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!);
        expect(formatted.displayText).toBe("5 days ago");
      }
    });

    it("extracts employer active and active date variants on Indeed", () => {
      document.body.innerHTML = `
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="active-date-test">
            <h1 data-testid="jobsearch-JobInfoHeader-title">Data Engineer</h1>
            <div data-testid="inlineHeader-companyName">Analytics Co</div>
            <div id="jobDescriptionText">SQL, Spark, Python data pipelines.</div>
            <div data-testid="jobsearch-HiringInsights-date">EmployerActive 3 days ago</div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://au.indeed.com/viewjob?jk=active-date-test"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.postingDateRaw?.label).toBe("EmployerActive 3 days ago");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!);
        expect(formatted.displayText).toBe("3 days ago");
      }
    });

    it("does not extract years of experience or weekly hours from job description as posting date", () => {
      document.body.innerHTML = `
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="9b6c4e44d19a1073">
            <h1 data-testid="jobsearch-JobInfoHeader-title">Full-stack Developer (.NET/Blazor/SQL/Pipelines) - job post</h1>
            <div data-testid="inlineHeader-companyName">Mango Chamba, LLC</div>
            <div id="jobDescriptionText">
              <p>We are seeking a Full-Stack Developer with 5+ years of experience with C#, .NET, Blazor.</p>
              <p>Requirements:</p>
              <ul>
                <li>5+ years building web applications</li>
                <li>3+ years with SQL databases</li>
                <li>Work in office 3 days a week (hybrid)</li>
                <li>40 hours per week</li>
              </ul>
            </div>
          </div>
        </div>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.indeed.com/viewjob?jk=9b6c4e44d19a1073"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("Full-stack Developer (.NET/Blazor/SQL/Pipelines)");
        expect(inspection.snapshot.postingDateRaw).toBeUndefined();
        expect(inspection.snapshot.lastPostedAt).toBeUndefined();
      }
    });

    it("extracts exact pubDate and relative time from window.mosaic.providerData", () => {
      document.body.innerHTML = `
        <div class="jobsearch-RightPane">
          <div class="jobsearch-ViewJobPaneWrapper" data-jk="20fec3bae09fda06">
            <h1 data-testid="jobsearch-JobInfoHeader-title">Full Stack Developer</h1>
            <div data-testid="inlineHeader-companyName">Sydney Tech</div>
            <div id="jobDescriptionText">Building scalable cloud services.</div>
          </div>
        </div>
        <script id="mosaic-data">
          window.mosaic = window.mosaic || {};
          window.mosaic.providerData = window.mosaic.providerData || {};
          window.mosaic.providerData["mosaic-provider-jobcards"] = {
            "metaData": {
              "mosaicProviderJobCardsModel": {
                "results": [
                  {
                    "jobkey": "20fec3bae09fda06",
                    "title": "Full Stack Developer",
                    "company": "Sydney Tech",
                    "formattedRelativeTime": "30+ days ago",
                    "pubDate": 1724600000000
                  }
                ]
              }
            }
          };
        </script>
      `;
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("https://www.indeed.com/jobs?q=Full+Stack+Developer&l=Sydney&vjk=20fec3bae09fda06"),
      });

      const inspection = readIndeedJobPage();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.title).toBe("Full Stack Developer");
        expect(inspection.snapshot.company).toBe("Sydney Tech");
        expect(inspection.snapshot.lastPostedAt).toBe(new Date(1724600000000).toISOString());
        expect(inspection.snapshot.postingDateRaw?.label).toBe(new Date(1724600000000).toISOString());
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
        expect(inspection.snapshot.lastPostedAt).toBe("2026-08-17T07:41:39.323Z");
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
        expect(inspection.snapshot.lastPostedAt).toBe("2026-08-10T08:00:00.000Z");
        const formatted = parseAndFormatJobDate(inspection.snapshot.lastPostedAt!, new Date("2026-08-13T00:00:00Z"));
        expect(formatted.displayText).toBe("2 days ago");
      }
    });
  });
});
