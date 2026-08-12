import { z } from "/vendor/.vite-deps-zod.js__v--ac2f9308.js";
const jobSnapshotFields = {
  externalId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  datePosted: z.string().optional(),
  description: z.string().optional(),
  technologies: z.array(z.string().min(1)).max(30).default([]),
  easyApply: z.boolean()
};
export const seekJobSnapshotSchema = z.object({
  platform: z.literal("seek"),
  ...jobSnapshotFields
});
export const linkedinJobSnapshotSchema = z.object({
  platform: z.literal("linkedin"),
  ...jobSnapshotFields
});
export const genericJobSnapshotSchema = z.object({
  platform: z.literal("generic"),
  ...jobSnapshotFields
});
export const indeedJobSnapshotSchema = z.object({
  platform: z.literal("indeed"),
  ...jobSnapshotFields
});
export const jobSnapshotSchema = z.discriminatedUnion("platform", [
  seekJobSnapshotSchema,
  linkedinJobSnapshotSchema,
  genericJobSnapshotSchema,
  indeedJobSnapshotSchema
]);
export const pageInspectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("job"),
    snapshot: jobSnapshotSchema
  }),
  z.object({
    kind: z.literal("not_job_page"),
    platform: z.enum(["seek", "linkedin", "indeed"]),
    url: z.string().url(),
    reason: z.string().min(1)
  }),
  z.object({
    kind: z.literal("unsupported_page"),
    url: z.string().url(),
    reason: z.string().min(1)
  })
]);
