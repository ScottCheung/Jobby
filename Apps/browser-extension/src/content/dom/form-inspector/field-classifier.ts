import type {
  FileUploadObservation,
  FormFieldType,
} from "../../../shared/contracts/form-inspection";
import {
  BUTTON_CHOICE_VALUE,
  cleanLabel,
  cleanText,
  closestComposed,
  composedParent,
  isLikelyHelperText,
  isVisibleElement,
  labelTextWithoutControl,
  queryAllInScope,
  scopeFor,
  type FormScope,
  type QueryScope,
} from "./visibility";
import {
  comboboxCurrentValue,
  comboboxOptionsFor,
  isPlaceholderOption,
  isSelectableCombobox,
  optionLabelFor,
  smartRecruitersAutocompleteIsCommitted,
  type FormOption,
} from "./option-reader";
import {
  containerLabelFor,
  labelFor,
  labelledByText,
  precedingQuestionLabel,
  requiredFor,
} from "./label-resolver";

export function checkboxPresentationElements(
  element: HTMLInputElement,
  scope: FormScope,
): HTMLElement[] {
  const root = scopeFor(element, scope);
  const elements = new Set<HTMLElement>();
  const add = (candidate: HTMLElement | null | undefined) => {
    if (candidate) elements.add(candidate);
  };

  add(element);
  if (element.id) {
    add(root.querySelector<HTMLElement>(`label[for='${CSS.escape(element.id)}']`));
    add(root.querySelector<HTMLElement>(`[aria-controls='${CSS.escape(element.id)}']`));
  }
  const parentLabel = element.closest<HTMLElement>("label");
  add(parentLabel);
  add(parentLabel?.querySelector<HTMLElement>(".jobs-easy-apply-checkbox__label"));
  add(parentLabel?.querySelector<HTMLElement>(".jobs-easy-apply-checkbox__indicator"));
  add(element.closest<HTMLElement>(".jobs-easy-apply-checkbox"));
  add(element.closest<HTMLElement>("[class*='checkbox' i]"));
  add(element.closest<HTMLElement>("[data-testid*='checkbox' i]"));
  return Array.from(elements).filter(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement && isVisibleElement(candidate),
  );
}

export function checkboxIsChecked(
  element: HTMLInputElement,
  scope: FormScope,
): boolean {
  if (element.checked) return true;
  const presentations = checkboxPresentationElements(element, scope);
  return presentations.some(
    (candidate) =>
      candidate.getAttribute("aria-checked") === "true" ||
      candidate.getAttribute("data-state") === "checked" ||
      candidate.classList.contains("checked") ||
      candidate.classList.contains("selected"),
  );
}

export function ariaCheckboxElementsInScope(scope: FormScope): HTMLElement[] {
  const elements = queryAllInScope<HTMLElement>(scope, "[role='checkbox']");
  return elements.filter((element) => {
    if (
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    return isVisibleElement(element);
  });
}

export function ariaCheckboxLabel(element: HTMLElement, scope: FormScope): string {
  const labelledBy = cleanText(element.getAttribute("aria-labelledby"))
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => cleanText(scope.querySelector(`#${CSS.escape(id)}`)?.textContent))
    .filter(Boolean)
    .join(" ");
  return cleanLabel(
    cleanText(
      labelledBy ||
        element.getAttribute("aria-label") ||
        labelTextWithoutControl(element.closest("label")) ||
        containerLabelFor(element) ||
        element.getAttribute("name") ||
        element.id,
    ) || "Unnamed field",
  );
}

export function ariaCheckboxIsChecked(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-checked") === "true" ||
    element.getAttribute("data-state") === "checked" ||
    element.classList.contains("checked") ||
    element.classList.contains("selected")
  );
}

