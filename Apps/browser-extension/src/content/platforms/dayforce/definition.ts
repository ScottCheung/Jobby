import type { AtsProviderDefinition } from "../platform-definition";
import { adaptDayforceFormFields } from "./form-field-adapter";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function lastJobPathSegment(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const jobsIndex = segments.findIndex((segment) => segment.toLowerCase() === "jobs");
  return jobsIndex >= 0 ? segments[jobsIndex + 1] || "" : segments.at(-1) || "";
}

function companyFromDayforcePage(): string {
  try {
    const nextDataEl = document.getElementById("__NEXT_DATA__");
    if (nextDataEl?.textContent) {
      const data = JSON.parse(nextDataEl.textContent);
      const queries = data?.props?.pageProps?.dehydratedState?.queries;
      if (Array.isArray(queries)) {
        for (const q of queries) {
          const name = q?.state?.data?.candidateCorrespondenceClientName;
          if (name && typeof name === "string") return cleanText(name);
        }
      }
    }
  } catch {}

  const logoImg = document.querySelector<HTMLImageElement>(
    "[test-id='header-logo'] img, img[test-id='header-logo']",
  );
  const logoAlt = logoImg?.getAttribute("alt");
  if (logoAlt) {
    const cleaned = cleanText(logoAlt)
      .replace(/[\s_-]*(?:logo|icon).*$/i, "")
      .trim();
    if (cleaned && !/^dayforce$/i.test(cleaned)) return cleaned;
  }

  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const clientNamespace = segments[1];
    if (
      clientNamespace &&
      !/^(?:jobs|candidateportal|apply)$/i.test(clientNamespace)
    ) {
      return clientNamespace;
    }
  }
  return "";
}

function idFromDayforceRoot(root: ParentNode): string {
  const element = root.querySelector<HTMLElement>("[test-id='job-detail-job-req-id']");
  if (element) {
    const text = cleanText(element.textContent);
    const match = text.match(/(?:job\s*req(?:\s*id)?[:\s]*)?([a-zA-Z0-9_-]+)$/i);
    if (match?.[1]) return match[1];
    return text;
  }
  return "";
}

function dateFromDayforcePage(): string | undefined {
  const element = document.querySelector<HTMLElement>("[test-id='job-detail-posted-date']");
  if (element) {
    const text = cleanText(element.textContent);
    if (text) return text;
  }
  try {
    const nextDataEl = document.getElementById("__NEXT_DATA__");
    if (nextDataEl?.textContent) {
      const data = JSON.parse(nextDataEl.textContent);
      const queries = data?.props?.pageProps?.dehydratedState?.queries;
      if (Array.isArray(queries)) {
        for (const q of queries) {
          const date =
            q?.state?.data?.postingStartTimestampUTC ||
            q?.state?.data?.createdTimestampUTC;
          if (date && typeof date === "string") return date;
        }
      }
    }
  } catch {}
  return undefined;
}

export const dayforceDefinition = {
  platform: "dayforce",
  detection: {
    host: /(?:^|\.)dayforcehcm\.com$/i,
    dom: "[test-id='job-details-dayforce-jobs'], [test-id='job-detail-title'], [test-id='manual-application-dayforce-jobs'], [test-id='manual-application']",
  },
  applicationRoots: [
    "[test-id='manual-application-dayforce-jobs']",
    "[test-id='manual-application']",
    "[test-id^='application-step-']",
    "div.ant-form[name='jobPostingApplication']",
    "[test-id*='application' i] form",
    "form:not(#site-navigation):not([role='search']):not([id*='search' i]):not([id*='nav' i])",
  ],
  adaptFormFields: adaptDayforceFormFields,
  job: {
    roots: [
      "[test-id='job-details-dayforce-jobs']",
      "#job-details-dayforce-jobs",
      "[test-id='job-detail-body']",
    ],
    title: ["[test-id='job-detail-title']", "h1"],
    company: ["[test-id='job-detail-company']", "[data-company]"],
    companyFromPage: companyFromDayforcePage,
    location: ["[test-id='job-detail-location-name']", "[test-id='job-details-location-item']"],
    description: [
      "[test-id='job-detail-header'], [test-id='job-detail-body'], [test-id='job-detail-footer']",
      "[test-id='job-detail-body']",
      "[test-id='job-detail-description']",
    ],
    apply: ["[test-id='apply-button']", "a[href*='/apply']", "button"],
    id: ["[test-id='job-detail-job-req-id']", "[data-job-id]"],
    idFromRoot: idFromDayforceRoot,
    idFromUrl: lastJobPathSegment,
    dateFromPage: dateFromDayforcePage,
    readinessWaitUntilAttempt: 8,
  },
  applicationNavigation: {
    getAction(action) {
      if (action === "next") {
        return document.querySelector<HTMLElement>("[test-id='application-next-step']");
      }
      if (action === "submit") {
        return document.querySelector<HTMLElement>("[test-id='application-submit']");
      }
      if (action === "previous") {
        return document.querySelector<HTMLElement>("[test-id='application-previous-step']");
      }
      return null;
    },
    getActionKind() {
      if (document.querySelector("[test-id='application-submit']")) return "submit";
      if (document.querySelector("[test-id='application-next-step']")) return "next";
      return undefined;
    },
    getActionLabel() {
      const submit = document.querySelector<HTMLElement>("[test-id='application-submit']");
      if (submit) return cleanText(submit.textContent);
      const next = document.querySelector<HTMLElement>("[test-id='application-next-step']");
      if (next) return cleanText(next.textContent);
      return undefined;
    },
  },
} satisfies AtsProviderDefinition<"dayforce">;
