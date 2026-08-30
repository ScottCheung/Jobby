import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { ProviderFormRoot } from "../platform-definition";

const MANAGED_SECTION_SELECTOR = [
  "[data-automation-id='workExperienceSection']",
  "[data-automation-id='educationSection']",
  "[data-automation-id='certificationsSection']",
  "[data-automation-id='certificationSection']",
  "[data-automation-id='languagesSection']",
  "[data-automation-id='languageSection']",
  "[data-automation-id='skillsSection']",
  "[data-automation-id='skillSection']",
  "[data-automation-id='websitesSection']",
  "[data-automation-id='websiteSection']",
].join(", ");

const MANAGED_FIELD_IDENTIFIERS = new Set([
  "jobtitle",
  "positiontitle",
  "company",
  "companyname",
  "employer",
  "currentlyworkhere",
  "currentjob",
  "startdate",
  "enddate",
  "roledescription",
  "jobdescription",
  "school",
  "schoolname",
  "institution",
  "degree",
  "degreename",
  "fieldofstudy",
  "firstyearattended",
  "lastyearattended",
  "certificationname",
  "certificatename",
  "issuer",
  "issuedby",
  "issuedate",
  "expirationdate",
  "expirydate",
  "certificationurl",
  "credentialurl",
  "languagename",
  "languageproficiency",
]);

const MANAGED_FIELD_ID = /^(?:workExperience|education|certification|language|skills|website)(?:-|$)/i;
const STRUCTURED_ENTRY_ID = /^(workExperience|education)-.+--/i;

