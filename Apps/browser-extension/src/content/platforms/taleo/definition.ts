import type { AtsProviderDefinition } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function idFromRoot(root: ParentNode): string {
  for (const selector of [
    "[id*='reqContestNumberValue']",
    "[id*='jobNumber']",
    "[data-job-id]",
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

function companyFromPage(): string {
  const alt = document.querySelector<HTMLImageElement>("img[alt$=' Taleo']")?.alt || "";
  return alt ? cleanText(alt.replace(/\s+Taleo$/i, "")) : "";
}

export const taleoDefinition = {
  platform: "taleo",
  detection: {
    host: /(?:^|\.)taleo\.net$/i,
    path: /\/careersection\//i,
  },
  applicationRoots: [
    "#candidateApplication",
    "#applicationForm",
    "form[action*='careersection']",
    "[id*='application' i][class*='form' i]",
  ],
  job: {
    roots: ["#requisitionDescriptionInterface", "#jobdetail", "[data-qa='job-detail']"],
    title: ["[id*='reqTitleLinkAction']", "[id*='job-title' i]", ".titlepage", "h1"],
    company: ["[id*='company' i]", "[class*='company' i]"],
    location: ["[id*='location' i]", "[class*='location' i]"],
    description: [".mastercontentpanel3", ".editablesection", ".jobdescription", "[id*='job-description' i]", "[class*='description' i]"],
    apply: ["[id*='apply' i]", "a[href*='apply']"],
    id: ["[data-job-id]", "[id*='requisition' i]"],
    idFromUrl: (url) => url.searchParams.get("job") || url.searchParams.get("jobid") || "",
    idFromRoot,
    companyFromPage,
  },
} satisfies AtsProviderDefinition<"taleo">;
