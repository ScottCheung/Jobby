export const dedicatedPlatforms = [
  "seek",
  "linkedin",
  "indeed",
  "glassdoor",
  "workday",
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "taleo",
  "icims",
  "successfactors",
  "oracle",
  "workable",
  "bamboohr",
] as const;

export type DedicatedPlatform = (typeof dedicatedPlatforms)[number];

export const atsJobPlatforms = [
  "glassdoor",
  "workday",
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "taleo",
  "icims",
  "successfactors",
  "oracle",
  "workable",
  "bamboohr",
] as const;

export type AtsJobPlatform = (typeof atsJobPlatforms)[number];

export const sharedFormPlatforms = ["indeed", ...atsJobPlatforms] as const;

export type SharedFormPlatform = (typeof sharedFormPlatforms)[number];

export const formPlatforms = ["generic", ...dedicatedPlatforms] as const;

export type FormPlatform = (typeof formPlatforms)[number];
