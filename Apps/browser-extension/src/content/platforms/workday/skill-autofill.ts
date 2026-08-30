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
    return (candidate.type === "select" || candidate.id === "skills--skills") &&
      /skills?|skillprompt|skillsearch/i.test(identity);
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

function skillsSearchInput(section: HTMLElement): HTMLInputElement | null {
  return section.querySelector<HTMLInputElement>(
    "#skills--skills, [data-uxi-widget-type='selectinput'], [data-automation-id='multiSelectContainer'] input",
  );
}

function clearSkillsSearch(input: HTMLInputElement): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, "");
  else input.value = "";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: "" }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, composed: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true, composed: true }));
}

async function waitForSelectedSkill(
  section: HTMLElement,
  skill: string,
  shouldCancel: () => boolean,
): Promise<boolean> {
  let stableChecks = 0;
  const input = skillsSearchInput(section);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (shouldCancel()) return false;
    const selected = hasSelectedSkill(section, skill);
    if (selected && input?.value && attempt >= 10) clearSkillsSearch(input);
    if (selected && !input?.value) {
      stableChecks += 1;
      if (stableChecks >= 3) return true;
    } else {
      stableChecks = 0;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return false;
}

export async function autofillWorkdaySkills(
  resume: MasterResumeData,
  savedSkills: string[] = [],
  shouldCancel: () => boolean = () => false,
): Promise<FieldFillResult[]> {
  const section = findSkillsSection();
  if (!section) return [];
  const results: FieldFillResult[] = [];
  const skills = workdaySkills(resume, savedSkills);
  const unavailableSkills = new Set<string>();
  for (let pass = 0; pass < 3; pass += 1) {
    let selectedInThisPass = false;
    for (const skill of skills) {
      if (shouldCancel()) break;
      if (hasSelectedSkill(section, skill) || unavailableSkills.has(skill)) continue;
      const target = skillTarget(section);
      if (!target) break;
      const result = await fillExactWorkdayCombobox(target, skill, section, shouldCancel);
      const resultKey = `workday-skill-${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (result) results.push({ ...result, key: resultKey });
      if (shouldCancel()) break;
      if (result?.status === "filled" && !await waitForSelectedSkill(section, skill, shouldCancel)) {
        results[results.length - 1] = {
          ...result,
          key: resultKey,
          status: "rejected",
          message: `Workday did not keep “${skill}” selected.`,
        };
      } else if (result?.status === "filled" || result?.status === "already_filled") {
        selectedInThisPass = true;
      }
      if (result?.status === "rejected" && /no (?:confirmable )?exact option/i.test(result.message)) {
        unavailableSkills.add(skill);
      }
    }
    if (shouldCancel()) break;
    const retryableMissing = skills.filter((skill) =>
      !unavailableSkills.has(skill) && !hasSelectedSkill(section, skill),
    );
    if (!selectedInThisPass && retryableMissing.length === 0) break;
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    if (skills.every((skill) => unavailableSkills.has(skill) || hasSelectedSkill(section, skill))) break;
  }
  return results;
}
