import { z } from "zod";

import { formFieldTypeSchema } from "./form-inspection";

export const fieldFillInstructionSchema = z.object({
  type: z.literal("content.fill-field"),
  commandId: z.string().min(1).max(128),
  source: z.enum(["backend", "panel"]),
  target: z.object({
    key: z.string().min(1).max(256),
    frameId: z.number().int().nonnegative().optional(),
    id: z.string().max(256).optional(),
    // Some ATSs (including Ashby consent fields) use the full question text
    // as the native input name. Keep that stable identifier intact instead
    // of rejecting the extension message before it reaches the webpage.
    name: z.string().max(2_000).optional(),
    type: formFieldTypeSchema,
    label: z.string().min(1).max(500),
  }),
  value: z.union([z.string().max(10000), z.boolean()]),
});

export const formFieldTargetSchema = fieldFillInstructionSchema.shape.target;
export type FormFieldTarget = z.infer<typeof formFieldTargetSchema>;

export type FieldFillInstruction = z.infer<typeof fieldFillInstructionSchema>;

export const fileUploadInstructionSchema = z.object({
  type: z.literal("content.upload-file"),
  commandId: z.string().min(1).max(128),
  target: formFieldTargetSchema,
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  // Base64 keeps the binary payload compatible with Chrome extension
  // messaging, which serializes runtime messages as JSON.
  contentBase64: z.string().min(1).max(14_000_000),
});
export type FileUploadInstruction = z.infer<typeof fileUploadInstructionSchema>;

export const fieldFillResultSchema = z.object({
  commandId: z.string().min(1),
  key: z.string().min(1),
  status: z.enum(["filled", "already_filled", "not_found", "rejected", "requires_user_action"]),
  message: z.string().min(1),
});

export type FieldFillResult = z.infer<typeof fieldFillResultSchema>;

export const formFocusResultSchema = z.object({
  key: z.string().min(1),
  status: z.enum(["focused", "not_found"]),
  message: z.string().min(1),
});

export type FormFocusResult = z.infer<typeof formFocusResultSchema>;

export const formFillInstructionsResponseSchema = z.object({
  application_id: z.string().min(1),
  instructions: z.array(fieldFillInstructionSchema),
  unanswered_fields: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

export type FormFillInstructionsResponse = z.infer<typeof formFillInstructionsResponseSchema>;

export const formAutofillInstructionsResponseSchema = z.object({
  instructions: z.array(fieldFillInstructionSchema),
  unanswered_fields: formFillInstructionsResponseSchema.shape.unanswered_fields,
  traces: z.array(z.object({
    key: z.string(),
    label: z.string(),
    intent_key: z.string().nullable().optional(),
    core_field_key: z.string().nullable().optional(),
    scene: z.string().nullable().optional(),
    semantic_features: z.array(z.string()).default([]),
    source: z.string(),
    status: z.enum(["filled", "unanswered"]),
    value: z.union([z.string(), z.boolean()]).nullable().optional(),
    reason: z.string().nullable().optional(),
  })).default([]),
});

export type FormAutofillInstructionsResponse = z.infer<typeof formAutofillInstructionsResponseSchema>;
