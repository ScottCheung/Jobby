import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1) || "";
  return /^(?:apply|application)$/i.test(last) ? segments.at(-2) || "" : last;
}

function companyFromPage(): string {
  const match = cleanText(document.title).match(/^(.+?)\s+-\s+.*$/i);
  return match?.[1] ? cleanText(match[1]) : "";
}

export const bambooHrDefinition = {
  platform: "bamboohr",
  detection: {
    host: /(?:^|\.)bamboohr\.(?:com|co\.uk)$/i,
    dom: "#BambooHR, [class*='BambooHR'], [id*='BambooHR'], [data-qa='job-description'], .BambooHR-ATS-Jobs-Item",
  },
  applicationRoots: [
    "#BambooHR-ATS-Jobs-Apply",
    "#application-form",
    "form.BambooHR-ATS-Jobs-Form",
    "form[action*='bamboohr']",
    ".BambooHR-ATS-Jobs-Item",
  ],
  job: {
    roots: ["#BambooHR", "#BambooHR-ATS-Jobs-Item", ".BambooHR-ATS-Jobs-Item", "#job-details"],
    title: [".BambooHR-ATS-Jobs-Item h2", "h1.BambooHR-ATS-Jobs-Title", "h2", "h1"],
    company: [".BambooHR-ATS-Jobs-Company", "[data-company]"],
    location: [".BambooHR-ATS-Jobs-Location", "[data-location]"],
    description: [".BambooHR-ATS-Jobs-Description", "#jobDescription", ".BambooHR-ATS-Jobs-Item"],
    apply: ["a[href*='/apply']", "button[data-action='apply']", ".BambooHR-ATS-Jobs-ApplyButton"],
    id: ["[data-job-id]", "input[name='job_id']"],
    idFromUrl: (url) => url.searchParams.get("id") || url.searchParams.get("jobId") || lastJobPathSegment(url),
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"bamboohr">;
