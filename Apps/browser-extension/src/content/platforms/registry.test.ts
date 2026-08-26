import { describe, expect, it } from "vitest";

import {
  atsJobPlatforms,
  dedicatedPlatforms,
  sharedFormPlatforms,
} from "../../shared/contracts/platform";
import {
  atsProviderDefinitions,
  getApplicationRoots,
  getAtsProviderDefinition,
  providerDefinitions,
} from "./registry";

describe("platform registry", () => {
  it("registers every dedicated platform exactly once", () => {
    const registered = providerDefinitions.map(({ platform }) => platform);
    expect(new Set(registered).size).toBe(registered.length);
    expect([...registered].sort()).toEqual([...dedicatedPlatforms].sort());
  });

  it("keeps every shared ATS job reader configuration complete", () => {
    const registered = atsProviderDefinitions.map(({ platform }) => platform);
    expect([...registered].sort()).toEqual([...atsJobPlatforms].sort());

    for (const platform of atsJobPlatforms) {
      const definition = getAtsProviderDefinition(platform);
      expect(definition.job.roots.length).toBeGreaterThan(0);
      expect(definition.job.title.length).toBeGreaterThan(0);
      expect(definition.job.description.length).toBeGreaterThan(0);
      expect(definition.applicationRoots.length).toBeGreaterThan(0);
    }
  });

  it("provides an application root for every shared form platform", () => {
    for (const platform of sharedFormPlatforms) {
      expect(getApplicationRoots(platform).length).toBeGreaterThan(0);
    }
  });
});
