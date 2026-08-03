import { inspectPageCombobox } from "/src/content/dom/combobox-bridge.ts.js";
const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image'])",
  "select",
  "textarea"
].join(", ");
const BUTTON_CHOICE_VALUE = /^(?:yes|no|true|false|agree|disagree|i agree|prefer not to say)$/i;
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function cleanLabel(value) {
  return cleanText(value).replace(/\s*(?:Required|必填|\*)\s*$/gi, "").trim();
}
export function isVisibleElement(element) {
  if (element.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
function isInspectableControl(element) {
  return !element.disabled && element.getAttribute("aria-disabled") !== "true" && element.getAttribute("aria-hidden") !== "true";
}
function isDocumentSelectionRadio(element) {
  return element.type.toLowerCase() === "radio" && (element.id.startsWith("jobsDocumentCardToggle") || Boolean(element.closest(".jobs-document-upload-redesign-card")));
}
function fieldType(element) {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (isSelectableCombobox(element)) return "select";
  const type = element.type.toLowerCase();
  if (type === "text" || type === "search") return "text";
  if (type === "checkbox" || type === "radio" || type === "file") return type;
  if (["number", "email", "tel", "url", "date", "password"].includes(type)) return type;
  return "unknown";
}
export function isSelectableCombobox(element) {
  return element instanceof HTMLInputElement && element.getAttribute("role") === "combobox" && (element.getAttribute("aria-autocomplete") === "list" || element.getAttribute("aria-haspopup") === "listbox" || element.getAttribute("aria-haspopup") === "true");
}
function scopeFor(element, fallback) {
  const root = element.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot ? root : fallback;
}
export function checkboxPresentationElements(element, scope) {
  const root = scopeFor(element, scope);
  const elements = /* @__PURE__ */ new Set();
  const add = (candidate) => {
    if (candidate) elements.add(candidate);
  };
  add(element);
  if (element.id) {
    add(root.querySelector(`label[for='${CSS.escape(element.id)}']`));
    add(root.querySelector(`[aria-controls='${CSS.escape(element.id)}']`));
  }
  add(element.closest("label, [role='checkbox']"));
  let parent = element.parentElement;
  for (let depth = 0; parent && depth < 4; depth += 1) {
    if (parent.matches(
      "label, [role='checkbox'], [aria-checked], [aria-pressed], [data-state='checked'], [data-state='unchecked']"
    )) {
      add(parent);
    }
    parent = parent.parentElement;
  }
  return Array.from(elements);
}
export function checkboxIsChecked(element, scope) {
  const presentation = checkboxPresentationElements(element, scope);
  const semanticState = presentation.map((candidate) => {
    const ariaChecked = candidate.getAttribute("aria-checked");
    if (ariaChecked === "true") return true;
    if (ariaChecked === "false") return false;
    const ariaPressed = candidate.getAttribute("aria-pressed");
    if (ariaPressed === "true") return true;
    if (ariaPressed === "false") return false;
    const dataState = candidate.getAttribute("data-state");
    if (dataState === "checked" || dataState === "selected") return true;
    if (dataState === "unchecked") return false;
    return void 0;
  }).find((state) => state !== void 0);
  return semanticState ?? element.checked;
}
function comboboxContainerFor(element) {
  return element.closest(".select-shell, [data-testid*='select' i], [class*='select' i]") || element.parentElement;
}
export function comboboxCurrentValue(element) {
  const bridgedValue = inspectPageCombobox(element)?.currentValue;
  if (bridgedValue) return bridgedValue;
  const container = comboboxContainerFor(element);
  return cleanText(
    container?.querySelector(
      ".select__single-value, [class*='single-value' i], [class*='singleValue' i]"
    )?.textContent
  );
}
function liveComboboxOptions(element, scope) {
  const listboxId = cleanText(element.getAttribute("aria-controls"));
  if (!listboxId) return [];
  const listbox = scope.querySelector(`#${CSS.escape(listboxId)}`);
  if (!listbox) return [];
  return Array.from(listbox.querySelectorAll("[role='option']")).map((option) => {
    const label = cleanText(option.textContent || option.getAttribute("aria-label"));
    return { label, value: label };
  }).filter((option) => Boolean(option.label));
}
function record(value) {
  return typeof value === "object" && value !== null ? value : null;
}
function greenhouseJobPost(value, visited = /* @__PURE__ */ new Set(), depth = 0) {
  const candidate = record(value);
  if (!candidate || depth > 6 || visited.has(candidate)) return null;
  visited.add(candidate);
  if (Array.isArray(candidate.questions)) return candidate;
  for (const child of Object.values(candidate)) {
    const jobPost = greenhouseJobPost(child, visited, depth + 1);
    if (jobPost) return jobPost;
  }
  return null;
}
function greenhouseQuestionOptions(element) {
  const pageContext = window.__remixContext;
  const scriptContext = Array.from(document.scripts).map((script) => script.textContent || "").find((text) => /^\s*window\.__remixContext\s*=/.test(text));
  let parsedContext;
  if (scriptContext) {
    try {
      parsedContext = JSON.parse(
        scriptContext.replace(/^window\.__remixContext\s*=\s*/, "").replace(/;\s*$/, "")
      );
    } catch {
      parsedContext = void 0;
    }
  }
  const jobPost = greenhouseJobPost(pageContext) || greenhouseJobPost(parsedContext);
  const questions = jobPost?.questions;
  if (!Array.isArray(questions)) return [];
  for (const question of questions) {
    const fields = record(question)?.fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      const candidate = record(field);
      if (candidate?.name !== element.id && candidate?.name !== element.name) continue;
      const values = candidate.values;
      if (!Array.isArray(values)) return [];
      return values.map((value) => {
        const option = record(value);
        const label = cleanText(typeof option?.label === "string" ? option.label : "");
        const rawValue = option?.value;
        return {
          label,
          value: rawValue === void 0 || rawValue === null ? label : String(rawValue)
        };
      }).filter((option) => Boolean(option.label));
    }
  }
  return [];
}
const COUNTRY_CODES = [
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AR",
  "AT",
  "AU",
  "AW",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BN",
  "BO",
  "BR",
  "BS",
  "BT",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FM",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GH",
  "GM",
  "GN",
  "GQ",
  "GR",
  "GT",
  "GW",
  "GY",
  "HK",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IN",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MR",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NE",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PG",
  "PH",
  "PK",
  "PL",
  "PT",
  "PW",
  "PY",
  "QA",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SI",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SY",
  "SZ",
  "TD",
  "TG",
  "TH",
  "TJ",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VN",
  "VU",
  "WS",
  "YE",
  "ZA",
  "ZM",
  "ZW"
];
function countryOptions(element) {
  if (element.id !== "country" && element.name !== "country") return [];
  const displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  return COUNTRY_CODES.map((code) => ({ label: displayNames?.of(code) || code, value: displayNames?.of(code) || code })).sort((left, right) => left.label.localeCompare(right.label));
}
export function comboboxOptionsFor(element, scope) {
  const bridgedOptions = inspectPageCombobox(element)?.options;
  if (bridgedOptions && bridgedOptions.length > 0) return bridgedOptions;
  const liveOptions = liveComboboxOptions(element, scope);
  if (liveOptions.length > 0) return liveOptions;
  const greenhouseOptions = greenhouseQuestionOptions(element);
  if (greenhouseOptions.length > 0) return greenhouseOptions;
  return countryOptions(element);
}
function optionLabelFor(element, scope) {
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return cleanLabel(ariaLabel);
  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return cleanLabel(text);
  }
  const parentLabel = cleanText(element.closest("label")?.textContent);
  if (parentTextIsDistinct(parentLabel, element)) return cleanLabel(parentLabel);
  if (element instanceof HTMLInputElement && element.value) return cleanText(element.value);
  return "Option";
}
function parentTextIsDistinct(text, element) {
  if (!text) return false;
  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend && text === legend) return false;
  return true;
}
function labelFor(element, scope) {
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio") {
    const fieldset2 = element.closest("fieldset");
    const legend2 = cleanText(fieldset2?.querySelector("legend")?.textContent);
    if (legend2) return cleanLabel(legend2);
  }
  const labelledBy = cleanText(element.getAttribute("aria-label"));
  if (labelledBy) return cleanLabel(labelledBy);
  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
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
function requiredFor(element) {
  if (element.hasAttribute("required") || element.getAttribute("aria-required") === "true") return true;
  const fieldset = element.closest("fieldset");
  return Boolean(fieldset?.hasAttribute("required") || fieldset?.getAttribute("aria-required") === "true");
}
function optionsFor(element, scope) {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).map((option) => ({
      label: cleanText(option.textContent) || option.value,
      value: option.value
    }));
  }
  if (element instanceof HTMLInputElement && isSelectableCombobox(element)) {
    return comboboxOptionsFor(element, scope);
  }
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio" && element.name) {
    return Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`)).map((radio) => ({
      label: optionLabelFor(radio, scope),
      value: radio.value
    }));
  }
  return [];
}
function currentValue(element, type, scope) {
  if (type === "password" || type === "file") return void 0;
  if (element instanceof HTMLInputElement && type === "radio" && element.name) {
    const group = Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`));
    const checkedRadio = group.find((r) => r.checked);
    if (!checkedRadio) return "";
    return optionLabelFor(checkedRadio, scope) || checkedRadio.value || "true";
  }
  if (element instanceof HTMLInputElement && type === "checkbox") {
    return checkboxIsChecked(element, scope) ? element.value || "true" : "";
  }
  if (element instanceof HTMLInputElement && isSelectableCombobox(element)) {
    return comboboxCurrentValue(element);
  }
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.selectedOptions).map((option) => cleanText(option.textContent)).join(", ");
  }
  return cleanText(element.value);
}
function isFilled(element, type, scope) {
  if (type === "file") return Boolean(element instanceof HTMLInputElement && element.files?.length);
  if (element instanceof HTMLInputElement && type === "radio" && element.name) {
    const group = Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`));
    return group.some((r) => r.checked);
  }
  if (element instanceof HTMLInputElement && type === "checkbox") return checkboxIsChecked(element, scope);
  return Boolean(currentValue(element, type, scope));
}
function labelledByText(element, scope) {
  const ids = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
  return cleanText(ids.map((id) => scope.querySelector(`#${CSS.escape(id)}`)?.textContent).join(" "));
}
function fileUploadGroupFor(element) {
  return element.closest("[role='group'][aria-labelledby], .file-upload, [class*='file-upload' i]");
}
function fileUploadLabelFor(element, scope) {
  const root = scopeFor(element, scope);
  const uploadGroup = fileUploadGroupFor(element);
  const groupLabel = uploadGroup ? labelledByText(uploadGroup, root) : "";
  const explicitLabel = element.id ? root.querySelector(`label[for='${CSS.escape(element.id)}']`) : null;
  const controller = element.id ? root.querySelector(`[aria-controls='${CSS.escape(element.id)}']`) : null;
  const text = cleanText(
    groupLabel || explicitLabel?.textContent || controller?.getAttribute("aria-label") || controller?.textContent || element.getAttribute("aria-label") || element.getAttribute("name")
  );
  if (/upload\s+resume|resume\s+upload/i.test(text)) return "Resume";
  if (/upload\s+(?:cv|cover\s+letter)/i.test(text)) return cleanLabel(text.replace(/^upload\s+/i, ""));
  return cleanLabel(text) || "Upload file";
}
function selectedDocumentFor(element, scope) {
  const root = scopeFor(element, scope);
  const selectedLabel = Array.from(root.querySelectorAll(".jobs-document-upload-redesign-card__toggle-label")).find((label) => /^deselect\s+(?:resume|cv|cover\s+letter)\s+/i.test(cleanText(label.textContent)));
  if (!selectedLabel) return void 0;
  const name = cleanText(selectedLabel.textContent).replace(/^deselect\s+(?:resume|cv|cover\s+letter)\s+/i, "").trim();
  if (!name) return void 0;
  const cardText = cleanText(selectedLabel.closest(".jobs-document-upload-redesign-card")?.textContent);
  return { name, accepted: !/\b0\s*B\b/i.test(cardText) };
}
function uploadErrorFor(element, scope) {
  const root = scopeFor(element, scope);
  const uploader = fileUploadGroupFor(element) || element.closest("fieldset, section, div");
  const ids = [
    cleanText(element.getAttribute("aria-errormessage")),
    element.id ? `${element.id}-error` : ""
  ].filter(Boolean);
  const directError = ids.map((id) => cleanText(root.querySelector(`#${CSS.escape(id)}`)?.textContent)).find(Boolean);
  if (directError) return directError;
  return Array.from(
    uploader?.querySelectorAll("[role='alert'], [aria-live='assertive'], [id$='-error'], .error, .errors") || []
  ).map((candidate) => cleanText(candidate.textContent)).find(Boolean) || "";
}
function uploadObservationFor(element, scope, selectedDocument) {
  const error = uploadErrorFor(element, scope);
  if (error) return { state: "rejected", detail: error };
  const selectedFile = element.files?.[0];
  if (selectedFile?.size) return { state: "ready", filename: selectedFile.name };
  if (selectedDocument?.accepted) return { state: "ready", filename: selectedDocument.name };
  if (selectedDocument) {
    return {
      state: "rejected",
      filename: selectedDocument.name,
      detail: "The selected document is empty or was rejected by the webpage."
    };
  }
  return { state: "empty" };
}
function documentOptionsFor(element, scope) {
  const root = scopeFor(element, scope);
  return Array.from(root.querySelectorAll(".jobs-document-upload-redesign-card__toggle-label")).map((label) => {
    const text = cleanText(label.textContent);
    const match = text.match(/^(?:deselect|select)\s+(?:resume|cv|cover\s+letter)\s+(.+)$/i);
    const value = cleanText(label.htmlFor);
    return match?.[1] && value ? { label: match[1].trim(), value } : null;
  }).filter((option) => Boolean(option));
}
function fileRequiredFor(element, scope) {
  if (requiredFor(element)) return true;
  const root = scopeFor(element, scope);
  const uploadGroup = fileUploadGroupFor(element);
  if (uploadGroup?.getAttribute("aria-required") === "true" || uploadGroup?.hasAttribute("required")) return true;
  const explicitLabel = element.id ? root.querySelector(`label[for='${CSS.escape(element.id)}']`) : null;
  const nearbyText = cleanText(explicitLabel?.closest("fieldset, section, div")?.textContent);
  return /\*\s*$/.test(cleanText(explicitLabel?.textContent)) || /\bresume\b[\s\S]{0,180}\*/i.test(nearbyText);
}
function isPresentedFileInput(element, scope) {
  if (isAutofillResumeInput(element)) return false;
  if (isVisibleElement(element)) return true;
  const root = scopeFor(element, scope);
  const explicitLabel = element.id ? root.querySelector(`label[for='${CSS.escape(element.id)}']`) : null;
  if (explicitLabel && isVisibleElement(explicitLabel)) return true;
  const controller = element.id ? root.querySelector(`[aria-controls='${CSS.escape(element.id)}']`) : null;
  if (controller && isVisibleElement(controller)) return true;
  const uploader = element.closest(
    "[class*='file-upload' i], [class*='upload' i], [data-testid*='upload' i]"
  );
  if (!uploader || !isVisibleElement(uploader)) return false;
  return Array.from(uploader.querySelectorAll("button, [role='button'], label")).some((control) => isVisibleElement(control));
}
function isAutofillResumeInput(element) {
  let container = element.parentElement;
  for (let depth = 0; container && depth < 4; depth += 1) {
    const text = cleanText(container.textContent);
    if (text.length <= 900 && /autofill from resume/i.test(text)) return true;
    container = container.parentElement;
  }
  return false;
}
export function elementsInScope(scope) {
  const elements = [];
  const visitedRoots = /* @__PURE__ */ new Set();
  const visit = (root) => {
    if (visitedRoots.has(root)) return;
    visitedRoots.add(root);
    const descendants = Array.from(root.querySelectorAll("*"));
    elements.push(...descendants);
    descendants.forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };
  visit(scope);
  return elements;
}
export function controlsInScope(scope) {
  return elementsInScope(scope).filter(
    (element) => element.matches(CONTROL_SELECTOR)
  );
}
export function visibleControlsInScope(scope) {
  return controlsInScope(scope).filter((element) => isVisibleElement(element) && isInspectableControl(element));
}
export function fieldKeyFor(element, index) {
  return cleanText(element.id) || cleanText(element.getAttribute("name")) || `field-${index + 1}`;
}
function checkboxChoiceGroupFor(element, scope) {
  const name = cleanText(element.name);
  if (element.type.toLowerCase() !== "checkbox" || !name || !name.endsWith("[]") || !name.startsWith("question_")) {
    return null;
  }
  const fieldset = element.closest("fieldset");
  if (!fieldset) return null;
  const root = scopeFor(element, scope);
  const options = Array.from(
    root.querySelectorAll(`input[type='checkbox'][name='${CSS.escape(name)}']`)
  ).filter((candidate) => isVisibleElement(candidate) && candidate.closest("fieldset") === fieldset);
  const label = cleanLabel(cleanText(fieldset.querySelector("legend")?.textContent));
  if (options.length < 2 || !label) return null;
  return {
    container: fieldset,
    name,
    label,
    required: requiredFor(fieldset),
    options
  };
}
function currentCheckboxChoiceValue(group, scope) {
  return group.options.filter((option) => checkboxIsChecked(option, scope)).map((option) => optionLabelFor(option, scope)).filter(Boolean).join(", ");
}
function visibleChoiceButtons(container) {
  return Array.from(container.querySelectorAll("button, [role='radio'], [role='button']")).filter((button) => isVisibleElement(button) && BUTTON_CHOICE_VALUE.test(cleanText(button.textContent || button.getAttribute("aria-label"))));
}
function choiceGroupContainer(button) {
  let candidate = button.parentElement;
  for (let depth = 0; candidate && depth < 4; depth += 1) {
    const options = visibleChoiceButtons(candidate);
    if (options.length >= 2 && options.length <= 5 && options.includes(button)) return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}
function choiceGroupLabel(container) {
  const labelledBy = cleanText(container.getAttribute("aria-labelledby"));
  if (labelledBy) {
    const root = container.getRootNode();
    const scope = root instanceof Document || root instanceof ShadowRoot ? root : document;
    const text = labelledBy.split(/\s+/).map((id) => cleanText(scope.querySelector(`#${CSS.escape(id)}`)?.textContent)).filter(Boolean).join(" ");
    if (text) return cleanLabel(text);
  }
  const semanticLabel = cleanText(container.closest("fieldset")?.querySelector("legend")?.textContent);
  if (semanticLabel) return cleanLabel(semanticLabel);
  let sibling = container.previousElementSibling;
  while (sibling) {
    const text = cleanText(sibling.textContent);
    if (text.length >= 3 && text.length <= 280) return cleanLabel(text);
    sibling = sibling.previousElementSibling;
  }
  const parent = container.parentElement;
  if (parent) {
    const label = Array.from(parent.children).slice(0, Array.from(parent.children).indexOf(container)).map((child) => cleanText(child.textContent)).find((text) => text.length >= 3 && text.length <= 280);
    if (label) return cleanLabel(label);
  }
  return "";
}
function buttonChoiceGroups(scope) {
  const groups = [];
  const seen = /* @__PURE__ */ new Set();
  for (const button of elementsInScope(scope)) {
    if (!isVisibleElement(button) || !BUTTON_CHOICE_VALUE.test(cleanText(button.textContent || button.getAttribute("aria-label")))) continue;
    const container = choiceGroupContainer(button);
    if (!container || seen.has(container)) continue;
    seen.add(container);
    const label = choiceGroupLabel(container);
    if (!label) continue;
    groups.push({
      container,
      label,
      required: container.getAttribute("aria-required") === "true" || container.hasAttribute("required") || /\*\s*$/.test(label),
      options: visibleChoiceButtons(container)
    });
  }
  return groups;
}
function selectedChoice(options) {
  return options.find(
    (option) => option.getAttribute("aria-checked") === "true" || option.getAttribute("aria-pressed") === "true" || option.getAttribute("data-state") === "checked" || option.getAttribute("data-state") === "selected"
  );
}
export function findButtonChoiceOption(scope, label, value) {
  const targetLabel = cleanLabel(label).toLowerCase();
  const targetValue = cleanText(value).toLowerCase();
  const group = buttonChoiceGroups(scope).find((candidate) => {
    const candidateLabel = cleanLabel(candidate.label).toLowerCase();
    return candidateLabel === targetLabel || candidateLabel.length > 3 && targetLabel.length > 3 && (candidateLabel.includes(targetLabel) || targetLabel.includes(candidateLabel));
  });
  return group?.options.find((option) => cleanText(option.textContent || option.getAttribute("aria-label")).toLowerCase() === targetValue) || null;
}
export function inspectVisibleFormFields(scope = document) {
  const visibleControls = visibleControlsInScope(scope);
  const seenRadioNames = /* @__PURE__ */ new Set();
  const seenCheckboxGroupNames = /* @__PURE__ */ new Set();
  const result = [];
  for (let index = 0; index < visibleControls.length && result.length < 200; index += 1) {
    const element = visibleControls[index];
    if (!element) continue;
    const type = fieldType(element);
    if (element instanceof HTMLInputElement && isDocumentSelectionRadio(element)) continue;
    if (element instanceof HTMLInputElement) {
      const checkboxGroup = checkboxChoiceGroupFor(element, scope);
      if (checkboxGroup) {
        if (seenCheckboxGroupNames.has(checkboxGroup.name)) continue;
        seenCheckboxGroupNames.add(checkboxGroup.name);
        const value = currentCheckboxChoiceValue(checkboxGroup, scope);
        result.push({
          key: cleanText(checkboxGroup.container.id) || checkboxGroup.name,
          id: cleanText(checkboxGroup.container.id) || void 0,
          name: checkboxGroup.name,
          // Greenhouse renders these single-answer screening questions as
          // checkbox controls. Present them as one choice field so the panel
          // mirrors the question instead of listing every option as a field.
          type: "radio",
          label: checkboxGroup.label,
          required: checkboxGroup.required,
          filled: Boolean(value),
          sensitive: false,
          options: checkboxGroup.options.map((option) => ({
            label: optionLabelFor(option, scope),
            value: option.value
          })),
          ...value ? { currentValue: value } : {}
        });
        continue;
      }
    }
    if (type === "radio" && element instanceof HTMLInputElement && element.name) {
      if (seenRadioNames.has(element.name)) continue;
      seenRadioNames.add(element.name);
    }
    const elementScope = scopeFor(element, scope);
    const val = currentValue(element, type, elementScope);
    result.push({
      key: fieldKeyFor(element, index),
      id: cleanText(element.id) || void 0,
      name: cleanText(element.getAttribute("name")) || void 0,
      type,
      label: labelFor(element, elementScope),
      required: requiredFor(element),
      filled: isFilled(element, type, elementScope),
      sensitive: type === "password" || type === "file",
      options: optionsFor(element, elementScope),
      ...val ? { currentValue: val } : {}
    });
  }
  const keys = new Set(result.map((field) => field.key));
  const fileInputs = elementsInScope(scope).filter(
    (element) => element instanceof HTMLInputElement && element.type.toLowerCase() === "file"
  );
  for (let index = 0; index < fileInputs.length && result.length < 200; index += 1) {
    const input = fileInputs[index];
    if (!input || input.disabled || input.getAttribute("aria-disabled") === "true") continue;
    if (!isPresentedFileInput(input, scope)) continue;
    const key = fieldKeyFor(input, visibleControls.length + index);
    if (keys.has(key)) continue;
    const selectedDocument = selectedDocumentFor(input, scope);
    const selectedFile = input.files?.[0];
    const upload = uploadObservationFor(input, scope, selectedDocument);
    result.push({
      key,
      id: cleanText(input.id) || void 0,
      name: cleanText(input.getAttribute("name")) || void 0,
      type: "file",
      label: fileUploadLabelFor(input, scope),
      required: fileRequiredFor(input, scope),
      filled: Boolean(selectedFile && selectedFile.size > 0 || selectedDocument?.accepted),
      sensitive: true,
      options: documentOptionsFor(input, scope),
      upload,
      ...selectedDocument ? { currentValue: selectedDocument.name } : selectedFile ? { currentValue: selectedFile.name } : {}
    });
  }
  for (const group of buttonChoiceGroups(scope)) {
    if (result.length >= 200) break;
    if (result.some((field) => field.type === "radio" && cleanLabel(field.label) === cleanLabel(group.label))) continue;
    const selected = selectedChoice(group.options);
    result.push({
      key: `button-choice-${result.length + 1}`,
      type: "radio",
      label: group.label,
      required: group.required,
      filled: Boolean(selected),
      sensitive: false,
      options: group.options.map((option) => {
        const value = cleanText(option.textContent || option.getAttribute("aria-label"));
        return { label: value, value };
      }),
      ...selected ? { currentValue: cleanText(selected.textContent || selected.getAttribute("aria-label")) } : {}
    });
  }
  return result;
}
export function readApplicationForm(url, platform, isApplicationPage, submitLabel, scope = document, action, canGoBack = false) {
  const fields = scope ? inspectVisibleFormFields(scope) : [];
  if (!isApplicationPage) {
    return {
      kind: "not_application_form",
      platform,
      url,
      reason: `No visible ${platform === "linkedin" ? "LinkedIn" : platform === "seek" ? "SEEK" : "application"} form was found.`
    };
  }
  return {
    kind: "application_form",
    platform,
    url,
    fields,
    hasSubmitAction: Boolean(submitLabel),
    canGoBack,
    ...submitLabel ? { submitLabel } : {},
    ...action ? { action } : {}
  };
}
export function readPageInputFields(url, platform) {
  const fields = inspectVisibleFormFields(document);
  if (fields.length === 0) return null;
  return {
    kind: "page_input_fields",
    platform,
    url,
    fields
  };
}
export function readSeekForm(url, isApplicationPage, submitLabel, action, canGoBack = false) {
  return readApplicationForm(url, "seek", isApplicationPage, submitLabel, document, action, canGoBack);
}
