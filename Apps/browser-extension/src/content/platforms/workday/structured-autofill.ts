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
  entryPrefix: string;
}> = [
  { key: "experience", label: /^(?:work experience|employment history)$/i, selectors: ["[data-automation-id='workExperienceSection']"], entryPrefix: "workExperience" },
  { key: "education", label: /^education$/i, selectors: ["[data-automation-id='educationSection']"], entryPrefix: "education" },
  { key: "certifications", label: /^(?:certifications?|licenses?)$/i, selectors: ["[data-automation-id='certificationsSection']", "[data-automation-id='certificationSection']"], entryPrefix: "certification" },
  { key: "languages", label: /^languages?$/i, selectors: ["[data-automation-id='languagesSection']", "[data-automation-id='languageSection']"], entryPrefix: "language" },
  { key: "websites", label: /^websites?$/i, selectors: ["[data-automation-id='websitesSection']", "[data-automation-id='websiteSection']"], entryPrefix: "website" },
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

function editorForSave(save: HTMLElement, boundary: HTMLElement): HTMLElement | null {
  let container = save.parentElement;
  for (let depth = 0; container && depth < 7; depth += 1) {
    if (inspectVisibleFormFields(container).length > 0) return container;
    if (container === boundary) break;
    container = container.parentElement;
  }
  return null;
}

function activeEditor(section: HTMLElement): HTMLElement | null {
  const candidates = [
    ...Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).filter(visible),
    section,
  ];
  for (const candidate of candidates) {
    const save = actionButton(candidate, "save");
    if (!save) continue;
    const editor = editorForSave(save, candidate);
    if (editor) return editor;
  }
  return null;
}

