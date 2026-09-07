import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { ProviderFormRoot } from "../platform-definition";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isUsableLabel(label: string | undefined): boolean {
  if (!label) return false;
  const normalized = label.replace(/\s+/g, " ").trim().toLowerCase();
  return (
    Boolean(normalized) &&
    !/^(?:unnamed field|question|field|select|choose|enter|attachment)$/i.test(normalized) &&
    !/(?:is required|is invalid|cannot be empty|can't be blank|is missing)$/i.test(normalized)
  );
}

function shouldOverrideDayforceLabel(id: string): boolean {
  return /(?:countrycode|statecode|prefixid|suffixid|preferredcontactmethod|candidatesource|confirmemail|confirmmobilephone|email)$/i.test(
    id.toLowerCase(),
  );
}

function fieldInfoForDayforce(
  id: string | undefined,
  name: string | undefined,
): { label?: string; semantic?: string[] } | undefined {
  const tokens = [id, name].filter(Boolean) as string[];
  if (tokens.length === 0) return undefined;
  const matches = (pattern: RegExp) => tokens.some((t) => pattern.test(t));

  if (matches(/(?:^|_|-)prefix(?:id)?$/i)) return { label: "Prefix", semantic: ["prefix"] };
  if (matches(/(?:^|_|-)suffix(?:id)?$/i)) return { label: "Suffix", semantic: ["suffix"] };
  if (matches(/(?:^|_|-)preferredcontactmethod$/i))
    return { label: "Preferred contact method", semantic: ["contact_method"] };
  if (matches(/(?:^|_|-)candidatesource$/i))
    return { label: "How did you hear about this job?", semantic: ["candidate_source", "source"] };
  if (matches(/(?:^|_|-)candidatesourcedescription$/i))
    return { label: "Candidate source details" };
  if (matches(/(?:^|_|-)countrycode$/i)) return { label: "Country", semantic: ["country"] };
  if (matches(/(?:^|_|-)statecode$/i)) return { label: "State/Province", semantic: ["state"] };
  if (matches(/(?:^|_|-)confirmemail$/i))
    return { label: "Confirm email address", semantic: ["email", "confirm_email"] };
  if (matches(/(?:^|_|-)email$/i)) return { label: "Email address", semantic: ["email"] };
  if (matches(/(?:^|_|-)confirmmobilephone$/i))
    return { label: "Confirm mobile phone", semantic: ["phone", "mobile_phone", "confirm_phone"] };
  if (matches(/(?:^|_|-)mobilephone$/i))
    return { label: "Mobile phone", semantic: ["phone", "mobile_phone"] };
  if (matches(/(?:^|_|-)homephone$/i))
    return { label: "Home phone", semantic: ["phone", "home_phone"] };
  if (matches(/(?:^|_|-)firstname$/i))
    return { label: "First name", semantic: ["first_name", "name"] };
  if (matches(/(?:^|_|-)lastname$/i))
    return { label: "Last name", semantic: ["last_name", "name"] };
  if (matches(/(?:^|_|-)middlename$/i))
    return { label: "Middle name", semantic: ["middle_name", "name"] };
  if (matches(/(?:^|_|-)address1$/i))
    return { label: "Address", semantic: ["address", "street_address"] };
  if (matches(/(?:^|_|-)address2$/i))
    return { label: "Address line 2", semantic: ["address_line_2"] };
  if (matches(/(?:^|_|-)address3$/i)) return { label: "Address line 3" };
  if (matches(/(?:^|_|-)city$/i)) return { label: "City", semantic: ["city"] };
  if (matches(/(?:^|_|-)(?:zippostalcode|postalcode)$/i))
    return { label: "Postal code", semantic: ["postal_code", "zip"] };
  if (matches(/(?:^|_|-)county$/i)) return { label: "County" };
  if (matches(/(?:^|_|-)linkedin(?:url)?$/i)) return { label: "LinkedIn", semantic: ["linkedin"] };
  if (matches(/(?:^|_|-)isapplyingwithphonenumber$/i))
    return { label: "Apply with phone number" };
  if (matches(/hideexternalcandidateprofile/i)) return { label: "Hide profile" };
  if (matches(/(?:^|_|-)jobtitle$/i)) return { label: "Position title", semantic: ["job_title"] };
  if (matches(/(?:^|_|-)companyname$/i)) return { label: "Company", semantic: ["company"] };
  if (matches(/(?:^|_|-)schoolname$/i)) return { label: "School name", semantic: ["school"] };
  if (matches(/(?:^|_|-)degree$/i)) return { label: "Degree", semantic: ["degree"] };
  if (matches(/(?:^|_|-)major$/i)) return { label: "Major", semantic: ["major"] };

  return undefined;
}

type DayforceFileKind = "resume" | "cover_letter" | "additional_document";

function classifyDayforceFileInput(input: HTMLInputElement): DayforceFileKind | undefined {
  if (
    input.closest("[test-id='resume-upload-section']") ||
    input.closest("[test-id*='resume' i]") ||
    input.parentElement?.querySelector("[test-id='resume-upload-button']")
  ) {
    return "resume";
  }
  if (
    input.closest("[test-id='cover-letter-upload-section']") ||
    input.closest("[test-id*='cover-letter' i]") ||
    input.parentElement?.querySelector("[test-id='cover-letter-upload-button']")
  ) {
    return "cover_letter";
  }
  if (
    input.closest("[test-id='additional-documents-upload-section']") ||
    input.closest("[test-id*='additional-document' i]")
  ) {
    return "additional_document";
  }
  return undefined;
}

function normalizeDayforceFileInputs(root: ProviderFormRoot) {
  const fileInputs = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='file']"));
  return fileInputs.map((input) => {
    if (input.accept) {
      input.accept = input.accept
        .split(",")
        .map((part) => part.trim())
        .map((part) => (part && !part.startsWith(".") && !part.includes("/") ? `.${part}` : part))
        .join(",");
    }

    const kind = classifyDayforceFileInput(input);
    if (kind === "resume") {
      if (!input.id) input.id = "dayforce-resume-upload";
      input.dataset.dayforceField = "resume";
    } else if (kind === "cover_letter") {
      if (!input.id) input.id = "dayforce-cover-letter-upload";
      input.dataset.dayforceField = "cover-letter";
    } else if (kind === "additional_document") {
      if (!input.id) input.id = "dayforce-additional-documents-upload";
      input.dataset.dayforceField = "additional-documents";
    }
    return { input, kind };
  });
}

