import { z } from "zod";

import { jobSnapshotSchema } from "./page-inspection";

export const applicationSessionStatusSchema = z.enum([
  "active",
  "submitting",
  "submitted",
  "submission_unknown",
  "abandoned",
]);

export type ApplicationSessionStatus = z.infer<
  typeof applicationSessionStatusSchema
>;

export const jobIdentitySchema = z.object({
  platform: z.string().min(1),
  externalId: z.string().min(1).optional(),
  url: z.string().url().optional(),
  type: z.enum(["source", "ats", "requisition", "application_url"]),
  confidence: z.enum(["high", "medium", "low"]),
});

export type JobIdentity = z.infer<typeof jobIdentitySchema>;

export const applicationSubmissionSchema = z.object({
  platform: z.string().min(1),
  url: z.string().url(),
  verified: z.boolean(),
});

export type ApplicationSubmission = z.infer<
  typeof applicationSubmissionSchema
>;

export const applicationSessionSchema = z.object({
  id: z.string().min(1),
  status: applicationSessionStatusSchema,
  job: jobSnapshotSchema,
  sourceJob: jobSnapshotSchema,
  identities: z.array(jobIdentitySchema),
  tabs: z.array(z.number().int().nonnegative()),
  identityLocked: z.boolean(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  submittedAt: z.string().datetime().optional(),
  submission: applicationSubmissionSchema.optional(),
});

export type ApplicationSession = z.infer<typeof applicationSessionSchema>;
