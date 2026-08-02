import type {
  FormFieldObservation,
  FormFieldType,
  FormInspection,
  FormPlatform,
} from "../../shared/contracts/form-inspection";

const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image'])",
  "select",
  "textarea",
].join(", ");
export type FormScope = Document | HTMLElement | ShadowRoot;
type QueryScope = FormScope | ShadowRoot;

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cleanLabel(value: string): string {
  return cleanText(value).replace(/\s*(?:Required|必填|\*)\s*$/gi, "").trim();
}

export function isVisibleElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function isInspectableControl(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  return !element.disabled && element.getAttribute("aria-disabled") !== "true";
}

function isDocumentSelectionRadio(element: HTMLInputElement): boolean {
  return (
    element.type.toLowerCase() === "radio" &&
    (element.id.startsWith("jobsDocumentCardToggle") || Boolean(element.closest(".jobs-document-upload-redesign-card")))
  );
}

function fieldType(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FormFieldType {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  const type = element.type.toLowerCase();
  if (type === "text" || type === "search") return "text";
  if (type === "checkbox" || type === "radio" || type === "file") return type;
  if (["number", "email", "tel", "url", "date", "password"].includes(type)) return type as FormFieldType;
  return "unknown";
}

function scopeFor(element: HTMLElement, fallback: FormScope): QueryScope {
  const root = element.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot ? root : fallback;
}

function optionLabelFor(element: HTMLElement, scope: QueryScope): string {
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return cleanLabel(ariaLabel);

  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return cleanLabel(text);
  }

  const parentLabel = cleanText(element.closest("label")?.textContent);
  if (parentTextIsDistinct(parentLabel, element)) return cleanLabel(parentLabel);

  if (element instanceof HTMLInputElement && element.value) return cleanText(element.value);
  return "Option";
}

function parentTextIsDistinct(text: string | null | undefined, element: HTMLElement): boolean {
  if (!text) return false;
  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend && text === legend) return false;
  return true;
}

function labelFor(element: HTMLElement, scope: QueryScope): string {
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio") {
    const fieldset = element.closest("fieldset");
    const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
    if (legend) return cleanLabel(legend);
  }

  const labelledBy = cleanText(element.getAttribute("aria-label"));
  if (labelledBy) return cleanLabel(labelledBy);

  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return cleanLabel(text);
  }

  const parentLabel = element.closest("label");
  const parentText = cleanText(parentLabel?.textContent);
  if (parentText) return cleanLabel(parentText);

  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend) return cleanLabel(legend);

  const placeholder = cleanText(element.getAttribute("placeholder"));
  if (placeholder) return cleanLabel(placeholder);
  return cleanLabel(element.getAttribute("name") || "") || "Unnamed field";
}

function requiredFor(element: HTMLElement): boolean {
  if (element.hasAttribute("required") || element.getAttribute("aria-required") === "true") return true;
  const fieldset = element.closest("fieldset");
  return Boolean(fieldset?.hasAttribute("required") || fieldset?.getAttribute("aria-required") === "true");
}

function optionsFor(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  scope: QueryScope,
): Array<{ label: string; value: string }> {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).map((option) => ({
      label: cleanText(option.textContent) || option.value,
      value: option.value,
    }));
  }
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio" && element.name) {
    return Array.from(scope.querySelectorAll<HTMLInputElement>(`input[type='radio'][name='${CSS.escape(element.name)}']`)).map((radio) => ({
      label: optionLabelFor(radio, scope),
      value: radio.value,
    }));
  }
  return [];
}

function currentValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, type: FormFieldType, scope: QueryScope): string | undefined {
  if (type === "password" || type === "file") return undefined;
  if (element instanceof HTMLInputElement && type === "radio" && element.name) {
    const group = Array.from(scope.querySelectorAll<HTMLInputElement>(`input[type='radio'][name='${CSS.escape(element.name)}']`));
    const checkedRadio = group.find((r) => r.checked);
    if (!checkedRadio) return "";
    return optionLabelFor(checkedRadio, scope) || checkedRadio.value || "true";
  }
  if (element instanceof HTMLInputElement && type === "checkbox") {
    return element.checked ? element.value || "true" : "";
  }
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.selectedOptions).map((option) => cleanText(option.textContent)).join(", ");
  }
  return cleanText(element.value);
}

