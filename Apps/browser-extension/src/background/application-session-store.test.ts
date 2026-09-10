import { describe, expect, it } from "vitest";

import {
  getApplicationSessionForTab,
  markApplicationSessionSubmitted,
  resolveApplicationSession,
} from "./application-session-store";
import type { PageInspection } from "../shared/contracts/page-inspection";

describe("application-session-store", () => {
  it("keeps the source identity while enriching a locked session with an ATS alias", async () => {
    const source: PageInspection = {
      kind: "job",
      snapshot: {
        platform: "linkedin",
        externalId: "source-7101",
        url: "https://www.linkedin.com/jobs/view/source-7101/",
        title: "Software Engineer",
        company: "Canva",
        description: "Build the platform.",
        technologies: ["TypeScript"],
        easyApply: false,
      },
    };
    const ats: PageInspection = {
      kind: "job",
      snapshot: {
        platform: "greenhouse",
        externalId: "ats-7101",
        url: "https://boards.greenhouse.io/canva/jobs/ats-7101",
        title: "Apply for Software Engineer",
        company: "Canva",
        location: "Sydney",
        description: "Build the platform with TypeScript and React.",
        technologies: ["React"],
      },
    };

    const created = await resolveApplicationSession(7101, source);
    const enriched = await resolveApplicationSession(7101, ats, { lock: true });

    expect(enriched.session.id).toBe(created.session.id);
    expect(enriched.session.identityLocked).toBe(true);
    expect(enriched.session.identities).toHaveLength(2);
    expect(enriched.session.job.platform).toBe("linkedin");
    expect(enriched.session.job.title).toBe("Software Engineer");
    expect(enriched.session.job.location).toBe("Sydney");
    expect(enriched.session.job.description).toContain("React");

    const applicationStep = {
      ...ats,
      snapshot: {
        ...ats.snapshot,
        externalId: "ats-7101-step-2",
        url: "https://boards.greenhouse.io/canva/jobs/ats-7101/application",
      },
    };
    const preserved = await resolveApplicationSession(7101, applicationStep, {
      lock: true,
    });
    expect(preserved.session.id).toBe(created.session.id);
    expect(preserved.session.identities).toHaveLength(3);

    const unrelated: PageInspection = {
      ...ats,
      snapshot: {
        ...ats.snapshot,
        externalId: "different-job",
        title: "Different Job",
      },
    };
    const nextJob = await resolveApplicationSession(7101, unrelated);
    expect(nextJob.session.id).not.toBe(created.session.id);
    expect(nextJob.session.job.title).toBe("Different Job");
    expect(nextJob.session.identities).toHaveLength(1);

    const submitted = await markApplicationSessionSubmitted(7101, {
      platform: "greenhouse",
      url: ats.snapshot.url,
      verified: true,
    });
    expect(submitted?.status).toBe("submitted");
    await expect(getApplicationSessionForTab(7101)).resolves.toBeNull();
  });
});
