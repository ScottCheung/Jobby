import { afterEach, describe, expect, it, vi } from "vitest";

import { inspectActiveTab, inspectJobUrl, jobInspectionUrl } from "./content-bridge";

function createSessionStorage() {
  const values: Record<string, unknown> = {};
  return {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (updates: Record<string, unknown>) => {
      Object.assign(values, updates);
    }),
  };
}

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

  it("turns an Ashby application URL into the matching job detail URL", () => {
    expect(
      jobInspectionUrl(
        "https://jobs.ashbyhq.com/mitti/fede1e72-bb71-4ded-8305-b46e8ec54c86/application?utm_source=test&src=LinkedIn",
      ),
    ).toBe(
      "https://jobs.ashbyhq.com/mitti/fede1e72-bb71-4ded-8305-b46e8ec54c86?utm_source=test&src=LinkedIn",
    );
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

  it("shares one temporary tab between concurrent inspections of the same URL", async () => {
    const inspection = {
      kind: "job" as const,
      snapshot: {
        platform: "seek" as const,
        externalId: "94260401",
        url: "https://au.seek.com/job/94260401",
        title: "Software Engineer",
        company: "Example",
        description: "A complete job description that is ready for tailoring.",
        technologies: [],
      },
    };
    const create = vi.fn().mockResolvedValue({ id: 75 });
    vi.stubGlobal("chrome", {
      tabs: {
        create,
        get: vi.fn().mockResolvedValue({
          id: 75,
          status: "complete",
          url: inspection.snapshot.url,
        }),
        remove: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue({ ok: true, inspection }),
      },
    });

    await expect(
      Promise.all([
        inspectJobUrl(inspection.snapshot.url),
        inspectJobUrl(inspection.snapshot.url),
      ]),
    ).resolves.toEqual([inspection, inspection]);
    expect(create).toHaveBeenCalledTimes(1);
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

describe("inspectActiveTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads missing SEEK application details from the canonical job page", async () => {
    const applicationUrl = "https://au.seek.com/job/94120995/apply";
    const detailUrl = "https://au.seek.com/job/94120995";
    const partialInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "seek" as const,
        externalId: "94120995",
        url: applicationUrl,
        title: "Senior Software Engineer",
        company: "The Onset",
        technologies: [],
      },
    };
    const detailInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "seek" as const,
        externalId: "94120995",
        url: detailUrl,
        title: "Senior Software Engineer",
        company: "The Onset",
        location: "Sydney NSW",
        description: "Build and operate a cloud platform using TypeScript and AWS.",
        technologies: ["TypeScript", "AWS"],
      },
    };
    const remove = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn(async (tabId: number) => ({
      ok: true,
      inspection: tabId === 81 ? partialInspection : detailInspection,
    }));

    vi.stubGlobal("chrome", {
      tabs: {
        create: vi.fn().mockResolvedValue({ id: 82 }),
        get: vi.fn(async (tabId: number) => ({
          id: tabId,
          status: "complete",
          url: tabId === 81 ? applicationUrl : detailUrl,
        })),
        remove,
        sendMessage,
      },
    });

    const inspection = await inspectActiveTab(81);

    expect(inspection).toEqual({
      kind: "job",
      snapshot: expect.objectContaining({
        externalId: "94120995",
        url: applicationUrl,
        description: detailInspection.snapshot.description,
        location: "Sydney NSW",
        technologies: ["TypeScript", "AWS"],
      }),
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: detailUrl,
      active: false,
    });
    expect(remove).toHaveBeenCalledWith(82);
  });

  it("reuses the detail inspection while the SEEK application tab remains open", async () => {
    const applicationUrl = "https://au.seek.com/job/94120996/apply";
    const detailInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "seek" as const,
        externalId: "94120996",
        url: applicationUrl,
        title: "Senior Software Engineer",
        company: "The Onset",
        description: "Build and operate a cloud platform using TypeScript and AWS.",
        technologies: ["TypeScript", "AWS"],
      },
    };
    const create = vi.fn().mockResolvedValue({ id: 84 });
    const sendMessage = vi.fn(async (tabId: number) => ({
      ok: true,
      inspection:
        tabId === 83
          ? { ...detailInspection, snapshot: { ...detailInspection.snapshot, description: undefined } }
          : detailInspection,
    }));

    vi.stubGlobal("chrome", {
      tabs: {
        create,
        get: vi.fn(async (tabId: number) => ({
          id: tabId,
          status: "complete",
          url: tabId === 83 ? applicationUrl : "https://au.seek.com/job/94120996",
        })),
        remove: vi.fn().mockResolvedValue(undefined),
        sendMessage,
      },
    });

    await inspectActiveTab(83);
    await inspectActiveTab(83);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reuses the SEEK detail inspection when application steps use different paths", async () => {
    let applicationUrl = "https://au.seek.com/job/94120997/apply/personal-details";
    const detailInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "seek" as const,
        externalId: "94120997",
        url: applicationUrl,
        title: "Senior Software Engineer",
        company: "The Onset",
        description: "Build and operate a cloud platform using TypeScript and AWS.",
        technologies: ["TypeScript", "AWS"],
      },
    };
    const create = vi.fn().mockResolvedValue({ id: 87 });
    const sendMessage = vi.fn(async (tabId: number) => ({
      ok: true,
      inspection:
        tabId === 86
          ? { ...detailInspection, snapshot: { ...detailInspection.snapshot, description: undefined } }
          : detailInspection,
    }));

    vi.stubGlobal("chrome", {
      tabs: {
        create,
        get: vi.fn(async (tabId: number) => ({
          id: tabId,
          status: "complete",
          url: tabId === 86 ? applicationUrl : "https://au.seek.com/job/94120997",
        })),
        remove: vi.fn().mockResolvedValue(undefined),
        sendMessage,
      },
    });

    await inspectActiveTab(86);
    applicationUrl = "https://au.seek.com/job/94120997/apply/resume";
    await inspectActiveTab(86);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("replaces a bound inspection when the selected job changes in a split view", async () => {
    const splitViewUrl =
      "https://www.linkedin.com/jobs/search-results/?keywords=engineer";
    const firstInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "linkedin" as const,
        externalId: "4450000001",
        url: splitViewUrl,
        title: "Frontend Engineer",
        company: "First Company",
        description: "Build the first company product with React.",
        technologies: ["React"],
        easyApply: false,
      },
    };
    const secondInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "linkedin" as const,
        externalId: "4450000002",
        url: splitViewUrl,
        title: "Backend Engineer",
        company: "Second Company",
        description: "Build the second company platform with Go.",
        technologies: ["Go"],
        easyApply: false,
      },
    };
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, inspection: firstInspection })
      .mockResolvedValueOnce({ ok: true, inspection: secondInspection });

    vi.stubGlobal("chrome", {
      tabs: {
        get: vi.fn().mockResolvedValue({
          id: 95,
          status: "complete",
          url: splitViewUrl,
        }),
        sendMessage,
      },
    });

    await expect(inspectActiveTab(95)).resolves.toEqual(firstInspection);
    await expect(inspectActiveTab(95)).resolves.toEqual(secondInspection);
  });

  it("binds an Ashby application form to its canonical job detail", async () => {
    const applicationUrl = "https://jobs.ashbyhq.com/mitti/fede1e72-bb71-4ded-8305-b46e8ec54c86/application?src=LinkedIn";
    const detailUrl = "https://jobs.ashbyhq.com/mitti/fede1e72-bb71-4ded-8305-b46e8ec54c86?src=LinkedIn";
    const applicationInspection = {
      kind: "not_job_page" as const,
      platform: "ashby" as const,
      url: applicationUrl,
      reason: "The application route does not mount the job description.",
    };
    const detailInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "ashby" as const,
        externalId: "fede1e72-bb71-4ded-8305-b46e8ec54c86",
        url: detailUrl,
        title: "Software Engineer II (Frontend)",
        company: "Mitti",
        location: "Sydney",
        description: "Build customer-facing frontend software using React and TypeScript.",
        technologies: ["React", "TypeScript"],
      },
    };
    const remove = vi.fn().mockResolvedValue(undefined);
    const session = createSessionStorage();
    const sendMessage = vi.fn(async (tabId: number) => ({
      ok: true,
      inspection: tabId === 91 ? applicationInspection : detailInspection,
    }));

    vi.stubGlobal("chrome", {
      storage: { session },
      tabs: {
        create: vi.fn().mockResolvedValue({ id: 92 }),
        get: vi.fn(async (tabId: number) => ({
          id: tabId,
          status: "complete",
          url: tabId === 91 ? applicationUrl : detailUrl,
        })),
        remove,
        sendMessage,
      },
    });

    const inspection = await inspectActiveTab(91);

    expect(inspection).toEqual({
      kind: "job",
      snapshot: expect.objectContaining({
        platform: "ashby",
        externalId: "fede1e72-bb71-4ded-8305-b46e8ec54c86",
        url: applicationUrl,
        description: detailInspection.snapshot.description,
        technologies: ["React", "TypeScript"],
      }),
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: detailUrl,
      active: false,
    });
    expect(remove).toHaveBeenCalledWith(92);
  });

  it("restores an Ashby detail snapshot on the matching application URL", async () => {
    const detailUrl = "https://jobs.ashbyhq.com/mitti/fede1e72-bb71-4ded-8305-b46e8ec54c86?src=LinkedIn";
    const applicationUrl = "https://jobs.ashbyhq.com/mitti/fede1e72-bb71-4ded-8305-b46e8ec54c86/application?utm_source=other";
    const detailInspection = {
      kind: "job" as const,
      snapshot: {
        platform: "ashby" as const,
        externalId: "fede1e72-bb71-4ded-8305-b46e8ec54c86",
        url: detailUrl,
        title: "Software Engineer II (Frontend)",
        company: "Mitti",
        location: "Sydney",
        description: "Build customer-facing frontend software using React and TypeScript.",
        technologies: ["React", "TypeScript"],
      },
    };
    let currentUrl = detailUrl;
    const session = createSessionStorage();
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      inspection: detailInspection,
    });
    const create = vi.fn();

    vi.stubGlobal("chrome", {
      storage: { session },
      tabs: {
        create,
        get: vi.fn(async (tabId: number) => ({
          id: tabId,
          status: "complete",
          url: currentUrl,
        })),
        remove: vi.fn(),
        sendMessage,
      },
    });

    await expect(inspectActiveTab(93)).resolves.toEqual(detailInspection);
    currentUrl = applicationUrl;

    await expect(inspectActiveTab(93)).resolves.toEqual({
      kind: "job",
      snapshot: {
        ...detailInspection.snapshot,
        url: applicationUrl,
      },
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });
});
