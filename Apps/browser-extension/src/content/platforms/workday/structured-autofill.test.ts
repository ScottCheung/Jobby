// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  autofillWorkdayStructuredSections,
  valueForWorkdayStructuredField,
} from "./structured-autofill";
import { workdaySectionItems, workdaySkills } from "./field-mapping";

const textField = (label: string, name = "") => ({
  type: "text",
  label,
  name,
});

describe("Workday structured resume field mapping", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 480 });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 48 });
    HTMLElement.prototype.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 480, height: 48, top: 0, right: 480, bottom: 48, left: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  });

  it("maps work experience fields", () => {
    const experience = {
      company: "Acme Pty Ltd",
      title: "Senior Engineer",
      location: "Sydney, NSW",
      start_date: "2022-03-01",
      end_date: null,
      is_current: true,
      description: ["Built the platform", "Led five engineers"],
    };

    expect(valueForWorkdayStructuredField("experience", experience, textField("Job Title", "jobTitle"))).toBe("Senior Engineer");
    expect(valueForWorkdayStructuredField("experience", experience, textField("Company", "company"))).toBe("Acme Pty Ltd");
    expect(valueForWorkdayStructuredField("experience", experience, textField("Start Date", "startDate"))).toBe("03/2022");
    expect(valueForWorkdayStructuredField("experience", experience, { type: "checkbox", label: "I currently work here", name: "currentlyWorkHere" })).toBe(true);
    expect(valueForWorkdayStructuredField("experience", experience, { type: "textarea", label: "Role Description", name: "roleDescription" })).toBe("Built the platform\nLed five engineers");
  });

  it("maps Workday segmented month and year controls from resume dates", () => {
    const experience = { start_date: "August 2022", end_date: "2024-03" };

    expect(valueForWorkdayStructuredField("experience", experience, {
      type: "select",
      label: "Month",
      automationId: "dateSectionMonth-input|startDate",
    })).toBe("August");
    expect(valueForWorkdayStructuredField("experience", experience, {
      type: "text",
      label: "Year",
      automationId: "dateSectionYear-input|startDate",
    })).toBe("2022");
    expect(valueForWorkdayStructuredField("experience", experience, {
      type: "text",
      label: "Month",
      automationId: "dateSectionMonth-input|endDate",
    })).toBe("03");
    expect(valueForWorkdayStructuredField("experience", experience, {
      type: "text",
      label: "Year",
      automationId: "dateSectionYear-input|endDate",
    })).toBe("2024");
  });

  it("uses real Workday inline ids to distinguish repeated start and end dates", () => {
    const experience = { start_date: "2022-08", end_date: "2024-03" };
    const education = { start_date: "2017-02", end_date: "2020-11" };

    expect(valueForWorkdayStructuredField("experience", experience, {
      type: "number",
      label: "Year",
      id: "workExperience-6--startDate-dateSectionYear-input",
      automationId: "dateSectionYear-input",
    })).toBe("2022");
    expect(valueForWorkdayStructuredField("experience", experience, {
      type: "number",
      label: "Year",
      id: "workExperience-6--endDate-dateSectionYear-input",
      automationId: "dateSectionYear-input",
    })).toBe("2024");
    expect(valueForWorkdayStructuredField("education", education, {
      type: "number",
      label: "Year",
      id: "education-15--firstYearAttended-dateSectionYear-input",
      automationId: "dateSectionYear-input",
    })).toBe("2017");
    expect(valueForWorkdayStructuredField("education", education, {
      type: "number",
      label: "Year",
      id: "education-15--lastYearAttended-dateSectionYear-input",
      automationId: "dateSectionYear-input",
    })).toBe("2020");
  });

  it("maps education fields", () => {
    const education = {
      institution: "University of Sydney",
      degree: "Bachelor of Science",
      field_of_study: "Computer Science",
      start_date: "2017-02-01",
      end_date: "2020-11-01",
    };

    expect(valueForWorkdayStructuredField("education", education, textField("School", "school"))).toBe("University of Sydney");
    expect(valueForWorkdayStructuredField("education", education, textField("Degree", "degree"))).toBe("Bachelor of Science");
    expect(valueForWorkdayStructuredField("education", education, textField("Field of Study", "fieldOfStudy"))).toBe("Computer Science");
    expect(valueForWorkdayStructuredField("education", education, textField("First Year Attended", "firstYearAttended"))).toBe("2017");
  });

  it("maps detailed resume degrees to Workday's supported degree choices", () => {
    const education = { degree: "Master of Information Technology" };

    expect(valueForWorkdayStructuredField(
      "education",
      education,
      { type: "select", label: "Degree", name: "degree" },
    )).toBe("Masters");
  });

  it("treats an experience with no end date as current when the profile omits the flag", () => {
    const experience = { start_date: "2026-03", end_date: null };

    expect(valueForWorkdayStructuredField(
      "experience",
      experience,
      { type: "checkbox", label: "I currently work here", name: "currentlyWorkHere" },
    )).toBe(true);
  });

  it("maps certification and language fields", () => {
    const certification = {
      name: "AWS Solutions Architect",
      issuer: "Amazon Web Services",
      issue_date: "2024-05-01",
      expiry_date: "2027-05-01",
      credential_url: "https://example.com/credential",
    };
    const language = { name: "English", proficiency: "Native" };

    expect(valueForWorkdayStructuredField("certifications", certification, textField("Certification Name", "certificationName"))).toBe("AWS Solutions Architect");
    expect(valueForWorkdayStructuredField("certifications", certification, textField("Issued By", "issuer"))).toBe("Amazon Web Services");
    expect(valueForWorkdayStructuredField("certifications", certification, textField("Expiration Date", "expirationDate"))).toBe("05/2027");
    expect(valueForWorkdayStructuredField("languages", language, { type: "select", label: "Language", name: "language" })).toBe("English");
    expect(valueForWorkdayStructuredField("languages", language, { type: "select", label: "Proficiency", name: "languageProficiency" })).toBe("Native");
  });

  it("maps profile websites and portfolio links to Workday website entries", () => {
    expect(workdaySectionItems({
      basics: {
        website: "https://example.com",
        portfolio_url: "https://portfolio.example.com",
      },
      links: [{ name: "GitHub", url: "https://github.com/example" }],
    }, "websites")).toEqual([
      { url: "https://example.com" },
      { url: "https://portfolio.example.com" },
      { url: "https://github.com/example" },
    ]);
    expect(valueForWorkdayStructuredField(
      "websites",
      { url: "https://portfolio.example.com" },
      { type: "url", label: "Website URL", name: "webAddress" },
    )).toBe("https://portfolio.example.com");
  });

  it("uses only explicit profile and saved skills with stable deduplication", () => {
    expect(workdaySkills({
      core_competencies: ["Invented competency"],
      skills: [
        { type: "Languages", skills: ["TypeScript", "Java"] },
        { type: "Tools", skills: ["typescript", "Docker"] },
      ],
    }, ["Kubernetes", "Java"])).toEqual([
      "TypeScript",
      "Java",
      "Docker",
      "Kubernetes",
    ]);
  });

  it("splits the common .NET C# compound skill into Workday-compatible skills", () => {
    expect(workdaySkills({
      skills: [{ type: "Languages", skills: [".NET C#", "C# .NET", ".NET / C#", "TypeScript"] }],
    })).toEqual([".NET Framework", "C#", "TypeScript"]);
  });

  it("selects an exact Workday skill instead of the first similar suggestion", async () => {
    document.body.innerHTML = `
      <section data-automation-id="skillsSection">
        <h3>Skills</h3>
        <label for="skill-search">Skill</label>
        <input id="skill-search" name="skillPrompt" role="combobox" aria-controls="skill-options" />
        <div id="selected-skills"></div>
      </section>
      <div id="skill-options" role="listbox"></div>`;
    const input = document.querySelector<HTMLInputElement>("#skill-search")!;
    const options = document.querySelector<HTMLElement>("#skill-options")!;
    input.addEventListener("input", () => {
      options.innerHTML = `<div role="option">JavaScript</div><div role="option">Java</div>`;
      options.querySelectorAll<HTMLElement>("[role='option']").forEach((option) => {
        option.addEventListener("click", () => {
          document.querySelector("#selected-skills")!.innerHTML =
            `<span data-automation-id="selected-skill">${option.textContent}</span>`;
        });
      });
    });

    const results = await autofillWorkdayStructuredSections({
      skills: [{ type: "Languages", skills: ["Java"] }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("filled");
    expect(document.querySelector("#selected-skills")?.textContent).toBe("Java");
  });

  it("recognises Workday's real skills multiselect without ARIA combobox attributes", async () => {
    document.body.innerHTML = `
      <section>
        <h4 id="Skills-section">Skills</h4>
        <div data-automation-id="multiSelectContainer">
          <label for="skills--skills">Type to Add Skills</label>
          <input id="skills--skills" />
          <div id="selected-skills"></div>
        </div>
      </section>
      <div role="listbox" id="skill-options"></div>`;
    const keys: string[] = [];
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return;
      keys.push(event.key);
      if (keys.join(",") === "Enter") {
        document.querySelector("#skill-options")!.innerHTML = `
          <div role="option" data-automation-id="menuItem" aria-selected="false"><span data-automation-id="promptOption">TypeScript</span></div>`;
        document.body.focus();
      } else if (event.key === "ArrowDown") {
        document.querySelector<HTMLElement>("[data-automation-id='menuItem']")!
          .setAttribute("aria-selected", "true");
      } else if (keys.join(",") === "Enter,ArrowDown,Enter") {
        document.querySelector("#selected-skills")!.innerHTML =
          `<div data-automation-id="selectedItem"><span data-automation-id="promptOption">TypeScript</span></div>`;
      }
    };
    document.addEventListener("keydown", handleKey);

    const results = await autofillWorkdayStructuredSections({
      skills: [{ type: "Languages", skills: ["TypeScript"] }],
    });
    document.removeEventListener("keydown", handleKey);

    expect(results).toEqual([
      expect.objectContaining({ status: "filled", key: "workday-skill-typescript" }),
    ]);
    expect(keys).toEqual(["Enter", "ArrowDown", "Enter"]);
    expect(document.querySelector("#selected-skills")?.textContent).toBe("TypeScript");
  });

  it("waits for a delayed Workday skill result before confirming it", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = `
        <section>
          <h4 id="Skills-section">Skills</h4>
          <div data-automation-id="multiSelectContainer">
            <label for="skills--skills">Type to Add Skills</label>
            <input id="skills--skills" data-uxi-widget-type="selectinput" />
            <div id="selected-skills"></div>
          </div>
        </section>
        <div role="listbox" id="skill-options"></div>`;
      document.addEventListener("keydown", function onKey(event) {
        if (event.key !== "Enter") return;
        window.setTimeout(() => {
          const options = document.querySelector<HTMLElement>("#skill-options")!;
          options.innerHTML = `
            <div role="option" data-automation-id="menuItem"><span data-automation-id="promptLeafNode">TypeScript</span></div>`;
          options.querySelector<HTMLElement>("[data-automation-id='promptLeafNode']")!
            .addEventListener("click", () => {
              document.querySelector("#selected-skills")!.innerHTML =
                `<div data-automation-id="selectedItem">TypeScript</div>`;
            });
        }, 2500);
        document.removeEventListener("keydown", onKey);
      });

      const pending = autofillWorkdayStructuredSections({
        skills: [{ type: "Languages", skills: ["TypeScript"] }],
      });
      await vi.advanceTimersByTimeAsync(10000);

      expect(await pending).toEqual([
        expect.objectContaining({ status: "filled", key: "workday-skill-typescript" }),
      ]);
      expect(document.querySelector("#selected-skills")?.textContent).toBe("TypeScript");
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a Workday skill when its optimistic selected pill is rolled back", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = `
        <section>
          <h4 id="Skills-section">Skills</h4>
          <div data-automation-id="multiSelectContainer">
            <label for="skills--skills">Type to Add Skills</label>
            <input id="skills--skills" data-uxi-widget-type="selectinput" />
            <div id="selected-skills"></div>
          </div>
        </section>
        <div role="listbox" id="skill-options"></div>`;
      const input = document.querySelector<HTMLInputElement>("#skills--skills")!;
      const options = document.querySelector<HTMLElement>("#skill-options")!;
      let selections = 0;
      input.addEventListener("input", () => {
        if (!input.value) {
          options.innerHTML = "";
          return;
        }
        options.innerHTML = `<div role="option" data-automation-id="menuItem"><span data-automation-id="promptLeafNode">TypeScript</span></div>`;
        options.querySelector<HTMLElement>("[data-automation-id='promptLeafNode']")!
          .addEventListener("click", () => {
            selections += 1;
            document.querySelector("#selected-skills")!.innerHTML =
              `<div data-automation-id="selectedItem">TypeScript</div>`;
            input.value = "";
            if (selections === 1) {
              window.setTimeout(() => {
                document.querySelector("#selected-skills")!.innerHTML = "";
              }, 1000);
            }
          });
      });

      const pending = autofillWorkdayStructuredSections({
        skills: [{ type: "Languages", skills: ["TypeScript"] }],
      });
      await vi.advanceTimersByTimeAsync(15000);

      expect(await pending).toEqual([
        expect.objectContaining({ status: "filled" }),
        expect.objectContaining({ status: "filled" }),
      ]);
      expect(selections).toBe(2);
      expect(document.querySelector("#selected-skills")?.textContent).toBe("TypeScript");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops before filling Workday sections when autofill is cancelled", async () => {
    document.body.innerHTML = `
      <section data-automation-id="workExperienceSection">
        <input id="workExperience-1--jobTitle" name="jobTitle" />
      </section>`;

    const results = await autofillWorkdayStructuredSections(
      { work_experience: [{ title: "UI Engineer" }] },
      [],
      () => true,
    );

    expect(results).toEqual([]);
    expect(document.querySelector<HTMLInputElement>("#workExperience-1--jobTitle")?.value).toBe("");
  });

  it("does not confirm the first Workday skill when the exact search has no result", async () => {
    document.body.innerHTML = `
      <section>
        <h4 id="Skills-section">Skills</h4>
        <div data-automation-id="multiSelectContainer">
          <label for="skills--skills">Type to Add Skills</label>
          <input id="skills--skills" data-uxi-widget-type="selectinput" />
          <div id="selected-skills"></div>
        </div>
      </section>
      <div role="listbox" id="skill-options"></div>`;
    const input = document.querySelector<HTMLInputElement>("#skills--skills")!;
    const keys: string[] = [];
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return;
      keys.push(event.key);
      if (event.key === "Enter") {
        document.querySelector("#skill-options")!.innerHTML = `
          <div role="option" data-automation-id="menuItem" aria-label="No Items.">No Items.</div>`;
      }
    };
    document.addEventListener("keydown", handleKey);

    const results = await autofillWorkdayStructuredSections({
      skills: [{ type: "Tools", skills: ["Playright"] }],
    });
    document.removeEventListener("keydown", handleKey);

    expect(results).toEqual([
      expect.objectContaining({ status: "rejected" }),
    ]);
    expect(keys).toEqual(["Enter"]);
    expect(document.querySelector("#selected-skills")?.textContent).toBe("");
    expect(input.value).toBe("");
  });

  it("skips a skill when Workday has no exact suggestion", async () => {
    document.body.innerHTML = `
      <section data-automation-id="skillsSection">
        <h3>Skills</h3>
        <label for="skill-search">Skill</label>
        <input id="skill-search" name="skillPrompt" role="combobox" aria-controls="skill-options" />
      </section>
      <div id="skill-options" role="listbox"><div role="option">JavaScript</div></div>`;

    const results = await autofillWorkdayStructuredSections({
      skills: [{ type: "Languages", skills: ["Java"] }],
    });

    expect(results[0]?.status).toBe("rejected");
    expect(document.querySelector("[role='option']")?.textContent).toBe("JavaScript");
  });

  it("opens, fills, and saves a Workday repeated section", async () => {
    document.body.innerHTML = `
      <section data-automation-id="workExperienceSection">
        <h3>Work Experience</h3>
        <button data-automation-id="add-button">Add</button>
      </section>`;
    const section = document.querySelector<HTMLElement>("[data-automation-id='workExperienceSection']")!;
    section.querySelector("button")!.addEventListener("click", () => {
      section.insertAdjacentHTML("beforeend", `
        <div data-testid="experience-editor">
          <label for="job-title">Job Title</label><input id="job-title" name="jobTitle" />
          <label for="company">Company</label><input id="company" name="company" />
          <button data-automation-id="save-button">Save</button>
        </div>`);
      section.querySelector<HTMLElement>("[data-automation-id='save-button']")!.addEventListener("click", () => {
        const company = section.querySelector<HTMLInputElement>("#company")!.value;
        section.querySelector("[data-testid='experience-editor']")!.remove();
        section.insertAdjacentHTML("beforeend", `<p>${company}</p>`);
      });
    });

    const results = await autofillWorkdayStructuredSections({
      experience: [{ company: "Acme Pty Ltd", title: "Senior Engineer" }],
    });

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === "filled")).toBe(true);
    expect(section.textContent).toContain("Acme Pty Ltd");
    expect(section.querySelector("[data-testid='experience-editor']")).toBeNull();
  });

  it("adds two roles at the same company instead of treating the second as a duplicate", async () => {
    document.body.innerHTML = `
      <section data-automation-id="workExperienceSection">
        <h3>Work Experience</h3>
        <button data-automation-id="add-button">Add</button>
        <div id="saved-experience"></div>
      </section>`;
    const section = document.querySelector<HTMLElement>("[data-automation-id='workExperienceSection']")!;
    section.querySelector("button")!.addEventListener("click", () => {
      section.insertAdjacentHTML("beforeend", `
        <div data-testid="experience-editor">
          <label for="job-title">Job Title</label><input id="job-title" name="jobTitle" />
          <label for="company">Company</label><input id="company" name="company" />
          <button data-automation-id="save-button">Save</button>
        </div>`);
      section.querySelector<HTMLElement>("[data-automation-id='save-button']")!.addEventListener("click", () => {
        const title = section.querySelector<HTMLInputElement>("#job-title")!.value;
        const company = section.querySelector<HTMLInputElement>("#company")!.value;
        section.querySelector("#saved-experience")!.insertAdjacentHTML("beforeend", `<p>${title} — ${company}</p>`);
        section.querySelector("[data-testid='experience-editor']")!.remove();
      });
    });

    const results = await autofillWorkdayStructuredSections({
      experience: [
        { company: "Acme", title: "Senior Engineer" },
        { company: "Acme", title: "Engineering Manager" },
      ],
    });

    expect(results).toHaveLength(4);
    expect(document.querySelector("#saved-experience")?.textContent).toContain("Senior Engineer — Acme");
    expect(document.querySelector("#saved-experience")?.textContent).toContain("Engineering Manager — Acme");
  });

  it("fills real Workday inline entries in resume order with entry-specific dates", async () => {
    document.body.innerHTML = `
      <section>
        <h4 id="Work-Experience-section">Work Experience</h4>
        <div>
          <label for="workExperience-6--jobTitle">Job Title</label><input id="workExperience-6--jobTitle" name="jobTitle" />
          <label for="workExperience-6--companyName">Company</label><input id="workExperience-6--companyName" name="companyName" />
          <label for="workExperience-6--startDate-dateSectionYear-input">Year</label>
          <input id="workExperience-6--startDate-dateSectionYear-input" data-automation-id="dateSectionYear-input" />
        </div>
        <div>
          <label for="workExperience-59--jobTitle">Job Title</label><input id="workExperience-59--jobTitle" name="jobTitle" />
          <label for="workExperience-59--companyName">Company</label><input id="workExperience-59--companyName" name="companyName" />
          <label for="workExperience-59--startDate-dateSectionYear-input">Year</label>
          <input id="workExperience-59--startDate-dateSectionYear-input" data-automation-id="dateSectionYear-input" />
        </div>
      </section>`;

    await autofillWorkdayStructuredSections({
      experience: [
        { company: "Newest Co", title: "Lead Engineer", start_date: "2024-01" },
        { company: "Earlier Co", title: "Engineer", start_date: "2021-06" },
      ],
    });

    expect(document.querySelector<HTMLInputElement>("#workExperience-6--jobTitle")?.value).toBe("Lead Engineer");
    expect(document.querySelector<HTMLInputElement>("#workExperience-6--companyName")?.value).toBe("Newest Co");
    expect(document.querySelector<HTMLInputElement>("#workExperience-6--startDate-dateSectionYear-input")?.value).toBe("2024");
    expect(document.querySelector<HTMLInputElement>("#workExperience-59--jobTitle")?.value).toBe("Engineer");
    expect(document.querySelector<HTMLInputElement>("#workExperience-59--companyName")?.value).toBe("Earlier Co");
    expect(document.querySelector<HTMLInputElement>("#workExperience-59--startDate-dateSectionYear-input")?.value).toBe("2021");
  });

  it("continues to the next inline experience when one field in the first entry is missing", async () => {
    document.body.innerHTML = `
      <section>
        <h4 id="Work-Experience-section">Work Experience</h4>
        <div>
          <label for="workExperience-1--jobTitle">Job Title</label><input id="workExperience-1--jobTitle" name="jobTitle" />
          <label for="workExperience-1--location">Location</label><input id="workExperience-1--location" name="location" required />
        </div>
        <div>
          <label for="workExperience-2--jobTitle">Job Title</label><input id="workExperience-2--jobTitle" name="jobTitle" />
        </div>
      </section>`;

    const results = await autofillWorkdayStructuredSections({
      experience: [
        { title: "Current Role" },
        { title: "Previous Role" },
      ],
    });

    expect(results.some((result) => result.key === "workExperience-1--location" && result.status === "rejected")).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#workExperience-2--jobTitle")?.value).toBe("Previous Role");
  });

  it("adds and fills Workday Languages when the section initially has no inputs", async () => {
    document.body.innerHTML = `
      <section>
        <h4 id="Languages-section">Languages</h4>
        <button data-automation-id="add-button">Add</button>
      </section>`;
    const section = document.querySelector<HTMLElement>("section")!;
    section.querySelector("button")!.addEventListener("click", () => {
      section.insertAdjacentHTML("beforeend", `
        <div>
          <label for="language-1--language">Language</label>
          <select id="language-1--language" name="language"><option value="">Select One</option><option>English</option></select>
          <label for="language-1--languageProficiency">Proficiency</label>
          <select id="language-1--languageProficiency" name="languageProficiency"><option value="">Select One</option><option>Native</option></select>
        </div>`);
    });

    await autofillWorkdayStructuredSections({
      languages: [{ name: "English", proficiency: "Native" }],
    });

    expect(document.querySelector<HTMLSelectElement>("#language-1--language")?.value).toBe("English");
    expect(document.querySelector<HTMLSelectElement>("#language-1--languageProficiency")?.value).toBe("Native");
  });

  it("adds and fills Workday Websites when the section initially has no inputs", async () => {
    document.body.innerHTML = `
      <section>
        <h4 id="Websites-section">Websites</h4>
        <button data-automation-id="add-button">Add</button>
      </section>`;
    const section = document.querySelector<HTMLElement>("section")!;
    section.querySelector("button")!.addEventListener("click", () => {
      section.insertAdjacentHTML("beforeend", `
        <div><label for="website-1--url">Website URL</label><input id="website-1--url" name="webAddress" type="url" /></div>`);
    });

    await autofillWorkdayStructuredSections({
      basics: { website: "https://example.com" },
    });

    expect(document.querySelector<HTMLInputElement>("#website-1--url")?.value).toBe("https://example.com");
  });

  it("does not overwrite a Workday entry that the applicant is already editing", async () => {
    document.body.innerHTML = `
      <section data-automation-id="workExperienceSection">
        <h3>Work Experience</h3>
        <div data-testid="experience-editor">
          <label for="job-title">Job Title</label><input id="job-title" name="jobTitle" value="Applicant's existing title" />
          <label for="company">Company</label><input id="company" name="company" value="Applicant's existing company" />
          <button data-automation-id="save-button">Save</button>
        </div>
      </section>`;

    const results = await autofillWorkdayStructuredSections({
      experience: [{ company: "Acme", title: "Senior Engineer" }],
    });

    expect(results).toEqual([]);
    expect(document.querySelector<HTMLInputElement>("#job-title")?.value).toBe("Applicant's existing title");
    expect(document.querySelector<HTMLInputElement>("#company")?.value).toBe("Applicant's existing company");
  });

  it("does not save an entry when a required Workday field has no mapped profile value", async () => {
    document.body.innerHTML = `
      <section data-automation-id="educationSection">
        <h3>Education</h3>
        <button data-automation-id="add-button">Add</button>
      </section>`;
    const section = document.querySelector<HTMLElement>("[data-automation-id='educationSection']")!;
    let saved = false;
    section.querySelector("button")!.addEventListener("click", () => {
      section.insertAdjacentHTML("beforeend", `
        <div data-testid="education-editor">
          <label for="school">School</label><input id="school" name="school" required />
          <label for="gpa">GPA</label><input id="gpa" name="gpa" required />
          <button data-automation-id="save-button">Save</button>
        </div>`);
      section.querySelector<HTMLElement>("[data-automation-id='save-button']")!
        .addEventListener("click", () => { saved = true; });
    });

    const results = await autofillWorkdayStructuredSections({
      education: [{ institution: "University of Sydney" }],
    });

    expect(results.some((result) => result.key === "gpa" && result.status === "rejected")).toBe(true);
    expect(saved).toBe(false);
  });
});
