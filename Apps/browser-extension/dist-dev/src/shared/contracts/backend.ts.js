import { z } from "/vendor/.vite-deps-zod.js__v--22c5bc1a.js";
const applicationCandidateSchema = z.object({
  platform: z.string().min(1),
  external_id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string().nullable().optional(),
  match_score: z.number().nullable().optional(),
  priority_score: z.number().nullable().optional(),
  recency_factor: z.number().nullable().optional(),
  skill_score: z.number().nullable().optional(),
  title_score: z.number().nullable().optional(),
  exp_score: z.number().nullable().optional(),
  easy_apply: z.boolean().optional(),
  already_applied: z.boolean().optional(),
  posted_at: z.string().nullable().optional(),
  date_posted: z.string().nullable().optional(),
  technologies: z.array(z.string()).optional()
});
const applicationDecisionSchema = z.object({
  action: z.enum(["skip", "review", "apply"]),
  reason_codes: z.array(z.string()),
  explanation: z.string().min(1),
  score: z.number().nullable().optional(),
  resume_strategy: z.enum(["master", "tailored"]).nullable().optional(),
  requires_submit_confirmation: z.boolean(),
  matched_terms: z.array(z.string()).optional()
});
export const applicationPlanResponseSchema = z.object({
  application_id: z.string().min(1),
  plan: z.object({
    candidate: applicationCandidateSchema,
    decision: applicationDecisionSchema,
    idempotency_key: z.string().min(1),
    state: z.string().min(1),
    review_reason: z.string().nullable().optional()
  })
});
export const applicationPlanActionSchema = z.enum([
  "prepare",
  "request_review",
  "mark_prepared",
  "approve",
  "confirm_submit",
  "reject",
  "begin_submission",
  "mark_submitted",
  "mark_failed"
]);
export const extensionPlanActionSchema = applicationPlanActionSchema.extract([
  "prepare",
  "request_review",
  "mark_prepared",
  "approve",
  "mark_submitted"
]);
