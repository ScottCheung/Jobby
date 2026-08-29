import type { FieldFillResult, FormFieldTarget } from "../../../shared/contracts/form-actions";
import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { MasterResumeData } from "../../../shared/contracts/tailored-resume";
import { fillFormFieldValue } from "../../dom/form-driver";
import {
  inspectVisibleFormFields,
  isVisibleElement,
  type FormScope,
} from "../../dom/form-inspector";
import { fillExactWorkdayCombobox } from "./exact-combobox";
import {
  valueForWorkdayStructuredField,
  workdaySectionItems,
  type WorkdayFieldIdentity,
  type WorkdaySectionKey,
  type WorkdayStructuredItem,
} from "./field-mapping";
import { autofillWorkdaySkills } from "./skill-autofill";

export { valueForWorkdayStructuredField } from "./field-mapping";

const SECTIONS: ReadonlyArray<{
  key: WorkdaySectionKey;
  label: RegExp;
  selectors: readonly string[];
}> = [
  { key: "experience", label: /^(?:work experience|employment history)$/i, selectors: ["[data-automation-id='workExperienceSection']"] },
  { key: "education", label: /^education$/i, selectors: ["[data-automation-id='educationSection']"] },
  { key: "certifications", label: /^(?:certifications?|licenses?)$/i, selectors: ["[data-automation-id='certificationsSection']", "[data-automation-id='certificationSection']"] },
  { key: "languages", label: /^languages?$/i, selectors: ["[data-automation-id='languagesSection']", "[data-automation-id='languageSection']"] },
];

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function visible(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && isVisibleElement(element);
}

function findSection(config: (typeof SECTIONS)[number]): HTMLElement | null {
  for (const selector of config.selectors) {
    const section = document.querySelector(selector);
    if (visible(section)) return section;
  }
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("h2, h3, h4, legend, [role='heading']"),
  ).find((candidate) => visible(candidate) && config.label.test(cleanText(candidate.textContent)));
  let container = heading?.parentElement || null;
  for (let depth = 0; container && depth < 6; depth += 1) {
    if (actionButton(container, "add") || inspectVisibleFormFields(container).length > 0) return container;
    container = container.parentElement;
  }
  return null;
}

function actionButton(scope: ParentNode, action: "add" | "save"): HTMLElement | null {
  const ids = action === "add" ? ["add-button"] : ["save-button", "done-button"];
  for (const id of ids) {
    const button = scope.querySelector(`[data-automation-id='${id}']`);
    if (visible(button)) return button;
  }
  const label = action === "add" ? /^(?:add|add another)$/i : /^(?:save|done)$/i;
  return Array.from(scope.querySelectorAll<HTMLElement>("button, [role='button']"))
    .find((button) => visible(button) && label.test(cleanText(button.textContent))) || null;
}

function activeEditor(section: HTMLElement): HTMLElement | null {
  if (inspectVisibleFormFields(section).length > 0) return section;
  return Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']"))
    .find((dialog) => visible(dialog) && inspectVisibleFormFields(dialog).length > 0) || null;
}

async function waitForEditor(section: HTMLElement): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const editor = activeEditor(section);
    if (editor) return editor;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return null;
}

function controlFor(field: FormFieldObservation, editor: HTMLElement): HTMLElement | null {
  if (field.id) {
    const byId = editor.querySelector<HTMLElement>(`#${CSS.escape(field.id)}`);
    if (byId) return byId;
  }
  if (field.name) {
    return editor.querySelector<HTMLElement>(`[name='${CSS.escape(field.name)}']`);
  }
  return null;
}

function automationId(field: FormFieldObservation, editor: HTMLElement): string | undefined {
  let element = controlFor(field, editor);
  const values: string[] = [];
  for (let depth = 0; element && depth < 7; depth += 1) {
    const value = cleanText(element.getAttribute("data-automation-id"));
    if (value && !/^(?:formField|input)$/i.test(value)) {
      values.push(value.replace(/^formField-/, ""));
    }
    element = element.parentElement;
  }
  return values.length > 0 ? values.join("|") : undefined;
}

function targetFor(field: FormFieldObservation): FormFieldTarget {
  return { key: field.key, id: field.id, name: field.name, label: field.label, type: field.type };
}

async function fillEditor(
  section: WorkdaySectionKey,
  item: WorkdayStructuredItem,
  editor: HTMLElement,
): Promise<FieldFillResult[]> {
  const results: FieldFillResult[] = [];
  for (const field of inspectVisibleFormFields(editor)) {
    const identity: WorkdayFieldIdentity = { ...field, automationId: automationId(field, editor) };
    const value = valueForWorkdayStructuredField(section, item, identity);
    if (value === null || value === "") {
      if (field.required) {
        results.push({
          commandId: `workday-required-${Date.now()}-${field.key}`.slice(0, 64),
          key: field.key,
          status: "rejected",
          message: `Required Workday field “${field.label}” has no exact Resume Profile value.`,
        });
      }
      continue;
    }
    const target = targetFor(field);
    const exactChoice = typeof value === "string" && field.type === "select"
      ? await fillExactWorkdayCombobox(target, value, editor)
      : null;
    results.push(exactChoice || await fillFormFieldValue(target, value, editor as FormScope));
  }
  return results;
}

function fingerprintTerms(
  section: WorkdaySectionKey,
  item: WorkdayStructuredItem,
): string[] {
  const values = section === "experience"
    ? [item.company, item.title]
    : section === "education"
      ? [item.institution, item.degree]
      : [item.name];
  return values.map((value) => cleanText(String(value || ""))).filter(Boolean);
}

function entryExists(section: HTMLElement, terms: string[]): boolean {
  const text = cleanText(section.textContent).toLowerCase();
  return terms.length > 0 && terms.every((term) => text.includes(term.toLowerCase()));
}

async function waitForSavedEntry(
  section: HTMLElement,
  editor: HTMLElement,
  terms: string[],
): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const editorClosed = !editor.isConnected || inspectVisibleFormFields(editor).length === 0;
    if (editorClosed && (entryExists(section, terms) || actionButton(section, "add"))) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return false;
}

export async function autofillWorkdayStructuredSections(
  resume: MasterResumeData,
  savedSkills: string[] = [],
): Promise<FieldFillResult[]> {
  const results: FieldFillResult[] = [];
  for (const config of SECTIONS) {
    const section = findSection(config);
    if (!section) continue;
    for (const item of workdaySectionItems(resume, config.key)) {
      const terms = fingerprintTerms(config.key, item);
      if (terms.length === 0 || entryExists(section, terms)) continue;
      let editor = activeEditor(section);
      if (!editor) {
        const add = actionButton(section, "add");
        if (!add) break;
        add.click();
        editor = await waitForEditor(section);
      }
      if (!editor) break;
      const entryResults = await fillEditor(config.key, item, editor);
      results.push(...entryResults);
      if (entryResults.some((result) => result.status === "rejected" || result.status === "not_found")) break;
      const save = actionButton(editor, "save");
      if (!save) break;
      save.click();
      if (!await waitForSavedEntry(section, editor, terms)) break;
    }
  }
  results.push(...await autofillWorkdaySkills(resume, savedSkills));
  return results;
}
