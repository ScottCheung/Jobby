import { z } from "/vendor/.vite-deps-zod.js__v--22c5bc1a.js";
export const linkedinApplicationActionSchema = z.enum(["previous", "next", "submit"]);
export const linkedinApplicationResultSchema = z.object({
  status: z.enum(["already_open", "opened", "navigating", "clicked", "not_open", "unavailable"]),
  message: z.string().min(1),
  url: z.string().url().optional(),
  actionLabel: z.string().min(1).optional()
});
