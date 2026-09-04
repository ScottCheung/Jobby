import type { AtsProviderDefinition } from "../platform-definition";
import { ashbyAutofillPolicy } from "./autofill-policy";
import { adaptAshbyFormFields } from "./form-field-adapter";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1) || "";
  return /^(?:apply|application)$/i.test(last) ? segments.at(-2) || "" : last;
}

function locationFromRoot(root: ParentNode): string {
  const heading = Array.from(root.querySelectorAll<HTMLElement>("h2, h3, h4, dt"))
    .find((candidate) => cleanText(candidate.textContent).toLowerCase() === "location");
  if (!heading) return "";
  const section = heading.closest<HTMLElement>("section, [class*='section' i]") || heading.parentElement;
  const candidates = section
    ? Array.from(section.querySelectorAll<HTMLElement>("p, dd, [class*='value' i]"))
    : [];
  return candidates.map((candidate) => cleanText(candidate.textContent)).find(Boolean) ||
    cleanText(heading.nextElementSibling?.textContent);
}

function companyFromPage(title: string): string {
  const pageTitle = cleanText(document.title);
  const prefix = `${title} @ `;
  return pageTitle.startsWith(prefix) ? cleanText(pageTitle.slice(prefix.length)) : "";
}

export const ashbyDefinition = {
  platform: "ashby",
  detection: {
    host: /(?:^|\.)jobs\.ashbyhq\.com$/i,
    dom: ".ashby-job-posting-heading, .ashby-application-form-container, [data-testid='job-posting']",
  },
  applicationRoots: [
    "#form",
    "[data-testid='application-form']",
    "form[data-testid*='application' i]",
  ],
  adaptFormFields: adaptAshbyFormFields,
  autofill: ashbyAutofillPolicy,
  job: {
    roots: ["#root", ".ashby-job-posting-left-pane", "[data-testid='job-posting']", "[data-testid='job-posting-page']"],
    title: [".ashby-job-posting-heading", "[data-testid='job-title']", "h1"],
    company: ["[data-testid='company-name']"],
    location: ["[data-testid='job-location']", "[class*='location' i]"],
    description: [".ashby-job-posting-description", "[data-testid='job-description']", "[class*='description' i]"],
    apply: ["a[href$='/application']", "button[data-testid*='apply' i]"],
    id: ["[data-job-id]"],
    idFromUrl: lastJobPathSegment,
    locationFromRoot,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"ashby">;