function isFilled(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, type: FormFieldType, scope: QueryScope): boolean {
  if (type === "file") return Boolean(element instanceof HTMLInputElement && element.files?.length);
  if (element instanceof HTMLInputElement && type === "radio" && element.name) {
    const group = Array.from(scope.querySelectorAll<HTMLInputElement>(`input[type='radio'][name='${CSS.escape(element.name)}']`));
    return group.some((r) => r.checked);
  }
  if (element instanceof HTMLInputElement && type === "checkbox") return element.checked;
  return Boolean(currentValue(element, type, scope));
}

function fileUploadLabelFor(element: HTMLInputElement, scope: FormScope): string {
  const root = scopeFor(element, scope);
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const controller = element.id
    ? root.querySelector<HTMLElement>(`[aria-controls='${CSS.escape(element.id)}']`)
    : null;
  const text = cleanText(
    explicitLabel?.textContent ||
      controller?.getAttribute("aria-label") ||
      controller?.textContent ||
      element.getAttribute("aria-label") ||
      element.getAttribute("name"),
  );
  if (/upload\s+resume|resume\s+upload/i.test(text)) return "Resume";
  if (/upload\s+(?:cv|cover\s+letter)/i.test(text)) return cleanLabel(text.replace(/^upload\s+/i, ""));
  return cleanLabel(text) || "Upload file";
}

function selectedDocumentFor(
  element: HTMLInputElement,
  scope: FormScope,
): { name: string; accepted: boolean } | undefined {
  const root = scopeFor(element, scope);
  const selectedLabel = Array.from(root.querySelectorAll<HTMLLabelElement>(".jobs-document-upload-redesign-card__toggle-label"))
    .find((label) => /^deselect\s+(?:resume|cv|cover\s+letter)\s+/i.test(cleanText(label.textContent)));
  if (!selectedLabel) return undefined;
  const name = cleanText(selectedLabel.textContent)
    .replace(/^deselect\s+(?:resume|cv|cover\s+letter)\s+/i, "")
    .trim();
  if (!name) return undefined;
  const cardText = cleanText(selectedLabel.closest(".jobs-document-upload-redesign-card")?.textContent);
  return { name, accepted: !/\b0\s*B\b/i.test(cardText) };
}

function documentOptionsFor(element: HTMLInputElement, scope: FormScope): Array<{ label: string; value: string }> {
  const root = scopeFor(element, scope);
  return Array.from(root.querySelectorAll<HTMLLabelElement>(".jobs-document-upload-redesign-card__toggle-label"))
    .map((label) => {
      const text = cleanText(label.textContent);
      const match = text.match(/^(?:deselect|select)\s+(?:resume|cv|cover\s+letter)\s+(.+)$/i);
      const value = cleanText(label.htmlFor);
      return match?.[1] && value ? { label: match[1].trim(), value } : null;
    })
    .filter((option): option is { label: string; value: string } => Boolean(option));
}

function fileRequiredFor(element: HTMLInputElement, scope: FormScope): boolean {
  if (requiredFor(element)) return true;
  const root = scopeFor(element, scope);
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const nearbyText = cleanText(explicitLabel?.closest("fieldset, section, div")?.textContent);
  return /\*\s*$/.test(cleanText(explicitLabel?.textContent)) || /\bresume\b[\s\S]{0,180}\*/i.test(nearbyText);
}

function isPresentedFileInput(element: HTMLInputElement, scope: FormScope): boolean {
  if (isVisibleElement(element)) return true;

  const root = scopeFor(element, scope);
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  if (explicitLabel && isVisibleElement(explicitLabel)) return true;

  const controller = element.id
    ? root.querySelector<HTMLElement>(`[aria-controls='${CSS.escape(element.id)}']`)
    : null;
  if (controller && isVisibleElement(controller)) return true;

  // Native file inputs are often visually hidden by design. Treat them as a
  // real field only when their visible uploader UI is present in the same
  // component. This filters LinkedIn's dormant global attachment inputs.
  const uploader = element.closest<HTMLElement>(
    "[class*='file-upload' i], [class*='upload' i], [data-testid*='upload' i]",
  );
  if (!uploader || !isVisibleElement(uploader)) return false;
  return Array.from(uploader.querySelectorAll<HTMLElement>("button, [role='button'], label"))
    .some((control) => isVisibleElement(control));
}

export function elementsInScope(scope: FormScope): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const visitedRoots = new Set<Document | HTMLElement | ShadowRoot>();

  const visit = (root: Document | HTMLElement | ShadowRoot) => {
    if (visitedRoots.has(root)) return;
    visitedRoots.add(root);
    const descendants = Array.from(root.querySelectorAll<HTMLElement>("*"));
    elements.push(...descendants);
    descendants.forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };

  visit(scope);
  return elements;
}

