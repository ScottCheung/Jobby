import { z } from "/vendor/.vite-deps-zod.js__v--d9a92ae8.js";
export const formPlatformSchema = z.enum(["generic", "seek", "linkedin"]);
export const formFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "file",
  "number",
  "email",
  "tel",
  "url",
  "date",
  "password",
  "unknown"
]);
export const formOptionSchema = z.object({
  label: z.string(),
  value: z.string()
});
export const fileUploadObservationSchema = z.object({
  // "ready" means the ATS page currently exposes a non-empty document for
  // this field. It does not claim the final application submission succeeded.
  state: z.enum(["empty", "ready", "rejected"]),
  filename: z.string().min(1).optional(),
  detail: z.string().min(1).optional()
});
export const formFieldObservationSchema = z.object({
  key: z.string().min(1),
  // The top page may embed an external ATS in an iframe. This is intentionally
  // optional so normal top-level fields remain compatible with existing plans.
  frameId: z.number().int().nonnegative().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  type: formFieldTypeSchema,
  label: z.string().min(1),
  required: z.boolean(),
  filled: z.boolean(),
  sensitive: z.boolean(),
  options: z.array(formOptionSchema),
  semanticFeatures: z.array(z.string().max(80)).max(50).optional(),
  currentValue: z.string().optional(),
  upload: fileUploadObservationSchema.optional()
});
export const formInspectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("application_form"),
    platform: formPlatformSchema,
    url: z.string().url(),
    fields: z.array(formFieldObservationSchema),
    hasSubmitAction: z.boolean(),
    submitLabel: z.string().optional(),
    action: z.enum(["next", "submit"]).optional(),
    canGoBack: z.boolean()
  }),
  z.object({
    kind: z.literal("not_application_form"),
    platform: formPlatformSchema,
    url: z.string().url(),
    reason: z.string().min(1)
  }),
  z.object({
    kind: z.literal("page_input_fields"),
    platform: formPlatformSchema,
    url: z.string().url(),
    fields: z.array(formFieldObservationSchema)
  }),
  z.object({
    kind: z.literal("unsupported_page"),
    url: z.string().url(),
    reason: z.string().min(1)
  })
]);
