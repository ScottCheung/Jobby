import { inspectPageCombobox } from "/src/content/dom/combobox-bridge.ts.js";
const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image'])",
  "select",
  "textarea",
  "[role='combobox']"
].join(", ");
const BUTTON_CHOICE_VALUE = /^(?:yes|no|true|false|agree|disagree|i agree|prefer not to say)$/i;
const PLACEHOLDER_OPTION_LABELS = /* @__PURE__ */ new Set([
  "select",
  "select option",
  "select an option",
  "select a option",
  "select answer",
  "select an answer",
  "select a answer",
  "select value",
  "select a value",
  "select country",
  "select a country",
  "select location",
  "select a location",
  "choose",
  "choose option",
  "choose an option",
  "choose a option",
  "choose answer",
  "choose an answer",
  "choose a answer",
  "choose value",
  "choose a value",
  "choose country",
  "choose a country",
  "choose location",
  "choose a location",
  "please select",
  "please select an option",
  "please select a option",
  "please choose",
  "please choose an option",
  "please choose a option"
]);
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function cleanLabel(value) {
  return cleanText(value).replace(/^\s*(?:\(?(?:Required|Optional|必填|选填)\)?|\*)+\s*/gi, "").replace(/\s*(?:\(?(?:Required|Optional|必填|选填)\)?|\*)+\s*$/gi, "").replace(/\s+/g, " ").trim();
}
function precedingQuestionLabel(element) {
  let container = element.closest("[data-testid='field'], [data-testid*='field' i]") || element.parentElement;
  for (let depth = 0; container && depth < 4; depth += 1) {
    let sibling = container.previousElementSibling;
    while (sibling) {
      const text = cleanText(sibling.textContent);
      if (text.length >= 8 && text.length <= 500 && !/^(?:search|select|choose)$/i.test(text)) {
        return cleanLabel(text);
      }
      sibling = sibling.previousElementSibling;
    }
    container = container.parentElement;
  }
  return "";
}
function labelTextWithoutControl(label) {
  if (!label) return "";
  const copy = label.cloneNode(true);
  copy.querySelectorAll(
    "input, select, textarea, button, img, svg, noscript, script, style, .helper-text, .help-block, .field-hint, [class*='helper' i], [class*='tooltip' i], [class*='error' i], [class*='hint' i]"
  ).forEach((node) => node.remove());
  return cleanLabel(copy.textContent || "");
}
function normalizedOptionLabel(value) {
  return cleanText(value).toLowerCase().replace(/[.…]+$/g, "").replace(/^[-–—\s]+|[-–—\s]+$/g, "").replace(/\s+/g, " ");
}
export function isPlaceholderOption(label, value = "") {
  const normalizedLabel = normalizedOptionLabel(label);
  const normalizedValue = cleanText(value);
  if (!normalizedValue) return true;
  if (PLACEHOLDER_OPTION_LABELS.has(normalizedLabel)) return true;
  return /^(?:please\s+)?(?:select|choose)\s+(?:an?|the)\s+(?:option|answer|value|country|location)$/i.test(normalizedLabel);
}
function observedOptionValue(value) {
  return isPlaceholderOption(value, "observed") ? "" : cleanText(value);
}
export function isVisibleElement(element) {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
    return false;
  }
  for (let candidate = element.parentElement; candidate && candidate !== document.body && candidate !== document.documentElement; candidate = candidate.parentElement) {
    if (candidate.hidden || candidate.getAttribute("aria-hidden") === "true") return false;
    const ancestorStyle = window.getComputedStyle(candidate);
    if (ancestorStyle.display === "none" || ancestorStyle.visibility === "hidden" || ancestorStyle.visibility === "collapse") {
      return false;
    }
    const cRect = candidate.getBoundingClientRect();
    if (cRect.width > 0 || cRect.height > 0) {
      if (cRect.right < -3e3 || cRect.left < -3e3) {
        return false;
      }
    }
  }
  const isFormInput = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
  const rect = element.getBoundingClientRect();
  const hasSize = rect.width > 0 && rect.height > 0 || element.offsetWidth > 0 && element.offsetHeight > 0;
  if (hasSize && style.opacity !== "0" && rect.right >= -3e3 && rect.left >= -3e3) {
    return true;
  }
  if (isFormInput) {
    const container = element.closest(
      "label, fieldset, form, .form-group, .form-item, .form-field, .field-wrapper, [class*='control' i], [class*='field' i], [class*='radio' i], [class*='checkbox' i], [class*='select' i], [class*='t1-' i], [class*='jobwizard' i], [class*='question' i], [class*='component' i], [class*='item' i], [class*='container' i], [data-testid*='field' i], [data-testid*='question' i], [jobwizard_question_title_id]"
    ) || element.parentElement;
    if (container) {
      const containerStyle = window.getComputedStyle(container);
      const containerRect = container.getBoundingClientRect();
      const containerHasSize = containerRect.width > 0 && containerRect.height > 0 || container.offsetWidth > 0 && container.offsetHeight > 0;
      if (containerStyle.display !== "none" && containerStyle.visibility !== "hidden" && containerHasSize && containerRect.left >= -3e3) {
        return true;
      }
    }
  }
  return false;
}
function isInspectableControl(element) {
  return !element.disabled && element.getAttribute("aria-disabled") !== "true" && element.getAttribute("aria-hidden") !== "true";
}
function ariaCheckboxElementsInScope(scope) {
  return elementsInScope(scope).filter((element) => {
    if (!element.matches("[role='checkbox']")) return false;
    if (element.getAttribute("aria-disabled") === "true" || element.getAttribute("aria-hidden") === "true") return false;
    return isVisibleElement(element);
  });
}
function ariaCheckboxLabel(element, scope) {
  const labelledBy = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean).map((id) => cleanText(scope.querySelector(`#${CSS.escape(id)}`)?.textContent)).filter(Boolean).join(" ");
  return cleanLabel(
    cleanText(
      labelledBy || element.getAttribute("aria-label") || labelTextWithoutControl(element.closest("label")) || containerLabelFor(element) || element.getAttribute("name") || element.id
    ) || "Unnamed field"
  );
}
function ariaCheckboxIsChecked(element) {
  return element.getAttribute("aria-checked") === "true" || element.getAttribute("data-state") === "checked" || element.classList.contains("checked") || element.classList.contains("selected");
}
function isDocumentSelectionRadio(element) {
  return element.type.toLowerCase() === "radio" && (element.id.startsWith("jobsDocumentCardToggle") || Boolean(element.closest(".jobs-document-upload-redesign-card")));
}
function fieldType(element) {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element.getAttribute("role") === "combobox" || isSelectableCombobox(element)) return "select";
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === "text" || type === "search") return "text";
    if (type === "checkbox" || type === "radio" || type === "file") return type;
    if (["number", "email", "tel", "url", "date", "password"].includes(type)) return type;
  }
  return "unknown";
}
export function isSelectableCombobox(element) {
  if (!(element instanceof HTMLInputElement)) return false;
  const role = element.getAttribute("role");
  const ariaHasPopup = element.getAttribute("aria-haspopup");
  const ariaAutocomplete = element.getAttribute("aria-autocomplete");
  if (role === "combobox" && (ariaAutocomplete === "list" || ariaAutocomplete === "both" || ariaHasPopup === "listbox" || ariaHasPopup === "true")) {
    return true;
  }
  if (ariaHasPopup === "listbox" || ariaHasPopup === "grid") {
    return true;
  }
  const container = element.closest(
    "[class*='select' i], [class*='dropdown' i], [class*='combobox' i], [class*='lookup' i], [class*='t1-lookup' i], [class*='t1-select' i], [class*='t1-dropdown' i]"
  );
  if (container && (element.readOnly || element.getAttribute("aria-expanded") !== null || role === "combobox" || container.matches("[class*='lookup' i], [class*='t1-lookup' i]"))) {
    return true;
  }
  return false;
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
  return element.closest(".select-shell, [data-testid*='select' i], [class*='select' i], [class*='dropdown' i], [class*='t1-' i]") || element.parentElement;
}
export function isPhoneCountryElement(element) {
  const id = cleanText(element.id).toLowerCase();
  const name = cleanText(element.getAttribute("name")).toLowerCase();
  const ariaLabel = cleanText(element.getAttribute("aria-label")).toLowerCase();
  const title = cleanText(element.getAttribute("title")).toLowerCase();
  const placeholder = cleanText(element.getAttribute("placeholder")).toLowerCase();
  if (id === "country" || name === "country") return true;
  const countryKeywords = [
    "phone_country",
    "phone-country",
    "country_code",
    "country-code",
    "phone_code",
    "phone-code",
    "dial_code",
    "dial-code",
    "calling_code",
    "countrycode",
    "phonecountry",
    "phonecountrycode",
    "phone_dial"
  ];
  if (countryKeywords.some((kw) => id.includes(kw) || name.includes(kw))) {
    return true;
  }
  const labelTexts = [ariaLabel, title, placeholder];
  if (labelTexts.some((text) => /(?:phone\s+country|country\s+code|phone\s+code|dial\s+code|calling\s+code)/i.test(text))) {
    return true;
  }
  return false;
}
export function comboboxCurrentValue(element) {
  const bridgedValue = observedOptionValue(inspectPageCombobox(element)?.currentValue || "");
  if (bridgedValue) return bridgedValue;
  const rawValue = element instanceof HTMLInputElement ? element.value : element.getAttribute("value");
  const directValue = observedOptionValue(cleanText(rawValue));
  const container = comboboxContainerFor(element);
  const displayedValue = observedOptionValue(
    cleanText(
      container?.querySelector(
        ".select__single-value, [class*='single-value' i], [class*='singleValue' i], [class*='selected' i], [class*='value' i], [class*='trigger' i], [class*='display' i], [class*='selection' i]"
      )?.textContent
    )
  );
  const buttonValue = observedOptionValue(
    cleanText(container?.querySelector("button, [role='combobox']")?.textContent)
  );
  const selfText = observedOptionValue(cleanText(element.textContent));
  const resolved = directValue || displayedValue || buttonValue || selfText;
  if (isPhoneCountryElement(element)) {
    const flagClass = Array.from(
      container?.querySelector("[class*='iti__flag']")?.classList || []
    ).find((name) => /^iti__[a-z]{2}$/i.test(name));
    const code = flagClass?.slice("iti__".length).toUpperCase();
    if (code && typeof Intl.DisplayNames === "function") {
      const country = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      if (country) return country;
    }
  }
  return resolved;
}
function liveComboboxOptions(element, scope) {
  const listboxId = cleanText(element.getAttribute("aria-controls"));
  if (!listboxId) return [];
  const listbox = scope.querySelector(`#${CSS.escape(listboxId)}`);
  if (!listbox) return [];
  return Array.from(listbox.querySelectorAll("[role='option']")).map((option) => {
    const label = cleanText(option.textContent || option.getAttribute("aria-label"));
    return { label, value: label };
  }).filter((option) => Boolean(option.label) && !isPlaceholderOption(option.label, option.value));
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
      }).filter((option) => Boolean(option.label) && !isPlaceholderOption(option.label, option.value));
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
  if (!isPhoneCountryElement(element)) return [];
  const displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  return COUNTRY_CODES.map((code) => ({ label: displayNames?.of(code) || code, value: displayNames?.of(code) || code })).sort((left, right) => left.label.localeCompare(right.label));
}
function greenhouseChoiceOptions(element, scope) {
  if (!element.id.startsWith("question_")) return [];
  const label = cleanLabel(labelFor(element, scope)).toLowerCase();
  if (!/(citizen|relocat|clearance)/i.test(label)) return [];
  return ["Yes", "No"].map((value) => ({ label: value, value }));
}
export function comboboxOptionsFor(element, scope) {
  const bridgedOptions = inspectPageCombobox(element)?.options;
  if (bridgedOptions && bridgedOptions.length > 0) {
    const realOptions = bridgedOptions.filter((option) => !isPlaceholderOption(option.label, option.value));
    if (realOptions.length > 0) return realOptions;
  }
  const liveOptions = liveComboboxOptions(element, scope);
  if (liveOptions.length > 0) return liveOptions;
  const greenhouseOptions = greenhouseQuestionOptions(element);
  if (greenhouseOptions.length > 0) return greenhouseOptions;
  const inferredOptions = greenhouseChoiceOptions(element, scope);
  if (inferredOptions.length > 0) return inferredOptions;
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
  const parentLabel = labelTextWithoutControl(element.closest("label"));
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
function isOptionLabelElement(candidate, element) {
  if (candidate.contains(element)) return true;
  const targetId = candidate.getAttribute("for");
  if (targetId) {
    const root = element.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : document;
    const targetInput = queryScope.querySelector(`#${CSS.escape(targetId)}`);
    if (targetInput && (targetInput.type.toLowerCase() === "radio" || targetInput.type.toLowerCase() === "checkbox")) {
      return true;
    }
  }
  if (candidate.querySelector("input[type='radio'], input[type='checkbox']")) {
    return true;
  }
  const candidateText = cleanText(labelTextWithoutControl(candidate));
  if (BUTTON_CHOICE_VALUE.test(candidateText)) {
    return true;
  }
  return false;
}
export function containerLabelFor(element) {
  const root = scopeFor(element, document);
  const targetId = cleanText(element.id) || cleanText(element.getAttribute("jobwizard_question_input_id")) || cleanText(element.getAttribute("extra_data_id"));
  if (targetId) {
    const titleElem = root.querySelector(`[jobwizard_question_title_id='${CSS.escape(targetId)}']`);
    const titleText = cleanText(titleElem?.textContent);
    if (titleText) return cleanLabel(titleText);
  }
  const titleContainer = element.closest("[jobwizard_question_title_id]");
  const titleId = titleContainer?.getAttribute("jobwizard_question_title_id");
  if (titleId) {
    const labelElem = root.querySelector(`#${CSS.escape(titleId)}-label, #${CSS.escape(titleId)}`) || root.querySelector(`[jobwizard_question_title_id='${CSS.escape(titleId)}']`);
    const titleText = cleanText(labelElem?.textContent);
    if (titleText) return cleanLabel(titleText);
  }
  let current = element.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (current.matches("body, html")) break;
    const labelCandidates = Array.from(
      current.querySelectorAll(
        "legend, label, [class*='label' i], [class*='prompt' i], [class*='question' i], [class*='title' i], [class*='name' i], [class*='heading' i], [class*='caption' i], [class*='text' i], [class*='description' i], [class*='t1-' i], [data-label], [data-prompt]"
      )
    );
    for (const candidate of labelCandidates) {
      if (isOptionLabelElement(candidate, element)) continue;
      const text = labelTextWithoutControl(candidate);
      if (text && text.length >= 2 && text.length <= 400) {
        if (!BUTTON_CHOICE_VALUE.test(text)) {
          return cleanLabel(text);
        }
      }
    }
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (!sibling.matches("input, select, textarea, button")) {
        const text = cleanText(sibling.textContent);
        if (text && text.length >= 2 && text.length <= 400 && !BUTTON_CHOICE_VALUE.test(text)) {
          return cleanLabel(text);
        }
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return "";
}
export function cleanPlaceholderLabel(placeholder) {
  const cleaned = cleanText(placeholder);
  if (!cleaned) return "";
  const stripped = cleaned.replace(/^(?:e\.g\.?|eg|example|enter|please enter|type|please type|select|please select|choose|please choose)\s+/i, "").replace(/^[.:\s]+|[.:\s]+$/g, "");
  return cleanLabel(stripped || cleaned);
}
export function labelFor(element, scope) {
  const isRadio = element instanceof HTMLInputElement && element.type.toLowerCase() === "radio";
  if (isRadio) {
    const fieldset2 = element.closest("fieldset");
    const legend2 = cleanText(fieldset2?.querySelector("legend")?.textContent);
    if (legend2) return cleanLabel(legend2);
    const radiogroup = element.closest("[role='radiogroup']");
    if (radiogroup) {
      const groupLabel = labelledByText(radiogroup, scope) || cleanText(radiogroup.getAttribute("aria-label"));
      if (groupLabel) return cleanLabel(groupLabel);
    }
    const questionLabel2 = precedingQuestionLabel(element);
    if (questionLabel2) return questionLabel2;
    const containerLabel = containerLabelFor(element);
    if (containerLabel) return containerLabel;
  }
  if (isPhoneCountryElement(element)) return "Phone country";
  const labelledByIds = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
  if (labelledByIds.length > 0) {
    const labelledByText2 = cleanText(
      labelledByIds.map((id) => scope.querySelector(`#${CSS.escape(id)}`)?.textContent || "").join(" ")
    );
    if (labelledByText2) return cleanLabel(labelledByText2);
  }
  const isGenericActionLabel = (text) => /^(?:search|filter|type|select|choose|enter|type to search)$/i.test(text.trim());
  const labelledBy = cleanText(element.getAttribute("aria-label"));
  if (labelledBy && !isGenericActionLabel(labelledBy)) return cleanLabel(labelledBy);
  const dataLabel = cleanText(element.getAttribute("data-label") || element.getAttribute("data-prompt") || element.getAttribute("title"));
  if (dataLabel && !isGenericActionLabel(dataLabel)) return cleanLabel(dataLabel);
  if (!isRadio) {
    const id = cleanText(element.id);
    if (id) {
      const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
      const text = labelTextWithoutControl(label);
      if (text) return cleanLabel(text);
    }
    const parentLabel = element.closest("label");
    const parentText = labelTextWithoutControl(parentLabel);
    if (parentText) return cleanLabel(parentText);
  }
  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend) return cleanLabel(legend);
  const questionLabel = precedingQuestionLabel(element);
  if (questionLabel) return questionLabel;
  const structuralLabel = containerLabelFor(element);
  if (structuralLabel) return structuralLabel;
  if (isRadio) {
    const id = cleanText(element.id);
    if (id) {
      const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
      const text = labelTextWithoutControl(label);
      if (text && !BUTTON_CHOICE_VALUE.test(text)) return cleanLabel(text);
    }
    const parentLabel = element.closest("label");
    const parentText = labelTextWithoutControl(parentLabel);
    if (parentText && !BUTTON_CHOICE_VALUE.test(parentText)) return cleanLabel(parentText);
  }
  const placeholder = cleanText(element.getAttribute("placeholder"));
  if (placeholder) {
    const cleanedPlaceholder = cleanPlaceholderLabel(placeholder);
    if (cleanedPlaceholder) return cleanedPlaceholder;
  }
  return cleanLabel(element.getAttribute("name") || "") || "Unnamed field";
}
function requiredFor(element) {
  if (element.hasAttribute("required") || element.getAttribute("aria-required") === "true") return true;
  const fieldset = element.closest("fieldset");
  if (fieldset?.hasAttribute("required") || fieldset?.getAttribute("aria-required") === "true") return true;
  const metadata = element.closest("[data-t1-control]")?.getAttribute("data-t1-control");
  if (metadata) {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed.IsMandatory === true) return true;
    } catch {
    }
  }
  return false;
}
export function radioGroupForElement(element, scope = document) {
  if (element.name) {
    const namedGroup = Array.from(
      scope.querySelectorAll(
        `input[type='radio'][name='${CSS.escape(element.name)}']`
      )
    );
    if (namedGroup.length > 0) return namedGroup;
  }
  let container = element.parentElement;
  for (let depth = 0; container && depth < 8; depth += 1) {
    const containerRadios = Array.from(container.querySelectorAll("input[type='radio']"));
    if (containerRadios.length >= 2) return containerRadios;
    container = container.parentElement;
  }
  return [element];
}
function optionsFor(element, scope) {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).map((option) => ({
      label: cleanText(option.textContent) || option.value,
      value: option.value
    })).filter((option) => !isPlaceholderOption(option.label, option.value));
  }
  if (element instanceof HTMLInputElement && isSelectableCombobox(element)) {
    return comboboxOptionsFor(element, scope);
  }
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio") {
    return radioGroupForElement(element, scope).map((radio) => ({
      label: optionLabelFor(radio, scope),
      value: radio.value
    }));
  }
  return [];
}
function currentValue(element, type, scope) {
  if (type === "password" || type === "file") return void 0;
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
    return Array.from(element.selectedOptions).filter((option) => !isPlaceholderOption(option.textContent || "", option.value)).map((option) => cleanText(option.textContent) || cleanText(option.value)).filter(Boolean).join(", ");
  }
  return cleanText(element.value);
}
function isFilled(element, type, scope) {
  if (type === "file") return Boolean(element instanceof HTMLInputElement && element.files?.length);
  if (element instanceof HTMLInputElement && type === "radio") {
    const group = radioGroupForElement(element, scope);
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
function isUploadHelperText(text) {
  const cleaned = cleanText(text).toLowerCase();
  if (!cleaned) return true;
  return /^(?:total\s+\d+|drop\s+or\s+select|drag\s+and\s+drop|no\s+file|browse|choose\s+file|select\s+file)/i.test(cleaned) || /\b(?:file|files)\s+selected\b/i.test(cleaned) || /^(?:\.pdf|\.doc|\.docx|pdf|doc|docx)$/i.test(cleaned);
}
function labelledByTextFrom(element, root) {
  if (!element) return "";
  const ids = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
  if (ids.length === 0) return "";
  const parts = ids.map((id) => {
    const target = root.querySelector(`#${CSS.escape(id)}`);
    if (!target) return "";
    if (target.matches("[data-testid*='screen-reader' i], [class*='screen-reader' i], [class*='sr-only' i]")) return "";
    const txt = cleanText(target.textContent);
    if (isUploadHelperText(txt)) return "";
    return txt;
  }).filter(Boolean);
  return cleanText(parts.join(" "));
}
function labelFromAttribute(val) {
  const cleaned = cleanText(val);
  if (!cleaned) return "";
  if (/cover[-_\s]*letter|cover/i.test(cleaned)) return "Cover Letter";
  if (/resume|cv/i.test(cleaned)) return "Resume";
  if (/portfolio|works|projects/i.test(cleaned)) return "Portfolio";
  if (/transcript|degree|education/i.test(cleaned)) return "Transcript";
  return "";
}
function fileUploadLabelFor(element, scope) {
  const root = scopeFor(element, scope);
  const uploadGroup = fileUploadGroupFor(element);
  const groupLabel = uploadGroup ? labelledByText(uploadGroup, root) : "";
  const explicitLabel = element.id ? root.querySelector(`label[for='${CSS.escape(element.id)}']`) : null;
  const parentLabel = element.closest("label");
  const controller = element.id ? root.querySelector(`[aria-controls='${CSS.escape(element.id)}']`) : null;
  const structuralLabel = containerLabelFor(element) || precedingQuestionLabel(element);
  const ariaLabelledByText = labelledByTextFrom(element, root) || labelledByTextFrom(parentLabel, root);
  const containerText = (() => {
    const parent = element.closest(
      "div[data-testid='field'], [class*='field' i], section, fieldset, [class*='upload' i], [class*='file' i], [class*='drop' i]"
    ) || element.parentElement?.parentElement;
    if (!parent) return "";
    const copy = parent.cloneNode(true);
    copy.querySelectorAll("input, button, svg, script, style, [data-testid*='screen-reader' i], [class*='screen-reader' i], [class*='sr-only' i]").forEach((n) => n.remove());
    const candidates2 = Array.from(copy.querySelectorAll("h1, h2, h3, h4, h5, legend, label, p, span, div")).map((el) => cleanText(el.textContent)).filter((txt) => txt.length >= 2 && txt.length <= 100 && !isUploadHelperText(txt));
    return candidates2[0] || "";
  })();
  const attributeHint = labelFromAttribute(element.id) || labelFromAttribute(element.name) || labelFromAttribute(element.getAttribute("data-testid")) || labelFromAttribute(parentLabel?.getAttribute("data-testid")) || labelFromAttribute(parentLabel?.id);
  const candidates = [
    groupLabel,
    ariaLabelledByText,
    explicitLabel?.textContent,
    labelTextWithoutControl(parentLabel),
    controller?.getAttribute("aria-label"),
    controller?.textContent,
    element.getAttribute("aria-label"),
    structuralLabel,
    containerText,
    attributeHint,
    element.getAttribute("name")
  ].map((str) => cleanText(str)).filter((str) => str && !isUploadHelperText(str));
  const text = candidates[0] || "";
  if (/resume|cv|履历|简历/i.test(text)) return "Resume";
  if (/cover\s*letter|求职信|自荐信/i.test(text)) return "Cover Letter";
  if (text) return cleanLabel(text);
  if (attributeHint) return attributeHint;
  const allFileInputs = Array.from(root.querySelectorAll("input[type='file']"));
  const inputIndex = allFileInputs.indexOf(element);
  if (inputIndex > 0) {
    return "Cover Letter";
  }
  return "Resume";
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
  const parentLabel = element.closest("label");
  if (parentLabel && isVisibleElement(parentLabel)) return true;
  const fieldContainer = element.closest("[data-testid='field'], [data-testid*='field' i]");
  if (fieldContainer && isVisibleElement(fieldContainer)) return true;
  const controller = element.id ? root.querySelector(`[aria-controls='${CSS.escape(element.id)}']`) : null;
  if (controller && isVisibleElement(controller)) return true;
  const dropZone = element.closest("[role='button'], button, label");
  if (dropZone) {
    const acceptsDocument = /(?:\.pdf|\.docx|\.doc|application\/pdf|wordprocessingml)/i.test(element.accept || "");
    if (isVisibleElement(dropZone) || acceptsDocument) return true;
  }
  const uploader = element.closest(
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
      "[data-test-form-element]"
    ].join(", ")
  );
  if (!uploader || !isVisibleElement(uploader)) return false;
  return Array.from(uploader.querySelectorAll("button, [role='button'], label, input")).some((control) => isVisibleElement(control));
}
export function isAutofillResumeInput(element) {
  const dropZone = element.closest("[role='button']");
  return Boolean(dropZone && /autofill from resume/i.test(cleanText(dropZone.textContent)));
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
export function fieldKeyFor(element, index, scope) {
  const explicit = cleanText(element.id) || cleanText(element.getAttribute("name"));
  if (explicit) return explicit;
  const label = cleanText(labelFor(element, scope || document));
  if (label && label !== "Unnamed field") {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    if (slug) return `field-${slug}`;
  }
  return `field-${index + 1}`;
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
  return group?.options.find((option) => {
    const text = cleanText(option.textContent || option.getAttribute("aria-label")).toLowerCase();
    return text === targetValue || targetValue.length > 1 && (text.includes(targetValue) || targetValue.includes(text));
  }) || null;
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
    if (type === "radio" && element instanceof HTMLInputElement) {
      const radioGroup = radioGroupForElement(element, scope);
      const groupKey = element.name || radioGroup.map((r) => r.id || r.value).join("-");
      if (seenRadioNames.has(groupKey)) continue;
      seenRadioNames.add(groupKey);
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
  for (const combobox of elementsInScope(scope)) {
    if (result.length >= 200) break;
    if (combobox instanceof HTMLInputElement || combobox.getAttribute("role") !== "combobox") continue;
    if (!isVisibleElement(combobox) || combobox.getAttribute("aria-disabled") === "true") continue;
    const key = fieldKeyFor(combobox, result.length, scope);
    if (result.some((field) => field.key === key || combobox.id && field.id === combobox.id)) continue;
    const value = cleanText(combobox.textContent);
    const label = labelFor(combobox, scope);
    const controlsId = cleanText(combobox.getAttribute("aria-controls"));
    let options = [];
    if (controlsId) {
      const listbox = scope.querySelector(`#${CSS.escape(controlsId)}`);
      if (listbox) {
        options = Array.from(listbox.querySelectorAll("[role='option'], li")).map((opt) => {
          const optLabel = cleanText(opt.textContent || opt.getAttribute("aria-label"));
          return { label: optLabel, value: optLabel };
        }).filter((opt) => Boolean(opt.label) && !isPlaceholderOption(opt.label, opt.value));
      }
    }
    result.push({
      key,
      id: cleanText(combobox.id) || void 0,
      name: cleanText(combobox.getAttribute("name")) || void 0,
      type: "select",
      label,
      required: requiredFor(combobox),
      filled: Boolean(value && !isPlaceholderOption(value, "selected")),
      sensitive: false,
      options,
      ...value && !isPlaceholderOption(value, "selected") ? { currentValue: value } : {}
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
  for (const element of ariaCheckboxElementsInScope(scope)) {
    if (result.length >= 200) break;
    const label = ariaCheckboxLabel(element, scope);
    const key = cleanText(element.id) || cleanText(element.getAttribute("name")) || `aria-checkbox-${result.length + 1}`;
    if (result.some((field) => field.key === key || field.type === "checkbox" && cleanLabel(field.label) === cleanLabel(label))) continue;
    result.push({
      key,
      id: cleanText(element.id) || void 0,
      name: cleanText(element.getAttribute("name")) || void 0,
      type: "checkbox",
      label,
      required: requiredFor(element),
      filled: ariaCheckboxIsChecked(element),
      sensitive: false,
      options: [],
      ...ariaCheckboxIsChecked(element) ? { currentValue: "true" } : {}
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
