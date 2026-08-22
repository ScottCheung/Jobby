import { pageInspectionSchema } from "../shared/contracts/page-inspection";
import { formInspectionSchema } from "../shared/contracts/form-inspection";
import { fieldFillInstructionSchema, fileUploadInstructionSchema, formFieldTargetSchema } from "../shared/contracts/form-actions";
import { linkedinApplicationActionSchema } from "../shared/contracts/linkedin";

import { getCurrentFormScope, readCurrentForm, readCurrentPageWhenReady } from "./page-reader";
import { startFormDiscovery, watchFormScope } from "./form-observer";
import { classifyCurrentPage } from "./page-classifier";
import { fillFormField, fillFormFieldValue, focusFormField, uploadFormFile } from "./dom/form-driver";
import { linkedinAdapter } from "./platforms/linkedin/adapter";
import { clickSeekApplicationAction } from "./platforms/seek/adapter";
import { clickGenericApplicationAction, openGenericApplication } from "./platforms/generic/adapter";
import {
  closeInPageResumePreviewModal,
  showInPageResumeLibraryModal,
  showInPageResumePreviewModal,
} from "./dom/resume-preview-modal-injector";
import { showInPageToast } from "./dom/in-page-toast";

export async function handleContentCommand(message: unknown): Promise<unknown> {
  if (isShowToastCommand(message)) {
    const payload = message as { message: string; toastType?: 'success' | 'error' | 'info' | 'warning'; duration?: number };
    showInPageToast(payload.message, payload.toastType || 'info', payload.duration);
    return { ok: true };
  }
  if (isShowResumePreviewCommand(message)) {
    const payload = message as any;
    showInPageResumePreviewModal({
      data: payload.data,
      coreCompetencies: payload.coreCompetencies,
      keyQualifications: payload.keyQualifications,
      company: payload.company,
      jobTitle: payload.jobTitle,
      filename: payload.filename,
      pdfDataUrl: payload.pdfDataUrl,
      pages: payload.pages,
      fileSize: payload.fileSize,
      pdfScale: payload.pdfScale,
      generatedAt: payload.generatedAt,
      themeColor: payload.themeColor,
      editUrl: payload.editUrl,
    });
    return { ok: true };
  }
  if (isShowResumeLibraryCommand(message)) {
    const payload = message as {
      resumes: import('../shared/contracts/tailored-resume').TailoredResume[];
      selectedId?: string;
    };
    showInPageResumeLibraryModal({
      resumes: payload.resumes || [],
      selectedId: payload.selectedId,
    });
    return { ok: true };
  }
  if (isCloseResumePreviewCommand(message)) {
    closeInPageResumePreviewModal();
    return { ok: true };
  }
  if (isInspectCommand(message)) {
    const inspection = pageInspectionSchema.parse(await readCurrentPageWhenReady());
    return { inspection };
  }
  if (isRenderScoreCardCommand(message)) {
    return { ok: true };
  }
  if (isInspectFormCommand(message)) {
    const form = formInspectionSchema.parse(readCurrentForm());
    if (hasObservableFields(form)) {
      watchFormScope(getCurrentFormScope(), () => readCurrentForm(), form);
    } else {
      // A generic ATS can render the application step after the job page has
      // already been read. Watch only after an explicit form inspection on job pages,
      // then hand off to the narrower scope watcher once fields appear.
      const pageClass = classifyCurrentPage();
      if (pageClass.isJobPage) {
        startFormDiscovery(() => readCurrentForm());
      }
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
  if (isOpenLinkedInApplicationCommand(message)) {
    const hostname = window.location.hostname;
    const application = isLinkedInHost(hostname)
      ? await linkedinAdapter.openApplication()
      : await openGenericApplication();
    return { application };
  }
  if (isLinkedInApplicationActionCommand(message)) {
    const action = linkedinApplicationActionSchema.parse((message as { action: unknown }).action);
    const hostname = window.location.hostname;
    const application = isSeekHost(hostname)
      ? await clickSeekApplicationAction(action)
      : isLinkedInHost(hostname)
        ? await linkedinAdapter.clickApplicationAction(action)
        : await clickGenericApplicationAction(action);
    return { application };
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

function isLinkedInHost(hostname: string): boolean {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
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

function isRenderScoreCardCommand(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.render-score-card"
  );
}

function isShowResumePreviewCommand(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.show-resume-preview"
  );
}

function isShowResumeLibraryCommand(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.show-resume-library"
  );
}

function isCloseResumePreviewCommand(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.close-resume-preview"
  );
}

function isShowToastCommand(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "content.show-toast"
  );
}