function detectDayforceUploadedFile(
  input: HTMLInputElement,
): { isUploaded: boolean; filename?: string } {
  const section =
    input.closest(
      "section, [test-id$='-upload-section'], [test-id$='-upload-container'], .ant-form-item",
    ) || input.parentElement?.closest("section, .ant-form-item");

  if (section) {
    const testItem = section.querySelector<HTMLElement>("[test-id='upload-file-item-test']");
    if (testItem) {
      const nameEl = testItem.querySelector<HTMLElement>(
        ".ant-upload-list-item-name, a, span[title]",
      );
      const rawName = nameEl?.getAttribute("title") || nameEl?.textContent || testItem.textContent || "";
      const filename = cleanText(rawName).replace(/\s*(?:delete|remove|preview)$/i, "").trim();
      if (filename) return { isUploaded: true, filename };
      return { isUploaded: true, filename: "Uploaded document" };
    }

    const listItem = section.querySelector<HTMLElement>(
      ".ant-upload-list-item:not(.ant-upload-list-item-error)",
    );
    if (listItem) {
      const nameEl = listItem.querySelector<HTMLElement>(
        ".ant-upload-list-item-name, a, span[title]",
      );
      const rawName = nameEl?.getAttribute("title") || nameEl?.textContent || listItem.textContent || "";
      const filename = cleanText(rawName).replace(/\s*(?:delete|remove|preview)$/i, "").trim();
      if (filename) return { isUploaded: true, filename };
      return { isUploaded: true, filename: "Uploaded document" };
    }

    const deleteBtn = section.querySelector<HTMLElement>(
      "[test-id$='-delete-icon-button'], [test-id*='delete-icon' i], [test-id$='-upload-delete-button']",
    );
    if (deleteBtn) {
      const parentRow = deleteBtn.closest<HTMLElement>(
        ".ant-upload-list-item, .w-44, [test-id='upload-file-item-test'], tr, div",
      );
      const nameEl = parentRow?.querySelector<HTMLElement>(".ant-upload-list-item-name, span[title]");
      const rawName = nameEl?.getAttribute("title") || nameEl?.textContent || "";
      const filename = cleanText(rawName).replace(/\s*(?:delete|remove|preview)$/i, "").trim();
      return { isUploaded: true, filename: filename || "Uploaded document" };
    }
  }

  if (input.files && input.files.length > 0) {
    return { isUploaded: true, filename: input.files[0]!.name };
  }

  return { isUploaded: false };
}

function detectDayforceSelectState(
  control: HTMLElement,
): { filled: boolean; currentValue?: string } {
  const select =
    control.closest<HTMLElement>(".ant-select") ||
    control.parentElement?.closest<HTMLElement>(".ant-select");

  if (!select) {
    if (control instanceof HTMLSelectElement) {
      const val = cleanText(control.value);
      return { filled: Boolean(val), currentValue: val || undefined };
    }
    return { filled: false };
  }

  const selectionItem = select.querySelector<HTMLElement>(".ant-select-selection-item");
  if (selectionItem) {
    const val = cleanText(selectionItem.getAttribute("title") || selectionItem.textContent);
    if (val) {
      return { filled: true, currentValue: val };
    }
  }

  const searchInput = select.querySelector<HTMLInputElement>(".ant-select-selection-search-input");
  if (searchInput && cleanText(searchInput.value)) {
    return { filled: true, currentValue: cleanText(searchInput.value) };
  }

  return { filled: false };
}

