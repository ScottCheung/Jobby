import { afterEach, describe, expect, it, vi } from "vitest";

import { inspectJobUrl, jobInspectionUrl } from "./content-bridge";

describe("jobInspectionUrl", () => {
  it("turns a LinkedIn search result URL into its real job page", () => {
    expect(
      jobInspectionUrl(
        "https://www.linkedin.com/jobs/search-results/?currentJobId=4458650875&keywords=jobs",
      ),
    ).toBe("https://www.linkedin.com/jobs/view/4458650875/");
  });

  it("turns SEEK split-view URLs into regional job pages", () => {
    expect(
      jobInspectionUrl(
        "https://www.seek.com.au/jobs?jobId=94260401&tracking=search",
      ),
    ).toBe("https://www.seek.com.au/job/94260401");
    expect(jobInspectionUrl("https://www.seek.co.nz/jobs?jobId=88776655")).toBe(
      "https://www.seek.co.nz/job/88776655",
    );
  });

  it("turns Glassdoor detail links into its readable selected-job view", () => {
    expect(
      jobInspectionUrl(
        "https://www.glassdoor.com.au/job-listing/software-engineer-example-JV_IC2235932_KO0,17.htm?jl=1009879845424",
      ),
    ).toBe("https://www.glassdoor.com.au/Job/index.htm?jl=1009879845424");
  });
});

describe("inspectJobUrl", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads an inactive temporary tab and closes it after inspection", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const inspection = {
      kind: "job" as const,
      snapshot: {
        platform: "seek" as const,
        externalId: "94260401",
        url: "https://www.seek.com.au/job/94260401",
        title: "Software Engineer",
        company: "Example",
        description: "A complete job description that is ready for tailoring.",
        technologies: [],
      },
    };
    const create = vi.fn().mockResolvedValue({ id: 73 });
    const get = vi.fn().mockResolvedValue({
      id: 73,
      status: "complete",
      url: inspection.snapshot.url,
    });
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, inspection });

    vi.stubGlobal("chrome", {
      tabs: { create, get, remove, sendMessage },
    });

    await expect(inspectJobUrl(inspection.snapshot.url)).resolves.toEqual(
      inspection,
    );
    expect(create).toHaveBeenCalledWith({
      url: inspection.snapshot.url,
      active: false,
    });
    expect(sendMessage).toHaveBeenCalledWith(
      73,
      { type: "content.inspect" },
      { frameId: 0 },
    );
    expect(remove).toHaveBeenCalledWith(73);
  });

  it("closes the temporary tab when its content script never responds", async () => {
    vi.useFakeTimers();
    const remove = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      tabs: {
        create: vi.fn().mockResolvedValue({ id: 74 }),
        get: vi.fn().mockResolvedValue({
          id: 74,
          status: "complete",
          url: "https://www.linkedin.com/jobs/view/4448572050/",
        }),
        remove,
        sendMessage: vi.fn(() => new Promise(() => undefined)),
      },
    });

    const inspection = inspectJobUrl(
      "https://www.linkedin.com/jobs/view/4448572050/",
    );
    const expectation = expect(inspection).rejects.toThrow(
      "The job details did not become available.",
    );
    await vi.advanceTimersByTimeAsync(20_000);

    await expectation;
    expect(remove).toHaveBeenCalledWith(74);
  });
});
