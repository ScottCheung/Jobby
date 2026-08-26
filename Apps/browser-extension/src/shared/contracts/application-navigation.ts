import { z } from "zod";

export const applicationActionSchema = z.enum(["previous", "next", "submit"]);
export type ApplicationAction = z.infer<typeof applicationActionSchema>;

export const applicationActionResultSchema = z.object({
  status: z.enum(["already_open", "opened", "navigating", "clicked", "not_open", "unavailable"]),
  message: z.string().min(1),
  url: z.string().url().optional(),
  actionLabel: z.string().min(1).optional(),
});

export type ApplicationActionResult = z.infer<typeof applicationActionResultSchema>;