export function isDocumentSelectionRadio(element: HTMLInputElement): boolean {
  if (element.type.toLowerCase() !== "radio") return false;
  if (
    element.id.startsWith("jobsDocumentCardToggle") ||
    Boolean(element.closest(".jobs-document-upload-redesign-card"))
  ) {
    return true;
  }
  const name = cleanText(element.getAttribute("name")).toLowerCase();
  const id = cleanText(element.id).toLowerCase();
  const value = cleanText(element.value).toLowerCase();
  if (
    /(?:resume|cv)[-_]?option/i.test(name) ||
    /(?:resume|cv)[-_]?(?:upload|profile|stored|select)/i.test(id) ||
    /(?:resume|cv)[-_]?(?:upload|profile|stored|select)/i.test(value)
  ) {
    return true;
  }

  const container = element.closest<HTMLElement>(
    "fieldset, [role='radiogroup'], section, div",
  );
  const heading = cleanText(
    container?.querySelector("legend, h1, h2, h3, h4, [role='heading']")?.textContent,
  );
  if (/^(?:resume|curriculum vitae|cv|简历|履历)$/i.test(heading)) {
    const hasUploadOption = Boolean(
      container?.querySelector("input[type='file']") ||
        /(?:upload|stored|profile|上传)/i.test(cleanText(container?.textContent)),
    );
    if (hasUploadOption) return true;
  }

  return false;
}

export function radioGroupForElement(
  element: HTMLInputElement,
  scope: QueryScope = document,
): HTMLInputElement[] {
  if (element.name) {
    const namedGroup = Array.from(
      scope.querySelectorAll<HTMLInputElement>(
        `input[type='radio'][name='${CSS.escape(element.name)}']`,
      ),
    );
    if (namedGroup.length > 0) return namedGroup;
  }

  let container = element.parentElement;
  for (let depth = 0; container && depth < 8; depth += 1) {
    const containerRadios = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type='radio']"),
    );
    if (containerRadios.length >= 2) return containerRadios;
    container = container.parentElement;
  }
  return [element];
}

export function fieldType(element: HTMLElement): FormFieldType {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element.getAttribute("role") === "combobox" || isSelectableCombobox(element))
    return "select";
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    // JobAdder validates telephone fields with `data-val-phone` while
    // rendering them as type=text. Keep their actual semantic type.
    if (type === "text" && element.hasAttribute("data-val-phone")) return "tel";
    if (type === "text" || type === "search") return "text";
    if (type === "checkbox" || type === "radio" || type === "file") return type;
    if (["number", "email", "tel", "url", "date", "password"].includes(type))
      return type as FormFieldType;
  }
  return "unknown";
}

export function optionsFor(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  scope: QueryScope,
): FormOption[] {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options)
      .map((option) => ({
        label: cleanText(option.textContent) || option.value,
        value: option.value,
      }))
      .filter((option) => !isPlaceholderOption(option.label, option.value));
  }
  if (element instanceof HTMLInputElement && isSelectableCombobox(element)) {
    return comboboxOptionsFor(element, scope);
  }
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio") {
    return radioGroupForElement(element, scope).map((radio) => ({
      label: optionLabelFor(radio, scope),
      value: radio.value,
    }));
  }
  return [];
}

export function currentValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  type: FormFieldType,
  scope: QueryScope,
): string | undefined {
  if (type === "password" || type === "file") return undefined;
  if (element instanceof HTMLInputElement && type === "radio") {
    const group = radioGroupForElement(element, scope);
    const checkedRadio = group.find((r) => r.checked);
    if (!checkedRadio) return "";
    return optionLabelFor(checkedRadio, scope) || checkedRadio.value || "true";
  }
  if (element instanceof HTMLInputElement && type === "checkbox") {
    return checkboxIsChecked(element, scope) ? element.value || "true" : "";
  }
  if (element.getAttribute("role") === "combobox" || isSelectableCombobox(element)) {
    return comboboxCurrentValue(element);
  }
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.selectedOptions)
      .filter((option) => !isPlaceholderOption(option.textContent || "", option.value))
      .map((option) => cleanText(option.textContent) || cleanText(option.value))
      .filter(Boolean)
      .join(", ");
  }
  return cleanText((element as HTMLInputElement).value);
}

