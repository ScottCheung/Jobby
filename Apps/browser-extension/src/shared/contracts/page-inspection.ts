import { z } from "zod";

const jobSnapshotFields = {
  externalId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  datePosted: z.string().optional(),
  description: z.string().optional(),
  technologies: z.array(z.string().min(1)).max(30).default([]),
  easyApply: z.boolean(),
};

export const seekJobSnapshotSchema = z.object({
  platform: z.literal("seek"),
  ...jobSnapshotFields,
});

export type SeekJobSnapshot = z.infer<typeof seekJobSnapshotSchema>;

export const linkedinJobSnapshotSchema = z.object({
  platform: z.literal("linkedin"),
  ...jobSnapshotFields,
  /** Work arrangement inferred from LinkedIn's workplaceTypes URNs. */
  workType: z.enum(["onsite", "remote", "hybrid"]).optional(),
  /** Formatted experience level string from the Voyager API. */
  experienceLevel: z.string().optional(),
});

export type LinkedInJobSnapshot = z.infer<typeof linkedinJobSnapshotSchema>;

export const genericJobSnapshotSchema = z.object({
  platform: z.literal("generic"),
  ...jobSnapshotFields,
});

export type GenericJobSnapshot = z.infer<typeof genericJobSnapshotSchema>;

export const indeedJobSnapshotSchema = z.object({
  platform: z.literal("indeed"),
  ...jobSnapshotFields,
});

export type IndeedJobSnapshot = z.infer<typeof indeedJobSnapshotSchema>;

export const jobSnapshotSchema = z.discriminatedUnion("platform", [
  seekJobSnapshotSchema,
  linkedinJobSnapshotSchema,
  genericJobSnapshotSchema,
  indeedJobSnapshotSchema,
]);

export type JobSnapshot = z.infer<typeof jobSnapshotSchema>;

export const pageInspectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("job"),
    snapshot: jobSnapshotSchema,
  }),
  z.object({
    kind: z.literal("not_job_page"),
    platform: z.enum(["seek", "linkedin", "indeed"]),
    url: z.string().url(),
    reason: z.string().min(1),
  }),
  z.object({
    kind: z.literal("unsupported_page"),
    url: z.string().url(),
    reason: z.string().min(1),
  }),
]);

export type PageInspection = z.infer<typeof pageInspectionSchema>;
