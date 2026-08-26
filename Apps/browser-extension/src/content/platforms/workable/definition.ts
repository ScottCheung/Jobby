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
  const suffix = ` - ${title}`;
  if (pageTitle.endsWith(suffix)) return cleanText(pageTitle.slice(0, -suffix.length));
  const prefix = `${title} - `;
  return pageTitle.startsWith(prefix) ? cleanText(pageTitle.slice(prefix.length)) : "";
}

export const workableDefinition = {
  platform: "workable",
  detection: {
    host: /(?:^|\.)(?:apply\.)?workable\.com$/i,
    dom: "[data-ui='job-title'], [data-ui='application-form'], [data-ui='overview'], form[data-ui='application-form']",
  },
  applicationRoots: [
    "[data-ui='application-form']",
    "form[data-ui='application-form']",
    "#application-form",
    "form[action*='workable']",
  ],
  job: {
    roots: ["[data-ui='overview']", "[data-ui='job-details']", "main", "#app"],
    title: ["[data-ui='job-title']", "h1"],
    company: ["[data-ui='company-name']", ".company-name"],
    location: ["[data-ui='job-location']", "[data-ui='job-workplace']", ".job-location"],
    description: ["[data-ui='job-description']", "[data-ui='job-requirements']", "[data-ui='job-overview']", "[data-ui='section']"],
    apply: ["[data-ui='application-form-tab']", "a[href*='/apply']", "[data-ui='apply-button']", "button[type='submit']"],
    id: ["[data-job-id]"],
    idFromUrl: lastJobPathSegment,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"workable">;