export function isFilled(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  type: FormFieldType,
  scope: QueryScope,
): boolean {
  if (type === "file")
    return Boolean(element instanceof HTMLInputElement && element.files?.length);
  // Password values must never be included in the inspection payload, but
  // their presence is safe to use for the side-panel completion indicator.
  if (type === "password")
    return Boolean(element instanceof HTMLInputElement && element.value);
  if (element instanceof HTMLInputElement && type === "radio") {
    const group = radioGroupForElement(element, scope);
    return group.some((r) => r.checked);
  }
  if (element instanceof HTMLInputElement && type === "checkbox")
    return checkboxIsChecked(element, scope);
  if (type === "select" && smartRecruitersAutocompleteIsCommitted(element) === false)
    return false;
  return Boolean(currentValue(element, type, scope));
}

export function fileUploadGroupFor(element: HTMLInputElement): HTMLElement | null {
  return closestComposed(
    element,
    [
      "[role='group'][aria-labelledby]",
      ".file-upload",
      "[class*='file-upload' i]",
      "[data-test='resume-upload-container']",
      "[data-test='resume-upload']",
      "[data-testid*='resume-upload' i]",
    ].join(", "),
  );
}

export function composedUploadAttributeHint(element: HTMLInputElement): string {
  let candidate: HTMLElement | null = element;
  for (let depth = 0; candidate && depth < 24; depth += 1) {
    for (const attribute of ["data-test", "data-testid", "data-sr-id", "id", "name"]) {
      const hint = labelFromAttribute(candidate.getAttribute(attribute));
      if (hint) return hint;
    }
    candidate = composedParent(candidate);
  }
  return "";
}

export function composedUploadContainer(element: HTMLInputElement): HTMLElement | null {
  return closestComposed(
    element,
    [
      "[data-test='resume-upload-container']",
      "[data-testid*='resume-upload' i]",
      "[data-testid*='cover-letter' i]",
      "[data-test*='document-upload' i]",
      "section",
      "fieldset",
    ].join(", "),
  );
}

export function semanticFileKey(element: HTMLInputElement): string {
  let candidate: HTMLElement | null = element;
  for (let depth = 0; candidate && depth < 24; depth += 1) {
    for (const attribute of ["data-test", "data-testid", "data-sr-id"]) {
      const value = cleanText(candidate.getAttribute(attribute));
      if (!value || !/(?:resume|cv|cover|document|attachment|upload)/i.test(value)) continue;
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
      if (slug) return `file-${slug}`;
    }
    candidate = composedParent(candidate);
  }
  return "";
}

export function isUploadHelperText(text: string): boolean {
  const cleaned = cleanText(text).toLowerCase();
  if (!cleaned) return true;
  return (
    /^(?:total\s+\d+|drop\s+or\s+select|drag\s+and\s+drop|no\s+file|browse|choose\s+file|select\s+file)/i.test(
      cleaned,
    ) ||
    /\b(?:file|files)\s+selected\b/i.test(cleaned) ||
    /^(?:\.pdf|\.doc|\.docx|pdf|doc|docx)$/i.test(cleaned)
  );
}

export function labelledByTextFrom(
  element: HTMLElement | null | undefined,
  root: QueryScope,
): string {
  if (!element) return "";
  const ids = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
  if (ids.length === 0) return "";
  const parts = ids
    .map((id) => {
      const target = root.querySelector(`#${CSS.escape(id)}`);
      if (!target) return "";
      if (
        target.matches(
          "[data-testid*='screen-reader' i], [class*='screen-reader' i], [class*='sr-only' i]",
        )
      )
        return "";
      const txt = cleanText(target.textContent);
      if (isUploadHelperText(txt)) return "";
      return txt;
    })
    .filter(Boolean);
  return cleanText(parts.join(" "));
}

export function labelFromAttribute(val: string | null | undefined): string {
  const cleaned = cleanText(val);
  if (!cleaned) return "";
  if (/cover[-_\s]*letter|cover/i.test(cleaned)) return "Cover Letter";
  if (/resume|cv/i.test(cleaned)) return "Resume";
  if (/portfolio|works|projects/i.test(cleaned)) return "Portfolio";
  if (/transcript|degree|education/i.test(cleaned)) return "Transcript";
  return "";
}

