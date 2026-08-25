import type { FormPlatform } from "../../shared/contracts/form-inspection";

export type DedicatedPlatform = Exclude<FormPlatform, "generic">;

type RoutingContext = {
  location: Pick<Location, "hostname" | "pathname">;
  document: Document;
};

type ProviderRule = {
  platform: DedicatedPlatform;
  host: RegExp;
  dom?: string;
  path?: RegExp;
};

const PROVIDER_RULES: readonly ProviderRule[] = [
  { platform: "linkedin", host: /(?:^|\.)linkedin\.com$/i },
  { platform: "seek", host: /(?:^|\.)seek\.(?:com(?:\.au)?|co\.nz)$/i },
  { platform: "indeed", host: /(?:^|\.)indeed\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i },
  { platform: "glassdoor", host: /(?:^|\.)glassdoor\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2,3})$/i },
  {
    platform: "workday",
    host: /(?:^|\.)(?:myworkdayjobs|myworkday|workday)\.com$/i,
    dom: "[data-automation-id='jobPostingPage'], [data-automation-id='jobApplicationPage']",
  },
  {
    platform: "greenhouse",
    host: /(?:^|\.)(?:boards|job-boards)\.greenhouse\.io$/i,
    dom: "#grnhse_app, .job-post-container, form.application--form, form[action*='greenhouse.io']",
  },
  {
    platform: "lever",
    host: /(?:^|\.)jobs(?:\.eu)?\.lever\.co$/i,
    dom: ".posting-page, [data-qa='posting-page'], form[action*='lever.co']",
  },
  {
    platform: "ashby",
    host: /(?:^|\.)jobs\.ashbyhq\.com$/i,
    dom: ".ashby-job-posting-heading, .ashby-application-form-container, [data-testid='job-posting']",
  },
  {
    platform: "smartrecruiters",
    host: /(?:^|\.)smartrecruiters\.com$/i,
    dom: "spl-input, spl-autocomplete, spl-dropzone, oc-application",
  },
  {
    platform: "taleo",
    host: /(?:^|\.)taleo\.net$/i,
    path: /\/careersection\//i,
  },
  {
    platform: "icims",
    host: /(?:^|\.)(?:icims\.com|icims-candidateportal\.com)$/i,
    dom: "#iCIMS_Header, #iCIMS_JobContent, #iCIMS_SubHeader, [class*='iCIMS_'], [id*='icims' i], iframe[src*='icims.com']",
  },
  {
    platform: "successfactors",
    host: /(?:^|\.)(?:successfactors|sapsf)\.(?:com|eu)$/i,
    dom: "#rcm_job_details, .jobDisplay, .sf-job-detail, [id*='successfactors' i], [class*='successfactors' i]",
  },
  {
    platform: "oracle",
    host: /(?:^|\.)(?:oraclecloud|fa\.ocs\.oraclecloud)\.com$/i,
    dom: "[data-qa='oracle-cloud-candidate-experience'], .cx-job-details, cx-job-details, [id*='oracle' i]",
  },
  {
    platform: "workable",
    host: /(?:^|\.)(?:apply\.)?workable\.com$/i,
    dom: "[data-ui='job-title'], [data-ui='application-form'], [data-ui='overview'], form[data-ui='application-form']",
  },
  {
    platform: "bamboohr",
    host: /(?:^|\.)bamboohr\.(?:com|co\.uk)$/i,
    dom: "#BambooHR, [class*='BambooHR'], [id*='BambooHR'], [data-qa='job-description'], .BambooHR-ATS-Jobs-Item",
  },
];

export function detectDedicatedPlatform(
  location: Pick<Location, "hostname" | "pathname"> = window.location,
  documentRoot: Document = document,
): DedicatedPlatform | null {
  const context: RoutingContext = { location, document: documentRoot };
  const hostname = context.location.hostname.toLowerCase();
  const pathname = context.location.pathname.toLowerCase();

  const hostMatch = PROVIDER_RULES.find((rule) =>
    rule.host.test(hostname) && (!rule.path || rule.path.test(pathname)),
  );
  if (hostMatch) return hostMatch.platform;

  // White-label ATS pages keep their provider-specific DOM even when the
  // employer uses a custom careers hostname. These signals are deliberately
  // limited to dedicated component/root markers, not broad class keywords.
  return PROVIDER_RULES.find((rule) => rule.dom && documentRoot.querySelector(rule.dom))?.platform || null;
}

export function isJobProviderPlatform(
  platform: DedicatedPlatform,
): platform is Exclude<DedicatedPlatform, "linkedin" | "seek" | "indeed"> {
  return platform !== "linkedin" && platform !== "seek" && platform !== "indeed";
}
