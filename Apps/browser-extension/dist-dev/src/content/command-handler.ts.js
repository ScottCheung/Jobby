import { pageInspectionSchema } from "/src/shared/contracts/page-inspection.ts.js";
import { formInspectionSchema } from "/src/shared/contracts/form-inspection.ts.js";
import { fieldFillInstructionSchema } from "/src/shared/contracts/form-actions.ts.js";
import { linkedinApplicationActionSchema } from "/src/shared/contracts/linkedin.ts.js";
import { getCurrentFormScope, readCurrentForm, readCurrentPageWhenReady } from "/src/content/page-reader.ts.js";
import { fillFormField } from "/src/content/dom/form-driver.ts.js";
import { linkedinAdapter } from "/src/content/platforms/linkedin/adapter.ts.js";
export async function handleContentCommand(message) {
  if (isInspectCommand(message)) return { inspection: pageInspectionSchema.parse(await readCurrentPageWhenReady()) };
  if (isInspectFormCommand(message)) return { form: formInspectionSchema.parse(readCurrentForm()) };
  if (isOpenLinkedInApplicationCommand(message)) return { application: await linkedinAdapter.openApplication() };
  if (isLinkedInApplicationActionCommand(message)) {
    const action = linkedinApplicationActionSchema.parse(message.action);
    return { application: await linkedinAdapter.clickApplicationAction(action) };
  }
  if (isFillFieldCommand(message)) {
    const instruction = fieldFillInstructionSchema.parse(message);
    return { fillResult: fillFormField(instruction, getCurrentFormScope()) };
  }
  return void 0;
}
function isInspectFormCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.inspect-form";
}
function isFillFieldCommand(message) {
  return typeof message === "object" && message !== null && message.type === "content.fill-field";
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