export function fileUploadLabelFor(element: HTMLInputElement, scope: FormScope): string {
  const root = scopeFor(element, scope);
  const uploadGroup = fileUploadGroupFor(element);
  const composedAttributeHint = composedUploadAttributeHint(element);
  const composedContainer = composedUploadContainer(element);
  const composedHeading = cleanText(
    composedContainer?.querySelector<HTMLElement>(
      "[data-test='section-title'], h1, h2, h3, h4, legend, label",
    )?.textContent,
  );
  if (/resume|curriculum vitae|\bcv\b|简历|履历/i.test(composedHeading)) {
    return "Resume";
  }
  if (
    /cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/i.test(
      composedHeading,
    )
  ) {
    return "Cover Letter";
  }
  const groupLabel = uploadGroup ? labelledByText(uploadGroup, root) : "";
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const parentLabel = element.closest<HTMLLabelElement>("label");
  const controller = element.id
    ? root.querySelector<HTMLElement>(`[aria-controls='${CSS.escape(element.id)}']`)
    : null;
  const structuralLabel =
    containerLabelFor(element) || precedingQuestionLabel(element);

  const ariaLabelledByText =
    labelledByTextFrom(element, root) || labelledByTextFrom(parentLabel, root);

  const containerText = (() => {
    const parent =
      element.closest<HTMLElement>(
        "div[data-testid='field'], [class*='field' i], section, fieldset, [class*='upload' i], [class*='file' i], [class*='drop' i]",
      ) || element.parentElement?.parentElement;
    if (!parent) return "";
    const directHeading = parent.querySelector<HTMLElement>(
      "h1, h2, h3, h4, h5, legend, label",
    );
    if (directHeading) {
      const txt = cleanLabel(labelTextWithoutControl(directHeading));
      if (txt.length >= 2 && txt.length <= 100 && !isUploadHelperText(txt)) return txt;
    }
    const txt = cleanLabel(labelTextWithoutControl(parent));
    return txt.length >= 2 && txt.length <= 100 && !isUploadHelperText(txt) ? txt : "";
  })();

  const nearbyButtonText = (() => {
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1) {
      const btn = parent.querySelector<HTMLElement>(
        "button, [role='button'], label, a, .btn, [class*='btn' i]",
      );
      if (btn && isVisibleElement(btn)) {
        const btnText = cleanLabel(labelTextWithoutControl(btn));
        if (btnText && !isUploadHelperText(btnText)) return btnText;
      }
      parent = parent.parentElement;
    }
    return "";
  })();

  const attributeHint =
    composedAttributeHint ||
    labelFromAttribute(element.id) ||
    labelFromAttribute(element.name) ||
    labelFromAttribute(element.getAttribute("data-testid")) ||
    labelFromAttribute(parentLabel?.getAttribute("data-testid")) ||
    labelFromAttribute(parentLabel?.id);

  const candidates = [
    groupLabel,
    ariaLabelledByText,
    explicitLabel?.textContent,
    labelTextWithoutControl(parentLabel),
    nearbyButtonText,
    controller?.getAttribute("aria-label"),
    controller?.textContent,
    element.getAttribute("aria-label"),
    structuralLabel,
    containerText,
    attributeHint,
    element.getAttribute("name"),
  ]
    .map((str) => cleanText(str))
    .filter((str) => str && !isUploadHelperText(str));

  const text = candidates[0] || "";

  if (/resume|curriculum vitae|\bcv\b|履历|简历/i.test(text)) return "Resume";
  if (/cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/i.test(text))
    return "Cover Letter";
  if (text) return cleanLabel(text);

  if (attributeHint) return attributeHint;

  const allFileInputs = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='file']"));
  const inputIndex = allFileInputs.indexOf(element);
  if (inputIndex > 0) {
    return "Cover Letter";
  }
  return "Resume";
}