function hasFilledEditorFields(editor: HTMLElement): boolean {
  return inspectVisibleFormFields(editor).some((field) => field.filled);
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

function sameObservedValue(
  field: FormFieldObservation | undefined,
  value: string | boolean,
): boolean {
  if (!field) return false;
  if (typeof value === "boolean") return field.filled === value;
  const expected = cleanText(value).toLowerCase();
  const actual = cleanText(field.currentValue).toLowerCase();
  if (/^\d+$/.test(expected) && /^\d+$/.test(actual)) {
    return Number(expected) === Number(actual);
  }
  return actual === expected;
}

function liveField(
  editor: HTMLElement,
  target: FormFieldTarget,
): FormFieldObservation | undefined {
  return inspectVisibleFormFields(editor).find((field) =>
    field.key === target.key ||
    Boolean(target.id && field.id === target.id) ||
    Boolean(target.name && field.name === target.name && field.label === target.label),
  );
}

async function fillEditor(
  section: WorkdaySectionKey,
  item: WorkdayStructuredItem,
  editor: HTMLElement,
  shouldCancel: () => boolean,
): Promise<FieldFillResult[]> {
  const results: FieldFillResult[] = [];
  for (const field of inspectVisibleFormFields(editor)) {
    if (shouldCancel()) break;
    const control = controlFor(field, editor);
    if (!control || !isVisibleElement(control)) continue;
    const currentField = liveField(editor, targetFor(field)) || field;
    const identity: WorkdayFieldIdentity = {
      ...currentField,
      automationId: automationId(currentField, editor),
    };
    const value = valueForWorkdayStructuredField(section, item, identity);
    if (value === null || value === "") {
      if (currentField.required) {
        results.push({
          commandId: `workday-required-${Date.now()}-${currentField.key}`.slice(0, 64),
          key: currentField.key,
          status: "rejected",
          message: `Required Workday field “${currentField.label}” has no exact Resume Profile value.`,
        });
      }
      continue;
    }
    const target = targetFor(currentField);
    const exactChoice = typeof value === "string"
      ? await fillExactWorkdayCombobox(target, value, editor, shouldCancel)
      : null;
    let result = exactChoice || await fillFormFieldValue(target, value, editor as FormScope);
    if (!exactChoice && (result.status === "filled" || result.status === "already_filled")) {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      if (!sameObservedValue(liveField(editor, target), value) && !shouldCancel()) {
        result = await fillFormFieldValue(target, value, editor as FormScope);
        await new Promise((resolve) => window.setTimeout(resolve, 200));
        if (!sameObservedValue(liveField(editor, target), value)) {
          result = {
            ...result,
            status: "rejected",
            message: "Workday did not retain this value after updating the field.",
          };
        }
      }
    }
    results.push(result);
  }
  return results;
}

function inlineEntryScopes(section: HTMLElement, entryPrefix: string): HTMLElement[] {
  const groups = new Map<string, HTMLElement[]>();
  for (const control of Array.from(section.querySelectorAll<HTMLElement>("[id]"))) {
    const separator = control.id.indexOf("--");
    if (separator < 0) continue;
    const entryKey = control.id.slice(0, separator);
    if (!entryKey.startsWith(`${entryPrefix}-`)) continue;
    const controls = groups.get(entryKey) || [];
    controls.push(control);
    groups.set(entryKey, controls);
  }

  return Array.from(groups.values()).flatMap((controls) => {
    let container = controls[0]?.parentElement || null;
    for (let depth = 0; container && depth < 10; depth += 1) {
      if (controls.every((control) => container?.contains(control))) return [container];
      if (container === section) break;
      container = container.parentElement;
    }
    return [];
  });
}

function isInlineSection(
  config: (typeof SECTIONS)[number],
  section: HTMLElement,
): boolean {
  return inlineEntryScopes(section, config.entryPrefix).length > 0 ||
    Array.from(section.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id], [role='heading'][id]"))
      .some((heading) => config.label.test(cleanText(heading.textContent)) && /-section$/i.test(heading.id));
}

async function addInlineEntry(
  section: HTMLElement,
  entryPrefix: string,
): Promise<HTMLElement | null> {
  const previousCount = inlineEntryScopes(section, entryPrefix).length;
  const add = actionButton(section, "add");
  if (!add) return null;
  add.click();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const entries = inlineEntryScopes(section, entryPrefix);
    if (entries.length > previousCount) return entries[previousCount] || null;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return null;
}

async function fillInlineSection(
  config: (typeof SECTIONS)[number],
  section: HTMLElement,
  items: WorkdayStructuredItem[],
  shouldCancel: () => boolean,
): Promise<FieldFillResult[]> {
  const results: FieldFillResult[] = [];
  for (let index = 0; index < items.length; index += 1) {
    if (shouldCancel()) break;
    const item = items[index];
    if (!item || fingerprintTerms(config.key, item).length === 0) continue;
    const entries = inlineEntryScopes(section, config.entryPrefix);
    const editor = entries[index] || await addInlineEntry(section, config.entryPrefix);
    if (!editor) break;
    const entryResults = await fillEditor(config.key, item, editor, shouldCancel);
    results.push(...entryResults);
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
      : section === "websites"
        ? [item.url]
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
  shouldCancel: () => boolean = () => false,
): Promise<FieldFillResult[]> {
  const results: FieldFillResult[] = [];
  for (const config of SECTIONS) {
    if (shouldCancel()) break;
    const section = findSection(config);
    if (!section) continue;
    const items = workdaySectionItems(resume, config.key);
    if (isInlineSection(config, section)) {
      results.push(...await fillInlineSection(config, section, items, shouldCancel));
      continue;
    }
    for (const item of items) {
      if (shouldCancel()) break;
      const terms = fingerprintTerms(config.key, item);
      if (terms.length === 0 || entryExists(section, terms)) continue;
      let editor = activeEditor(section);
      // An already-populated editor belongs to the applicant. Do not reuse it
      // for a different resume entry, even when Workday exposes it in the same
      // section as the Add control.
      if (editor && hasFilledEditorFields(editor)) break;
      if (!editor) {
        const add = actionButton(section, "add");
        if (!add) break;
        add.click();
        editor = await waitForEditor(section);
      }
      if (!editor) break;
      const entryResults = await fillEditor(config.key, item, editor, shouldCancel);
      results.push(...entryResults);
      if (entryResults.some((result) => result.status === "rejected" || result.status === "not_found")) break;
      const save = actionButton(editor, "save");
      if (!save) break;
      save.click();
      if (!await waitForSavedEntry(section, editor, terms)) break;
    }
  }
  if (!shouldCancel()) {
    results.push(...await autofillWorkdaySkills(resume, savedSkills, shouldCancel));
  }
  return results;
}