function detectDayforceControlState(
  control: HTMLElement,
  fieldType: string,
  root: ProviderFormRoot,
): { filled: boolean; currentValue?: string } {
  if (fieldType === "select") {
    return detectDayforceSelectState(control);
  }

  if (fieldType === "checkbox" && control instanceof HTMLInputElement) {
    const isChecked =
      control.checked ||
      control.getAttribute("aria-checked") === "true" ||
      Boolean(control.closest(".ant-checkbox-checked"));
    return { filled: isChecked, currentValue: isChecked ? "true" : undefined };
  }

  if (fieldType === "radio") {
    const name = control.getAttribute("name");
    if (name) {
      const radios = Array.from(
        root.querySelectorAll<HTMLInputElement>(`input[type='radio'][name='${CSS.escape(name)}']`),
      );
      const checkedRadio = radios.find(
        (r) =>
          r.checked ||
          r.getAttribute("aria-checked") === "true" ||
          Boolean(r.closest(".ant-radio-checked, .ant-radio-wrapper-checked")),
      );
      if (checkedRadio) {
        const val = cleanText(checkedRadio.value || checkedRadio.closest("label")?.textContent);
        return { filled: true, currentValue: val || "true" };
      }
      return { filled: false };
    }
  }

  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    const val = cleanText(control.value);
    return { filled: Boolean(val), currentValue: val || undefined };
  }

  return { filled: false };
}

export function adaptDayforceFormFields(
  fields: FormFieldObservation[],
  root: ProviderFormRoot,
): FormFieldObservation[] {
  const normalizedInputs = normalizeDayforceFileInputs(root);
  const fileFields = fields.filter((f) => f.type === "file");

  return fields.map((field) => {
    if (field.type === "file") {
      const fileIndex = fileFields.indexOf(field);
      const mapped =
        (field.id && normalizedInputs.find((n) => n.input.id === field.id)) ||
        (fileIndex >= 0 ? normalizedInputs[fileIndex] : undefined);

      const targetInput =
        mapped?.input ||
        (field.id ? root.querySelector<HTMLInputElement>(`#${CSS.escape(field.id)}`) : null);
      const uploadStatus = targetInput
        ? detectDayforceUploadedFile(targetInput)
        : { isUploaded: false };

      let label = field.label;
      const semanticFeatures = new Set(field.semanticFeatures || []);

      if (
        mapped?.kind === "resume" ||
        /resume/i.test(label || "") ||
        /resume/i.test(field.id || "")
      ) {
        label = "Resume";
        semanticFeatures.add("resume");
      } else if (
        mapped?.kind === "cover_letter" ||
        /cover/i.test(label || "") ||
        /cover/i.test(field.id || "")
      ) {
        label = "Cover Letter";
        semanticFeatures.add("cover_letter");
      } else if (
        mapped?.kind === "additional_document" ||
        /additional/i.test(label || "") ||
        /additional/i.test(field.id || "")
      ) {
        label = "Additional Documents";
        semanticFeatures.add("additional_documents");
      }

      return {
        ...field,
        id: field.id || mapped?.input.id || field.key,
        label,
        semanticFeatures: Array.from(semanticFeatures),
        filled: uploadStatus.isUploaded,
        upload: uploadStatus.isUploaded
          ? { state: "ready", filename: uploadStatus.filename || "Uploaded document" }
          : { state: "empty" },
        ...(uploadStatus.isUploaded
          ? { currentValue: uploadStatus.filename || "Uploaded document" }
          : {}),
      };
    }

    const control =
      (field.id ? root.querySelector<HTMLElement>(`#${CSS.escape(field.id)}`) : null) ||
      (field.name
        ? root.querySelector<HTMLElement>(`[name='${CSS.escape(field.name)}']`)
        : null) ||
      root.querySelector<HTMLElement>(`[test-id='${CSS.escape(field.key)}']`);

    const info = fieldInfoForDayforce(field.id, field.name);
    const updatedField: FormFieldObservation = {
      ...field,
      semanticFeatures: Array.from(
        new Set([...(field.semanticFeatures || []), ...(info?.semantic || [])]),
      ),
    };

    if (control) {
      const state = detectDayforceControlState(control, field.type, root);
      updatedField.filled = state.filled;
      if (state.filled && state.currentValue) {
        updatedField.currentValue = state.currentValue;
      } else if (!state.filled) {
        delete updatedField.currentValue;
      }
    }

    if (info) {
      if (
        info.label &&
        (!isUsableLabel(updatedField.label) || shouldOverrideDayforceLabel(updatedField.id || ""))
      ) {
        updatedField.label = info.label;
      }
    }

    return updatedField;
  });
}
