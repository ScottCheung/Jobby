import type { FormFieldObservation } from "../../../shared/contracts/form-inspection";
import type { ProviderFormRoot } from "../platform-definition";

function isUsableLabel(label: string | undefined): boolean {
  if (!label) return false;
  const normalized = label.replace(/\s+/g, " ").trim().toLowerCase();
  return (
    Boolean(normalized) &&
    !/^(?:unnamed field|question|field|select|choose|enter|attachment)$/i.test(normalized) &&
    !/(?:is required|is invalid|cannot be empty|can't be blank|is missing)$/i.test(normalized)
  );
}

function labelForDayforceField(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (/(?:personalInfo_)?prefixId$/i.test(id)) return "Prefix";
  if (/(?:personalInfo_)?suffixId$/i.test(id)) return "Suffix";
  if (/(?:personalInfo_)?preferredContactMethod$/i.test(id)) return "Preferred contact method";
  if (/(?:personalInfo_)?candidateSource$/i.test(id)) return "How did you hear about this job?";
  if (/(?:personalInfo|workHistory_\d+)_countryCode$/i.test(id)) return "Country";
  if (/(?:personalInfo|workHistory_\d+)_stateCode$/i.test(id)) return "State/Province";
  if (/(?:workHistory_\d+)_jobTitle$/i.test(id)) return "Position title";
  if (/(?:workHistory_\d+)_companyName$/i.test(id)) return "Company";
  if (/hideExternalCandidateProfile/i.test(id)) return "Hide profile";
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

      if (mapped?.kind === "resume") {
        return {
          ...field,
          id: field.id || mapped.input.id || "dayforce-resume-upload",
          label: "Resume",
          semanticFeatures: Array.from(new Set([...(field.semanticFeatures || []), "resume"])),
        };
      }
      if (mapped?.kind === "cover_letter") {
        return {
          ...field,
          id: field.id || mapped.input.id || "dayforce-cover-letter-upload",
          label: "Cover Letter",
          semanticFeatures: Array.from(new Set([...(field.semanticFeatures || []), "cover_letter"])),
        };
      }
      if (mapped?.kind === "additional_document") {
        return {
          ...field,
          id: field.id || mapped.input.id || "dayforce-additional-documents-upload",
          label: "Additional Documents",
          semanticFeatures: Array.from(new Set([...(field.semanticFeatures || []), "additional_documents"])),
        };
      }
    }

    const dayforceLabel = labelForDayforceField(field.id);
    if (dayforceLabel) {
      if (
        !isUsableLabel(field.label) ||
        /(?:countryCode|stateCode|prefixId|suffixId|preferredContactMethod|candidateSource)$/i.test(field.id || "")
      ) {
        return { ...field, label: dayforceLabel };
      }
    }
    return field;
  });
}
