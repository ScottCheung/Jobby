import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function companyFromPage(title: string): string {
  const pageTitle = cleanText(document.title);
  const prefix = `Job Application for ${title} at `;
  return pageTitle.startsWith(prefix) ? cleanText(pageTitle.slice(prefix.length)) : "";
}

export const greenhouseDefinition = {
  platform: "greenhouse",
  detection: {
    host: /(?:^|\.)(?:boards|job-boards)\.greenhouse\.io$/i,
    dom: "#grnhse_app, .job-post-container, form.application--form, form[action*='greenhouse.io']",
  },
  applicationRoots: [
    "#application-form",
    "form.application--form",
    "#application_form",
    "#grnhse_app form",
    "form[action*='/applications']",
    "[data-testid='application-form']",
  ],
  job: {
    roots: [".job-post-container", "main.job-post", "#app_body", "[data-qa='job-post']", "main#main"],
    title: [".job__title h1", "h1.app-title", ".app-title", "h1"],
    company: [".company-name", "[data-company-name]", "[itemprop='hiringOrganization'] [itemprop='name']"],
    location: [".job__location", ".location", "[itemprop='jobLocation']"],
    description: [".job__description", "#job_description", "#content", "[data-qa='job-description']"],
    apply: ["button[aria-label='Apply']", "#apply_button", "a[href*='#app']", "button[type='submit']"],
    id: ["[data-job-id]", "input[name='job_id']"],
    idFromUrl: (url) => url.searchParams.get("gh_jid") || url.pathname.match(/\/jobs\/(\d+)/i)?.[1] || "",
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"greenhouse">;
