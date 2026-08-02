import { z } from "/vendor/.vite-deps-zod.js__v--dbafbd4a.js";
export const formPlatformSchema = z.enum(["seek", "linkedin"]);
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
export const formFieldObservationSchema = z.object({
  key: z.string().min(1),
  id: z.string().optional(),
  name: z.string().optional(),
  type: formFieldTypeSchema,
  label: z.string().min(1),
  required: z.boolean(),
  filled: z.boolean(),
  sensitive: z.boolean(),
  options: z.array(formOptionSchema),
  currentValue: z.string().optional()
});
export const formInspectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("application_form"),
    platform: formPlatformSchema,
    url: z.string().url(),
    fields: z.array(formFieldObservationSchema),
    hasSubmitAction: z.boolean(),
    submitLabel: z.string().optional(),
    action: z.enum(["next", "submit"]).optional()
  }),
  z.object({
    kind: z.literal("not_application_form"),
    platform: formPlatformSchema,
    url: z.string().url(),
    reason: z.string().min(1)
  }),
  z.object({
    kind: z.literal("unsupported_page"),
    url: z.string().url(),
    reason: z.string().min(1)
  })
]);
