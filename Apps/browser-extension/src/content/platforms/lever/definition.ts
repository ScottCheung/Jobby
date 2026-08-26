import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1) || "";
  return /^(?:apply|application)$/i.test(last) ? segments.at(-2) || "" : last;
}

function companyFromPage(title: string): string {
  const pageTitle = cleanText(document.title);
  if (!pageTitle) return "";
  const delimiterMatch = pageTitle.match(/^(.*?)\s*[-–—|•]\s*(.+)$/);
  if (delimiterMatch && delimiterMatch[1]) {
    const trailingPart = delimiterMatch[2] || "";
    if (title && trailingPart.toLowerCase().includes(title.toLowerCase())) {
      return cleanText(delimiterMatch[1]);
    }
    return cleanText(delimiterMatch[1]);
  }
  const suffix = ` - ${title}`;
  return pageTitle.endsWith(suffix) ? cleanText(pageTitle.slice(0, -suffix.length)) : "";
}

export const leverDefinition = {
  platform: "lever",
  detection: {
    host: /(?:^|\.)jobs(?:\.eu)?\.lever\.co$/i,
    dom: ".posting-page, [data-qa='posting-page'], form[action*='lever.co']",
  },
  applicationRoots: [
    "#application-form",
    "form.application-form",
    "form[action*='/apply']",
    "[data-qa='application-form']",
  ],
  job: {
    roots: [".posting-page", "[data-qa='posting-page']", "main.posting"],
    title: [".posting-headline h2", "[data-qa='posting-name']", "h1"],
    company: ["[data-qa='company-name']", ".posting-company"],
    location: [".posting-categories .location", ".sort-by-location", "[data-qa='location']"],
    description: [
      ".section-wrapper:not(.accent-section):not(.main-header) > .section:not(.last-section-apply):not([data-qa='btn-apply-bottom']):not([data-qa='ai-disclaimer'])",
      ".section-wrapper.page-full-width:not(.accent-section):not(.main-header) > .section:not(.last-section-apply)",
      ".posting-page .section-wrapper:not(.accent-section) .section:not(.last-section-apply)",
      "[data-qa='job-description'], [data-qa='posting-requirements'], [data-qa='closing-description']",
      ".posting-description",
      "[data-qa='job-description']",
      ".section-wrapper.page-full-width",
    ],
    apply: ["a.postings-btn", "a[href$='/apply']", "button[type='submit']"],
    id: ["[data-posting-id]", "input[name='postingId']"],
    idFromUrl: lastJobPathSegment,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"lever">;
