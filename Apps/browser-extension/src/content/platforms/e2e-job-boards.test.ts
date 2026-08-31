// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { readCurrentPageWhenReady } from "../page-reader";
import { classifyCurrentPage } from "../page-classifier";

function setLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: new URL(url),
  });
}

const LONG_JD = `
About the Role:
We are seeking a talented Senior Software Engineer with strong experience in building scalable cloud-native architectures.
Key Responsibilities:
- Design, develop, and maintain high-performance microservices in TypeScript, Go, and Python.
- Architect cloud infrastructure using AWS, Terraform, and Kubernetes.
- Collaborate with product designers and frontend teams using React, Next.js, and Tailwind CSS.
- Optimize database queries across PostgreSQL and Redis.
Requirements:
- 5+ years of full stack software engineering experience.
- Proficiency in modern JavaScript/TypeScript, React, Node.js, and SQL.
- Strong problem-solving and communication skills.
`;

describe("End-to-End Job Boards Multi-Job Recognition (5+ Jobs per Platform)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  // ==========================================
  // 1. DICE (5 Real-World Scenarios)
  // ==========================================
  describe("Dice (5 Distinct Job Scenarios)", () => {
    it("Job 1: Modern Web Component & data-cy layout", async () => {
      setLocation("https://www.dice.com/job-detail/b36db6d7-8367-4bb9-bd89-72c050b18f8e");
      document.title = "Senior Cloud Architect - Apex Systems - Austin, TX - Dice";
      document.body.innerHTML = `
        <dhi-candidate-job-details>
          <div data-cy="job-details">
            <h1 data-cy="jobTitle">Senior Cloud Architect</h1>
            <a data-cy="companyDescriptionLink" href="/company/apex-systems">Apex Systems</a>
            <li data-cy="jobLocation">Austin, TX</li>
            <span data-cy="postedDate">1 day ago</span>
            <div data-cy="jobDescriptionText">${LONG_JD}</div>
            <button data-cy="applyButton">Apply Now</button>
          </div>
        </dhi-candidate-job-details>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("dice");
        expect(inspection.snapshot.title).toBe("Senior Cloud Architect");
        expect(inspection.snapshot.company).toBe("Apex Systems");
        expect(inspection.snapshot.location).toBe("Austin, TX");
        expect(inspection.snapshot.externalId).toBe("b36db6d7-8367-4bb9-bd89-72c050b18f8e");
        expect(inspection.snapshot.description).toContain("microservices in TypeScript");
      }
    });

    it("Job 2: Standard jobdescSec with data-testid layout", async () => {
      setLocation("https://www.dice.com/jobs/detail/c89fa123-4567-89ab-cdef-0123456789ab");
      document.title = "Staff DevOps Engineer - CyberShield Corp - Dice";
      document.body.innerHTML = `
        <main>
          <div class="job-details">
            <h1 id="jobTitle" class="jobTitle">Staff DevOps Engineer</h1>
            <div data-testid="employer-name" class="company-name">CyberShield Corp</div>
            <div class="job-location">Remote, US</div>
            <time class="posted-date">3 hours ago</time>
            <div id="jobdescSec" class="job-description">
              <p>Lead the Kubernetes platform and Terraform infrastructure team.</p>
              ${LONG_JD}
            </div>
            <button class="dice-btn-apply">Easy Apply</button>
          </div>
        </main>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("dice");
        expect(inspection.snapshot.title).toBe("Staff DevOps Engineer");
        expect(inspection.snapshot.company).toBe("CyberShield Corp");
        expect(inspection.snapshot.location).toBe("Remote, US");
        expect(inspection.snapshot.externalId).toBe("c89fa123-4567-89ab-cdef-0123456789ab");
        expect(inspection.snapshot.description).toContain("Kubernetes platform and Terraform");
      }
    });

    it("Job 3: JSON-LD Structured Data on Dice detail page", async () => {
      setLocation("https://www.dice.com/job-detail/99911122-3344-5566-7788-99aabbccddeeff");
      document.title = "Full Stack Engineer - TechCraft - Dice";
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Full Stack Engineer",
          "hiringOrganization": { "@type": "Organization", "name": "TechCraft" },
          "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "New York, NY" } },
          "description": "TechCraft is looking for a Full Stack Engineer proficient in Next.js, Go, and PostgreSQL. ${LONG_JD}",
          "datePosted": "2026-08-30T10:00:00Z"
        }
        </script>
      `;
      document.body.innerHTML = `
        <div data-cy="job-details">
          <h1 data-cy="jobTitle">Full Stack Engineer</h1>
          <span data-cy="companyName">TechCraft</span>
          <span data-cy="jobLocation">New York, NY</span>
          <div data-cy="jobDescriptionText">TechCraft is looking for a Full Stack Engineer proficient in Next.js, Go, and PostgreSQL. ${LONG_JD}</div>
        </div>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("dice");
        expect(inspection.snapshot.title).toBe("Full Stack Engineer");
        expect(inspection.snapshot.company).toBe("TechCraft");
        expect(inspection.snapshot.location).toBe("New York, NY");
      }
    });

    it("Job 4: User Live URL - Dice Search with selectedJobId parameter", async () => {
      setLocation(
        "https://www.dice.com/jobs?q=Full+Stack+Developer&location=Sydney+NSW%2C+Australia&latitude=-33.8622503&longitude=151.207684&countryCode=AU&locationPrecision=City&adminDistrictCode=NSW&selectedJobId=2180c761-a7f3-48cb-9d6d-c0c5f1555c46",
      );
      document.title = "Full Stack Developer Jobs in Sydney NSW - Dice";
      document.body.innerHTML = `
        <div class="search-layout">
          <div class="search-card-list">
            <dhi-search-card data-cy="search-card" data-jobid="2180c761-a7f3-48cb-9d6d-c0c5f1555c46" data-selected="true">
              <a data-cy="card-title-link">Lead Full Stack Engineer</a>
              <span class="card-company">Sydney Tech Partners</span>
            </dhi-search-card>
          </div>
          <div class="search-details-pane">
            <dhi-sjt-job-details data-cy="sjt-job-details">
              <div data-cy="job-details">
                <h1 data-cy="jobTitle">Lead Full Stack Engineer</h1>
                <a data-cy="companyDescriptionLink" href="/company/sydney-tech">Sydney Tech Partners</a>
                <div data-cy="jobLocation">Sydney NSW, Australia</div>
                <div data-cy="jobDescriptionText">${LONG_JD}</div>
                <button data-cy="applyButton">Apply Now</button>
              </div>
            </dhi-sjt-job-details>
          </div>
        </div>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("dice");
        expect(inspection.snapshot.title).toBe("Lead Full Stack Engineer");
        expect(inspection.snapshot.company).toBe("Sydney Tech Partners");
        expect(inspection.snapshot.location).toBe("Sydney NSW, Australia");
        expect(inspection.snapshot.externalId).toBe("2180c761-a7f3-48cb-9d6d-c0c5f1555c46");
        expect(inspection.snapshot.description).toContain("microservices in TypeScript");
      }
    });

    it("Job 5: Legacy Dice job view with company fallback from title", async () => {
      setLocation("https://www.dice.com/jobs/detail/legacy-dice-id-7788");
      document.title = "Data Engineering Lead - Global Analytics - San Jose, CA - Dice";
      document.body.innerHTML = `
        <div class="job-info">
          <h1 class="title">Data Engineering Lead</h1>
          <div class="location">San Jose, CA</div>
          <div class="job-description">${LONG_JD}</div>
          <a href="/apply" class="button btn-primary">Apply</a>
        </div>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("dice");
        expect(inspection.snapshot.title).toBe("Data Engineering Lead");
        expect(inspection.snapshot.company).toBe("Global Analytics");
        expect(inspection.snapshot.location).toBe("San Jose, CA");
      }
    });
  });

  // ==========================================
  // 2. JORA (5 Real-World Scenarios)
  // ==========================================
  describe("Jora (5 Distinct Job Scenarios)", () => {
    it("Job 1: Modern Standalone Jora Page (#job-description-container)", async () => {
      setLocation("https://au.jora.com/job/Senior-Software-Engineer-Sydney-NSW-4ed7e4a8ac7496963d7be06e2ba13ddc");
      document.title = "Senior Software Engineer - Canva - Sydney NSW - Jora";
      document.body.innerHTML = `
        <div class="job-details-page content-container -width-xl">
          <div class="job-view-content" id="job-view" job-id="j_4ed7e4a8ac7496963d7be06e2ba13ddc">
            <div id="job-info-container">
              <h1 class="job-title heading -size-xxlarge">Senior Software Engineer</h1>
              <div id="company-location-container">
                <span class="company">Canva</span>
                <span class="location">Sydney NSW</span>
              </div>
              <div id="job-meta"><span class="listed-date">2h ago</span></div>
            </div>
            <div id="job-description-container">
              <div><div><p>${LONG_JD}</p></div></div>
            </div>
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("jora");
        expect(inspection.snapshot.title).toBe("Senior Software Engineer");
        expect(inspection.snapshot.company).toBe("Canva");
        expect(inspection.snapshot.location).toBe("Sydney NSW");
        expect(inspection.snapshot.externalId).toBe("4ed7e4a8ac7496963d7be06e2ba13ddc");
      }
    });

    it("Job 2: Split SERP Search Results View with active card", async () => {
      setLocation("https://au.jora.com/jobs-in-Sydney-NSW");
      document.title = "Jobs in Sydney NSW - Jora";
      document.body.innerHTML = `
        <div class="results-list-container">
          <div class="job-card result organic-job" data-job-id="jora-active-card-123" data-active="true">
            <h2 class="job-title"><a class="show-job-description">Frontend Tech Lead</a></h2>
            <span class="job-company">Atlassian</span>
            <span class="job-location">Sydney NSW</span>
            <div class="job-listed-date">1 day ago</div>
          </div>
        </div>
        <div class="grid-aside-pane">
          <div class="jdv-panel" data-hidden="false">
            <div class="jdv-content">
              <h1 class="heading -size-large">Frontend Tech Lead</h1>
              <div class="job-company">Atlassian</div>
              <div class="job-location">Sydney NSW</div>
              <div class="job-description">${LONG_JD}</div>
              <a href="/apply" class="rounded-button -primary">Apply</a>
            </div>
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("jora");
        expect(inspection.snapshot.title).toBe("Frontend Tech Lead");
        expect(inspection.snapshot.company).toBe("Atlassian");
        expect(inspection.snapshot.location).toBe("Sydney NSW");
      }
    });

    it("Job 3: Jora UK regional domain with Referral Apply link", async () => {
      setLocation("https://uk.jora.com/job/Data-Scientist-London-77bb88cc99dd00ee11ff22aa33bb44cc");
      document.title = "Data Scientist - DeepMind - London - Jora";
      document.body.innerHTML = `
        <div class="job-container">
          <div class="job-view-content" job-id="77bb88cc99dd00ee11ff22aa33bb44cc">
            <div id="job-info-container">
              <h1 class="job-title">Data Scientist</h1>
              <div id="company-location-container">
                <span class="company">DeepMind</span>
                <span class="location">London, UK</span>
              </div>
            </div>
            <div class="job-view-actions-container">
              <a class="apply-button" href="/job/rd/77bb88cc99dd00ee11ff22aa33bb44cc">Apply on employer site</a>
            </div>
            <div id="job-description-container">
              <div class="description-content">${LONG_JD}</div>
            </div>
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("jora");
        expect(inspection.snapshot.title).toBe("Data Scientist");
        expect(inspection.snapshot.company).toBe("DeepMind");
        expect(inspection.snapshot.externalId).toBe("77bb88cc99dd00ee11ff22aa33bb44cc");
      }
    });

    it("Job 4: Jora Braze/Hubble Tracking JSON Attribute on apply link", async () => {
      setLocation("https://au.jora.com/job/Product-Manager-Melbourne-VIC-11223344556677889900aabbccddeeff");
      document.title = "Product Manager - REA Group - Melbourne VIC - Jora";
      document.body.innerHTML = `
        <div class="job-details-page">
          <div class="job-view-content">
            <div id="job-info-container">
              <h1 class="job-title">Product Manager</h1>
              <div id="company-location-container">
                <span class="company">REA Group</span>
                <span class="location">Melbourne VIC</span>
              </div>
            </div>
            <a class="apply-button" data-braze='{"job_id":"11223344556677889900aabbccddeeff"}' href="/apply">Apply</a>
            <div id="job-description-container"><div>${LONG_JD}</div></div>
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("jora");
        expect(inspection.snapshot.externalId).toBe("11223344556677889900aabbccddeeff");
        expect(inspection.snapshot.company).toBe("REA Group");
      }
    });

    it("Job 5: Jora NZ regional search with JSON-LD metadata", async () => {
      setLocation("https://nz.jora.com/job/Security-Engineer-Auckland-abcdef1234567890abcdef1234567890");
      document.title = "Security Engineer - Xero - Auckland - Jora";
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Security Engineer",
          "hiringOrganization": { "@type": "Organization", "name": "Xero" },
          "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Auckland" } },
          "description": "${LONG_JD}"
        }
        </script>
      `;
      document.body.innerHTML = `
        <div class="job-details-page">
          <div class="job-view-content" job-id="j_abcdef1234567890abcdef1234567890">
            <h1 class="job-title">Security Engineer</h1>
            <div class="company">Xero</div>
            <div id="job-description-container">${LONG_JD}</div>
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("jora");
        expect(inspection.snapshot.title).toBe("Security Engineer");
        expect(inspection.snapshot.company).toBe("Xero");
      }
    });
  });

  // ==========================================
  // 3. ZIPRECRUITER (5 Real-World Scenarios)
  // ==========================================
  describe("ZipRecruiter (5 Distinct Job Scenarios)", () => {
    it("Job 1: Standard [data-testid='job-details'] with 1-Click Apply", async () => {
      setLocation("https://www.ziprecruiter.com/job/lead-infrastructure-engineer-abc12345");
      document.title = "Lead Infrastructure Engineer at Stripe in San Francisco, CA";
      document.body.innerHTML = `
        <div data-testid="job-details" data-job-id="zip-stripe-001">
          <h1 data-testid="job-title">Lead Infrastructure Engineer</h1>
          <div data-testid="hiring-company" class="hiring_company_text">Stripe</div>
          <div data-testid="job-location" class="location_text">San Francisco, CA</div>
          <div class="job_age">Posted 2 days ago</div>
          <div class="jobDescriptionSection">${LONG_JD}</div>
          <button data-testid="1-click-apply-button" class="apply_button">1-Click Apply</button>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("ziprecruiter");
        expect(inspection.snapshot.title).toBe("Lead Infrastructure Engineer");
        expect(inspection.snapshot.company).toBe("Stripe");
        expect(inspection.snapshot.location).toBe("San Francisco, CA");
        expect(inspection.snapshot.externalId).toBe("zip-stripe-001");
      }
    });

    it("Job 2: Employer Hosted Career Sub-route (/c/company/Job/...)", async () => {
      setLocation("https://www.ziprecruiter.com/c/Datadog/Job/Staff-Backend-Engineer/-id-datadog-998877");
      document.title = "Staff Backend Engineer at Datadog - New York, NY";
      document.body.innerHTML = `
        <div class="job_details">
          <h1 class="job_title">Staff Backend Engineer</h1>
          <a class="hiring_company">Datadog</a>
          <span class="company_location">New York, NY</span>
          <div class="job_description">${LONG_JD}</div>
          <button class="apply_button">Apply on Company Site</button>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("ziprecruiter");
        expect(inspection.snapshot.title).toBe("Staff Backend Engineer");
        expect(inspection.snapshot.company).toBe("Datadog");
        expect(inspection.snapshot.location).toBe("New York, NY");
      }
    });

    it("Job 3: ZipRecruiter UK regional job page", async () => {
      setLocation("https://www.ziprecruiter.co.uk/job/Cloud-Security-Lead-London-zipuk-445566");
      document.title = "Cloud Security Lead at Revolut in London, UK - ZipRecruiter";
      document.body.innerHTML = `
        <div class="job_details" data-job-id="zipuk-445566">
          <h1 class="job_title">Cloud Security Lead</h1>
          <div class="company_name">Revolut</div>
          <div class="location">London, UK</div>
          <div class="posted_time">1 week ago</div>
          <div class="job_description_container">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("ziprecruiter");
        expect(inspection.snapshot.title).toBe("Cloud Security Lead");
        expect(inspection.snapshot.company).toBe("Revolut");
        expect(inspection.snapshot.externalId).toBe("zipuk-445566");
      }
    });

    it("Job 4: ZipRecruiter Modular Container with Header Separation", async () => {
      setLocation("https://www.ziprecruiter.com/job/Senior-Data-Scientist-zip-ds-1234");
      document.title = "Senior Data Scientist at OpenAI in San Francisco, CA";
      document.body.innerHTML = `
        <div class="job-header">
          <h1 class="job_title">Senior Data Scientist</h1>
          <div class="hiring_company_text">OpenAI</div>
          <div class="location_text">San Francisco, CA</div>
        </div>
        <div class="job-details-container">
          <div class="jobDescriptionSection">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("ziprecruiter");
        expect(inspection.snapshot.title).toBe("Senior Data Scientist");
        expect(inspection.snapshot.company).toBe("OpenAI");
      }
    });

    it("Job 5: ZipRecruiter with JSON-LD Structured Data", async () => {
      setLocation("https://www.ziprecruiter.com/job/Full-Stack-Developer-zip-fs-7890");
      document.title = "Full Stack Developer at GitHub in Seattle, WA";
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Full Stack Developer",
          "hiringOrganization": { "@type": "Organization", "name": "GitHub" },
          "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Seattle, WA" } },
          "description": "${LONG_JD}"
        }
        </script>
      `;
      document.body.innerHTML = `
        <div data-testid="job-details">
          <h1 data-testid="job-title">Full Stack Developer</h1>
          <div data-testid="hiring-company">GitHub</div>
          <div data-testid="job-description">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("ziprecruiter");
        expect(inspection.snapshot.title).toBe("Full Stack Developer");
        expect(inspection.snapshot.company).toBe("GitHub");
      }
    });

    it("Job 6: Australian ZipRecruiter domain (ziprecruiter.com.au)", async () => {
      setLocation("https://www.ziprecruiter.com.au/job/senior-devops-sydney-zipau-5566");
      document.title = "Senior DevOps Engineer at Atlassian in Sydney NSW - ZipRecruiter";
      document.body.innerHTML = `
        <div data-testid="job-details" data-job-id="zipau-5566">
          <h1 data-testid="job-title">Senior DevOps Engineer</h1>
          <div data-testid="hiring-company">Atlassian</div>
          <div data-testid="job-location">Sydney NSW</div>
          <div class="jobDescriptionSection">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("ziprecruiter");
        expect(inspection.snapshot.title).toBe("Senior DevOps Engineer");
        expect(inspection.snapshot.company).toBe("Atlassian");
        expect(inspection.snapshot.location).toBe("Sydney NSW");
      }
    });

    it("Job 7: CareerOne third-party site must NOT be misidentified as ZipRecruiter", async () => {
      setLocation(
        "https://www.careerone.com.au/jobview/aff-46/1414e5c6-a0d2-11f1-bc76-0231708ce3cd?wt_mc_n=afc_adzuna_p5&utm_medium=afc_adzuna_p5&utm_source=affiliates",
      );
      document.title = "Warehouse Assistant - CareerOne";
      document.body.innerHTML = `
        <div class="job_content">
          <h1>Warehouse Assistant</h1>
          <div class="company_name">Logistics Hub</div>
          <div class="job_description_container">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      // Should NOT be ziprecruiter!
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).not.toBe("ziprecruiter");
      }
    });
  });

  // ==========================================
  // 4. ADZUNA (5 Real-World Scenarios)
  // ==========================================
  describe("Adzuna (5 Distinct Job Scenarios)", () => {
    it("Job 1: Australian Adzuna (adzuna.com.au) standard detail", async () => {
      setLocation("https://www.adzuna.com.au/details/1020304050");
      document.title = "Lead Frontend Engineer - Canva - Sydney NSW - Adzuna";
      document.body.innerHTML = `
        <div class="job-details" data-aid="1020304050">
          <h1 class="title">Lead Frontend Engineer</h1>
          <div class="company">Canva</div>
          <div class="location">Sydney NSW</div>
          <div class="posted">Just now</div>
          <div class="job-description">${LONG_JD}</div>
          <a class="apply-button" href="/land/ad/1020304050">Apply on partner site</a>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("adzuna");
        expect(inspection.snapshot.title).toBe("Lead Frontend Engineer");
        expect(inspection.snapshot.company).toBe("Canva");
        expect(inspection.snapshot.externalId).toBe("1020304050");
      }
    });

    it("Job 2: UK Adzuna with Phone Numbers / Email / Salary in JD (Strict Skill Cleanliness)", async () => {
      setLocation("https://www.adzuna.co.uk/details/9988776655");
      document.title = "Senior Platform Engineer - Monzo - London - Adzuna";
      document.body.innerHTML = `
        <div class="ui-details" data-id="9988776655">
          <h1 data-testid="title" class="heading">Senior Platform Engineer</h1>
          <div class="ui-details-company" data-testid="company">Monzo</div>
          <div class="ui-details-location" data-testid="location">London, UK</div>
          <div class="ui-details-description">
            <p>Monzo is hiring a Senior Platform Engineer.</p>
            <ul>
              <li>Call 0412 345 678 for details</li>
              <li>Email us at careers@monzo.com</li>
              <li>Salary: $150,000 per annum</li>
              <li>Location: London CBD</li>
              <li>Experience with Kubernetes, Go, Terraform, and AWS</li>
            </ul>
            ${LONG_JD}
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("adzuna");
        expect(inspection.snapshot.title).toBe("Senior Platform Engineer");
        expect(inspection.snapshot.company).toBe("Monzo");
        expect(inspection.snapshot.externalId).toBe("9988776655");
        // Verify phone numbers, emails, salaries are NEVER in technologies/skills
        const skillsJoined = (inspection.snapshot.technologies || []).join(" ");
        expect(skillsJoined).not.toContain("0412");
        expect(skillsJoined).not.toContain("monzo.com");
        expect(skillsJoined).not.toContain("$150,000");
        expect(skillsJoined).not.toContain("Call");
        expect(skillsJoined).not.toContain("Email");
      }
    });

    it("Job 3: Adzuna Referral Land Route (/land/ad/...)", async () => {
      setLocation("https://www.adzuna.com/land/ad/5544332211");
      document.title = "Staff Machine Learning Engineer at Anthropic in San Francisco, CA";
      document.body.innerHTML = `
        <div class="adp-body">
          <h1 class="title">Staff Machine Learning Engineer</h1>
          <a class="company" href="/company/anthropic">Anthropic</a>
          <span class="location">San Francisco, CA</span>
          <div class="job-description">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("adzuna");
        expect(inspection.snapshot.title).toBe("Staff Machine Learning Engineer");
        expect(inspection.snapshot.company).toBe("Anthropic");
        expect(inspection.snapshot.externalId).toBe("5544332211");
      }
    });

    it("Job 4: Adzuna Modular Header + Description Separation", async () => {
      setLocation("https://www.adzuna.com.au/details/1122339900");
      document.title = "Principal Site Reliability Engineer - Macquarie Group - Sydney NSW";
      document.body.innerHTML = `
        <header class="job-header">
          <h1 class="title">Principal Site Reliability Engineer</h1>
          <div class="company">Macquarie Group</div>
          <div class="location">Sydney NSW</div>
        </header>
        <div class="job-details">
          <div class="adp-body">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("adzuna");
        expect(inspection.snapshot.title).toBe("Principal Site Reliability Engineer");
        expect(inspection.snapshot.company).toBe("Macquarie Group");
      }
    });

    it("Job 5: Adzuna with JSON-LD Structured Data", async () => {
      setLocation("https://www.adzuna.com.au/details/7788990011");
      document.title = "Rust Systems Engineer - Fastly - Melbourne VIC";
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Rust Systems Engineer",
          "hiringOrganization": { "@type": "Organization", "name": "Fastly" },
          "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Melbourne VIC" } },
          "description": "${LONG_JD}"
        }
        </script>
      `;
      document.body.innerHTML = `
        <div class="job-details">
          <h1 class="title">Rust Systems Engineer</h1>
          <div class="company">Fastly</div>
          <div class="job-description">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("adzuna");
        expect(inspection.snapshot.title).toBe("Rust Systems Engineer");
        expect(inspection.snapshot.company).toBe("Fastly");
      }
    });
  });

  // ==========================================
  // 5. WELLFOUND (5 Real-World Scenarios)
  // ==========================================
  describe("Wellfound (5 Distinct Job Scenarios)", () => {
    it("Job 1: Modern Wellfound [data-test='JobListing'] with styles classes", async () => {
      setLocation("https://wellfound.com/jobs/334455-founding-engineer");
      document.title = "Founding Engineer at LangChain (Remote)";
      document.body.innerHTML = `
        <div data-test="JobListing" data-job-id="334455">
          <h1 class="styles_title__123">Founding Engineer</h1>
          <a class="styles_companyName__456" href="/company/langchain">LangChain</a>
          <div class="styles_location__789">Remote (US)</div>
          <span class="styles_posted__abc">Posted 1d ago</span>
          <div data-test="JobDescription" class="styles_description__def">${LONG_JD}</div>
          <button data-test="JobApplyButton">Apply Now</button>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("wellfound");
        expect(inspection.snapshot.title).toBe("Founding Engineer");
        expect(inspection.snapshot.company).toBe("LangChain");
        expect(inspection.snapshot.location).toBe("Remote (US)");
        expect(inspection.snapshot.externalId).toBe("334455");
      }
    });

    it("Job 2: Startup Header Component with sub-section description", async () => {
      setLocation("https://wellfound.com/jobs/998811-lead-ai-researcher");
      document.title = "Lead AI Researcher at Scale AI - San Francisco, CA";
      document.body.innerHTML = `
        <div class="styles_jobDetails__container">
          <div class="styles_companyHeader__top">
            <h1 class="styles_header__title">Lead AI Researcher</h1>
            <h2 class="styles_company__name">Scale AI</h2>
            <div class="styles_meta__info"><span>San Francisco, CA</span></div>
          </div>
          <section class="styles_jobDescription__body">
            <div class="job-description">${LONG_JD}</div>
          </section>
          <button class="styles_applyButton__btn">Quick Apply</button>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("wellfound");
        expect(inspection.snapshot.title).toBe("Lead AI Researcher");
        expect(inspection.snapshot.company).toBe("Scale AI");
        expect(inspection.snapshot.location).toBe("San Francisco, CA");
      }
    });

    it("Job 3: AngelList legacy domain (angel.co) compatibility", async () => {
      setLocation("https://angel.co/jobs/112233-senior-frontend-architect");
      document.title = "Senior Frontend Architect at Vercel";
      document.body.innerHTML = `
        <div data-test="JobListing">
          <h1 class="styles_title">Senior Frontend Architect</h1>
          <div class="styles_startupName">Vercel</div>
          <div class="styles_location">Remote</div>
          <div data-test="JobDescription">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("wellfound");
        expect(inspection.snapshot.title).toBe("Senior Frontend Architect");
        expect(inspection.snapshot.company).toBe("Vercel");
      }
    });

    it("Job 4: Wellfound Listing Route with slug (/l/slug-12345)", async () => {
      setLocation("https://wellfound.com/l/fullstack-engineer-resend-445566");
      document.title = "Fullstack Engineer at Resend - San Francisco, CA";
      document.body.innerHTML = `
        <div class="styles_layout">
          <h1 class="styles_title__main">Fullstack Engineer</h1>
          <div class="styles_companyTitle">Resend</div>
          <div class="styles_meta"><span>San Francisco, CA</span></div>
          <div class="styles_description">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("wellfound");
        expect(inspection.snapshot.title).toBe("Fullstack Engineer");
        expect(inspection.snapshot.company).toBe("Resend");
      }
    });

    it("Job 5: Wellfound JSON-LD Structured Data", async () => {
      setLocation("https://wellfound.com/jobs/778899-head-of-product");
      document.title = "Head of Product at Supabase - Remote";
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Head of Product",
          "hiringOrganization": { "@type": "Organization", "name": "Supabase" },
          "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Remote" } },
          "description": "${LONG_JD}"
        }
        </script>
      `;
      document.body.innerHTML = `
        <div data-test="JobListing">
          <h1 class="styles_title">Head of Product</h1>
          <div class="styles_companyName">Supabase</div>
          <div data-test="JobDescription">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("wellfound");
        expect(inspection.snapshot.title).toBe("Head of Product");
        expect(inspection.snapshot.company).toBe("Supabase");
      }
    });
  });

  // ==========================================
  // 6. SIMPLYHIRED (5 Real-World Scenarios)
  // ==========================================
  describe("SimplyHired (5 Distinct Job Scenarios)", () => {
    it("Job 1: Modern SimplyHired [data-testid='viewJobBody'] with Clean JD Separation", async () => {
      setLocation("https://www.simplyhired.com.au/job/abc-123-sre-sydney");
      document.title = "Staff SRE - Canva - Sydney NSW - SimplyHired";
      document.body.innerHTML = `
        <div data-testid="viewJobBody" data-jobkey="simply-canva-sre">
          <div data-testid="viewJobHeader">
            <h1 data-testid="viewJobTitle">Staff SRE</h1>
            <div data-testid="viewJobCompany">Canva</div>
            <div data-testid="viewJobLocation">Sydney NSW</div>
            <span data-testid="viewJobAge">1 day ago</span>
          </div>
          <div class="viewjob-salary-container">
            <span>$180,000 - $220,000 a year</span>
          </div>
          <div class="viewjob-qualifications">
            <span>Bachelor's degree</span>
          </div>
          <div data-testid="jobDescriptionText" class="viewjob-description">${LONG_JD}</div>
          <div class="viewjob-footer">
            <button data-testid="applyButton">Apply Now</button>
            <button class="report-job">Report Job</button>
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("simplyhired");
        expect(inspection.snapshot.title).toBe("Staff SRE");
        expect(inspection.snapshot.company).toBe("Canva");
        expect(inspection.snapshot.location).toBe("Sydney NSW");
        expect(inspection.snapshot.externalId).toBe("simply-canva-sre");
        // Verify JD description is clean and contains the real requirements without footer buttons
        expect(inspection.snapshot.description).toContain("microservices in TypeScript");
        expect(inspection.snapshot.description).not.toContain("Report Job");
      }
    });

    it("Job 2: SimplyHired viewjob-content with class selectors", async () => {
      setLocation("https://www.simplyhired.com/job/def-456-security-engineer");
      document.title = "Senior Security Engineer - Cloudflare - Austin, TX - SimplyHired";
      document.body.innerHTML = `
        <div class="viewjob-content">
          <h2 class="viewjob-jobTitle">Senior Security Engineer</h2>
          <span class="viewjob-company">Cloudflare</span>
          <span class="viewjob-location">Austin, TX</span>
          <span class="viewjob-age">3 hours ago</span>
          <div class="viewjob-description">${LONG_JD}</div>
          <a class="viewjob-applyButton" href="/apply">Apply</a>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("simplyhired");
        expect(inspection.snapshot.title).toBe("Senior Security Engineer");
        expect(inspection.snapshot.company).toBe("Cloudflare");
        expect(inspection.snapshot.location).toBe("Austin, TX");
      }
    });

    it("Job 3: Search SERP Split-view Job Card Selection", async () => {
      setLocation("https://www.simplyhired.com.au/search?q=Golang+Engineer&l=Melbourne");
      document.title = "Golang Engineer Jobs in Melbourne - SimplyHired";
      document.body.innerHTML = `
        <div class="serp-layout">
          <div class="serp-list">
            <div data-testid="searchSerpJob" data-jobkey="simply-go-7788">
              <h3>Lead Golang Engineer</h3>
            </div>
          </div>
          <div class="serp-detail-pane">
            <div data-testid="viewJobBody" data-jobkey="simply-go-7788">
              <h1 data-testid="viewJobTitle">Lead Golang Engineer</h1>
              <div data-testid="companyName">Envato</div>
              <div data-testid="location">Melbourne VIC</div>
              <div data-testid="jobDescriptionText">${LONG_JD}</div>
            </div>
          </div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("simplyhired");
        expect(inspection.snapshot.title).toBe("Lead Golang Engineer");
        expect(inspection.snapshot.company).toBe("Envato");
        expect(inspection.snapshot.externalId).toBe("simply-go-7788");
      }
    });

    it("Job 4: Header Outside Body Separation Layout", async () => {
      setLocation("https://www.simplyhired.com/job/ghi-789-data-architect");
      document.title = "Enterprise Data Architect - Snowflake - San Mateo, CA - SimplyHired";
      document.body.innerHTML = `
        <div class="viewjob-header">
          <h1 data-testid="viewJobTitle">Enterprise Data Architect</h1>
          <div data-testid="viewJobCompany">Snowflake</div>
          <div data-testid="viewJobLocation">San Mateo, CA</div>
        </div>
        <div data-testid="viewJobSection">
          <div class="job-description">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("simplyhired");
        expect(inspection.snapshot.title).toBe("Enterprise Data Architect");
        expect(inspection.snapshot.company).toBe("Snowflake");
      }
    });

    it("Job 5: SimplyHired with JSON-LD Structured Data", async () => {
      setLocation("https://www.simplyhired.com.au/job/jkl-012-frontend-lead");
      document.title = "Frontend Lead - SafetyCulture - Sydney NSW - SimplyHired";
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Frontend Lead",
          "hiringOrganization": { "@type": "Organization", "name": "SafetyCulture" },
          "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Sydney NSW" } },
          "description": "${LONG_JD}"
        }
        </script>
      `;
      document.body.innerHTML = `
        <div data-testid="viewJobBody">
          <h1 data-testid="viewJobTitle">Frontend Lead</h1>
          <div data-testid="viewJobCompany">SafetyCulture</div>
          <div class="viewjob-description">${LONG_JD}</div>
        </div>
      `;

      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("simplyhired");
        expect(inspection.snapshot.title).toBe("Frontend Lead");
        expect(inspection.snapshot.company).toBe("SafetyCulture");
      }
    });
  });

  // ==========================================
  // 7. CAREERONE (5 Real-World Scenarios)
  // ==========================================
  describe("CareerOne (5 Distinct Job Scenarios)", () => {
    it("Job 1: User Live URL with affiliate query params (/jobview/aff-46/<uuid>)", async () => {
      setLocation(
        "https://www.careerone.com.au/jobview/aff-46/1414e5c6-a0d2-11f1-bc76-0231708ce3cd?wt_mc_n=afc_adzuna_p5&utm_medium=afc_adzuna_p5&utm_source=affiliates",
      );
      document.title = "Mid-Level Full Stack Developer | Yurra Pty Ltd | CareerOne";
      document.body.innerHTML = `
        <div class="jobview-container" data-testid="job-details">
          <div class="job-header">
            <h1 class="job-title" data-testid="job-title">Mid-Level Full Stack Developer</h1>
            <a href="/jobs/br_yurra-pty-ltd" class="company-name" data-testid="company-name">Yurra Pty Ltd</a>
            <a href="/jobs/in-perth-wa-6000" class="job-location" data-testid="job-location">Perth WA 6000</a>
          </div>
          <div class="job-description" data-testid="job-description">
            <p>About Beyond (part of Yurra Group)</p>
            ${LONG_JD}
          </div>
          <a href="/apply" class="apply-button" data-testid="apply-button">Apply Now</a>
        </div>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("careerone");
        expect(inspection.snapshot.title).toBe("Mid-Level Full Stack Developer");
        expect(inspection.snapshot.company).toBe("Yurra Pty Ltd");
        expect(inspection.snapshot.location).toBe("Perth WA 6000");
        expect(inspection.snapshot.externalId).toBe("1414e5c6-a0d2-11f1-bc76-0231708ce3cd");
        expect(inspection.snapshot.description).toContain("microservices in TypeScript");
      }
    });

    it("Job 2: Standard CareerOne standalone jobview route (/jobview/<uuid>)", async () => {
      setLocation("https://www.careerone.com.au/jobview/8899aabb-ccdd-eeff-0011-223344556677");
      document.title = "Senior DevOps Engineer - Atlassian - CareerOne";
      document.body.innerHTML = `
        <main class="job-view" data-job-id="8899aabb-ccdd-eeff-0011-223344556677">
          <h1 class="title">Senior DevOps Engineer</h1>
          <div class="company">Atlassian</div>
          <div class="location">Sydney NSW</div>
          <div class="job-details-content">${LONG_JD}</div>
          <button class="btn-apply">Apply</button>
        </main>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("careerone");
        expect(inspection.snapshot.title).toBe("Senior DevOps Engineer");
        expect(inspection.snapshot.company).toBe("Atlassian");
        expect(inspection.snapshot.externalId).toBe("8899aabb-ccdd-eeff-0011-223344556677");
      }
    });

    it("Job 3: CareerOne jobs slug route with title fallback", async () => {
      setLocation("https://www.careerone.com.au/jobs/tech-lead-sydney-careerone-5566");
      document.title = "Tech Lead | Canva | CareerOne";
      document.body.innerHTML = `
        <div class="job-details-page">
          <h1 data-testid="jobview-title">Tech Lead</h1>
          <a href="/jobs/br_canva" class="company">Canva</a>
          <span class="location">Sydney NSW</span>
          <div class="description">${LONG_JD}</div>
        </div>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("careerone");
        expect(inspection.snapshot.title).toBe("Tech Lead");
        expect(inspection.snapshot.company).toBe("Canva");
      }
    });

    it("Job 4: CareerOne with structured company badge and skills", async () => {
      setLocation("https://www.careerone.com.au/jobview/aff-99/product-manager-melbourne-7788");
      document.title = "Product Manager | REA Group | CareerOne";
      document.body.innerHTML = `
        <div data-testid="jobview">
          <h1 class="job-title">Product Manager</h1>
          <div data-testid="company">REA Group</div>
          <div data-testid="location">Melbourne VIC</div>
          <div data-testid="skills">
            <span class="skill">Product Strategy</span>
            <span class="skill">Agile</span>
          </div>
          <div class="job-description">${LONG_JD}</div>
        </div>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("careerone");
        expect(inspection.snapshot.title).toBe("Product Manager");
        expect(inspection.snapshot.company).toBe("REA Group");
        expect(inspection.snapshot.technologies).toContain("Product Strategy");
      }
    });

    it("Job 5: CareerOne with JSON-LD Structured Data", async () => {
      setLocation("https://www.careerone.com.au/jobview/cyber-security-analyst-112233");
      document.title = "Cyber Security Analyst | Commonwealth Bank | CareerOne";
      document.head.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Cyber Security Analyst",
          "hiringOrganization": { "@type": "Organization", "name": "Commonwealth Bank" },
          "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Sydney NSW" } },
          "description": "${LONG_JD}"
        }
        </script>
      `;
      document.body.innerHTML = `
        <div class="job-details">
          <h1 class="job-title">Cyber Security Analyst</h1>
          <div class="company-name">Commonwealth Bank</div>
          <div class="job-description">${LONG_JD}</div>
        </div>
      `;

      expect(classifyCurrentPage().isJobPage).toBe(true);
      const inspection = await readCurrentPageWhenReady();
      expect(inspection.kind).toBe("job");
      if (inspection.kind === "job") {
        expect(inspection.snapshot.platform).toBe("careerone");
        expect(inspection.snapshot.title).toBe("Cyber Security Analyst");
        expect(inspection.snapshot.company).toBe("Commonwealth Bank");
      }
    });
  });
});
