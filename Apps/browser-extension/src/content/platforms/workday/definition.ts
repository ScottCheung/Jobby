import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function valueFromRoot(root: ParentNode): string {
  for (const selector of [
    "[data-automation-id='jobReqId']",
    "[data-automation-id='requisitionId']",
  ]) {
    const element = root.querySelector<HTMLElement>(selector);
    const value = cleanText(
      element?.getAttribute("content") ||
      element?.getAttribute("value") ||
      element?.getAttribute("data-job-id") ||
      element?.textContent,
    );
    if (value) return value;
  }
  return "";
}

function idFromRoot(root: ParentNode): string {
  const value = valueFromRoot(root);
  return value.match(/([A-Z]{1,10}[-_]\d{2,})/)?.[1] || value;
}

function companyFromPage(): string {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>("header h1, h1"))) {
    const match = cleanText(element.textContent).match(/^Careers at (.+)$/i);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

export const workdayDefinition = {
  platform: "workday",
  detection: {
    host: /(?:^|\.)(?:myworkdayjobs|myworkday|workday)\.com$/i,
    dom: "[data-automation-id='jobPostingPage'], [data-automation-id='jobApplicationPage']",
  },
  applicationRoots: [
    "[data-automation-id='jobApplicationPage']",
    "[data-automation-id='applicationPage']",
    "[data-automation-id='applyFlow']",
    "[data-automation-id='applicationForm']",
  ],
  job: {
    roots: ["[data-automation-id='jobPostingPage']", "[data-automation-id='jobDetails']"],
    title: ["[data-automation-id='jobPostingHeader'] h2", "[data-automation-id='jobPostingHeader']", "h1", "h2"],
    company: ["[data-automation-id='company']", "[data-automation-id='companyName']"],
    location: ["[data-automation-id='locations']", "[data-automation-id='location']"],
    description: ["[data-automation-id='jobPostingDescription']", "[data-automation-id='jobDescription']"],
    apply: ["[data-automation-id='applyButton']", "a[href*='/apply']"],
    id: ["[data-automation-id='jobReqId']", "[data-automation-id='requisitionId']"],
    idFromUrl: (url) => url.searchParams.get("jobRequisitionId") || url.pathname.match(/\b([A-Z]+-?\d{2,})\b/i)?.[1] || "",
    idFromRoot,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"workday">;
