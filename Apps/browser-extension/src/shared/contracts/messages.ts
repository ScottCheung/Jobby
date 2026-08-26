/** @format */

import { z } from 'zod';

import type { AuthStatus } from './auth';
import type { PageInspection } from './page-inspection';
import type { FormInspection } from './form-inspection';
import { formFieldTargetSchema } from './form-actions';
import type { FieldFillResult, FormFocusResult } from './form-actions';
import {
  RUN_PHASES,
  type DiagnosticEntry,
  type RuntimeSnapshot,
} from './execution';

export const runtimeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('runtime.get') }),
  z.object({ type: z.literal('runtime.pause') }),
  z.object({ type: z.literal('runtime.resume') }),
  z.object({ type: z.literal('runtime.stop') }),
  z.object({ type: z.literal('diagnostics.list') }),
  z.object({ type: z.literal('diagnostics.clear') }),
  z.object({ type: z.literal('auth.status') }),
  z.object({ type: z.literal('auth.restore-web-session') }),
  z.object({ type: z.literal('auth.disconnect') }),
  z.object({ type: z.literal('auth.open-login') }),
  z.object({ type: z.literal('content.inspect-active') }),
  z.object({ type: z.literal('content.inspect-form-active') }),
  z.object({
    type: z.literal('content.highlight-job-requirement-active'),
    searchTerms: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  }),
  z.object({ type: z.literal('form.autofill-active') }),
  z.object({
    type: z.literal('content.focus-form-field-active'),
    target: formFieldTargetSchema,
  }),
  z.object({
    type: z.literal('content.autofill-single-field-active'),
    target: formFieldTargetSchema,
  }),
  z.object({
    type: z.literal('content.upload-default-resume-active'),
    target: formFieldTargetSchema,
  }),
  z.object({
    type: z.literal('content.upload-file-active'),
    target: formFieldTargetSchema,
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(128),
    contentBase64: z.string().min(1).max(14 * 1024 * 1024),
  }),
  z.object({
    type: z.literal('content.edit-form-field-active'),
    target: formFieldTargetSchema,
    value: z.union([z.string().max(10000), z.boolean()]),
  }),
  z.object({ type: z.literal('sidepanel.query-state') }),
  z.object({ type: z.literal('sidepanel.open') }),
  z.object({ type: z.literal('sidepanel.close') }),
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
      fillResults?: FieldFillResult[];
      fillResult?: FieldFillResult;
      unansweredFields?: Array<{ key: string; label: string; reason: string }>;
      focusResult?: FormFocusResult;
      highlighted?: boolean;
      matchCount?: number;
      currentIndex?: number;
      isOpen?: boolean;
      canHostSidepanel?: boolean;
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
