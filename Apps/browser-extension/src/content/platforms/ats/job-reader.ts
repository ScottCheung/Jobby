import type {
  AtsJobSnapshot,
  PageInspection,
} from "../../../shared/contracts/page-inspection";
import { extractTechnologyKeywords, mergeSkills } from "../../technology-keywords";
import { extractStructuredText } from "../../text-utils";
import { capturedJobDateFields } from '@jobby/ui/lib/date-formatter';
import {
  datePostedFromDom,
  jobPostingFromMicrodata,
  jobPostingFromStructuredData,
  stableId,
} from "../generic/job-reader";
import { getAtsProviderDefinition } from "../registry";
import {
  clearJobDescriptionRoot,
  rememberJobDescriptionRoot,
} from "../../dom/job-description-root";

export type AtsJobPlatform = AtsJobSnapshot["platform"];

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function visible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  let parent = element.parentElement;
  for (let depth = 0; parent && depth < 24; depth += 1) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === "none" || parentStyle.visibility === "hidden") return false;
    parent = parent.parentElement;
  }
  return true;
}

function firstElement(root: ParentNode, selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element && visible(element)) return element;
  }
  return null;
}

function firstText(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
      if (!visible(element)) continue;
      const value = cleanText(
        element.getAttribute("content") ||
          element.getAttribute("value") ||
          element.textContent,
      );
      if (value) return value;
    }
  }
  return "";
}

function descriptionResult(
  root: ParentNode,
  selectors: readonly string[],
): { text: string; element: HTMLElement | null } {
  for (const selector of selectors) {
    const values = Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter(visible)
      .map((element) => ({ element, text: extractStructuredText(element) }))
      .filter(({ text }) => text.length >= 40);
    if (values.length > 0) {
      return {
        text: Array.from(new Set(values.map(({ text }) => text)))
          .join("\n\n")
          .slice(0, 18_000),
        element: values[0]?.element || null,
      };
    }
  }
  return { text: "", element: null };
}

function extractExplicitSkillsFromDom(root: ParentNode, selectors?: readonly string[]): string[] {
  if (!selectors || selectors.length === 0) return [];
  const skills: string[] = [];
  for (const selector of selectors) {
    const containers = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(visible);
    for (const container of containers) {
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(
          "li, button, [data-test*='qualification'], [data-test*='skill'], [class*='skill' i], [class*='pill' i], [class*='tag' i], [class*='chip' i], [class*='badge' i], [class*='qualification' i], span",
        ),
      ).filter(visible);

      const targetElements = items.length > 0 ? items : [container];
      for (const el of targetElements) {
        const text = cleanText(el.textContent);
        if (
          text &&
          text.length >= 2 &&
          text.length <= 40 &&
          !text.includes("?") &&
          !/^(?:edit|apply|save|share|qualifications|requirements|skills)$/i.test(text) &&
          !/^your qualifications/i.test(text) &&
          !/^do you/i.test(text)
        ) {
          skills.push(text);
        }
      }
    }
  }
  return skills;
}

function valueFromElement(element: HTMLElement | null): string {
  if (!element) return "";
  return cleanText(
    element.getAttribute("content") ||
      element.getAttribute("value") ||
      element.getAttribute("data-job-id") ||
      element.textContent,
  );
}

function firstValue(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const value = valueFromElement(root.querySelector<HTMLElement>(selector));
    if (value) return value;
  }
  return "";
}

function dateFromRoot(root: ParentNode): string | undefined {
  const element = root.querySelector<HTMLElement>(
    [
      "[itemprop='datePosted']",
      "[data-automation-id*='posted' i]",
      "[data-testid*='posted' i]",
      "[data-test*='posted' i]",
      "time[datetime]",
    ].join(", "),
  );
  const value = cleanText(
    element?.getAttribute("content") ||
      element?.getAttribute("datetime") ||
      element?.textContent,
  );
  return value || undefined;
}

function companyFromMetadata(): string {
  return cleanText(
    document.querySelector<HTMLMetaElement>("meta[property='og:site_name']")?.content ||
      document.querySelector<HTMLMetaElement>("meta[name='application-name']")?.content,
  );
}

export function readAtsJobPage(platform: AtsJobPlatform): PageInspection {
  clearJobDescriptionRoot(platform);
  const config = getAtsProviderDefinition(platform).job;
  const url = window.location.href;
  const root = firstElement(document, config.roots);
  const structured = jobPostingFromStructuredData() || jobPostingFromMicrodata();

  // A supported hostname can also host search, account, and application
  // routes. Without a platform job root or JobPosting data this provider is
  // explicitly unable to handle the page, allowing the router to try generic.
  if (!root && !structured) {
    return {
      kind: "not_job_page",
      platform,
      url,
      reason: `No ${platform} job detail root or JobPosting data was found.`,
    };
  }

  const source = root || document;
  const domTitle = root ? firstText(source, config.title) : "";
  const structuredMatchesRoot = !domTitle || Boolean(structured?.title && (() => {
    const left = cleanText(domTitle).toLowerCase();
    const right = cleanText(structured.title).toLowerCase();
    return left === right || left.includes(right) || right.includes(left);
  })());
  const rootStructured = structuredMatchesRoot ? structured : null;
  const title = domTitle || rootStructured?.title || "";
  const domDescription = descriptionResult(source, config.description);
  if (domDescription.element) {
    rememberJobDescriptionRoot(platform, domDescription.element);
  }
  const description = domDescription.text || rootStructured?.description || "";
  const company = firstText(source, config.company) || rootStructured?.company || config.companyFromPage?.(title) || companyFromMetadata();
  const location = firstText(source, config.location) || config.locationFromRoot?.(source) || rootStructured?.location || "";
  const applyAction = Boolean(firstElement(source, config.apply));
  const enoughEvidence = Boolean(title) && (
    Boolean(rootStructured) || description.length >= 40 || (Boolean(company) && applyAction)
  );

  if (!enoughEvidence) {
    return {
      kind: "not_job_page",
      platform,
      url,
      reason: `The ${platform} provider could not confirm a complete job posting.`,
    };
  }

  const parsedUrl = new URL(url);
  const externalId =
    config.idFromRoot?.(source) ||
    firstValue(source, config.id) ||
    config.idFromUrl(parsedUrl) ||
    rootStructured?.externalId ||
    stableId(`${platform}|${url}|${title}|${company}`);

  const rawDatePosted =
    rootStructured?.datePosted ||
    config.dateFromPage?.(externalId) ||
    dateFromRoot(source) ||
    (!root ? datePostedFromDom() : undefined);
  const explicitSkills = extractExplicitSkillsFromDom(source, config.qualifications);
  const textKeywords = extractTechnologyKeywords([title, description].filter(Boolean).join("\n\n"));
  const snapshot: AtsJobSnapshot = {
    platform,
    externalId,
    url,
    title,
    company: company || "Unknown company",
    location: location || undefined,
    ...capturedJobDateFields(rawDatePosted),
    description: description || undefined,
    technologies: mergeSkills(explicitSkills, textKeywords),
  };
  return { kind: "job", snapshot };
}
