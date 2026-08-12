import type { ValidatedApplicationPlanResponse } from "../shared/contracts/backend";
import type { FormInspection } from "../shared/contracts/form-inspection";
import type { PageInspection } from "../shared/contracts/page-inspection";
import type { FieldFillResult } from "../shared/contracts/form-actions";

import { apiClient } from "./api-client";
import {
  clickLinkedInApplicationAction,
  inspectActiveTab,
  inspectFormActiveTab,
  openLinkedInApplicationActiveTab,
} from "./content-bridge";
import { logDiagnostic } from "./diagnostics";
import { fillKnownFieldsForActiveTab } from "./field-fill-service";
import { createApplicationPlanFromActiveTab } from "./plan-service";

export interface LinkedInAutoRunResult {
  step: number;
  status: "ready_to_submit" | "paused_for_user" | "completed";
  message: string;
  inspection?: PageInspection;
  form?: FormInspection;
  plan?: ValidatedApplicationPlanResponse;
  fillResults?: FieldFillResult[];
  unansweredFields?: Array<{ key: string; label: string; reason: string }>;
}

export async function runLinkedInAutoApplication(
  providedId?: string,
): Promise<LinkedInAutoRunResult> {
  let inspection: PageInspection | undefined;
  let plan: ValidatedApplicationPlanResponse;
  let applicationId = providedId;

  if (!applicationId) {
    const created = await createApplicationPlanFromActiveTab();
    inspection = created.inspection;
    plan = created.plan;
    applicationId = plan.application_id;
  } else {
    plan = await apiClient.getApplicationPlan(applicationId);
  }

  if (plan.plan.state === "skipped" || plan.plan.state === "rejected" || plan.plan.state === "submitted") {
    return {
      step: 0,
      status: "completed",
      message: `Job application state is ${plan.plan.state}: ${plan.plan.decision.explanation}`,
      inspection,
      plan,
    };
  }

  if (plan.plan.state === "planned" || plan.plan.state === "awaiting_user_review") {
    plan = await apiClient.applyApplicationPlanAction(applicationId, "prepare");
  }

  const openRes = await openLinkedInApplicationActiveTab().catch(() => null);
  const initialFormCheck = await waitForLinkedInForm();
  if (!initialFormCheck || initialFormCheck.kind !== "application_form") {
    const pageCheck = await inspectActiveTab().catch(() => null);
    const pageSummary = describeLinkedInPage(pageCheck);
    const formSummary = initialFormCheck?.kind === "not_application_form"
      ? initialFormCheck.reason
      : "Unable to inspect application form on page.";
    await logDiagnostic("warn", "linkedin-automation", "Easy Apply form was not detected after opening.", {
      applicationId,
      openMessage: openRes?.message,
      url: openRes?.url,
      pageSummary,
      formSummary,
    });
    throw new Error(
      `LinkedIn application form was not detected after waiting: ${openRes?.message || "Failed to send open command to page."} Page: ${pageSummary} Form: ${formSummary}`,
    );
  }

  let currentForm: FormInspection = initialFormCheck;
  let fillResults: FieldFillResult[] = [];
  let unanswered: Array<{ key: string; label: string; reason: string }> = [];

  for (let step = 1; step <= 15; step += 1) {
    if (currentForm.kind !== "application_form") {
      await wait(350);
      currentForm = await inspectFormActiveTab();
      if (currentForm.kind !== "application_form") {
        throw new Error("Application modal closed or was not found.");
      }
    }

    const filled = await fillKnownFieldsForActiveTab(applicationId);
    fillResults = filled.results;
    unanswered = filled.instructions.unanswered_fields;
    if (filled.plan) plan = filled.plan;

    currentForm = await inspectFormActiveTab();
    if (currentForm.kind !== "application_form") {
      return {
        step,
        status: "paused_for_user",
        message: "Application modal closed after filling fields.",
        inspection,
        form: currentForm,
        plan,
        fillResults,
        unansweredFields: unanswered,
      };
    }
    const updatedActiveForm = currentForm;

    if (updatedActiveForm.action === "submit") {
      if (plan.plan.state === "preparing") {
        plan = await apiClient.applyApplicationPlanAction(applicationId, "mark_prepared");
      }
      await logDiagnostic("info", "linkedin-automation", "LinkedIn application ready for submission.", {
        applicationId,
        step,
      });
      return {
        step,
        status: "ready_to_submit",
        message: "Reached final step. Form is ready for submission.",
        inspection,
        form: updatedActiveForm,
        plan,
        fillResults,
        unansweredFields: unanswered,
      };
    }

    if (updatedActiveForm.action === "next" || (!updatedActiveForm.hasSubmitAction && updatedActiveForm.action !== "submit")) {
      const requiredUnfilled = updatedActiveForm.fields.filter((f) => f.required && !f.filled);
      if (requiredUnfilled.length > 0) {
        await logDiagnostic("warn", "linkedin-automation", "User input required for unfilled required fields.", {
          applicationId,
          unanswered: requiredUnfilled.length,
          step,
        });
        return {
          step,
          status: "paused_for_user",
          message: `${requiredUnfilled.length} required field(s) require manual input or review. Please complete on page and click One-Click Auto Apply again.`,
          inspection,
          form: updatedActiveForm,
          plan,
          fillResults,
          unansweredFields: unanswered,
        };
      }

      const beforeNextFingerprint = updatedActiveForm.fields
        .map((f) => `${f.key}:${f.currentValue || ""}`)
        .join("|");

      const actionRes = await clickLinkedInApplicationAction("next");
      if (actionRes.status !== "clicked") {
        throw new Error(`Failed to advance step: ${actionRes.message}`);
      }
      await logDiagnostic("info", "linkedin-automation", `Moved to next step (${step}).`, { applicationId });
      await wait(600);
      currentForm = await inspectFormActiveTab();

      const afterNextFingerprint =
        currentForm.kind === "application_form"
          ? currentForm.fields.map((f) => `${f.key}:${f.currentValue || ""}`).join("|")
          : "";
      if (
        currentForm.kind === "application_form" &&
        beforeNextFingerprint === afterNextFingerprint &&
        currentForm.action === "next"
      ) {
        await logDiagnostic(
          "warn",
          "linkedin-automation",
          "Page did not advance after clicking Next. Pausing for user.",
          { applicationId, step },
        );
        return {
          step,
          status: "paused_for_user",
          message:
            "Page did not change after clicking Next (validation errors or missing inputs may exist). Please check for page errors and click One-Click Auto Apply again.",
          inspection,
          form: currentForm,
          plan,
          fillResults,
          unansweredFields: unanswered,
        };
      }
    }
  }

  return {
    step: 15,
    status: "paused_for_user",
    message: "Auto-apply stopped after 15 steps; review the form to continue.",
    inspection,
    form: currentForm,
    plan,
    fillResults,
    unansweredFields: unanswered,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLinkedInForm(): Promise<FormInspection | null> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const form = await inspectFormActiveTab().catch(() => null);
    if (form?.kind === "application_form") return form;
    await wait(250);
  }
  return inspectFormActiveTab().catch(() => null);
}

function describeLinkedInPage(inspection: PageInspection | null): string {
  if (!inspection) return "Unable to inspect LinkedIn page state.";
  if (inspection.kind === "job" && inspection.snapshot.platform === "linkedin") {
    return `${inspection.snapshot.title} @ ${inspection.snapshot.company}; Easy Apply button ${
      inspection.snapshot.easyApply ? "Detected" : "Not Detected"
    }; ${inspection.snapshot.url}`;
  }
  if (inspection.kind === "job") {
    return `Detected ${inspection.snapshot.platform} job page; ${inspection.snapshot.url}`;
  }
  return `${inspection.reason}；${inspection.url}`;
}
