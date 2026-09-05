import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { ProviderFormRoot } from "../platform-definition";
import type { FormOption } from "../../dom/form-inspector/option-reader";
import { cleanLabel, cleanText } from "../../dom/form-inspector/visibility";
import { labelFor } from "../../dom/form-inspector/label-resolver";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return typeof value === "object" && value !== null ? value as RecordValue : null;
}

function jobPost(value: unknown, visited = new Set<object>(), depth = 0): RecordValue | null {
  const candidate = record(value);
  if (!candidate || depth > 6 || visited.has(candidate)) return null;
  visited.add(candidate);
  if (Array.isArray(candidate.questions)) return candidate;
  for (const child of Object.values(candidate)) {
    const found = jobPost(child, visited, depth + 1);
    if (found) return found;
  }
  return null;
}

function questionOptions(element: HTMLInputElement): FormOption[] {
  const pageContext = (window as Window & { __remixContext?: unknown }).__remixContext;
  const scriptContext = Array.from(document.scripts)
    .map((script) => script.textContent || "")
    .find((text) => /^\s*window\.__remixContext\s*=/.test(text));
  let parsedContext: unknown;
  if (scriptContext) {
    try {
      parsedContext = JSON.parse(
        scriptContext
          .replace(/^window\.__remixContext\s*=\s*/, "")
          .replace(/;\s*$/, ""),
      );
    } catch {
      parsedContext = undefined;
    }
  }

  const questions = jobPost(pageContext)?.questions || jobPost(parsedContext)?.questions;
  if (!Array.isArray(questions)) return [];
  for (const question of questions) {
    const fields = record(question)?.fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      const candidate = record(field);
      if (candidate?.name !== element.id && candidate?.name !== element.name) continue;
      const values = candidate.values;
      if (!Array.isArray(values)) return [];
      return values
        .map((value) => {
          const option = record(value);
          const label = cleanText(typeof option?.label === "string" ? option.label : "");
          const rawValue = option?.value;
          return {
            label,
            value: rawValue === undefined || rawValue === null ? label : String(rawValue),
          };
        })
        .filter((option) => Boolean(option.label));
    }
  }
  return [];
}

function inferredChoiceOptions(element: HTMLInputElement): FormOption[] {
  if (!element.id.startsWith("question_")) return [];
  const label = cleanLabel(labelFor(element, document)).toLowerCase();
  return /(citizen|relocat|clearance)/i.test(label)
    ? ["Yes", "No"].map((value) => ({ label: value, value }))
    : [];
}

export function isGreenhouseLocation(element: HTMLElement): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;
  const id = cleanText(element.id).toLowerCase();
  const name = cleanText(element.getAttribute("name")).toLowerCase();
  return id === "job_application_location" ||
    id === "candidate_location" ||
    name === "job_application[location]" ||
    name === "candidate[location]" ||
    id.includes("location_autocomplete") ||
    element.classList.contains("ui-autocomplete-input") ||
    ((id === "location" || name === "location" || id.includes("location") || name.includes("location")) &&
      Boolean(element.closest("#grnhse_app, .job-post-container, form.application--form, form[action*='greenhouse.io']")));
}

function fieldElement(
  field: FormFieldObservation,
  root: ProviderFormRoot,
): HTMLInputElement | null {
  if (field.id) {
    const element = root.querySelector<HTMLInputElement>(`#${CSS.escape(field.id)}`);
    if (element) return element;
  }
  return field.name
    ? root.querySelector<HTMLInputElement>(`input[name='${CSS.escape(field.name)}']`)
    : null;
}

export function adaptGreenhouseFormFields(
  fields: FormFieldObservation[],
  root: ProviderFormRoot,
): FormFieldObservation[] {
  return fields.map((field) => {
    const element = fieldElement(field, root);
    if (field.type === "checkbox" && /^question_/.test(field.name || "") && /\[\]$/.test(field.name || "")) {
      return { ...field, type: "radio" as const };
    }
    if (!element) return field;
    const options = field.options.length > 0
      ? field.options
      : questionOptions(element).length > 0
        ? questionOptions(element)
        : inferredChoiceOptions(element);
    return isGreenhouseLocation(element)
      ? { ...field, type: "select" as const, options }
      : options.length > 0 ? { ...field, options } : field;
  });
}
