// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import {
  autofillWorkdayStructuredSections,
  valueForWorkdayStructuredField,
} from "./structured-autofill";
import { workdaySkills } from "./field-mapping";

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
