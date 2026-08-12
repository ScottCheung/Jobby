import { z } from "zod";

import type { AuthStatus } from "./auth";
import { applicationPlanResponseSchema, extensionPlanActionSchema, type ValidatedApplicationPlanResponse } from "./backend";
import { pageInspectionSchema, type PageInspection } from "./page-inspection";
import type { FormInspection } from "./form-inspection";
import { formFieldTargetSchema } from "./form-actions";
import type { FieldFillResult, FormFocusResult } from "./form-actions";
import { linkedinApplicationActionSchema, type LinkedInApplicationResult } from "./linkedin";
import { RUN_PHASES, type DiagnosticEntry, type RuntimeSnapshot } from "./execution";

export const runtimeMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("runtime.get") }),
  z.object({ type: z.literal("runtime.pause") }),
  z.object({ type: z.literal("runtime.resume") }),
  z.object({ type: z.literal("runtime.stop") }),
  z.object({ type: z.literal("diagnostics.list") }),
  z.object({ type: z.literal("diagnostics.clear") }),
  z.object({ type: z.literal("auth.status") }),
  z.object({ type: z.literal("auth.restore-web-session") }),
  z.object({ type: z.literal("auth.disconnect") }),
  z.object({ type: z.literal("auth.open-login") }),
  z.object({ type: z.literal("content.inspect-active") }),
  z.object({ type: z.literal("content.inspect-form-active") }),
  z.object({
    type: z.literal("content.render-score-card"),
    inspection: pageInspectionSchema.optional(),
    plan: applicationPlanResponseSchema.optional(),
  }),
  z.object({ type: z.literal("form.autofill-active") }),
  z.object({ type: z.literal("content.focus-form-field-active"), target: formFieldTargetSchema }),
  z.object({ type: z.literal("content.autofill-single-field-active"), target: formFieldTargetSchema }),
  z.object({ type: z.literal("content.upload-default-resume-active"), target: formFieldTargetSchema }),
  z.object({
    type: z.literal("content.edit-form-field-active"),
    target: formFieldTargetSchema,
    value: z.union([z.string().max(10000), z.boolean()]),
  }),
  z.object({ type: z.literal("application.open-linkedin-active") }),
  z.object({
    type: z.literal("application.linkedin-action-active"),
    action: linkedinApplicationActionSchema,
  }),
  z.object({
    type: z.literal("application.create-plan-active"),
    inspection: pageInspectionSchema.optional(),
  }),
  z.object({
    type: z.literal("application.plan-action-active"),
    applicationId: z.string().min(1).max(128),
    action: extensionPlanActionSchema,
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({ type: z.literal("application.fill-known-fields-active"), applicationId: z.string().min(1).max(128) }),
  z.object({ type: z.literal("application.fill-and-next-active"), applicationId: z.string().min(1).max(128) }),
  z.object({ type: z.literal("application.submit-linkedin-active"), applicationId: z.string().min(1).max(128) }),
  z.object({ type: z.literal("application.auto-run-linkedin-active"), applicationId: z.string().min(1).max(128).optional() }),
]);

export type RuntimeMessage = z.infer<typeof runtimeMessageSchema>;

export type RuntimeMessageResponse =
  | {
      ok: true;
      snapshot: RuntimeSnapshot;
      diagnostics?: DiagnosticEntry[];
      auth?: AuthStatus;
      inspection?: PageInspection;
      form?: FormInspection;
      plan?: ValidatedApplicationPlanResponse;
      fillResults?: FieldFillResult[];
      fillResult?: FieldFillResult;
      unansweredFields?: Array<{ key: string; label: string; reason: string }>;
      focusResult?: FormFocusResult;
      linkedinApplication?: LinkedInApplicationResult;
      stepAdvanced?: boolean;
      actionLabel?: string;
      unfilledRequiredLabels?: string[];
      autoStatus?: "completed" | "paused_for_user" | "ready_to_submit" | "error";
      autoMessage?: string;
    }
  | {
      ok: false;
      error: string;
    };

export const runtimeSnapshotSchema = z.object({
  phase: z.enum(RUN_PHASES),
  updatedAt: z.string().datetime(),
  runId: z.string().optional(),
  activeTabId: z.number().int().optional(),
  applicationId: z.string().optional(),
  reason: z.string().optional(),
});
