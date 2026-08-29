import type { FieldFillResult, FormFieldTarget } from "../../../shared/contracts/form-actions";
import type { MasterResumeData } from "../../../shared/contracts/tailored-resume";
import { inspectVisibleFormFields, isVisibleElement } from "../../dom/form-inspector";
import { fillExactWorkdayCombobox } from "./exact-combobox";
import { workdaySkills } from "./field-mapping";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function findSkillsSection(): HTMLElement | null {
  for (const selector of [
    "[data-automation-id='skillsSection']",
    "[data-automation-id='skillSection']",
  ]) {
    const section = document.querySelector<HTMLElement>(selector);
    if (section && isVisibleElement(section)) return section;
  }
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("h2, h3, h4, legend, [role='heading']"),
  ).find((candidate) => isVisibleElement(candidate) && /^skills?$/i.test(cleanText(candidate.textContent)));
  let container = heading?.parentElement || null;
  for (let depth = 0; container && depth < 6; depth += 1) {
    if (skillTarget(container)) return container;
    container = container.parentElement;
  }
  return null;
}

function skillTarget(section: HTMLElement): FormFieldTarget | null {
  const field = inspectVisibleFormFields(section).find((candidate) => {
    const identity = `${candidate.label} ${candidate.name || ""} ${candidate.id || ""}`;
    return candidate.type === "select" && /skills?|skillprompt|skillsearch/i.test(identity);
  });
  if (!field) return null;
  return {
    key: field.key,
    id: field.id,
    name: field.name,
    label: field.label,
    type: field.type,
  };
}

function hasSelectedSkill(section: HTMLElement, skill: string): boolean {
  const expected = cleanText(skill).toLowerCase();
  return Array.from(
    section.querySelectorAll<HTMLElement>(
      "[data-automation-id*='selected' i], [data-automation-id*='pill' i], [data-automation-id*='tag' i], [role='listitem']",
    ),
  ).some((item) => {
    const text = cleanText(item.textContent).toLowerCase();
    return text === expected || text.startsWith(`${expected} `);
  });
}

export async function autofillWorkdaySkills(
  resume: MasterResumeData,
  savedSkills: string[] = [],
): Promise<FieldFillResult[]> {
  const section = findSkillsSection();
  if (!section) return [];
  const results: FieldFillResult[] = [];
  for (const skill of workdaySkills(resume, savedSkills)) {
    if (hasSelectedSkill(section, skill)) continue;
    const target = skillTarget(section);
    if (!target) break;
    const result = await fillExactWorkdayCombobox(target, skill, section);
    if (result) results.push({ ...result, key: `workday-skill-${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` });
  }
  return results;
}
