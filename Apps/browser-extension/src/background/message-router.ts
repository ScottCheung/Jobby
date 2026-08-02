import type { RuntimeMessageResponse } from "../shared/contracts/messages";
import { runtimeMessageSchema } from "../shared/contracts/messages";

import { disconnect, getAuthStatus, openLogin } from "./auth-service";
import {
  clickLinkedInApplicationAction,
  editActiveTabField,
  focusActiveTabField,
  inspectActiveTab,
  inspectFormActiveTab,
  openLinkedInApplicationActiveTab,
  setTargetedTabId,
} from "./content-bridge";
import { logDiagnostic } from "./diagnostics";
import { createApplicationPlanFromActiveTab } from "./plan-service";
import { applyApplicationPlanAction } from "./plan-action-service";
import { fillAndNextForActiveTab, fillKnownFieldsForActiveTab, uploadDefaultResumeToActiveTab } from "./field-fill-service";
import { submitLinkedInApplication } from "./linkedin-application-service";
import { runLinkedInAutoApplication } from "./linkedin-automation-service";
import {
  clearDiagnostics,
  getRuntimeSnapshot,
  listDiagnostics,
} from "./session-store";
import { controlRun } from "./run-controller";

export async function handleRuntimeMessage(
  rawMessage: unknown,
  sender?: chrome.runtime.MessageSender,
): Promise<RuntimeMessageResponse> {
  const parsed = runtimeMessageSchema.safeParse(rawMessage);
  if (!parsed.success) return { ok: false, error: "Unsupported extension message." };

  setTargetedTabId(readTargetedTabId(rawMessage));

  try {
    switch (parsed.data.type) {
      case "runtime.get":
        return { ok: true, snapshot: await getRuntimeSnapshot() };
      case "runtime.pause":
        return { ok: true, snapshot: await controlRun("paused") };
      case "runtime.resume":
        return { ok: true, snapshot: await controlRun("running") };
      case "runtime.stop":
        return { ok: true, snapshot: await controlRun("stopped") };
      case "diagnostics.list":
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          diagnostics: await listDiagnostics(),
        };
      case "diagnostics.clear":
        await clearDiagnostics();
        return { ok: true, snapshot: await getRuntimeSnapshot(), diagnostics: [] };
      case "auth.status":
        return { ok: true, snapshot: await getRuntimeSnapshot(), auth: await getAuthStatus() };
      case "auth.disconnect":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can disconnect." };
        await disconnect();
        await logDiagnostic("info", "auth", "Extension disconnected.");
        return { ok: true, snapshot: await getRuntimeSnapshot(), auth: { connected: false } };
      case "auth.open-login":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can connect." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          auth: await openLogin(),
        };
      case "content.inspect-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can inspect a page." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          inspection: await inspectActiveTab(),
        };
      case "content.inspect-form-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can inspect a form." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          form: await inspectFormActiveTab(),
        };
      case "content.focus-form-field-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can focus form fields." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          focusResult: await focusActiveTabField(parsed.data.target),
        };
      case "content.upload-default-resume-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can upload resumes." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          fillResult: await uploadDefaultResumeToActiveTab(parsed.data.target),
        };
      case "content.edit-form-field-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can edit form fields." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          fillResult: await editActiveTabField(parsed.data.target, parsed.data.value),
        };
      case "application.open-linkedin-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can open a LinkedIn application." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          linkedinApplication: await openLinkedInApplicationActiveTab(),
        };
      case "application.linkedin-action-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can control a LinkedIn application." };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          linkedinApplication: await clickLinkedInApplicationAction(parsed.data.action),
        };
      case "application.create-plan-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can create an application plan." };
        {
          const result = await createApplicationPlanFromActiveTab();
          await logDiagnostic("info", "application-plan", "Application plan created.", {
            applicationId: result.plan.application_id,
            state: result.plan.plan.state,
          });
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            inspection: result.inspection,
            plan: result.plan,
          };
        }
      case "application.plan-action-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can change an application plan." };
        {
          const result = await applyApplicationPlanAction(
            parsed.data.applicationId,
            parsed.data.action,
            parsed.data.reason,
          );
          await logDiagnostic("info", "application-plan", "Application plan action applied.", {
            applicationId: result.application_id,
            action: parsed.data.action,
            state: result.plan.state,
          });
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            plan: result,
          };
        }
      case "application.fill-known-fields-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can fill fields." };
        {
          const result = await fillKnownFieldsForActiveTab(parsed.data.applicationId);
          await logDiagnostic("info", "form-driver", "Backend field instructions applied.", {
            filled: result.results.filter((item) => item.status === "filled").length,
            skipped: result.results.filter((item) => item.status !== "filled").length,
            unanswered: result.instructions.unanswered_fields.length,
            reviewRequested: Boolean(result.plan),
          });
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            ...(result.plan ? { plan: result.plan } : {}),
            fillResults: result.results,
            unansweredFields: result.instructions.unanswered_fields,
          };
        }
      case "application.fill-and-next-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can fill fields." };
        {
          const result = await fillAndNextForActiveTab(parsed.data.applicationId);
          await logDiagnostic("info", "form-driver", "Form filled & next action executed.", {
            filled: result.results.filter((item) => item.status === "filled").length,
            stepAdvanced: result.stepAdvanced,
            actionLabel: result.actionLabel,
          });
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            ...(result.plan ? { plan: result.plan } : {}),
            fillResults: result.results,
            unansweredFields: result.instructions.unanswered_fields,
            stepAdvanced: result.stepAdvanced,
            actionLabel: result.actionLabel,
            ...(result.unfilledRequiredLabels ? { unfilledRequiredLabels: result.unfilledRequiredLabels } : {}),
          };
        }
      case "application.submit-linkedin-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can submit a LinkedIn application." };
        {
          const result = await submitLinkedInApplication(parsed.data.applicationId);
          await logDiagnostic("info", "linkedin-application", "LinkedIn application submitted.", {
            applicationId: parsed.data.applicationId,
            action: "submit",
            state: result.plan.plan.state,
          });
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            linkedinApplication: result.application,
            plan: result.plan,
          };
        }
      case "application.auto-run-linkedin-active":
        if (!isExtensionUiSender(sender)) return { ok: false, error: "Only the extension UI can auto-run LinkedIn applications." };
        {
          const autoRes = await runLinkedInAutoApplication(parsed.data.applicationId);
          await logDiagnostic("info", "linkedin-automation", autoRes.message, {
            step: autoRes.step,
            status: autoRes.status,
          });
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            ...(autoRes.inspection ? { inspection: autoRes.inspection } : {}),
            ...(autoRes.form ? { form: autoRes.form } : {}),
            ...(autoRes.plan ? { plan: autoRes.plan } : {}),
            fillResults: autoRes.fillResults,
            unansweredFields: autoRes.unansweredFields,
            autoStatus: autoRes.status,
            autoMessage: autoRes.message,
          };
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected extension error.";
    await logDiagnostic("error", "message-router", message);
    return { ok: false, error: message };
  }
}

function isExtensionUiSender(sender?: chrome.runtime.MessageSender): boolean {
  return Boolean(
    sender?.id === chrome.runtime.id &&
      sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`),
  );
}

function readTargetedTabId(message: unknown): number | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const tabId = (message as { activeTabId?: unknown }).activeTabId;
  return typeof tabId === "number" && Number.isInteger(tabId) && tabId >= 0
    ? tabId
    : undefined;
}
