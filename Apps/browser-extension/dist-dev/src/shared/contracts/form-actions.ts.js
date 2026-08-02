import { z } from "/vendor/.vite-deps-zod.js__v--dbafbd4a.js";
import { formFieldTypeSchema } from "/src/shared/contracts/form-inspection.ts.js";
export const fieldFillInstructionSchema = z.object({
  type: z.literal("content.fill-field"),
  commandId: z.string().min(1).max(128),
  source: z.literal("backend"),
  target: z.object({
    key: z.string().min(1).max(256),
    id: z.string().max(256).optional(),
    name: z.string().max(256).optional(),
    type: formFieldTypeSchema,
    label: z.string().min(1).max(500)
  }),
  value: z.union([z.string().max(1e4), z.boolean()])
});
export const fieldFillResultSchema = z.object({
  commandId: z.string().min(1),
  key: z.string().min(1),
  status: z.enum(["filled", "already_filled", "not_found", "rejected", "requires_user_action"]),
  message: z.string().min(1)
});
export const formFillInstructionsResponseSchema = z.object({
  application_id: z.string().min(1),
  instructions: z.array(fieldFillInstructionSchema),
  unanswered_fields: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      reason: z.string().min(1)
    })
  )
});