function normalized(value: string | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function fieldElement(
  field: FormFieldObservation,
  root: ProviderFormRoot,
): HTMLElement | null {
  if (field.id) {
    const element = root.querySelector<HTMLElement>(`#${CSS.escape(field.id)}`);
    if (element) return element;
  }
  if (field.name) {
    const element = root.querySelector<HTMLElement>(`[name='${CSS.escape(field.name)}']`);
    if (element) return element;
  }
  return null;
}

export function excludeWorkdayManagedFields(
  fields: FormFieldObservation[],
  root: ProviderFormRoot,
): FormFieldObservation[] {
  const entryFields = new Map<string, FormFieldObservation[]>();
  for (const field of fields) {
    const id = field.id || "";
    if (!STRUCTURED_ENTRY_ID.test(id)) continue;
    const entryKey = id.slice(0, id.indexOf("--"));
    entryFields.set(entryKey, [...(entryFields.get(entryKey) || []), field]);
  }

  const emittedEntries = new Set<string>();
  const result: FormFieldObservation[] = [];
  for (const field of fields) {
    const id = field.id || "";
    if (STRUCTURED_ENTRY_ID.test(id)) {
      const entryKey = id.slice(0, id.indexOf("--"));
      if (!emittedEntries.has(entryKey)) {
        emittedEntries.add(entryKey);
        result.push(structuredEntrySummary(
          entryKey,
          entryFields.get(entryKey) || [],
          Array.from(emittedEntries).filter((key) => key.startsWith(entryKey.split("-")[0] || "")).length,
        ));
      }
      continue;
    }
    if ([field.key, field.id, field.name].some((value) => MANAGED_FIELD_ID.test(value || ""))) {
      continue;
    }
    const element = fieldElement(field, root);
    if (element?.closest(MANAGED_SECTION_SELECTOR)) continue;
    if ([field.label, field.name, field.id].some((value) => MANAGED_FIELD_IDENTIFIERS.has(normalized(value)))) {
      continue;
    }
    const hasSkillsSection = Boolean(
      root.querySelector("[data-automation-id='skillsSection'], [data-automation-id='skillSection']"),
    );
    const isSkillsSearch = [field.label, field.name, field.id]
      .filter(Boolean)
      .some((value) => /^(?:skills?|search skills?|add skills?|skillprompt)$/i.test(String(value).trim()));
    if (hasSkillsSection && isSkillsSearch) continue;
    result.push(field);
  }
  for (const summary of sectionSummaries(root, fields)) {
    if (!result.some((field) => field.key === summary.key)) result.push(summary);
  }

  return result.sort((left, right) => {
    const leftElement = fieldElement(left, root);
    const rightElement = fieldElement(right, root);
    if (!leftElement || !rightElement || leftElement === rightElement) return 0;
    return leftElement.compareDocumentPosition(rightElement) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

function sectionSummaries(
  root: ProviderFormRoot,
  fields: FormFieldObservation[],
): FormFieldObservation[] {
  const definitions = [
    { key: "languages", label: "Languages", heading: /^languages?$/i, idPrefix: /^language-/i },
    { key: "skills", label: "Skills", heading: /^skills?$/i, idPrefix: /^skills?(?:-|$)/i },
    { key: "websites", label: "Websites", heading: /^websites?$/i, idPrefix: /^website-/i },
  ] as const;

  return definitions.flatMap((definition) => {
    const heading = Array.from(
      root.querySelectorAll<HTMLElement>("h2, h3, h4, h5, legend, [role='heading']"),
    ).find((candidate) => definition.heading.test((candidate.textContent || "").trim()));
    const explicitSection = root.querySelector<HTMLElement>(
      `[data-automation-id='${definition.key}Section'], [data-automation-id='${definition.key.slice(0, -1)}Section']`,
    );
    const anchor = heading || explicitSection;
    if (!anchor) return [];

    const matchingFields = fields.filter((field) =>
      definition.idPrefix.test(field.id || field.name || field.key),
    );
    const section = heading?.parentElement || explicitSection;
    const selectedSkills = definition.key === "skills" && section
      ? section.querySelectorAll("[data-automation-id='selectedItem']").length
      : 0;
    const entryKeys = new Set(matchingFields.map((field) => {
      const id = field.id || field.name || field.key;
      return id.includes("--") ? id.slice(0, id.indexOf("--")) : id;
    }));
    const count = definition.key === "skills" ? selectedSkills : entryKeys.size;

    return [{
      key: `workday-summary-${definition.key}`,
      ...(anchor.id ? { id: anchor.id } : {}),
      type: "unknown" as const,
      label: definition.label,
      required: false,
      filled: count > 0,
      sensitive: false,
      options: [],
      semanticFeatures: ["workday-structured-summary"],
      currentValue: count > 0
        ? definition.key === "skills" ? `${count} selected` : `${count} ${count === 1 ? "entry" : "entries"}`
        : "Not filled",
    }];
  });
}

function structuredEntrySummary(
  entryKey: string,
  fields: FormFieldObservation[],
  index: number,
): FormFieldObservation {
  const isExperience = entryKey.toLowerCase().startsWith("workexperience-");
  const label = `${isExperience ? "Work Experience" : "Education"} ${index}`;
  const requiredFields = fields.filter((field) => field.required);
  const detailSuffixes = isExperience
    ? ["--jobTitle", "--companyName"]
    : ["--schoolName", "--degree"];
  const coreFields = detailSuffixes
    .map((suffix) => fields.find((field) => field.id?.endsWith(suffix)))
    .filter((field): field is FormFieldObservation => Boolean(field));
  const filled = coreFields.length > 0
    ? coreFields.every((field) => field.filled)
    : requiredFields.length > 0
      ? requiredFields.every((field) => field.filled)
      : fields.some((field) => field.filled);
  const details = detailSuffixes
    .map((suffix) => fields.find((field) => field.id?.endsWith(suffix))?.currentValue)
    .filter((value): value is string => Boolean(value));

  return {
    key: `workday-summary-${entryKey}`,
    id: fields[0]?.id || entryKey,
    type: "unknown",
    label,
    required: false,
    filled,
    sensitive: false,
    options: [],
    semanticFeatures: ["workday-structured-summary"],
    currentValue: details.join(" · ") || (filled ? "Completed" : "Not filled"),
  };
}
