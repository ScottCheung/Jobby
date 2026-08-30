/** @format */

import { beforeEach, describe, expect, it } from "vitest";
import {
  bindTabJobInspection,
  getTabJobInspection,
  unbindTabJob,
} from "./job-binding-service";
import type { PageInspection } from "../shared/contracts/page-inspection";

describe("job-binding-service", () => {
  const mockJobInspection: PageInspection = {
    kind: "job",
    snapshot: {
      platform: "seek",
      externalId: "94222211",
      url: "https://www.seek.com.au/job/94222211",
      title: "Full Stack Dev",
      company: "5x Recruitment",
      technologies: ["React", "Node.js"],
    },
  };

  beforeEach(() => {
    unbindTabJob(101);
    unbindTabJob(102);
  });

  it("binds a job to a tab and retrieves it when URL matches", () => {
    bindTabJobInspection(101, mockJobInspection);
    const result = getTabJobInspection(101, "https://www.seek.com.au/job/94222211");
    expect(result).toEqual(mockJobInspection);
  });

  it("clears stale binding and returns null when tab navigates to an unrelated URL", () => {
    bindTabJobInspection(101, mockJobInspection);
    // User navigates this tab to google.com or blank page
    const result = getTabJobInspection(101, "https://www.google.com");
    expect(result).toBeNull();

    // Subsequent retrieval also returns null because stale entry was deleted
    expect(getTabJobInspection(101)).toBeNull();
  });

  it("allows inherited child tabs to access parent job inspection", () => {
    bindTabJobInspection(102, mockJobInspection, true);
    // Child application tab on external ATS
    const result = getTabJobInspection(102, "https://boards.greenhouse.io/application/123");
    expect(result).toEqual(mockJobInspection);
  });

  it("unbinds a tab when non-job inspection is passed", () => {
    bindTabJobInspection(101, mockJobInspection);
    bindTabJobInspection(101, { kind: "unsupported_page", url: "https://www.example.com", reason: "None" });
    expect(getTabJobInspection(101, "https://www.seek.com.au/job/94222211")).toBeNull();
  });
});
