import { pageInspectionSchema } from "/src/shared/contracts/page-inspection.ts.js";
import { formInspectionSchema } from "/src/shared/contracts/form-inspection.ts.js";
import { fieldFillInstructionSchema, fileUploadInstructionSchema, formFieldTargetSchema } from "/src/shared/contracts/form-actions.ts.js";
import { linkedinApplicationActionSchema } from "/src/shared/contracts/linkedin.ts.js";
import { getCurrentFormScope, readCurrentForm, readCurrentPageWhenReady } from "/src/content/page-reader.ts.js";
import { startFormDiscovery, watchFormScope } from "/src/content/form-observer.ts.js";
import { fillFormField, fillFormFieldValue, focusFormField, uploadFormFile } from "/src/content/dom/form-driver.ts.js";
import { linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
import { clickSeekApplicationAction } from "/src/content/platforms/seek/adapter.ts.js";
import { clickGenericApplicationAction, openGenericApplication } from "/src/content/platforms/generic/adapter.ts.js";
import { applicationPlanResponseSchema } from "/src/shared/contracts/backend.ts.js";
import { injectInPageScoreCard } from "/src/content/dom/score-card-injector.ts.js";
export async function handleContentCommand(message) {
  if (isInspectCommand(message)) {
    const inspection = pageInspectionSchema.parse(await readCurrentPageWhenReady());
    injectInPageScoreCard(inspection);
    return { inspection };
  }
  if (isRenderScoreCardCommand(message)) {
    const inspection = message.inspection ? pageInspectionSchema.parse(message.inspection) : void 0;
    const plan = message.plan ? applicationPlanResponseSchema.parse(message.plan) : void 0;
    injectInPageScoreCard(inspection, plan);
    return { ok: true };
  }
  if (isInspectFormCommand(message)) {
    const form = formInspectionSchema.parse(readCurrentForm());
    if (hasObservableFields(form)) {
      watchFormScope(getCurrentFormScope(), () => readCurrentForm(), form);
    } else {
      startFormDiscovery(() => readCurrentForm());
    }
    return { form };
  }
  if (isFocusFormFieldCommand(message)) {
    const target = formFieldTargetSchema.parse(message.target);
    return { focusResult: focusFormField(target, getCurrentFormScope()) };
  }
  if (isEditFormFieldCommand(message)) {
    const target = formFieldTargetSchema.parse(message.target);
    const value = message.value;
    if (typeof value !== "string" && typeof value !== "boolean") throw new Error("Invalid form field value.");
    return { fillResult: await fillFormFieldValue(target, value, getCurrentFormScope()) };
  }
  if (isOpenLinkedInApplicationCommand(message)) {
    const hostname = window.location.hostname;
    const application = isLinkedInHost(hostname) ? await linkedinAdapter.openApplication() : await openGenericApplication();
    return { application };
  }
  if (isLinkedInApplicationActionCommand(message)) {
    const action = linkedinApplicationActionSchema.parse(message.action);
    const hostname = window.location.hostname;
    const application = isSeekHost(hostname) ? await clickSeekApplicationAction(action) : isLinkedInHost(hostname) ? await linkedinAdapter.clickApplicationAction(action) : await clickGenericApplicationAction(action);
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
  return void 0;
}
export function startContentFormDiscovery() {
  startFormDiscovery(() => readCurrentForm());
}
function hasObservableFields(form) {
  return form.kind === "application_form" || form.kind === "page_input_fields";
}
function isLinkedInHost(hostname) {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}
function isSeekHost(hostname) {
  return hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
}
function isInspectFormCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.inspect-form";
}
function isFillFieldCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.fill-field";
}
function isFocusFormFieldCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.focus-form-field";
}
function isEditFormFieldCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.edit-form-field";
}
function isUploadFileCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.upload-file";
}
function isInspectCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.inspect";
}
function isOpenLinkedInApplicationCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.linkedin.open-application";
}
function isLinkedInApplicationActionCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.linkedin.application-action";
}
function isRenderScoreCardCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.render-score-card";
}