export function selectedDocumentFor(
  element: HTMLInputElement,
  scope: FormScope,
): { name: string; accepted: boolean } | undefined {
  const root = scopeFor(element, scope);
  const selectedLabel = Array.from(
    root.querySelectorAll<HTMLLabelElement>(
      ".jobs-document-upload-redesign-card__toggle-label",
    ),
  ).find((label) =>
    /^deselect\s+(?:resume|cv|cover\s+letter)\s+/i.test(cleanText(label.textContent)),
  );
  if (!selectedLabel) return undefined;
  const name = cleanText(selectedLabel.textContent)
    .replace(/^deselect\s+(?:resume|cv|cover\s+letter)\s+/i, "")
    .trim();
  if (!name) return undefined;
  const cardText = cleanText(
    selectedLabel.closest(".jobs-document-upload-redesign-card")?.textContent,
  );
  return { name, accepted: !/\b0\s*B\b/i.test(cardText) };
}

export function uploadErrorFor(element: HTMLInputElement, scope: FormScope): string {
  const root = scopeFor(element, scope);
  const uploader =
    fileUploadGroupFor(element) || element.closest<HTMLElement>("fieldset, section, div");
  const ids = [
    cleanText(element.getAttribute("aria-errormessage")),
    element.id ? `${element.id}-error` : "",
  ].filter(Boolean);
  const directError = ids
    .map((id) => cleanText(root.querySelector(`#${CSS.escape(id)}`)?.textContent))
    .find(Boolean);
  if (directError) return directError;

  return (
    Array.from(
      uploader?.querySelectorAll<HTMLElement>(
        "[role='alert'], [aria-live='assertive'], [id$='-error'], .error, .errors",
      ) || [],
    )
      .map((candidate) => cleanText(candidate.textContent))
      .find(Boolean) || ""
  );
}

export function uploadObservationFor(
  element: HTMLInputElement,
  scope: FormScope,
  selectedDocument?: { name: string; accepted: boolean },
): FileUploadObservation {
  const error = uploadErrorFor(element, scope);
  if (error) return { state: "rejected", detail: error };

  const selectedFile = element.files?.[0];
  if (selectedFile?.size) return { state: "ready", filename: selectedFile.name };
  if (selectedDocument?.accepted)
    return { state: "ready", filename: selectedDocument.name };
  if (selectedDocument) {
    return {
      state: "rejected",
      filename: selectedDocument.name,
      detail: "The selected document is empty or was rejected by the webpage.",
    };
  }
  return { state: "empty" };
}

export function documentOptionsFor(
  element: HTMLInputElement,
  scope: FormScope,
): Array<{ label: string; value: string }> {
  const root = scopeFor(element, scope);
  return Array.from(
    root.querySelectorAll<HTMLLabelElement>(
      ".jobs-document-upload-redesign-card__toggle-label",
    ),
  )
    .map((label) => {
      const text = cleanText(label.textContent);
      const match = text.match(
        /^(?:deselect|select)\s+(?:resume|cv|cover\s+letter)\s+(.+)$/i,
      );
      const value = cleanText(label.htmlFor);
      return match?.[1] && value ? { label: match[1].trim(), value } : null;
    })
    .filter((option): option is { label: string; value: string } => Boolean(option));
}

export function fileRequiredFor(element: HTMLInputElement, scope: FormScope): boolean {
  if (requiredFor(element)) return true;
  const composedContainer = composedUploadContainer(element);
  if (
    composedContainer?.querySelector(
      "[data-test='section-required-mark'], [data-testid*='required-mark' i]",
    )
  ) {
    return true;
  }
  const composedText = cleanText(composedContainer?.textContent);
  if (/(?:resume|curriculum vitae|\bcv\b|cover\s*letter)[\s\S]{0,80}\*/i.test(composedText)) {
    return true;
  }
  const root = scopeFor(element, scope);
  const uploadGroup = fileUploadGroupFor(element);
  if (
    uploadGroup?.getAttribute("aria-required") === "true" ||
    uploadGroup?.hasAttribute("required")
  )
    return true;
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const nearbyText = cleanText(explicitLabel?.closest("fieldset, section, div")?.textContent);
  return (
    /\*\s*$/.test(cleanText(explicitLabel?.textContent)) ||
    /\bresume\b[\s\S]{0,180}\*/i.test(nearbyText)
  );
}

