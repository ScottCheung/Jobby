import type {
  FileUploadObservation,
  FormFieldObservation,
  FormFieldType,
  FormInspection,
  FormPlatform,
} from "../../shared/contracts/form-inspection";
import { inspectPageCombobox } from "./combobox-bridge";
import { canonicalizeFormFields } from "../../shared/utils/form-field-resolution";

const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image'])",
  "select",
  "textarea",
].join(", ");
const BUTTON_CHOICE_VALUE = /^(?:yes|no|true|false|agree|disagree|i agree|prefer not to say)$/i;
const PLACEHOLDER_OPTION_LABELS = new Set([
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
  "please choose a option",
]);
export type FormScope = Document | HTMLElement | ShadowRoot;
type QueryScope = FormScope | ShadowRoot;
type FormOption = { label: string; value: string };

export type JobAdderPhoneCountryControl = {
  countryList: HTMLInputElement;
  countryCode: HTMLInputElement;
  numberInput: HTMLInputElement;
  label: string;
  required: boolean;
  options: FormOption[];
};

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cleanLabel(value: string): string {
  return cleanText(value)
    .replace(/^\s*(?:\(?(?:Required|Optional|必填|选填)\)?|\*)+\s*/gi, "")
    .replace(/\s*(?:\(?(?:Required|Optional|必填|选填)\)?|\*)+\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAuxiliaryFieldLabel(label: string): boolean {
  return /^(?:autofill|apply[-\s]?later|quick[-\s]?apply|resume[-\s]?autofill)$/i.test(
    cleanLabel(label),
  );
}

function isHoneypotField(element: HTMLElement, label: string): boolean {
  const text = `${label} ${element.getAttribute("aria-label") || ""}`;
  return /(?:for robots? only|do not enter if you(?:'| a)re human|leave (?:this )?field blank|honeypot)/i.test(
    text,
  );
}

/** Help/error copy is useful to the page, but is not part of a field's intent. */
function isLikelyHelperText(value: string): boolean {
  const text = cleanText(value);
  if (!text) return true;
  return /^(?:optional|required|please (?:enter|select|choose)|this field is|required|invalid|error:|must be|we(?:'| a)ll use|your information will|by continuing|learn more|privacy (?:policy|notice)|character limit)/i.test(text) ||
    /^(?:accepted formats?|supported formats?|maximum file size|format:|e\.g\.?)/i.test(text);
}

function isValidationElement(element: HTMLElement): boolean {
  const className = typeof element.className === "string" ? element.className : "";
  return (
    element.getAttribute("role") === "alert" ||
    element.hasAttribute("aria-live") ||
    /(?:^|[-_\s])(?:error|errors|invalid|validation|helper|hint)(?:$|[-_\s])/i.test(className) ||
    /(?:error|validation|helper|hint)/i.test(element.id)
  );
}

function precedingQuestionLabel(element: HTMLElement): string {
  let container: HTMLElement | null = element.closest<HTMLElement>("[data-testid='field'], [data-testid*='field' i]") || element.parentElement;
  for (let depth = 0; container && depth < 4; depth += 1) {
    let sibling = container.previousElementSibling as HTMLElement | null;
    while (sibling) {
      if (isValidationElement(sibling)) {
        sibling = sibling.previousElementSibling as HTMLElement | null;
        continue;
      }
      const text = cleanText(sibling.textContent);
      if (text.length >= 8 && text.length <= 500 && !isLikelyHelperText(text) && !/^(?:search|select|choose)$/i.test(text)) {
        return cleanLabel(text);
      }
      sibling = sibling.previousElementSibling as HTMLElement | null;
    }
    container = container.parentElement;
  }
  return "";
}


const NOISY_LABEL_TAGS = new Set([
  "INPUT", "SELECT", "TEXTAREA", "BUTTON", "IMG", "SVG", "NOSCRIPT", "SCRIPT", "STYLE"
]);

function extractTextWithoutControls(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const el = node as HTMLElement;
  if (NOISY_LABEL_TAGS.has(el.tagName)) {
    return "";
  }
  const className = typeof el.className === "string" ? el.className.toLowerCase() : "";
  if (
    className.includes("helper-text") ||
    className.includes("help-block") ||
    className.includes("field-hint") ||
    className.includes("helper") ||
    className.includes("tooltip") ||
    className.includes("error") ||
    className.includes("hint") ||
    className.includes("screen-reader") ||
    className.includes("sr-only") ||
    className.includes("visually-hidden")
  ) {
    return "";
  }
  const role = el.getAttribute("role");
  if (role === "alert" || el.hasAttribute("aria-live")) {
    return "";
  }
  let text = "";
  for (let child = el.firstChild; child; child = child.nextSibling) {
    text += extractTextWithoutControls(child);
  }
  return text;
}

function labelTextWithoutControl(label: HTMLElement | null | undefined): string {
  if (!label) return "";
  return cleanLabel(extractTextWithoutControls(label));
}

function normalizedOptionLabel(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[.…]+$/g, "")
    .replace(/^[-–—\s]+|[-–—\s]+$/g, "")
    .replace(/\s+/g, " ");
}

/** Empty-value options and common prompt labels are not user answers. */
export function isPlaceholderOption(label: string, value = ""): boolean {
  const normalizedLabel = normalizedOptionLabel(label);
  const normalizedValue = cleanText(value);
  if (!normalizedValue) return true;
  if (PLACEHOLDER_OPTION_LABELS.has(normalizedLabel)) return true;
  return /^(?:please\s+)?(?:select|choose)\s+(?:an?|the)\s+(?:option|answer|value|country|location)$/i
    .test(normalizedLabel);
}

function observedOptionValue(value: string): string {
  return isPlaceholderOption(value, "observed") ? "" : cleanText(value);
}

export function isVisibleElement(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;

  // getComputedStyle(element) does not expose display:none on an ancestor in
  // every DOM implementation. Walk the composed tree so stale wizard steps,
  // hidden hydration copies, and controls inside hidden shadow hosts never
  // become candidate questions.
  let ancestor = composedParent(element);
  for (let depth = 0; ancestor && depth < 32; depth += 1) {
    if (
      ancestor.hidden ||
      ancestor.hasAttribute("inert") ||
      ancestor.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const ancestorStyle = window.getComputedStyle(ancestor);
    if (
      ancestorStyle.display === "none" ||
      ancestorStyle.visibility === "hidden" ||
      ancestorStyle.visibility === "collapse" ||
      ancestorStyle.opacity === "0"
    ) {
      return false;
    }
    ancestor = composedParent(ancestor);
  }

  // Fast path for Chromium / modern browser engines: native checkVisibility
  if (typeof (element as any).checkVisibility === "function") {
    if ((element as any).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      const rect = element.getBoundingClientRect();
      if (rect.right < -3000 || rect.left < -3000) return false;
      return true;
    }
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const hasSize =
    (rect.width > 0 && rect.height > 0) ||
    (element.offsetWidth > 0 && element.offsetHeight > 0);

  if (hasSize && rect.right >= -3000 && rect.left >= -3000) {
    return true;
  }

  const isFormInput =
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement;

  if (isFormInput) {
    const container = (element.closest(
      "label, fieldset, form, .form-group, .form-item, .form-field, .field-wrapper, [class*='control' i], [class*='field' i], [class*='radio' i], [class*='checkbox' i], [class*='select' i], [class*='t1-' i], [class*='jobwizard' i], [class*='question' i], [class*='component' i], [class*='item' i], [class*='container' i], [data-testid*='field' i], [data-testid*='question' i], [jobwizard_question_title_id]",
    ) || element.parentElement) as HTMLElement | null;
    if (container) {
      if (typeof (container as any).checkVisibility === "function") {
        if ((container as any).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
          const cRect = container.getBoundingClientRect();
          if (cRect.left >= -3000) return true;
        }
      } else {
        const containerStyle = window.getComputedStyle(container);
        const containerRect = container.getBoundingClientRect();
        const containerHasSize =
          (containerRect.width > 0 && containerRect.height > 0) ||
          (container.offsetWidth > 0 && container.offsetHeight > 0);
        if (
          containerStyle.display !== "none" &&
          containerStyle.visibility !== "hidden" &&
          containerHasSize &&
          containerRect.left >= -3000
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function isDropdownSearchFilter(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  // Select2 v3 keeps an off-screen focus proxy and a transient search input
  // next to the real application field. JobAdder uses those proxies for its
  // phone-country picker; neither control stores a candidate answer.
  if (
    element.classList.contains("select2-focusser") ||
    element.classList.contains("select2-input") ||
    element.classList.contains("select2-offscreen")
  ) {
    return true;
  }
  if (
    element.classList.contains("iti__search-input") ||
    Boolean(
      element.closest(
        ".iti__dropdown-content, .iti__country-list, .select2-search, .select2-dropdown, .iti__search, [class*='iti__dropdown' i], [class*='iti__search' i]",
      ),
    )
  ) {
    return true;
  }
  const role = element.getAttribute("role");
  if (
    role === "searchbox" &&
    Boolean(
      element.closest(
        "[role='listbox'], [role='menu'], [class*='dropdown' i], [class*='select' i]",
      ),
    )
  ) {
    return true;
  }
  if (
    Boolean(
      element.closest(
        "[role='listbox'], [role='menu'], ul[class*='country-list' i]",
      ),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Application pages commonly keep alternate "apply later" or resume
 * autofill controls mounted beside the active form. They are implementation
 * affordances, not questions the candidate should answer. Filtering them at
 * candidate collection time prevents the panel and backend from learning a
 * bogus field just because a site uses a different class name.
 */
function isAuxiliaryApplicationControl(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  const identifier = [
    element.id,
    element.getAttribute("name"),
    typeof element.className === "string" ? element.className : "",
    element.getAttribute("data-testid"),
    element.getAttribute("data-automation-id"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // A real user-facing field may describe an autofill preference, but it
  // will normally have an explicit label. The controls matched here are the
  // hidden/alternate form implementation itself.
  const hasExplicitQuestion = Boolean(
    element.getAttribute("aria-label") ||
      element.getAttribute("aria-labelledby") ||
      (element.id && element.ownerDocument.querySelector(`label[for='${CSS.escape(element.id)}']`)),
  );
  return (
    !hasExplicitQuestion &&
    /(?:autofill|apply[-_]?later|quick[-_]?apply)/.test(identifier)
  );
}

function isInspectableControl(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  return (
    !element.disabled &&
    element.getAttribute("aria-disabled") !== "true" &&
    element.getAttribute("aria-hidden") !== "true" &&
    !isDropdownSearchFilter(element) &&
    !isAuxiliaryApplicationControl(element)
  );
}

export function queryAllInScope<T extends HTMLElement>(scope: FormScope, selector: string): T[] {
  const results: T[] = [];
  const visitedRoots = new Set<Document | HTMLElement | ShadowRoot>();

  const visit = (root: Document | HTMLElement | ShadowRoot) => {
    if (visitedRoots.has(root)) return;
    visitedRoots.add(root);
    results.push(...Array.from(root.querySelectorAll<T>(selector)));
    if (root instanceof HTMLElement && root.shadowRoot) visit(root.shadowRoot);
    const hosts = root.querySelectorAll<HTMLElement>("*");
    for (let i = 0; i < hosts.length; i++) {
      const el = hosts[i];
      if (el && el.shadowRoot) visit(el.shadowRoot);
    }
  };

  visit(scope);
  return results;
}

function ariaCheckboxElementsInScope(scope: FormScope): HTMLElement[] {
  const elements = queryAllInScope<HTMLElement>(scope, "[role='checkbox']");
  return elements.filter((element) => {
    if (element.getAttribute("aria-disabled") === "true" || element.getAttribute("aria-hidden") === "true") return false;
    return isVisibleElement(element);
  });
}

function ariaCheckboxLabel(element: HTMLElement, scope: FormScope): string {
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

function ariaCheckboxIsChecked(element: HTMLElement): boolean {
  return element.getAttribute("aria-checked") === "true" ||
    element.getAttribute("data-state") === "checked" ||
    element.classList.contains("checked") ||
    element.classList.contains("selected");
}

function isDocumentSelectionRadio(element: HTMLInputElement): boolean {
  return (
    element.type.toLowerCase() === "radio" &&
    (element.id.startsWith("jobsDocumentCardToggle") || Boolean(element.closest(".jobs-document-upload-redesign-card")))
  );
}

function fieldType(element: HTMLElement): FormFieldType {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element.getAttribute("role") === "combobox" || isSelectableCombobox(element)) return "select";
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    // JobAdder validates telephone fields with `data-val-phone` while
    // rendering them as type=text. Keep their actual semantic type.
    if (type === "text" && element.hasAttribute("data-val-phone")) return "tel";
    if (type === "text" || type === "search") return "text";
    if (type === "checkbox" || type === "radio" || type === "file") return type;
    if (["number", "email", "tel", "url", "date", "password"].includes(type)) return type as FormFieldType;
  }
  return "unknown";
}

export function isGreenhouseLocation(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  const id = cleanText(element.id).toLowerCase();
  const name = cleanText(element.getAttribute("name")).toLowerCase();
  const isGreenhousePage = Boolean(
    element.closest("#grnhse_app, .job-post-container, form.application--form, form[action*='greenhouse.io']") ||
    document.querySelector("#grnhse_app, .job-post-container, form.application--form, form[action*='greenhouse.io'], #job_application_location_id, input[name*='location_id']") ||
    (typeof window !== "undefined" && /(?:^|\.)(?:boards|job-boards)\.greenhouse\.io$/i.test(window.location.hostname))
  );
  if (
    id === "job_application_location" ||
    id === "candidate_location" ||
    name === "job_application[location]" ||
    name === "candidate[location]" ||
    id.includes("location_autocomplete") ||
    element.classList.contains("ui-autocomplete-input")
  ) {
    return true;
  }
  if (isGreenhousePage && (id === "location" || name === "location" || id.includes("location") || name.includes("location"))) {
    return true;
  }
  return false;
}

export function isSelectableCombobox(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  if (isGreenhouseLocation(element)) return true;
  const role = element.getAttribute("role");
  const ariaHasPopup = element.getAttribute("aria-haspopup");
  const ariaAutocomplete = element.getAttribute("aria-autocomplete");
  if (
    role === "combobox" &&
    (ariaAutocomplete === "list" ||
      ariaAutocomplete === "both" ||
      ariaHasPopup === "listbox" ||
      ariaHasPopup === "true")
  ) {
    return true;
  }
  if (ariaHasPopup === "listbox" || ariaHasPopup === "grid") {
    return true;
  }
  const container = element.closest(
    "[class*='select' i], [class*='dropdown' i], [class*='combobox' i], [class*='lookup' i], [class*='t1-lookup' i], [class*='t1-select' i], [class*='t1-dropdown' i]",
  );
  if (
    container &&
    (element.readOnly ||
      element.getAttribute("aria-expanded") !== null ||
      role === "combobox" ||
      container.matches("[class*='lookup' i], [class*='t1-lookup' i]"))
  ) {
    return true;
  }
  return false;
}

function scopeFor(element: HTMLElement, fallback: FormScope): QueryScope {
  const root = element.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot ? root : fallback;
}

function composedParent(element: HTMLElement): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ?
      root.host
    : null;
}

function closestComposed(
  element: HTMLElement,
  selector: string,
  maxDepth = 32,
): HTMLElement | null {
  let candidate: HTMLElement | null = element;
  for (let depth = 0; candidate && depth < maxDepth; depth += 1) {
    if (candidate.matches(selector)) return candidate;
    candidate = composedParent(candidate);
  }
  return null;
}

function smartRecruitersAutocompleteHost(
  element: HTMLElement,
): HTMLElement | null {
  return closestComposed(
    element,
    "spl-autocomplete[data-test='location-autocomplete'], spl-autocomplete[data-sr-id*='location-autocomplete' i]",
  );
}

function smartRecruitersAutocompleteIsCommitted(
  element: HTMLElement,
): boolean | undefined {
  const host = smartRecruitersAutocompleteHost(element);
  if (!host) return undefined;
  const className = host.getAttribute('class') || '';
  if (/\bng-invalid\b/.test(className)) return false;
  return Boolean(
    cleanText(host.getAttribute('value')) || /\bng-valid\b/.test(className),
  );
}

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
  add(element.closest<HTMLElement>("label, [role='checkbox']"));

  let parent = element.parentElement;
  for (let depth = 0; parent && depth < 4; depth += 1) {
    if (
      parent.matches(
        "label, [role='checkbox'], [aria-checked], [aria-pressed], [data-state='checked'], [data-state='unchecked']",
      )
    ) {
      add(parent);
    }
    parent = parent.parentElement;
  }

  return Array.from(elements);
}

export function checkboxIsChecked(element: HTMLInputElement, scope: FormScope): boolean {
  const presentation = checkboxPresentationElements(element, scope);
  const semanticState = presentation
    .map((candidate) => {
      const ariaChecked = candidate.getAttribute("aria-checked");
      if (ariaChecked === "true") return true;
      if (ariaChecked === "false") return false;
      const ariaPressed = candidate.getAttribute("aria-pressed");
      if (ariaPressed === "true") return true;
      if (ariaPressed === "false") return false;
      const dataState = candidate.getAttribute("data-state");
      if (dataState === "checked" || dataState === "selected") return true;
      if (dataState === "unchecked") return false;
      return undefined;
    })
    .find((state) => state !== undefined);
  return semanticState ?? element.checked;
}

function comboboxContainerFor(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(".select-shell, [data-testid*='select' i], [class*='select' i], [class*='dropdown' i], [class*='t1-' i]") ||
    element.parentElement;
}

function controlledListboxFor(element: HTMLElement): HTMLElement | null {
  const listboxId = cleanText(element.getAttribute("aria-controls"));
  if (!listboxId) return null;
  const root = element.getRootNode();
  const localRoot = root instanceof Document || root instanceof ShadowRoot ? root : document;
  return (
    localRoot.querySelector<HTMLElement>(`#${CSS.escape(listboxId)}`) ||
    (localRoot !== document
      ? document.querySelector<HTMLElement>(`#${CSS.escape(listboxId)}`)
      : null) ||
    queryAllInScope<HTMLElement>(document, "[role='listbox']").find(
      (candidate) => candidate.id === listboxId,
    ) ||
    null
  );
}

function openComboboxValueIsCommitted(element: HTMLInputElement): boolean {
  if (element.getAttribute("aria-expanded") !== "true") return true;
  const inputValue = cleanText(element.value).toLowerCase();
  if (!inputValue) return false;
  const selectedOption = controlledListboxFor(element)?.querySelector<HTMLElement>(
    "[role='option'][aria-selected='true'], [role='option'][aria-checked='true'], [role='option'][data-state='selected'], [role='option'][data-state='checked']",
  );
  const selectedValue = cleanText(
    selectedOption?.getAttribute("aria-label") || selectedOption?.textContent,
  ).toLowerCase();
  return Boolean(selectedValue && selectedValue === inputValue);
}

export function isPhoneCountryElement(element: HTMLElement): boolean {
  const id = cleanText(element.id).toLowerCase();
  const name = cleanText(element.getAttribute("name")).toLowerCase();
  const ariaLabel = cleanText(element.getAttribute("aria-label")).toLowerCase();
  const title = cleanText(element.getAttribute("title")).toLowerCase();
  const placeholder = cleanText(element.getAttribute("placeholder")).toLowerCase();

  if (id === "country" || name === "country") return true;

  const countryKeywords = [
    "phone_country", "phone-country", "country_code", "country-code",
    "phone_code", "phone-code", "dial_code", "dial-code", "calling_code",
    "countrycode", "phonecountry", "phonecountrycode", "phone_dial"
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

export function comboboxCurrentValue(element: HTMLElement): string {
  // SmartRecruiters keeps the committed location object on the outer
  // spl-autocomplete host. Text in the nested input is only a search query
  // and must not be reported as a selected City until that host is valid.
  if (smartRecruitersAutocompleteIsCommitted(element) === false) return "";

  const bridgedValue = observedOptionValue(inspectPageCombobox(element)?.currentValue || "");
  if (bridgedValue) return bridgedValue;

  // Autocomplete inputs contain the search query while their popup is open.
  // Ashby, for example, highlights "Sydney, New South Wales, Australia" but
  // leaves the input as "Sydney" until the option is actually committed.
  if (element instanceof HTMLInputElement && !openComboboxValueIsCommitted(element)) return "";

  const rawValue = element instanceof HTMLInputElement ? element.value : element.getAttribute("value");
  const directValue = observedOptionValue(cleanText(rawValue));
  const container = comboboxContainerFor(element);
  const displayedValue = observedOptionValue(
    cleanText(
      container?.querySelector<HTMLElement>(
        ".select__single-value, [class*='single-value' i], [class*='singleValue' i], [class*='selected' i], [class*='value' i], [class*='trigger' i], [class*='display' i], [class*='selection' i]",
      )?.textContent,
    ),
  );
  const buttonValue = observedOptionValue(
    cleanText(container?.querySelector<HTMLElement>("button, [role='combobox']")?.textContent),
  );
  const selfText = observedOptionValue(cleanText(element.textContent));

  const resolved = directValue || displayedValue || buttonValue || selfText;

  // Phone-country selector displays only the dial code (for
  // example, "+61") after selection while retaining the ISO code on its
  // flag element. Normalize that display back to the country label so the
  // panel and backend compare the same value.
  if (isPhoneCountryElement(element)) {
    const flagClass = Array.from(
      container?.querySelector<HTMLElement>("[class*='iti__flag']")?.classList || [],
    ).find((name) => /^iti__[a-z]{2}$/i.test(name));
    const code = flagClass?.slice("iti__".length).toUpperCase();
    if (code && typeof Intl.DisplayNames === "function") {
      const country = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      if (country) return country;
    }
  }
  return resolved;
}

function liveComboboxOptions(element: HTMLInputElement, scope: QueryScope): FormOption[] {
  const listboxId = cleanText(element.getAttribute("aria-controls"));
  if (!listboxId) return [];
  const listbox = scope.querySelector<HTMLElement>(`#${CSS.escape(listboxId)}`);
  if (!listbox) return [];
  return Array.from(listbox.querySelectorAll<HTMLElement>("[role='option']")).map((option) => {
    const label = cleanText(option.textContent || option.getAttribute("aria-label"));
    return { label, value: label };
  }).filter((option) => Boolean(option.label) && !isPlaceholderOption(option.label, option.value));
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function greenhouseJobPost(value: unknown, visited = new Set<object>(), depth = 0): Record<string, unknown> | null {
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

function greenhouseQuestionOptions(element: HTMLInputElement): FormOption[] {
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
          value: rawValue === undefined || rawValue === null ? label : String(rawValue),
        };
      }).filter((option) => Boolean(option.label) && !isPlaceholderOption(option.label, option.value));
    }
  }
  return [];
}

const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AR", "AT", "AU", "AW",
  "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BN", "BO",
  "BR", "BS", "BT", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH", "CI",
  "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CY", "CZ", "DE", "DJ", "DK",
  "DM", "DO", "DZ", "EC", "EE", "EG", "ER", "ES", "ET", "FI", "FJ", "FM",
  "FR", "GA", "GB", "GD", "GE", "GH", "GM", "GN", "GQ", "GR", "GT", "GW",
  "GY", "HK", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IN", "IQ", "IR",
  "IS", "IT", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP",
  "KR", "KW", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU",
  "LV", "LY", "MA", "MC", "MD", "ME", "MG", "MH", "MK", "ML", "MM", "MN",
  "MR", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NE", "NG", "NI",
  "NL", "NO", "NP", "NR", "NZ", "OM", "PA", "PE", "PG", "PH", "PK", "PL",
  "PT", "PW", "PY", "QA", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD",
  "SE", "SG", "SI", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV",
  "SY", "SZ", "TD", "TG", "TH", "TJ", "TL", "TM", "TN", "TO", "TR", "TT",
  "TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC", "VE", "VN",
  "VU", "WS", "YE", "ZA", "ZM", "ZW",
] as const;

function countryOptions(element: HTMLInputElement): FormOption[] {
  if (!isPhoneCountryElement(element)) return [];
  const displayNames = typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
  return COUNTRY_CODES
    .map((code) => ({ label: displayNames?.of(code) || code, value: displayNames?.of(code) || code }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function jobAdderCountryOptions(
  numberInput: HTMLInputElement,
  scope: FormScope,
): FormOption[] {
  const localField = numberInput.closest<HTMLElement>(".form-field");
  const lists = [
    ...(localField ? Array.from(localField.querySelectorAll<HTMLLIElement>(".phone-number-country-list li")) : []),
    ...queryAllInScope<HTMLLIElement>(scope, ".phone-number-country-list li"),
  ];
  const seen = new Set<string>();
  const options: FormOption[] = [];
  for (const item of lists) {
    try {
      const parsed = JSON.parse(cleanText(item.textContent)) as { id?: unknown; text?: unknown };
      const value = cleanText(typeof parsed.id === "string" ? parsed.id : "");
      const label = cleanText(typeof parsed.text === "string" ? parsed.text : "");
      if (!value || !label || seen.has(value)) continue;
      seen.add(value);
      options.push({ label, value });
    } catch {
      // JobAdder embeds JSON text in each country option. Ignore unrelated
      // list items rather than turning them into selectable answers.
    }
  }
  return options;
}

/**
 * JobAdder's phone-country picker is a Select2 widget backed by hidden
 * inputs. The visible focus proxy is not fillable, but the backing fields are
 * stable and can be driven by the widget's native change handler.
 */
export function jobAdderPhoneCountryControls(
  scope: FormScope = document,
): JobAdderPhoneCountryControl[] {
  const controls: JobAdderPhoneCountryControl[] = [];
  const numbers = queryAllInScope<HTMLInputElement>(scope, "input[data-val-phone]");
  for (const numberInput of numbers) {
    const row = numberInput.closest<HTMLElement>(".flex-row") || numberInput.parentElement;
    const countryList = row?.querySelector<HTMLInputElement>("input.country-list");
    const countryCode = row?.querySelector<HTMLInputElement>("input[name$='CountryCode'], input[id$='_CountryCode']");
    if (!countryList || !countryCode) continue;

    const identifier = `${numberInput.id} ${numberInput.name}`.toLowerCase();
    const label = /(?:candidate)?mobile(?:[._-]|$)/.test(identifier)
      ? "Mobile country code"
      : "Phone country code";
    controls.push({
      countryList,
      countryCode,
      numberInput,
      label,
      required: requiredFor(numberInput),
      options: jobAdderCountryOptions(numberInput, scope),
    });
  }
  return controls;
}

function greenhouseChoiceOptions(
  element: HTMLInputElement,
  scope: QueryScope,
): FormOption[] {
  if (!element.id.startsWith("question_")) return [];
  const label = cleanLabel(labelFor(element, scope)).toLowerCase();
  if (!/(citizen|relocat|clearance)/i.test(label)) return [];
  return ["Yes", "No"].map((value) => ({ label: value, value }));
}

export function comboboxOptionsFor(element: HTMLInputElement, scope: QueryScope): FormOption[] {
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

function optionLabelFor(element: HTMLElement, scope: QueryScope): string {
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return cleanLabel(ariaLabel);

  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return cleanLabel(text);
  }

  const parentLabel = labelTextWithoutControl(element.closest("label"));
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

function isOptionLabelElement(candidate: HTMLElement, element: HTMLElement): boolean {
  if (candidate.contains(element)) return true;

  const targetId = candidate.getAttribute("for");
  if (targetId) {
    const root = element.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : document;
    const targetInput = queryScope.querySelector<HTMLInputElement>(`#${CSS.escape(targetId)}`);
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

export function containerLabelFor(element: HTMLElement): string {
  const root = scopeFor(element, document);

  // Check jobwizard_question_title_id attribute matching element's input id or title_id (used in Rippling ATS)
  const targetId = cleanText(element.id) ||
    cleanText(element.getAttribute("jobwizard_question_input_id")) ||
    cleanText(element.getAttribute("extra_data_id"));
  if (targetId) {
    const titleElem = root.querySelector<HTMLElement>(`[jobwizard_question_title_id='${CSS.escape(targetId)}']`);
    const titleText = cleanText(titleElem?.textContent);
    if (titleText) return cleanLabel(titleText);
  }

  const titleContainer = element.closest<HTMLElement>("[jobwizard_question_title_id]");
  const titleId = titleContainer?.getAttribute("jobwizard_question_title_id");
  if (titleId) {
    const labelElem = root.querySelector<HTMLElement>(`#${CSS.escape(titleId)}-label, #${CSS.escape(titleId)}`) ||
      root.querySelector<HTMLElement>(`[jobwizard_question_title_id='${CSS.escape(titleId)}']`);
    const titleText = cleanText(labelElem?.textContent);
    if (titleText) return cleanLabel(titleText);
  }

  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (current.matches("body, html")) break;
    // A form contains labels for every question. Once the local wrapper has
    // been exhausted, choosing the first label in the whole form is unsafe.
    if (current.matches("form, [role='form']")) break;

    const labelCandidates = Array.from(
      current.querySelectorAll<HTMLElement>(
        "legend, label, [class*='label' i], [class*='prompt' i], [class*='question' i], [class*='title' i], [class*='name' i], [class*='heading' i], [class*='caption' i], [class*='text' i], [class*='description' i], [class*='t1-' i], [data-label], [data-prompt]",
      ),
    );

    for (const candidate of labelCandidates) {
      if (isOptionLabelElement(candidate, element)) continue;

      const text = labelTextWithoutControl(candidate);
      if (text && text.length >= 2 && text.length <= 400 && !isLikelyHelperText(text)) {
        if (!BUTTON_CHOICE_VALUE.test(text)) {
          return cleanLabel(text);
        }
      }
    }

    let sibling = current.previousElementSibling as HTMLElement | null;
    while (sibling) {
      if (!sibling.matches("input, select, textarea, button")) {
        const text = cleanText(sibling.textContent);
        if (text && text.length >= 2 && text.length <= 400 && !isLikelyHelperText(text) && !BUTTON_CHOICE_VALUE.test(text)) {
          return cleanLabel(text);
        }
      }
      sibling = sibling.previousElementSibling as HTMLElement | null;
    }

    current = current.parentElement;
  }

  return "";
}

export function cleanPlaceholderLabel(placeholder: string): string {
  const cleaned = cleanText(placeholder);
  if (!cleaned) return "";
  const stripped = cleaned
    .replace(/^(?:e\.g\.?|eg|example|enter|please enter|type|please type|select|please select|choose|please choose)\s+/i, "")
    .replace(/^[.:\s]+|[.:\s]+$/g, "");
  return cleanLabel(stripped || cleaned);
}

/**
 * Web components commonly keep the native input in a shadow root and put its
 * human label on the host element (for example SmartRecruiters'
 * `<spl-input label="City">`). The input cannot see that label through its
 * own root, so walk out through shadow hosts before falling back to an ID or
 * an anonymous field name.
 */
function shadowHostLabelFor(element: HTMLElement): string {
  let current: HTMLElement = element;
  for (let depth = 0; depth < 4; depth += 1) {
    const root = current.getRootNode();
    if (!(root instanceof ShadowRoot)) break;
    const host = root.host as HTMLElement;
    const label = cleanText(
      host.getAttribute("aria-label") ||
        host.getAttribute("label") ||
        host.getAttribute("data-label") ||
        host.getAttribute("data-prompt") ||
        host.getAttribute("title"),
    );
    if (label) return cleanLabel(label);

    const hostId = cleanText(host.id);
    const hostRoot = host.getRootNode();
    if (hostId && (hostRoot instanceof Document || hostRoot instanceof ShadowRoot)) {
      const externalLabel = hostRoot.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(hostId)}']`);
      const externalLabelText = labelTextWithoutControl(externalLabel);
      if (externalLabelText) return cleanLabel(externalLabelText);
    }
    current = host;
  }
  return "";
}

export function labelFor(element: HTMLElement, scope: QueryScope): string {
  const isRadio = element instanceof HTMLInputElement && element.type.toLowerCase() === "radio";

  if (isRadio) {
    const fieldset = element.closest("fieldset");
    const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
    if (legend) return cleanLabel(legend);

    const radiogroup = element.closest<HTMLElement>("[role='radiogroup']");
    if (radiogroup) {
      const groupLabel = labelledByText(radiogroup, scope) || cleanText(radiogroup.getAttribute("aria-label"));
      if (groupLabel) return cleanLabel(groupLabel);
    }

    const questionLabel = precedingQuestionLabel(element);
    if (questionLabel) return questionLabel;
    const containerLabel = containerLabelFor(element);
    if (containerLabel) return containerLabel;
  }

  // Phone dialing country control nested in or near Phone input
  if (isPhoneCountryElement(element)) return "Phone country";

  const labelledByIds = cleanText(element.getAttribute("aria-labelledby"))
    .split(/\s+/)
    .filter(Boolean);
  if (labelledByIds.length > 0) {
    const labelledByText = cleanText(
      labelledByIds
        .map((id) => scope.querySelector(`#${CSS.escape(id)}`)?.textContent || "")
        .join(" "),
    );
    if (labelledByText) return cleanLabel(labelledByText);
  }

  const isGenericActionLabel = (text: string) =>
    /^(?:search|filter|type|select|choose|enter|type to search)$/i.test(text.trim());

  const labelledBy = cleanText(element.getAttribute("aria-label"));
  if (labelledBy && !isGenericActionLabel(labelledBy)) return cleanLabel(labelledBy);

  const dataLabel = cleanText(element.getAttribute("data-label") || element.getAttribute("data-prompt") || element.getAttribute("title"));
  if (dataLabel && !isGenericActionLabel(dataLabel)) return cleanLabel(dataLabel);

  const shadowHostLabel = shadowHostLabelFor(element);
  if (shadowHostLabel && !isGenericActionLabel(shadowHostLabel)) return shadowHostLabel;

  if (!isRadio) {
    const id = cleanText(element.id);
    if (id) {
      const label = scope.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(id)}']`);
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

  // JobAdder nests its Phone/Mobile fields without associating a label to the
  // real input. Use its stable rendered-number identifiers before the broad
  // container fallback can inherit another question's label.
  if (element instanceof HTMLInputElement && element.hasAttribute("data-val-phone")) {
    const identifier = `${element.id} ${element.name}`.toLowerCase();
    if (/(?:candidate)?mobile(?:[._-]|$)/.test(identifier)) return "Mobile";
    if (/(?:candidate)?phone(?:[._-]|$)/.test(identifier)) return "Phone";
  }

  const questionLabel = precedingQuestionLabel(element);
  if (questionLabel) return questionLabel;

  const structuralLabel = containerLabelFor(element);
  if (structuralLabel) return structuralLabel;

  if (isRadio) {
    const id = cleanText(element.id);
    if (id) {
      const label = scope.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(id)}']`);
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

function requiredFor(element: HTMLElement): boolean {
  if (element.hasAttribute("required") || element.getAttribute("aria-required") === "true") return true;
  const fieldset = element.closest("fieldset");
  if (fieldset?.hasAttribute("required") || fieldset?.getAttribute("aria-required") === "true") return true;

  const root = scopeFor(element, document);
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const parentLabel = element.closest<HTMLLabelElement>("label");
  const legend = fieldset?.querySelector("legend");
  const labelledByMarker = cleanText(element.getAttribute("aria-labelledby"))
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => cleanText(root.querySelector(`#${CSS.escape(id)}`)?.textContent))
    .filter(Boolean)
    .join(" ");
  const markerContainer = element.closest<HTMLElement>(
    "[data-required], [class~='required'], [class*='form-field' i], [class*='question' i], [data-testid*='field' i]",
  );
  const markerText = cleanText([
    explicitLabel?.textContent,
    parentLabel?.textContent,
    legend?.textContent,
    labelledByMarker,
  ].filter(Boolean).join(" "));
  if (!/\boptional\b|选填/i.test(markerText)) {
    if (/\*|\brequired\b|必填/i.test(markerText)) return true;
    if (
      markerContainer?.getAttribute("data-required") === "true" ||
      markerContainer?.classList.contains("required") ||
      Boolean(markerContainer?.querySelector("[data-required='true'], [class~='required-marker'], [data-testid*='required-mark' i]"))
    ) {
      return true;
    }
  }

  const metadata = element.closest<HTMLElement>("[data-t1-control]")?.getAttribute("data-t1-control");
  if (metadata) {
    try {
      const parsed = JSON.parse(metadata) as { IsMandatory?: unknown };
      if (parsed.IsMandatory === true) return true;
    } catch {
      // Ignore malformed page metadata and keep the native attribute checks.
    }
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
    const containerRadios = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='radio']"));
    if (containerRadios.length >= 2) return containerRadios;
    container = container.parentElement;
  }
  return [element];
}

function optionsFor(
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

function currentValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, type: FormFieldType, scope: QueryScope): string | undefined {
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

function isFilled(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, type: FormFieldType, scope: QueryScope): boolean {
  if (type === "file") return Boolean(element instanceof HTMLInputElement && element.files?.length);
  // Password values must never be included in the inspection payload, but
  // their presence is safe to use for the side-panel completion indicator.
  if (type === "password") return Boolean(element instanceof HTMLInputElement && element.value);
  if (element instanceof HTMLInputElement && type === "radio") {
    const group = radioGroupForElement(element, scope);
    return group.some((r) => r.checked);
  }
  if (element instanceof HTMLInputElement && type === "checkbox") return checkboxIsChecked(element, scope);
  if (type === "select" && smartRecruitersAutocompleteIsCommitted(element) === false) return false;
  return Boolean(currentValue(element, type, scope));
}

function labelledByText(element: HTMLElement, scope: QueryScope): string {
  const ids = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
  return cleanText(ids.map((id) => scope.querySelector(`#${CSS.escape(id)}`)?.textContent).join(" "));
}

function fileUploadGroupFor(element: HTMLInputElement): HTMLElement | null {
  return closestComposed(
    element,
    [
      "[role='group'][aria-labelledby]",
      ".file-upload",
      "[class*='file-upload' i]",
      "[data-test='resume-upload-container']",
      "[data-test='resume-upload']",
      "[data-testid*='resume-upload' i]",
    ].join(', '),
  );
}

function composedUploadAttributeHint(element: HTMLInputElement): string {
  let candidate: HTMLElement | null = element;
  for (let depth = 0; candidate && depth < 24; depth += 1) {
    for (const attribute of ['data-test', 'data-testid', 'data-sr-id', 'id', 'name']) {
      const hint = labelFromAttribute(candidate.getAttribute(attribute));
      if (hint) return hint;
    }
    candidate = composedParent(candidate);
  }
  return '';
}

function composedUploadContainer(element: HTMLInputElement): HTMLElement | null {
  return closestComposed(
    element,
    [
      "[data-test='resume-upload-container']",
      "[data-testid*='resume-upload' i]",
      "[data-testid*='cover-letter' i]",
      "[data-test*='document-upload' i]",
      "section",
      "fieldset",
    ].join(', '),
  );
}

function semanticFileKey(element: HTMLInputElement): string {
  let candidate: HTMLElement | null = element;
  for (let depth = 0; candidate && depth < 24; depth += 1) {
    for (const attribute of ['data-test', 'data-testid', 'data-sr-id']) {
      const value = cleanText(candidate.getAttribute(attribute));
      if (!value || !/(?:resume|cv|cover|document|attachment|upload)/i.test(value)) continue;
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      if (slug) return `file-${slug}`;
    }
    candidate = composedParent(candidate);
  }
  return '';
}

function isUploadHelperText(text: string): boolean {
  const cleaned = cleanText(text).toLowerCase();
  if (!cleaned) return true;
  return (
    /^(?:total\s+\d+|drop\s+or\s+select|drag\s+and\s+drop|no\s+file|browse|choose\s+file|select\s+file)/i.test(cleaned) ||
    /\b(?:file|files)\s+selected\b/i.test(cleaned) ||
    /^(?:\.pdf|\.doc|\.docx|pdf|doc|docx)$/i.test(cleaned)
  );
}

function labelledByTextFrom(element: HTMLElement | null | undefined, root: QueryScope): string {
  if (!element) return "";
  const ids = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
  if (ids.length === 0) return "";
  const parts = ids
    .map((id) => {
      const target = root.querySelector(`#${CSS.escape(id)}`);
      if (!target) return "";
      if (target.matches("[data-testid*='screen-reader' i], [class*='screen-reader' i], [class*='sr-only' i]")) return "";
      const txt = cleanText(target.textContent);
      if (isUploadHelperText(txt)) return "";
      return txt;
    })
    .filter(Boolean);
  return cleanText(parts.join(" "));
}

function labelFromAttribute(val: string | null | undefined): string {
  const cleaned = cleanText(val);
  if (!cleaned) return "";
  if (/cover[-_\s]*letter|cover/i.test(cleaned)) return "Cover Letter";
  if (/resume|cv/i.test(cleaned)) return "Resume";
  if (/portfolio|works|projects/i.test(cleaned)) return "Portfolio";
  if (/transcript|degree|education/i.test(cleaned)) return "Transcript";
  return "";
}

function fileUploadLabelFor(element: HTMLInputElement, scope: FormScope): string {
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
    return 'Resume';
  }
  if (/cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/i.test(composedHeading)) {
    return 'Cover Letter';
  }
  const groupLabel = uploadGroup ? labelledByText(uploadGroup, root) : "";
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const parentLabel = element.closest<HTMLLabelElement>("label");
  const controller = element.id
    ? root.querySelector<HTMLElement>(`[aria-controls='${CSS.escape(element.id)}']`)
    : null;
  const structuralLabel = containerLabelFor(element) || precedingQuestionLabel(element);

  const ariaLabelledByText = labelledByTextFrom(element, root) || labelledByTextFrom(parentLabel, root);

  const containerText = (() => {
    const parent = element.closest<HTMLElement>(
      "div[data-testid='field'], [class*='field' i], section, fieldset, [class*='upload' i], [class*='file' i], [class*='drop' i]",
    ) || element.parentElement?.parentElement;
    if (!parent) return "";
    const directHeading = parent.querySelector<HTMLElement>("h1, h2, h3, h4, h5, legend, label");
    if (directHeading) {
      const txt = cleanLabel(extractTextWithoutControls(directHeading));
      if (txt.length >= 2 && txt.length <= 100 && !isUploadHelperText(txt)) return txt;
    }
    const txt = cleanLabel(extractTextWithoutControls(parent));
    return txt.length >= 2 && txt.length <= 100 && !isUploadHelperText(txt) ? txt : "";
  })();

  const nearbyButtonText = (() => {
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1) {
      const btn = parent.querySelector<HTMLElement>(
        "button, [role='button'], label, a, .btn, [class*='btn' i]",
      );
      if (btn && isVisibleElement(btn)) {
        const btnText = cleanLabel(extractTextWithoutControls(btn));
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
  ].map((str) => cleanText(str)).filter((str) => str && !isUploadHelperText(str));

  const text = candidates[0] || "";

  if (/resume|curriculum vitae|\bcv\b|履历|简历/i.test(text)) return "Resume";
  if (/cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/i.test(text)) return "Cover Letter";
  if (text) return cleanLabel(text);

  if (attributeHint) return attributeHint;

  const allFileInputs = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='file']"));
  const inputIndex = allFileInputs.indexOf(element);
  if (inputIndex > 0) {
    return "Cover Letter";
  }
  return "Resume";
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

function uploadErrorFor(element: HTMLInputElement, scope: FormScope): string {
  const root = scopeFor(element, scope);
  const uploader = fileUploadGroupFor(element) || element.closest<HTMLElement>("fieldset, section, div");
  const ids = [
    cleanText(element.getAttribute("aria-errormessage")),
    element.id ? `${element.id}-error` : "",
  ].filter(Boolean);
  const directError = ids
    .map((id) => cleanText(root.querySelector(`#${CSS.escape(id)}`)?.textContent))
    .find(Boolean);
  if (directError) return directError;

  return Array.from(
    uploader?.querySelectorAll<HTMLElement>("[role='alert'], [aria-live='assertive'], [id$='-error'], .error, .errors") || [],
  )
    .map((candidate) => cleanText(candidate.textContent))
    .find(Boolean) || "";
}

function uploadObservationFor(
  element: HTMLInputElement,
  scope: FormScope,
  selectedDocument?: { name: string; accepted: boolean },
): FileUploadObservation {
  const error = uploadErrorFor(element, scope);
  if (error) return { state: "rejected", detail: error };

  const selectedFile = element.files?.[0];
  if (selectedFile?.size) return { state: "ready", filename: selectedFile.name };
  if (selectedDocument?.accepted) return { state: "ready", filename: selectedDocument.name };
  if (selectedDocument) {
    return {
      state: "rejected",
      filename: selectedDocument.name,
      detail: "The selected document is empty or was rejected by the webpage.",
    };
  }
  return { state: "empty" };
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
  if (uploadGroup?.getAttribute("aria-required") === "true" || uploadGroup?.hasAttribute("required")) return true;
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const nearbyText = cleanText(explicitLabel?.closest("fieldset, section, div")?.textContent);
  return /\*\s*$/.test(cleanText(explicitLabel?.textContent)) || /\bresume\b[\s\S]{0,180}\*/i.test(nearbyText);
}

function isPresentedFileInput(element: HTMLInputElement, scope: FormScope): boolean {
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

  const fieldContainer = element.closest<HTMLElement>("[data-testid='field'], [data-testid*='field' i]");
  if (fieldContainer && isVisibleElement(fieldContainer)) return true;

  const controller = element.id
    ? root.querySelector<HTMLElement>(`[aria-controls='${CSS.escape(element.id)}']`)
    : null;
  if (controller && isVisibleElement(controller)) return true;

  const dropZone = element.closest<HTMLElement>("[role='button'], button, label");
  if (dropZone) {
    const acceptsDocument = /(?:\.pdf|\.docx|\.doc|application\/pdf|wordprocessingml)/i.test(element.accept || "");
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
  return Boolean(dropZone && /autofill from resume/i.test(cleanText(dropZone.textContent)));
}

export function elementsInScope(scope: FormScope): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const visitedRoots = new Set<Document | HTMLElement | ShadowRoot>();

  const visit = (root: Document | HTMLElement | ShadowRoot) => {
    if (visitedRoots.has(root)) return;
    visitedRoots.add(root);
    const descendants = Array.from(root.querySelectorAll<HTMLElement>("*"));
    elements.push(...descendants);
    if (root instanceof HTMLElement && root.shadowRoot) visit(root.shadowRoot);
    descendants.forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };

  visit(scope);
  return elements;
}

export function controlsInScope(scope: FormScope): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  return queryAllInScope<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(scope, CONTROL_SELECTOR);
}

export function visibleControlsInScope(scope: FormScope): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  return controlsInScope(scope).filter((element) => isVisibleElement(element) && isInspectableControl(element));
}

export function fieldKeyFor(element: HTMLElement, index: number, scope?: FormScope): string {
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'file') {
    const semanticKey = semanticFileKey(element);
    if (semanticKey) return semanticKey;
  }
  const explicit = cleanText(element.id) || cleanText(element.getAttribute("name"));
  if (explicit) return explicit;
  const label = cleanText(labelFor(element, scope || document));
  if (label && label !== "Unnamed field") {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    if (slug) return `field-${slug}`;
  }
  return `field-${index + 1}`;
}

type CheckboxChoiceGroup = {
  container: HTMLElement;
  groupKey: string;
  name: string;
  label: string;
  type: "checkbox" | "radio";
  required: boolean;
  options: HTMLInputElement[];
};

function checkboxChoiceGroupFor(
  element: HTMLInputElement,
): CheckboxChoiceGroup | null {
  if (element.type.toLowerCase() !== "checkbox") return null;
  const fieldset = element.closest<HTMLElement>("fieldset");
  if (!fieldset) return null;
  const options = Array.from(fieldset.querySelectorAll<HTMLInputElement>("input[type='checkbox']"))
    .filter((candidate) => isVisibleElement(candidate));
  const label = cleanLabel(cleanText(fieldset.querySelector("legend")?.textContent));
  if (options.length < 2 || !label) return null;
  const names = Array.from(new Set(options.map((option) => cleanText(option.name)).filter(Boolean)));
  const name = names.length === 1 ? names[0] || "" : "";
  const greenhouseSingleChoice = name.startsWith("question_") && name.endsWith("[]");
  const groupKey = cleanText(fieldset.id) || name || `checkbox-group-${cleanText(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

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

function currentCheckboxChoiceValue(group: CheckboxChoiceGroup, scope: FormScope): string {
  return group.options
    .filter((option) => checkboxIsChecked(option, scope))
    .map((option) => optionLabelFor(option, scope))
    .filter(Boolean)
    .join(", ");
}

type ButtonChoiceGroup = {
  container: HTMLElement;
  label: string;
  required: boolean;
  options: HTMLElement[];
};

type AriaRadioGroup = {
  container: HTMLElement;
  label: string;
  required: boolean;
  options: HTMLElement[];
};

function ariaRadioGroups(scope: FormScope): AriaRadioGroup[] {
  return queryAllInScope<HTMLElement>(scope, "[role='radiogroup']")
    .filter((container) => isVisibleElement(container))
    .map((container) => {
      const options = Array.from(container.querySelectorAll<HTMLElement>("[role='radio']"))
        .filter((option) => isVisibleElement(option) && option.getAttribute("aria-disabled") !== "true");
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

function visibleChoiceButtons(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("button, [role='radio'], [role='button']"))
    .filter((button) => isVisibleElement(button) && BUTTON_CHOICE_VALUE.test(cleanText(button.textContent || button.getAttribute("aria-label"))));
}

function choiceGroupContainer(button: HTMLElement): HTMLElement | null {
  let candidate: HTMLElement | null = button.parentElement;
  for (let depth = 0; candidate && depth < 4; depth += 1) {
    const options = visibleChoiceButtons(candidate);
    if (options.length >= 2 && options.length <= 5 && options.includes(button)) return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}

function choiceGroupLabel(container: HTMLElement): string {
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

  const semanticLabel = cleanText(container.closest("fieldset")?.querySelector("legend")?.textContent);
  if (semanticLabel) return cleanLabel(semanticLabel);

  let sibling = container.previousElementSibling as HTMLElement | null;
  while (sibling) {
    const text = cleanText(sibling.textContent);
    if (text.length >= 3 && text.length <= 280 && !isLikelyHelperText(text)) return cleanLabel(text);
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

function buttonChoiceGroups(scope: FormScope): ButtonChoiceGroup[] {
  const groups: ButtonChoiceGroup[] = [];
  const seen = new Set<HTMLElement>();
  const buttons = queryAllInScope<HTMLElement>(scope, "button, [role='radio'], [role='button']");

  for (const button of buttons) {
    if (!isVisibleElement(button) || !BUTTON_CHOICE_VALUE.test(cleanText(button.textContent || button.getAttribute("aria-label")))) continue;
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

function selectedChoice(options: readonly HTMLElement[]): HTMLElement | undefined {
  return options.find((option) =>
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
    return candidateLabel === targetLabel ||
      (candidateLabel.length > 3 && targetLabel.length > 3 &&
        (candidateLabel.includes(targetLabel) || targetLabel.includes(candidateLabel)));
  });
  return group?.options.find((option) => {
    const text = cleanText(option.textContent || option.getAttribute("aria-label")).toLowerCase();
    return text === targetValue || (targetValue.length > 1 && (text.includes(targetValue) || targetValue.includes(text)));
  }) || null;
}

export function inspectVisibleFormFields(scope: FormScope = document): FormFieldObservation[] {
  const visibleControls = visibleControlsInScope(scope);
  const seenRadioNames = new Set<string>();
  const seenCheckboxGroupNames = new Set<string>();
  const result: FormFieldObservation[] = [];

  for (let index = 0; index < visibleControls.length && result.length < 200; index += 1) {
    const element = visibleControls[index];
    if (!element) continue;
    const type = fieldType(element);

    if (element instanceof HTMLInputElement && isDocumentSelectionRadio(element)) continue;
    // File controls need composed-tree label, required-state, and upload
    // inspection. Always handle them in the dedicated file pass below.
    if (type === "file") continue;

    if (element instanceof HTMLInputElement) {
      const checkboxGroup = checkboxChoiceGroupFor(element);
      if (checkboxGroup) {
        if (seenCheckboxGroupNames.has(checkboxGroup.groupKey)) continue;
        seenCheckboxGroupNames.add(checkboxGroup.groupKey);
        const value = currentCheckboxChoiceValue(checkboxGroup, scope);
        result.push({
          key: checkboxGroup.groupKey,
          id: cleanText(checkboxGroup.container.id) || undefined,
          name: checkboxGroup.name || undefined,
          // Greenhouse renders these single-answer screening questions as
          // checkbox controls. Present them as one choice field so the panel
          // mirrors the question instead of listing every option as a field.
          type: checkboxGroup.type,
          label: checkboxGroup.label,
          required: checkboxGroup.required,
          filled: Boolean(value),
          sensitive: false,
          options: checkboxGroup.options.map((option) => ({
            label: optionLabelFor(option, scope),
            value: option.value,
          })),
          ...(value ? { currentValue: value } : {}),
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
    const label = labelFor(element, elementScope);
    if (isAuxiliaryFieldLabel(label)) continue;
    if (isHoneypotField(element, label)) continue;
    result.push({
      key: fieldKeyFor(element, index),
      id: cleanText(element.id) || undefined,
      name: cleanText(element.getAttribute("name")) || undefined,
      type,
      label,
      required: requiredFor(element),
      filled: isFilled(element, type, elementScope),
      sensitive: type === "password",
      options: optionsFor(element, elementScope),
      ...(val ? { currentValue: val } : {}),
    });
  }

  // JobAdder's country selector is not a native visible control. Expose its
  // backing value as a regular select field so the backend can infer AU/NZ
  // from the phone number before the number itself is written.
  for (const control of jobAdderPhoneCountryControls(scope)) {
    if (result.length >= 200) break;
    const key = cleanText(control.countryCode.id) || cleanText(control.countryCode.name);
    if (!key || result.some((field) => field.key === key || field.id === control.countryCode.id)) continue;
    const currentValue = cleanText(control.countryCode.value);
    result.push({
      key,
      id: cleanText(control.countryCode.id) || undefined,
      name: cleanText(control.countryCode.name) || undefined,
      type: "select",
      label: control.label,
      required: control.required,
      filled: Boolean(currentValue),
      sensitive: false,
      options: control.options,
      ...(currentValue ? { currentValue } : {}),
    });
  }

  const keys = new Set(result.map((field) => field.key));
  const fileInputs = queryAllInScope<HTMLInputElement>(scope, "input[type='file']");
  for (let index = 0; index < fileInputs.length && result.length < 200; index += 1) {
    const input = fileInputs[index];
    if (!input || input.disabled || input.getAttribute("aria-disabled") === "true") continue;
    if (!isPresentedFileInput(input, scope)) continue;
    const key = fieldKeyFor(input, visibleControls.length + index);
    if (keys.has(key)) continue;
    const selectedDocument = selectedDocumentFor(input, scope);
    const selectedFile = input.files?.[0];
    const upload = uploadObservationFor(input, scope, selectedDocument);
    const label = fileUploadLabelFor(input, scope);
    if (isAuxiliaryFieldLabel(label)) continue;
    result.push({
      key,
      id: cleanText(input.id) || undefined,
      name: cleanText(input.getAttribute("name")) || undefined,
      type: "file",
      label,
      required: fileRequiredFor(input, scope),
      filled: Boolean((selectedFile && selectedFile.size > 0) || selectedDocument?.accepted),
      sensitive: true,
      options: documentOptionsFor(input, scope),
      upload,
      ...(selectedDocument
        ? { currentValue: selectedDocument.name }
        : selectedFile
          ? { currentValue: selectedFile.name }
          : {}),
    });
  }

  // Rippling renders required selects such as work-rights questions as a
  // focusable div rather than a native select or input. Treat those ARIA
  // comboboxes as normal select fields so the backend can classify them.
  const ariaComboboxes = queryAllInScope<HTMLElement>(scope, "[role='combobox']");
  for (const combobox of ariaComboboxes) {
    if (result.length >= 200) break;
    if (combobox instanceof HTMLInputElement || combobox.getAttribute("role") !== "combobox") continue;
    if (!isVisibleElement(combobox) || combobox.getAttribute("aria-disabled") === "true") continue;
    const key = fieldKeyFor(combobox, result.length, scope);
    if (result.some((field) => field.key === key || (combobox.id && field.id === combobox.id))) continue;
    const value = cleanText(combobox.textContent);
    const elementScope = scopeFor(combobox, scope);
    const label = labelFor(combobox, elementScope);

    const controlsId = cleanText(combobox.getAttribute("aria-controls"));
    let options: FormOption[] = [];
    if (controlsId) {
      // React Select and similar libraries portal their listbox to document.body.
      // Resolve aria-controls from the control's document/shadow root rather
      // than the narrow application container.
      const listbox =
        elementScope.querySelector<HTMLElement>(`#${CSS.escape(controlsId)}`) ||
        document.querySelector<HTMLElement>(`#${CSS.escape(controlsId)}`);
      if (listbox) {
        options = Array.from(listbox.querySelectorAll<HTMLElement>("[role='option'], li"))
          .map((opt) => {
            const optLabel = cleanText(opt.textContent || opt.getAttribute("aria-label"));
            return { label: optLabel, value: optLabel };
          })
          .filter((opt) => Boolean(opt.label) && !isPlaceholderOption(opt.label, opt.value));
      }
    }

    result.push({
      key,
      id: cleanText(combobox.id) || undefined,
      name: cleanText(combobox.getAttribute("name")) || undefined,
      type: "select",
      label,
      required: requiredFor(combobox),
      filled: Boolean(value && !isPlaceholderOption(value, "selected")),
      sensitive: false,
      options,
      ...(value && !isPlaceholderOption(value, "selected") ? { currentValue: value } : {}),
    });
  }

  for (const group of ariaRadioGroups(scope)) {
    if (result.length >= 200) break;
    if (result.some((field) => field.type === "radio" && cleanLabel(field.label) === cleanLabel(group.label))) continue;
    const selected = group.options.find((option) =>
      option.getAttribute("aria-checked") === "true" ||
      option.getAttribute("data-state") === "checked" ||
      option.getAttribute("data-state") === "selected",
    );
    result.push({
      key: cleanText(group.container.id) || `aria-radio-${result.length + 1}`,
      id: cleanText(group.container.id) || undefined,
      name: cleanText(group.container.getAttribute("name")) || undefined,
      type: "radio",
      label: group.label,
      required: group.required,
      filled: Boolean(selected),
      sensitive: false,
      options: group.options.map((option) => {
        const value = cleanText(option.getAttribute("data-value") || option.getAttribute("value") || option.textContent || option.getAttribute("aria-label"));
        const optionLabel = cleanText(option.getAttribute("aria-label") || option.textContent || value);
        return { label: optionLabel, value };
      }),
      ...(selected ? { currentValue: cleanText(selected.getAttribute("aria-label") || selected.textContent) } : {}),
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
      ...(selected ? { currentValue: cleanText(selected.textContent || selected.getAttribute("aria-label")) } : {}),
    });
  }

  // TechnologyOne renders its consent control as an ARIA checkbox rather
  // than a native input. Keep it in the field model so it can be recognised
  // and autofilled like a normal required checkbox.
  for (const element of ariaCheckboxElementsInScope(scope)) {
    if (result.length >= 200) break;
    const label = ariaCheckboxLabel(element, scope);
    const key = cleanText(element.id) || cleanText(element.getAttribute("name")) || `aria-checkbox-${result.length + 1}`;
    if (result.some((field) => field.key === key || (field.type === "checkbox" && cleanLabel(field.label) === cleanLabel(label)))) continue;
    result.push({
      key,
      id: cleanText(element.id) || undefined,
      name: cleanText(element.getAttribute("name")) || undefined,
      type: "checkbox",
      label,
      required: requiredFor(element),
      filled: ariaCheckboxIsChecked(element),
      sensitive: false,
      options: [],
      ...(ariaCheckboxIsChecked(element) ? { currentValue: "true" } : {}),
    });
  }

  return canonicalizeFormFields(result);
}

export function readApplicationForm(
  url: string,
  platform: FormPlatform,
  isApplicationPage: boolean,
  submitLabel?: string,
  scope: FormScope | null = document,
  action?: "next" | "submit",
  canGoBack = false,
  adaptFields?: (fields: FormFieldObservation[]) => FormFieldObservation[],
): FormInspection {
  const inspectedFields = scope ? inspectVisibleFormFields(scope) : [];
  const fields = adaptFields ? adaptFields(inspectedFields) : inspectedFields;
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

export function readPageInputFields(
  url: string,
  platform: FormPlatform,
  adaptFields?: (fields: FormFieldObservation[]) => FormFieldObservation[],
): FormInspection | null {
  const inspectedFields = inspectVisibleFormFields(document);
  const fields = adaptFields ? adaptFields(inspectedFields) : inspectedFields;
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
  scope: FormScope = document,
): FormInspection {
  return readApplicationForm(url, "seek", isApplicationPage, submitLabel, scope, action, canGoBack);
}