export function controlsInScope(scope: FormScope): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  return elementsInScope(scope).filter(
    (element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      element.matches(CONTROL_SELECTOR),
  );
}

export function visibleControlsInScope(scope: FormScope): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  return controlsInScope(scope).filter((element) => isVisibleElement(element) && isInspectableControl(element));
}

export function fieldKeyFor(element: HTMLElement, index: number): string {
  return cleanText(element.id) || cleanText(element.getAttribute("name")) || `field-${index + 1}`;
}

export function inspectVisibleFormFields(scope: FormScope = document): FormFieldObservation[] {
  const visibleControls = visibleControlsInScope(scope);
  const seenRadioNames = new Set<string>();
  const result: FormFieldObservation[] = [];

  for (let index = 0; index < visibleControls.length && result.length < 200; index += 1) {
    const element = visibleControls[index];
    if (!element) continue;
    const type = fieldType(element);

    if (element instanceof HTMLInputElement && isDocumentSelectionRadio(element)) continue;

    if (type === "radio" && element instanceof HTMLInputElement && element.name) {
      if (seenRadioNames.has(element.name)) continue;
      seenRadioNames.add(element.name);
    }

    const elementScope = scopeFor(element, scope);
    const val = currentValue(element, type, elementScope);
    result.push({
      key: fieldKeyFor(element, index),
      id: cleanText(element.id) || undefined,
      name: cleanText(element.getAttribute("name")) || undefined,
      type,
      label: labelFor(element, elementScope),
      required: requiredFor(element),
      filled: isFilled(element, type, elementScope),
      sensitive: type === "password" || type === "file",
      options: optionsFor(element, elementScope),
      ...(val ? { currentValue: val } : {}),
    });
  }

  const keys = new Set(result.map((field) => field.key));
  const fileInputs = elementsInScope(scope).filter(
    (element): element is HTMLInputElement => element instanceof HTMLInputElement && element.type.toLowerCase() === "file",
  );
  for (let index = 0; index < fileInputs.length && result.length < 200; index += 1) {
    const input = fileInputs[index];
    if (!input || input.disabled || input.getAttribute("aria-disabled") === "true") continue;
    if (!isPresentedFileInput(input, scope)) continue;
    const key = fieldKeyFor(input, visibleControls.length + index);
    if (keys.has(key)) continue;
    const selectedDocument = selectedDocumentFor(input, scope);
    const selectedFile = input.files?.[0];
    result.push({
      key,
      id: cleanText(input.id) || undefined,
      name: cleanText(input.getAttribute("name")) || undefined,
      type: "file",
      label: fileUploadLabelFor(input, scope),
      required: fileRequiredFor(input, scope),
      filled: Boolean((selectedFile && selectedFile.size > 0) || selectedDocument?.accepted),
      sensitive: true,
      options: documentOptionsFor(input, scope),
      ...(selectedDocument ? { currentValue: selectedDocument.name } : {}),
    });
  }

  return result;
}

export function readApplicationForm(
  url: string,
  platform: FormPlatform,
  isApplicationPage: boolean,
  submitLabel?: string,
  scope: FormScope | null = document,
  action?: "next" | "submit",
  canGoBack = false,
): FormInspection {
  const fields = scope ? inspectVisibleFormFields(scope) : [];
  // Some application steps are review/confirmation screens: they have a
  // valid application container and a Next/Back action, but no editable
  // controls at all. Keep them actionable instead of classifying them as
  // "not a form" and disabling the step controls.
  if (!isApplicationPage) {
    return {
      kind: "not_application_form",
      platform,
      url,
      reason: `No visible ${platform === "linkedin" ? "LinkedIn" : platform === "seek" ? "SEEK" : "application"} form was found.`,
    };
  }
  return {
    kind: "application_form",
    platform,
    url,
    fields,
    hasSubmitAction: Boolean(submitLabel),
    canGoBack,
    ...(submitLabel ? { submitLabel } : {}),
    ...(action ? { action } : {}),
  };
}

export function readPageInputFields(url: string, platform: FormPlatform): FormInspection | null {
  const fields = inspectVisibleFormFields(document);
  if (fields.length === 0) return null;
  return {
    kind: "page_input_fields",
    platform,
    url,
    fields,
  };
}

export function readSeekForm(
  url: string,
  isApplicationPage: boolean,
  submitLabel?: string,
  action?: "next" | "submit",
  canGoBack = false,
): FormInspection {
  return readApplicationForm(url, "seek", isApplicationPage, submitLabel, document, action, canGoBack);
}
