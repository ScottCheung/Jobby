import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export const avatureDefinition = {
  platform: "avature",
  detection: {
    host: /(?:^|\.)avature\.net$/i,
    dom: "meta[name^='avature'], [id^='wizard-id-'], .fieldSpec, form.form--methods, form#manualRegisterMethodsForm, script[src*='avacdn.net'], link[href*='/portalpacks/'], link[href*='/ASSET/wizard/']",
  },
  applicationRoots: [
    ".wizard",
    "[id^='wizard-id-']",
    "form.form--wizard",
    "form.wizardForm",
    "form#submitForm",
    "form#manualRegisterMethodsForm",
    "form[action*='ApplicationConfirmation']",
    "form[action*='ApplicationMethods']",
    "form[action*='careers']",
    "form.form",
  ],
  job: {
    roots: [
      "article.article--details",
      "article.article--job-detail",
      "article[class*='article']",
      "article.article__content__fields",
      ".article__content",
      ".body--job--details",
      "#job-details",
      "[class*='job-details' i]",
      "[class*='job-detail' i]",
      "main",
      "#app",
    ],
    title: [
      ".article__header__title",
      ".article__header__text__title",
      "h2.title--11",
      "h1.title",
      ".job-title",
      "[class*='jobTitle' i]",
      "h1",
      "h2",
    ],
    company: [
      ".article__header__subtitle",
      "meta[property='og:site_name']",
      ".companyName",
      "[data-company]",
      "[class*='company' i]",
    ],
    location: [
      ".article__header__location",
      ".field--location .article__content__view__field__value",
      ".field--location",
      "[data-location]",
      "[class*='location' i]",
    ],
    description: [
      ".article__content",
      "article.article--details",
      "article.article--job-detail",
      "article.article__content__fields",
      ".body--job--details",
    ],
    apply: [
      "a[href*='ApplicationMethods']",
      "a[href*='ApplicationConfirmation']",
      "a[href*='RegisterSocial']",
      "a.button--primary",
      "button.button--primary",
      "a[href*='/apply']",
    ],
    id: [
      "[data-job-id]",
      "[data-jobid]",
      "input[name='jobId']",
      "input[name='record']",
    ],
    idFromUrl: (url) =>
      url.searchParams.get("jobId") ||
      url.searchParams.get("record") ||
      url.pathname.match(/\/JobDetail(?:\/[^/]+)?\/(\d+)/i)?.[1] ||
      "",
    companyFromPage: (title) => {
      const ogSiteName = document
        .querySelector<HTMLMetaElement>("meta[property='og:site_name']")
        ?.content?.trim();
      if (ogSiteName) return cleanText(ogSiteName);
      const pageTitle = cleanText(document.title);
      const parts = pageTitle.split(/\s+[-|]\s+/);
      if (parts.length > 1) {
        const candidate = parts[parts.length - 1];
        if (candidate && candidate !== title) return cleanText(candidate);
      }
      return "";
    },
  },
} satisfies AtsProviderDefinition<"avature">;
