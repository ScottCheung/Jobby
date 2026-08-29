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
    ], document).map((candidate) => candidate.id)).toEqual(["first-name"]);
  });
});
