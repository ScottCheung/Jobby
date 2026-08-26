import { z } from "zod";
import { capturedJobDateFields } from "../utils/date-formatter";
import { atsJobPlatforms, dedicatedPlatforms } from "./platform";

const jobSnapshotFields = {
  externalId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  firstPostedAt: z.string().datetime().optional(),
  lastPostedAt: z.string().datetime().optional(),
  postingObservedAt: z.string().datetime().optional(),
  isReposted: z.boolean().optional(),
  postingDateRaw: z.object({
    listedAt: z.union([z.string(), z.number()]).optional(),
    originalListedAt: z.union([z.string(), z.number()]).optional(),
    label: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  technologies: z.array(z.string().min(1)).max(30).default([]),
};

export const seekJobSnapshotSchema = z.object({
  platform: z.literal("seek"),
  ...jobSnapshotFields,
});

export type SeekJobSnapshot = z.infer<typeof seekJobSnapshotSchema>;

export const linkedinJobSnapshotSchema = z.object({
  platform: z.literal("linkedin"),
  ...jobSnapshotFields,
  easyApply: z.boolean(),
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

export const atsJobSnapshotSchema = z.object({
  platform: z.enum(atsJobPlatforms),
  ...jobSnapshotFields,
});

export type AtsJobSnapshot = z.infer<typeof atsJobSnapshotSchema>;

const currentJobSnapshotSchema = z.discriminatedUnion("platform", [
  seekJobSnapshotSchema,
  linkedinJobSnapshotSchema,
  genericJobSnapshotSchema,
  indeedJobSnapshotSchema,
  atsJobSnapshotSchema,
]);

export const jobSnapshotSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const snapshot = value as Record<string, unknown>;
  if (
    typeof snapshot.datePosted !== "string" ||
    snapshot.firstPostedAt ||
    snapshot.lastPostedAt
  ) {
    return value;
  }
  return {
    ...snapshot,
    ...capturedJobDateFields(snapshot.datePosted),
  };
}, currentJobSnapshotSchema);

export type JobSnapshot = z.infer<typeof jobSnapshotSchema>;

export const pageInspectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("job"),
    snapshot: jobSnapshotSchema,
    originalSnapshot: jobSnapshotSchema.optional(),
  }),
  z.object({
    kind: z.literal("not_job_page"),
    platform: z.enum(dedicatedPlatforms),
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