export function isPresentedFileInput(element: HTMLInputElement, scope: FormScope): boolean {
  if (isAutofillResumeInput(element)) return false;
  if (isVisibleElement(element)) return true;

  const root = scopeFor(element, scope);
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  if (explicitLabel && isVisibleElement(explicitLabel)) return true;

  const parentLabel = element.closest<HTMLElement>("label");
  if (parentLabel && isVisibleElement(parentLabel)) return true;

  const composedUploader = closestComposed(
    element,
    "[data-test='resume-upload'], [data-test='resume-upload-container'], [data-testid*='resume-upload' i], [data-testid*='cover-letter' i]",
  );
  if (composedUploader && isVisibleElement(composedUploader)) return true;

  const fieldContainer = element.closest<HTMLElement>(
    "[data-testid='field'], [data-testid*='field' i]",
  );
  if (fieldContainer && isVisibleElement(fieldContainer)) return true;

  const controller = element.id
    ? root.querySelector<HTMLElement>(`[aria-controls='${CSS.escape(element.id)}']`)
    : null;
  if (controller && isVisibleElement(controller)) return true;

  const dropZone = element.closest<HTMLElement>("[role='button'], button, label");
  if (dropZone) {
    const acceptsDocument = /(?:\.pdf|\.docx|\.doc|application\/pdf|wordprocessingml)/i.test(
      element.accept || "",
    );
    if (isVisibleElement(dropZone) || acceptsDocument) return true;
  }

  const uploader = element.closest<HTMLElement>(
    [
      "[class*='file-upload' i]",
      "[class*='upload' i]",
      "[data-testid*='upload' i]",
      "[data-testid*='cover' i]",
      "[data-testid*='resume' i]",
      "[data-testid*='letter' i]",
      "[data-testid*='file' i]",
      "[class*='document' i]",
      "[data-test-document-upload]",
      ".jobs-document-upload",
      ".jobs-document-upload-redesign-card",
      ".jobs-easy-apply-form-element",
      ".fb-dash-form-element",
      "[data-test-form-element]",
    ].join(", "),
  );
  if (uploader && isVisibleElement(uploader)) {
    const controls = Array.from(
      uploader.querySelectorAll<HTMLElement>(
        "button, [role='button'], label, input, a, span, div",
      ),
    );
    if (controls.some((control) => isVisibleElement(control))) return true;
  }

  let parent = element.parentElement;
  for (let depth = 0; parent && depth < 6; depth += 1) {
    if (parent.matches("body, html")) break;
    if (isVisibleElement(parent)) {
      const controls = Array.from(
        parent.querySelectorAll<HTMLElement>(
          "button, [role='button'], label, a, [class*='btn' i], input",
        ),
      );
      const hasVisibleControl = controls.some((c) => isVisibleElement(c));
      const text = cleanText(parent.textContent).toLowerCase();
      const hasUploadIntent =
        /(?:resume|cv|upload|file|attach|choose|browse|document|cover|apply|简历|履历|求职)/i.test(
          text,
        );
      if (hasVisibleControl && hasUploadIntent) {
        return true;
      }
      const acceptsDocument =
        /(?:\.pdf|\.docx|\.doc|application\/pdf|wordprocessingml)/i.test(
          element.accept || "",
        );
      if (acceptsDocument && hasVisibleControl) {
        return true;
      }
    }
    parent = parent.parentElement;
  }

  return false;
}

export function isAutofillResumeInput(element: HTMLInputElement): boolean {
  if (
    closestComposed(
      element,
      "spl-dropzone[data-test='apply-with-resume-container'], oc-apply-with-resume, .ashby-application-form-autofill-input-root, .ashby-application-form-autofill-pane",
    )
  ) {
    return true;
  }
  // Dover keeps both file inputs in one <form>. Looking beyond the input's
  // own drop zone makes the required Resume field inherit the text from the
  // separate top-level "Autofill from resume" helper and get filtered out.
  const dropZone = element.closest<HTMLElement>("[role='button']");
  return Boolean(
    dropZone && /autofill from resume/i.test(cleanText(dropZone.textContent)),
  );
}

