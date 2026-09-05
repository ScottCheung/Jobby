import type { ProviderDefinition } from "../platform-definition";
import { SEEK_SELECTORS } from "./selectors";
import { readSeekPage } from "./job-reader";
import { getSeekApplicationScope, readSeekFormPage } from "./form-reader";

const SEEK_IGNORED_FIELD_LABELS =
  /(?:refine\s*your\s*search|strong\s*applicant\s*jobs|keywords?|classification|where\b|what\b|distance|work\s*type|pay\s*range|salary|date\s*listed|search\s*jobs)/i;

export function filterSeekFormFields<T extends { label: string }>(fields: T[]): T[] {
  return fields.filter((field) => !SEEK_IGNORED_FIELD_LABELS.test(field.label));
}

export const seekDefinition = {
  platform: "seek",
  detection: {
    host: /(?:^|\.)seek\.(?:com(?:\.au)?|co\.nz)$/i,
  },
  jobDescriptionRootSelectors: [
    "[data-automation='jobDetails']",
    "[data-automation='jobDetailsPage']",
    "[data-automation='splitViewJobDetailsWrapper']",
    "[data-automation='split-view']",
    "[data-automation='job-details']",
    "[data-testid='jobDetails']",
    "#job-details",
  ],
  jobDescriptionSelectors: SEEK_SELECTORS.description,
  adaptFormFields: (fields) => filterSeekFormFields(fields),
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

