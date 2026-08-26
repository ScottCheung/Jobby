import type { ProviderDefinition } from "../platform-definition";
import { SEEK_SELECTORS } from "./selectors";

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
} satisfies ProviderDefinition<"seek">;
