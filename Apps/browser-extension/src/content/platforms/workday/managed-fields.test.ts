// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import { excludeWorkdayManagedFields } from "./managed-fields";

function field(id: string, label: string): FormFieldObservation {
  return {
    key: id,
    id,
    name: id,
    type: "text",
    label,
    required: false,
    filled: false,
    sensitive: false,
    options: [],
  };
}

describe("Workday managed field isolation", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main data-automation-id="applyFlowPage">
        <label for="first-name">First name</label><input id="first-name" name="first-name" />
        <section data-automation-id="skillsSection">
          <label for="skill-search">Skill</label><input id="skill-search" name="skill-search" />
        </section>
        <div role="dialog">
          <label for="portal-job-title">Job Title</label><input id="portal-job-title" name="jobTitle" />
        </div>
      </main>`;
  });

  it("keeps generic fields but removes fields owned by the Workday provider", () => {
    expect(excludeWorkdayManagedFields([
      field("first-name", "First name"),
      field("skill-search", "Skill"),
      field("portal-job-title", "Job Title"),
    ], document).map((candidate) => candidate.label)).toEqual(["First name", "Skills"]);
  });

  it("summarizes Workday inline entries in DOM order and keeps ordinary fields", () => {
    document.body.innerHTML = `
      <main data-automation-id="applyFlowPage">
        <input id="workExperience-6--jobTitle" name="jobTitle" />
        <input id="workExperience-59--startDate-dateSectionYear-input" />
        <input id="education-15--schoolName" name="schoolName" />
        <input id="education-15--firstYearAttended-dateSectionYear-input" />
        <input id="skills--skills" />
        <input id="socialNetworkAccounts--linkedInAccount" />
      </main>`;

    const jobTitle = field("workExperience-6--jobTitle", "Job Title");
    jobTitle.currentValue = "UI Engineer";
    jobTitle.filled = true;
    expect(excludeWorkdayManagedFields([
      jobTitle,
      field("workExperience-59--startDate-dateSectionYear-input", "Year"),
      field("education-15--schoolName", "School or University"),
      field("education-15--firstYearAttended-dateSectionYear-input", "Year"),
      field("skills--skills", "Type to Add Skills"),
      field("socialNetworkAccounts--linkedInAccount", "LinkedIn profile"),
    ], document).map((candidate) => [candidate.label, candidate.id, candidate.currentValue])).toEqual([
      ["Work Experience 1", "workExperience-6--jobTitle", "UI Engineer"],
      ["Work Experience 2", "workExperience-59--startDate-dateSectionYear-input", "Not filled"],
      ["Education 1", "education-15--schoolName", "Not filled"],
      ["LinkedIn profile", "socialNetworkAccounts--linkedInAccount", undefined],
    ]);
  });

  it("recognizes empty Languages and Websites sections before Workday renders inputs", () => {
    document.body.innerHTML = `
      <main data-automation-id="applyFlowPage">
        <section><h4 id="Languages-section">Languages</h4><button data-automation-id="add-button">Add</button></section>
        <section><h4 id="Skills-section">Skills</h4><input id="skills--skills" /></section>
        <section><h4 id="Websites-section">Websites</h4><button data-automation-id="add-button">Add</button></section>
      </main>`;

    expect(excludeWorkdayManagedFields([
      field("skills--skills", "Type to Add Skills"),
    ], document).map((candidate) => [candidate.label, candidate.currentValue])).toEqual([
      ["Languages", "Not filled"],
      ["Skills", "Not filled"],
      ["Websites", "Not filled"],
    ]);
  });
});
