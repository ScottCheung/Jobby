import type { ProviderDefinition } from "../platform-definition";
import { readLinkedInPage } from "./job-reader";
import { readLinkedInPageWhenReady } from "./readiness";
import { readLinkedInFormPage } from "./form-reader";
import { linkedinAdapter } from "./adapter";
import { findActiveFormScope } from "../../dom/form-scope";

export const linkedinDefinition = {
  platform: "linkedin",
  detection: {
    host: /(?:^|\.)linkedin\.com$/i,
  },
  jobDescriptionRootSelectors: [
    ".jobs-search-two-pane__job-details",
    ".jobs-search-two-pane__details",
    ".jobs-search-results-list__detail",
    ".scaffold-layout__detail",
    ".jobs-search__job-details--detail-view",
    ".jobs-search__job-details",
    ".jobs-search__right-rail",
    ".jobs-details__main-content",
    ".job-view-layout",
    ".jobs-details",
    ".jobs-description__container",
    ".jobs-description",
  ],
  jobDescriptionSelectors: [
    ".jobs-description__content .jobs-box__html-content",
    ".jobs-description__container .jobs-box__html-content",
    ".jobs-description__container .jobs-description-content__text",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    "[data-test-id='job-details-description']",
    "[data-testid='job-details-description']",
    "[data-testid='expandable-text-box']",
    "[class*='job-details__description']",
    ".jobs-description__content",
    ".jobs-description__container",
    ".jobs-description",
    "#job-details",
  ],
  jobDescriptionExpandSelectors: [
    ".jobs-description__footer-button",
    ".show-more-less-html__button--more",
    ".show-more-less-html__button",
    ".show-more-less-button",
    "button[aria-label*='show more' i]",
    "button[aria-label*='see more' i]",
    "button[aria-label*='read more' i]",
    "button[aria-label*='展开' i]",
    "button[aria-label*='更多' i]",
    "button[data-tracking-control-name*='show_more' i]",
    "button[data-tracking-control-name*='see_more' i]",
    "button[data-control-name='job_details_show_more']",
    "button[class*='show-more' i]",
    "button[class*='show_more' i]",
    "button[class*='see-more' i]",
  ],
  autofill: {
    treatsAllFileInputsAsResume: true,
  },
  job: {
    read: (apiData) =>
      readLinkedInPage(
        apiData as import("./api-client").LinkedInJobApiData | null | undefined,
      ),
    fallback: false,
    readiness: {
      readWhenReady: readLinkedInPageWhenReady,
    },
  },
  form: {
    read: () => readLinkedInFormPage(),
    scope: () => linkedinAdapter.getApplicationRoot() || findActiveFormScope(),
  },
} satisfies ProviderDefinition<"linkedin">;