export function fieldKeyFor(
  element: HTMLElement,
  index: number,
  scope?: FormScope,
): string {
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "file") {
    const semanticKey = semanticFileKey(element);
    if (semanticKey) return semanticKey;
  }
  if (
    element instanceof HTMLInputElement &&
    element.type.toLowerCase() === "radio" &&
    /^questionnaire\.indirect_/i.test(cleanText(element.getAttribute("name")))
  ) {
    return cleanText(element.getAttribute("name"));
  }
  const explicit = cleanText(element.id) || cleanText(element.getAttribute("name"));
  if (explicit) return explicit;
  const label = cleanText(labelFor(element, scope || document));
  if (label && label !== "Unnamed field") {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    if (slug) return `field-${slug}`;
  }
  return `field-${index + 1}`;
}

export type CheckboxChoiceGroup = {
  container: HTMLElement;
  groupKey: string;
  name: string;
  label: string;
  type: "checkbox" | "radio";
  required: boolean;
  options: HTMLInputElement[];
};

export function checkboxChoiceGroupFor(
  element: HTMLInputElement,
): CheckboxChoiceGroup | null {
  if (element.type.toLowerCase() !== "checkbox") return null;
  const fieldset = element.closest<HTMLElement>("fieldset");
  if (!fieldset) return null;
  const options = Array.from(
    fieldset.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
  ).filter((candidate) => isVisibleElement(candidate));
  const label = cleanLabel(cleanText(fieldset.querySelector("legend")?.textContent));
  if (options.length < 2 || !label) return null;
  const names = Array.from(
    new Set(options.map((option) => cleanText(option.name)).filter(Boolean)),
  );
  const name = names.length === 1 ? names[0] || "" : "";
  const greenhouseSingleChoice = name.startsWith("question_") && name.endsWith("[]");
  const groupKey =
    cleanText(fieldset.id) ||
    name ||
    `checkbox-group-${cleanText(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return {
    container: fieldset,
    groupKey,
    name,
    label,
    type: greenhouseSingleChoice ? "radio" : "checkbox",
    required: requiredFor(fieldset),
    options,
  };
}

export function currentCheckboxChoiceValue(
  group: CheckboxChoiceGroup,
  scope: FormScope,
): string {
  return group.options
    .filter((option) => checkboxIsChecked(option, scope))
    .map((option) => optionLabelFor(option, scope))
    .filter(Boolean)
    .join(", ");
}

export type ButtonChoiceGroup = {
  container: HTMLElement;
  label: string;
  required: boolean;
  options: HTMLElement[];
};

export type AriaRadioGroup = {
  container: HTMLElement;
  label: string;
  required: boolean;
  options: HTMLElement[];
};

export function ariaRadioGroups(scope: FormScope): AriaRadioGroup[] {
  return queryAllInScope<HTMLElement>(scope, "[role='radiogroup']")
    .filter((container) => isVisibleElement(container))
    .map((container) => {
      const options = Array.from(
        container.querySelectorAll<HTMLElement>("[role='radio']"),
      ).filter(
        (option) =>
          isVisibleElement(option) && option.getAttribute("aria-disabled") !== "true",
      );
      const label = cleanLabel(
        labelledByText(container, scopeFor(container, scope)) ||
          cleanText(container.getAttribute("aria-label")) ||
          cleanText(container.closest("fieldset")?.querySelector("legend")?.textContent) ||
          precedingQuestionLabel(container),
      );
      return { container, label, required: requiredFor(container), options };
    })
    .filter((group) => Boolean(group.label) && group.options.length >= 2);
}

export function visibleChoiceButtons(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("button, [role='radio'], [role='button']"),
  ).filter(
    (button) =>
      isVisibleElement(button) &&
      BUTTON_CHOICE_VALUE.test(
        cleanText(button.textContent || button.getAttribute("aria-label")),
      ),
  );
}

export function choiceGroupContainer(button: HTMLElement): HTMLElement | null {
  let candidate: HTMLElement | null = button.parentElement;
  for (let depth = 0; candidate && depth < 4; depth += 1) {
    const options = visibleChoiceButtons(candidate);
    if (options.length >= 2 && options.length <= 5 && options.includes(button))
      return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}

export function choiceGroupLabel(container: HTMLElement): string {
  const labelledBy = cleanText(container.getAttribute("aria-labelledby"));
  if (labelledBy) {
    const root = container.getRootNode();
    const scope = root instanceof Document || root instanceof ShadowRoot ? root : document;
    const text = labelledBy
      .split(/\s+/)
      .map((id) => cleanText(scope.querySelector(`#${CSS.escape(id)}`)?.textContent))
      .filter(Boolean)
      .join(" ");
    if (text) return cleanLabel(text);
  }

  const semanticLabel = cleanText(
    container.closest("fieldset")?.querySelector("legend")?.textContent,
  );
  if (semanticLabel) return cleanLabel(semanticLabel);

  let sibling = container.previousElementSibling as HTMLElement | null;
  while (sibling) {
    const text = cleanText(sibling.textContent);
    if (text.length >= 3 && text.length <= 280 && !isLikelyHelperText(text))
      return cleanLabel(text);
    sibling = sibling.previousElementSibling as HTMLElement | null;
  }

  const parent = container.parentElement;
  if (parent) {
    const label = Array.from(parent.children)
      .slice(0, Array.from(parent.children).indexOf(container))
      .map((child) => cleanText(child.textContent))
      .find((text) => text.length >= 3 && text.length <= 280 && !isLikelyHelperText(text));
    if (label) return cleanLabel(label);
  }
  return "";
}

