import type { ProviderDefinition } from "../platform-definition";
import { SEEK_SELECTORS } from "./selectors";
import { readSeekPage } from "./job-reader";
import { getSeekApplicationScope, readSeekFormPage } from "./form-reader";

export const seekDefinition = {
  platform: "seek",
  detection: {
    host: /(?:^|\.)seek\.(?:com(?:\.au)?|co\.nz)$/i,
  },
  jobDescriptionRootSelectors: [
    "[data-automation='jobDetails']",
    "[data-automation='jobDetailsPage']",
    "[data-automation='job-details']",
    "[data-testid='jobDetails']",
    "#job-details",
  ],
  jobDescriptionSelectors: SEEK_SELECTORS.description,
  job: {
    read: () => readSeekPage(),
    fallback: true,
    readiness: {
      readinessWaitUntilAttempt: (location) =>
        /\/(?:apply|application)(?:\/|$)/i.test(location.pathname) ? 60 : 0,
    },
  },
  form: {
    read: () => readSeekFormPage(),
    scope: () => getSeekApplicationScope(),
  },
} satisfies ProviderDefinition<"seek">;
