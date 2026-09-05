import type {
  FieldFillInstruction,
  FieldFillResult,
  FormFieldTarget,
} from "../../../shared/contracts/form-actions";
import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type {
  ProviderDriverOverride,
  ProviderFormRoot,
} from "../platform-definition";
import type { FormOption } from "../../dom/form-inspector/option-reader";
import {
  cleanText,
  queryAllInScope,
  type FormScope,
} from "../../dom/form-inspector/visibility";
import { requiredFor } from "../../dom/form-inspector/label-resolver";
import {
  emitChange,
  markAutofillWrite,
  normalized,
  result,
  setValue,
} from "../../dom/form-driver/events";

type PhoneCountryControl = {
  countryList: HTMLInputElement;
  countryCode: HTMLInputElement;
  numberInput: HTMLInputElement;
  label: string;
  required: boolean;
  options: FormOption[];
};

function phoneLabel(input: HTMLInputElement): string {
  const identifier = `${input.id} ${input.name}`.toLowerCase();
  return /(?:candidate)?mobile(?:[._-]|$)/.test(identifier) ? "Mobile" : "Phone";
}

function countryOptions(numberInput: HTMLInputElement, scope: FormScope): FormOption[] {
  const localField = numberInput.closest<HTMLElement>(".form-field");
  const lists = [
    ...(localField
      ? Array.from(localField.querySelectorAll<HTMLLIElement>(".phone-number-country-list li"))
      : []),
    ...queryAllInScope<HTMLLIElement>(scope, ".phone-number-country-list li"),
  ];
  const seen = new Set<string>();
  const options: FormOption[] = [];
  for (const item of lists) {
    try {
      const parsed = JSON.parse(cleanText(item.textContent)) as {
        id?: unknown;
        text?: unknown;
      };
      const value = cleanText(typeof parsed.id === "string" ? parsed.id : "");
      const label = cleanText(typeof parsed.text === "string" ? parsed.text : "");
      if (!value || !label || seen.has(value)) continue;
      seen.add(value);
      options.push({ label, value });
    } catch {
      // Ignore unrelated list items.
    }
  }
  return options;
}

function phoneCountryControls(scope: FormScope = document): PhoneCountryControl[] {
  const controls: PhoneCountryControl[] = [];
  const numbers = queryAllInScope<HTMLInputElement>(scope, "input[data-val-phone]");
  for (const numberInput of numbers) {
    const row = numberInput.closest<HTMLElement>(".flex-row") || numberInput.parentElement;
    const countryList = row?.querySelector<HTMLInputElement>("input.country-list");
    const countryCode = row?.querySelector<HTMLInputElement>(
      "input[name$='CountryCode'], input[id$='_CountryCode']",
    );
    if (!countryList || !countryCode) continue;
    const label = `${phoneLabel(numberInput)} country code`;
    controls.push({
      countryList,
      countryCode,
      numberInput,
      label,
      required: requiredFor(numberInput),
      options: countryOptions(numberInput, scope),
    });
  }
  return controls;
}

function controlForTarget(
  target: FormFieldTarget,
  scope: FormScope,
): PhoneCountryControl | null {
  return phoneCountryControls(scope).find((control) =>
    target.key === control.countryCode.id ||
    target.key === control.countryCode.name ||
    (target.id && target.id === control.countryCode.id) ||
    (target.name && target.name === control.countryCode.name),
  ) || null;
}

function fillPhoneCountry(
  instruction: FieldFillInstruction,
  scope: FormScope,
): FieldFillResult | null {
  const value = instruction.value;
  if (instruction.target.type !== "select" || typeof value !== "string") return null;
  const control = controlForTarget(instruction.target, scope);
  if (!control) return null;

  const requested = value.trim().toUpperCase();
  const option = control.options.find((candidate) =>
    candidate.value.toUpperCase() === requested ||
    normalized(candidate.label) === normalized(value),
  );
  if (!option && value !== "") {
    return result(instruction, "rejected", "The requested phone country is unavailable.");
  }
  const nextValue = option?.value || "";
  if (normalized(control.countryCode.value) === normalized(nextValue)) {
    return result(instruction, "already_filled", "Phone country already has the requested value.");
  }

  markAutofillWrite(control.countryList, instruction.source);
  setValue(control.countryList, nextValue);
  emitChange(control.countryList);
  if (normalized(control.countryCode.value) !== normalized(nextValue)) {
    setValue(control.countryCode, nextValue);
    emitChange(control.countryCode);
  }
  return result(
    instruction,
    normalized(control.countryCode.value) === normalized(nextValue) ? "filled" : "rejected",
    normalized(control.countryCode.value) === normalized(nextValue)
      ? "Phone country updated."
      : "The webpage did not accept the phone country update.",
  );
}

export const jobAdderFormAdapter = {
  matches(root: ProviderFormRoot): boolean {
    return root.querySelector("input[data-val-phone]") !== null &&
      root.querySelector("input.country-list") !== null &&
      root.querySelector("input[name$='CountryCode'], input[id$='_CountryCode']") !== null;
  },
  adaptFormFields(
    fields: FormFieldObservation[],
    root: ProviderFormRoot,
  ): FormFieldObservation[] {
    const scope = root as FormScope;
    const controls = phoneCountryControls(scope);
    const phoneFields = new Map(
      controls.map((control) => [control.numberInput.id || control.numberInput.name, control]),
    );
    const adapted = fields.map((field) => {
      const control = (field.id && phoneFields.get(field.id)) ||
        (field.name && phoneFields.get(field.name));
      return control
        ? { ...field, type: "tel" as const, label: phoneLabel(control.numberInput) }
        : field;
    });
    for (const control of controls) {
      const key = cleanText(control.countryCode.id) || cleanText(control.countryCode.name);
      if (!key || adapted.some((field) => field.key === key || field.id === control.countryCode.id)) {
        continue;
      }
      const currentValue = cleanText(control.countryCode.value);
      adapted.push({
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
    return adapted;
  },
  driver: {
    fillField: async (instruction, scope) =>
      fillPhoneCountry(instruction, scope as FormScope),
  } satisfies ProviderDriverOverride,
};
