import { z } from "zod";

export const linkedinApplicationActionSchema = z.enum(["previous", "next", "submit"]);
export type LinkedInApplicationAction = z.infer<typeof linkedinApplicationActionSchema>;

export const linkedinApplicationResultSchema = z.object({
  status: z.enum(["already_open", "opened", "navigating", "clicked", "not_open", "unavailable"]),
  message: z.string().min(1),
  url: z.string().url().optional(),
  actionLabel: z.string().min(1).optional(),
});

export type LinkedInApplicationResult = z.infer<typeof linkedinApplicationResultSchema>;
