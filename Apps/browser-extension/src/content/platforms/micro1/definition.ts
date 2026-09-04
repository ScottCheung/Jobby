import type { AtsProviderDefinition, ProviderFormRoot } from "../platform-definition";
import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function adaptMicro1FormFields(
  fields: FormFieldObservation[],
  _root: ProviderFormRoot = document,
): FormFieldObservation[] {
  return fields.map((field) => {
    const normName = (field.name || "").toLowerCase();
    const normId = (field.id || "").toLowerCase();
    const normPlaceholder = (field.placeholder || "").toLowerCase();
    const normLabel = (field.label || "").toLowerCase();

    // 1. First name
    if (
      normName === "first_name" ||
      normName === "firstname" ||
      normPlaceholder.includes("first name") ||
      normId.includes("first_name") ||
      (normLabel.includes("first name") && !normLabel.includes("last name"))
    ) {
      return { ...field, label: "First name" };
    }

    // 2. Last name
    if (
      normName === "last_name" ||
      normName === "lastname" ||
      normPlaceholder.includes("last name") ||
      normId.includes("last_name") ||
      normLabel.includes("last name")
    ) {
      return { ...field, label: "Last name" };
    }

    // 3. LinkedIn profile / URL
    if (
      normName === "linkedin_url" ||
      normName === "linkedin" ||
      normPlaceholder.includes("linkedin") ||
      normId.includes("linkedin") ||
      normLabel.includes("linkedin")
    ) {
      return { ...field, label: "LinkedIn profile" };
    }

    // 4. Phone country select
    if (
      field.type === "select" &&
      (field.className?.includes("PhoneInputCountrySelect") ||
        normLabel.includes("phone number country") ||
        normLabel.includes("phone country"))
    ) {
      return { ...field, label: "Phone country" };
    }

    // 5. Phone number input
    if (
      field.type === "tel" ||
      field.className?.includes("PhoneInputInput") ||
      normName === "phone" ||
      normName === "phone_number" ||
      (normLabel.includes("phone") && !normLabel.includes("country"))
    ) {
      return { ...field, label: "Phone" };
    }

    // 6. Resume file
    if (
      field.type === "file" ||
      normName === "file" ||
      normId === "file" ||
      normLabel.includes("resume")
    ) {
      return { ...field, label: "Resume" };
    }

    return field;
  });
}

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1) || "";
  return /^(?:apply|application)$/i.test(last) ? segments.at(-2) || "" : last;
}

function idFromUrl(url: URL): string {
  const match = url.pathname.match(/\/post\/([a-z0-9-]+)/i);
  if (match?.[1]) return match[1];
  return (
    url.searchParams.get("id") ||
    url.searchParams.get("job_id") ||
    url.searchParams.get("jobId") ||
    lastJobPathSegment(url)
  );
}

function companyFromPage(_title: string): string {
  const siteName = document.querySelector<HTMLMetaElement>("meta[property='og:site_name']")?.content || "";
  if (/micro1/i.test(siteName)) return "micro1";
  const pageTitle = cleanText(document.title);
  if (/micro1/i.test(pageTitle) || /\|\s*Apply\s+on\s+Job/i.test(pageTitle)) return "micro1";
  return "";
}

function dateFromPage(_externalId: string): string | undefined {
  const dateEl = document.querySelector<HTMLElement>(
    "time, [class*='posted' i], [data-testid*='posted' i]",
  );
  return cleanText(dateEl?.getAttribute("datetime") || dateEl?.textContent) || undefined;
}

export const micro1Definition = {
  platform: "micro1",
  detection: {
    host: /(?:^|\.)micro1\.ai$/i,
    dom: "meta[property='og:site_name'][content*='micro1' i], meta[property='twitter:site'][content*='micro1' i], meta[name='twitter:site'][content*='micro1' i], [data-micro1], a[href*='micro1.ai']",
  },
  jobDescriptionRootSelectors: [
    "main",
    "section",
    "[class*='container']",
    "#app",
  ],
  jobDescriptionSelectors: [
    "section",
    "[class*='job-description' i]",
    "[class*='description' i]",
    ".ql-editor",
    "[class*='ql-editor']",
    "main",
  ],
  applicationRoots: [
    "form:not(#site-navigation):not([role='search']):not([id*='search']):not([id*='nav'])",
    "form[class*='grid-cols']",
    "form:has(input[name='first_name'])",
    "form:has(input[name='file'])",
    "form:has(input[name*='name'])",
    "form:has([data-testid*='apply'])",
    "form:has([class*='PhoneInput'])",
    "form:has(button[type='submit'])",
    "form[action*='apply']",
    "form[action*='application']",
    "[class*='col-span-4'] form",
    "[class*='col-span-4']",
    "[class*='max-w-[465px]'] form",
    "[class*='max-w-[465px]']",
    "[data-testid*='apply-form-header']",
    "[data-testid*='apply']",
    "[data-testid*='application']",
    "#apply-form",
    "#application-form",
  ],
  adaptFormFields: adaptMicro1FormFields,
  job: {
    roots: [
      "main",
      "section",
      "[class*='container']",
      "#app",
    ],
    title: [
      "h1",
      "[data-testid*='job-title' i]",
      "[class*='job-title' i]",
      "[class*='job_title' i]",
      "h2",
    ],
    company: [
      "[data-company]",
      "[data-testid*='company' i]",
      "[class*='company' i]",
      "[class*='client-name' i]",
    ],
    location: [
      "[data-location]",
      "[data-testid*='location' i]",
      "[class*='location' i]",
    ],
    description: [
      "section",
      "[class*='job-description' i]",
      "[class*='description' i]",
      ".ql-editor",
      "[class*='ql-editor']",
      "main",
    ],
    qualifications: [
      "[class*='skill' i]",
      "[class*='tag' i]",
      "[class*='chip' i]",
      "[class*='badge' i]",
      "[class*='pill' i]",
    ],
    apply: [
      "button[type='submit']",
      "button[data-action='apply']",
      "button[data-testid*='apply' i]",
      "a[href*='/apply']",
      "button",
    ],
    id: [
      "[data-job-id]",
      "[data-jobid]",
      "input[name='job_id']",
    ],
    idFromUrl,
    dateFromPage,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"micro1">;
