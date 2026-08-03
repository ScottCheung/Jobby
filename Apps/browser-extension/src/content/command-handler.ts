import { pageInspectionSchema } from "../shared/contracts/page-inspection";
import { formInspectionSchema } from "../shared/contracts/form-inspection";
import { fieldFillInstructionSchema, fileUploadInstructionSchema, formFieldTargetSchema } from "../shared/contracts/form-actions";
import { linkedinApplicationActionSchema } from "../shared/contracts/linkedin";

import { getCurrentFormScope, readCurrentForm, readCurrentPageWhenReady } from "./page-reader";
import { startFormDiscovery, watchFormScope } from "./form-observer";
import { fillFormField, fillFormFieldValue, focusFormField, uploadFormFile } from "./dom/form-driver";
import { linkedinAdapter } from "./platforms/linkedin/adapter";
import { clickSeekApplicationAction } from "./platforms/seek/adapter";

export async function handleContentCommand(message: unknown): Promise<unknown> {
  if (isInspectCommand(message)) return { inspection: pageInspectionSchema.parse(await readCurrentPageWhenReady()) };
  if (isInspectFormCommand(message)) {
    const form = formInspectionSchema.parse(readCurrentForm());
    if (hasObservableFields(form)) {
      watchFormScope(getCurrentFormScope(), () => readCurrentForm(), form);
    } else {
      // A generic ATS can render the application step after the job page has
      // already been read. Watch only after an explicit form inspection, then
      // hand off to the narrower scope watcher once fields appear.
      startFormDiscovery(() => readCurrentForm());
    }
    return { form };
  }
  if (isFocusFormFieldCommand(message)) {
    const target = formFieldTargetSchema.parse((message as { target: unknown }).target);
    return { focusResult: focusFormField(target, getCurrentFormScope()) };
  }
  if (isEditFormFieldCommand(message)) {
    const target = formFieldTargetSchema.parse((message as { target: unknown }).target);
    const value = (message as { value: unknown }).value;
    if (typeof value !== "string" && typeof value !== "boolean") throw new Error("Invalid form field value.");
    return { fillResult: await fillFormFieldValue(target, value, getCurrentFormScope()) };
  }
  if (isOpenLinkedInApplicationCommand(message)) return { application: await linkedinAdapter.openApplication() };
  if (isLinkedInApplicationActionCommand(message)) {
    const action = linkedinApplicationActionSchema.parse((message as { action: unknown }).action);
    return {
      application: isSeekHost(window.location.hostname)
        ? await clickSeekApplicationAction(action)
        : await linkedinAdapter.clickApplicationAction(action),
    };
  }
  if (isFillFieldCommand(message)) {
    const instruction = fieldFillInstructionSchema.parse(message);
    return { fillResult: await fillFormField(instruction, getCurrentFormScope()) };
  }
  if (isUploadFileCommand(message)) {
    const instruction = fileUploadInstructionSchema.parse(message);
    return { fillResult: await uploadFormFile(instruction, getCurrentFormScope()) };
  }
  return undefined;
}

export function startContentFormDiscovery(): void {
  startFormDiscovery(() => readCurrentForm());
}

function hasObservableFields(
  form: ReturnType<typeof readCurrentForm>,
): boolean {
  return form.kind === "application_form" || form.kind === "page_input_fields";
}

function isSeekHost(hostname: string): boolean {
  return hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
}

function isInspectFormCommand(message: unknown): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "content.inspect-form";
}

function isFillFieldCommand(message: unknown): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "content.fill-field";
}

function isFocusFormFieldCommand(message: unknown): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "content.focus-form-field";
}

function isEditFormFieldCommand(message: unknown): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "content.edit-form-field";
}

function isUploadFileCommand(message: unknown): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "content.upload-file";
}

function isInspectCommand(message: unknown): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "content.inspect";
}

function isOpenLinkedInApplicationCommand(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.linkedin.open-application"
  );
}

function isLinkedInApplicationActionCommand(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.linkedin.application-action"
  );
}