export function buttonChoiceGroups(scope: FormScope): ButtonChoiceGroup[] {
  const groups: ButtonChoiceGroup[] = [];
  const seen = new Set<HTMLElement>();
  const buttons = queryAllInScope<HTMLElement>(
    scope,
    "button, [role='radio'], [role='button']",
  );

  for (const button of buttons) {
    if (
      !isVisibleElement(button) ||
      !BUTTON_CHOICE_VALUE.test(
        cleanText(button.textContent || button.getAttribute("aria-label")),
      )
    )
      continue;
    const container = choiceGroupContainer(button);
    if (!container || seen.has(container)) continue;
    seen.add(container);
    const label = choiceGroupLabel(container);
    if (!label) continue;
    groups.push({
      container,
      label,
      required:
        container.getAttribute("aria-required") === "true" ||
        container.hasAttribute("required") ||
        /\*\s*$/.test(label),
      options: visibleChoiceButtons(container),
    });
  }
  return groups;
}

export function selectedChoice(options: readonly HTMLElement[]): HTMLElement | undefined {
  return options.find(
    (option) =>
      option.getAttribute("aria-checked") === "true" ||
      option.getAttribute("aria-pressed") === "true" ||
      option.getAttribute("data-state") === "checked" ||
      option.getAttribute("data-state") === "selected",
  );
}

export function findButtonChoiceOption(
  scope: FormScope,
  label: string,
  value: string,
): HTMLElement | null {
  const targetLabel = cleanLabel(label).toLowerCase();
  const targetValue = cleanText(value).toLowerCase();
  const group = buttonChoiceGroups(scope).find((candidate) => {
    const candidateLabel = cleanLabel(candidate.label).toLowerCase();
    return (
      candidateLabel === targetLabel ||
      (candidateLabel.length > 3 &&
        targetLabel.length > 3 &&
        (candidateLabel.includes(targetLabel) || targetLabel.includes(candidateLabel)))
    );
  });
  return (
    group?.options.find((option) => {
      const text = cleanText(
        option.textContent || option.getAttribute("aria-label"),
      ).toLowerCase();
      return (
        text === targetValue ||
        (targetValue.length > 1 &&
          (text.includes(targetValue) || targetValue.includes(text)))
      );
    }) || null
  );
}
