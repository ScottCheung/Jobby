import { inspectPageCombobox } from "../combobox-bridge";
import {
  BUTTON_CHOICE_VALUE,
  cleanLabel,
  cleanText,
  labelTextWithoutControl,
  queryAllInScope,
  type QueryScope,
} from "./visibility";

export type FormOption = { label: string; value: string };

export const PLACEHOLDER_OPTION_LABELS = new Set([
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

export function normalizedOptionLabel(value: string): string {
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
  return /^(?:please\s+)?(?:select|choose)\s+(?:an?|the)\s+(?:option|answer|value|country|location)$/i.test(
    normalizedLabel,
  );
}

export function observedOptionValue(value: string): string {
  return isPlaceholderOption(value, "observed") ? "" : cleanText(value);
}


export function controlledListboxFor(element: HTMLElement): HTMLElement | null {
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

export function openComboboxValueIsCommitted(element: HTMLInputElement): boolean {
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

export function comboboxContainerFor(element: HTMLElement): HTMLElement | null {
  return (
    element.closest<HTMLElement>(
      ".select-shell, [data-testid*='select' i], [class*='select' i], [class*='dropdown' i], [class*='t1-' i]",
    ) || element.parentElement
  );
}


export function isSelectableCombobox(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
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

export function isPhoneCountryElement(element: HTMLElement): boolean {
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
    "phone_dial",
  ];
  if (countryKeywords.some((kw) => id.includes(kw) || name.includes(kw))) {
    return true;
  }

  const labelTexts = [ariaLabel, title, placeholder];
  if (
    labelTexts.some((text) =>
      /(?:phone\s+country|country\s+code|phone\s+code|dial\s+code|calling\s+code)/i.test(
        text,
      ),
    )
  ) {
    return true;
  }

  return false;
}

export function comboboxCurrentValue(element: HTMLElement): string {
  const bridgedValue = observedOptionValue(inspectPageCombobox(element)?.currentValue || "");
  if (bridgedValue) return bridgedValue;

  // Autocomplete inputs contain the search query while their popup is open.
  // Report a value only after the selected option has been committed.
  if (element instanceof HTMLInputElement && !openComboboxValueIsCommitted(element)) return "";

  const rawValue =
    element instanceof HTMLInputElement ? element.value : element.getAttribute("value");
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

export function liveComboboxOptions(
  element: HTMLInputElement,
  scope: QueryScope,
): FormOption[] {
  const listboxId = cleanText(element.getAttribute("aria-controls"));
  if (!listboxId) return [];
  const listbox = scope.querySelector<HTMLElement>(`#${CSS.escape(listboxId)}`);
  if (!listbox) return [];
  return Array.from(listbox.querySelectorAll<HTMLElement>("[role='option']"))
    .map((option) => {
      const label = cleanText(option.textContent || option.getAttribute("aria-label"));
      return { label, value: label };
    })
    .filter((option) => Boolean(option.label) && !isPlaceholderOption(option.label, option.value));
}

export const COUNTRY_CODES = [
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

export function countryOptions(element: HTMLInputElement): FormOption[] {
  if (!isPhoneCountryElement(element)) return [];
  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "region" })
      : null;
  return COUNTRY_CODES.map((code) => ({
    label: displayNames?.of(code) || code,
    value: displayNames?.of(code) || code,
  })).sort((left, right) => left.label.localeCompare(right.label));
}

export function comboboxOptionsFor(
  element: HTMLInputElement,
  scope: QueryScope,
): FormOption[] {
  const bridgedOptions = inspectPageCombobox(element)?.options;
  if (bridgedOptions && bridgedOptions.length > 0) {
    const realOptions = bridgedOptions.filter(
      (option) => !isPlaceholderOption(option.label, option.value),
    );
    if (realOptions.length > 0) return realOptions;
  }
  const liveOptions = liveComboboxOptions(element, scope);
  if (liveOptions.length > 0) return liveOptions;
  return countryOptions(element);
}

export function optionLabelFor(element: HTMLElement, scope: QueryScope): string {
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

export function parentTextIsDistinct(
  text: string | null | undefined,
  element: HTMLElement,
): boolean {
  if (!text) return false;
  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend && text === legend) return false;
  return true;
}

export function isOptionLabelElement(
  candidate: HTMLElement,
  element: HTMLElement,
): boolean {
  if (candidate.contains(element)) return true;

  const targetId = candidate.getAttribute("for");
  if (targetId) {
    const root = element.getRootNode();
    const queryScope =
      root instanceof Document || root instanceof ShadowRoot ? root : document;
    const targetInput = queryScope.querySelector<HTMLInputElement>(
      `#${CSS.escape(targetId)}`,
    );
    if (
      targetInput &&
      (targetInput.type.toLowerCase() === "radio" ||
        targetInput.type.toLowerCase() === "checkbox")
    ) {
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
