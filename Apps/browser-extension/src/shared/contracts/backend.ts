import { z } from "zod";

export type ApplicationCandidateInput = {
  platform: string;
  external_id: string;
  title: string;
  company: string;
  description?: string | null;
  match_score?: number | null;
  priority_score?: number | null;
  recency_factor?: number | null;
  easy_apply?: boolean;
  already_applied?: boolean;
  posted_at?: string | null;
  date_posted?: string | null;
  technologies?: string[];
};

export type ApplicationPlanCreatePayload = {
  candidate: ApplicationCandidateInput;
  job_description?: string | null;
  job_link?: string | null;
  work_location?: string | null;
};

const applicationCandidateSchema = z.object({
  platform: z.string().min(1),
  external_id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string().nullable().optional(),
  match_score: z.number().nullable().optional(),
  priority_score: z.number().nullable().optional(),
  recency_factor: z.number().nullable().optional(),
  easy_apply: z.boolean().optional(),
  already_applied: z.boolean().optional(),
  posted_at: z.string().nullable().optional(),
  date_posted: z.string().nullable().optional(),
  technologies: z.array(z.string()).optional(),
});

const applicationDecisionSchema = z.object({
  action: z.enum(["skip", "review", "apply"]),
  reason_codes: z.array(z.string()),
  explanation: z.string().min(1),
  score: z.number().nullable().optional(),
  resume_strategy: z.enum(["master", "tailored"]).nullable().optional(),
  requires_submit_confirmation: z.boolean(),
  matched_terms: z.array(z.string()).optional(),
});

export const applicationPlanResponseSchema = z.object({
  application_id: z.string().min(1),
  plan: z.object({
    candidate: applicationCandidateSchema,
    decision: applicationDecisionSchema,
    idempotency_key: z.string().min(1),
    state: z.string().min(1),
    review_reason: z.string().nullable().optional(),
  }),
});

export type ValidatedApplicationPlanResponse = z.infer<typeof applicationPlanResponseSchema>;

export type ApplicationPlanResponse = {
  application_id: string;
  plan: {
    candidate: ApplicationCandidateInput;
    decision: {
      action: "skip" | "review" | "apply";
      reason_codes: string[];
      explanation: string;
      score?: number | null;
      resume_strategy?: "master" | "tailored" | null;
      requires_submit_confirmation: boolean;
    };
    idempotency_key: string;
    state: string;
    review_reason?: string | null;
  };
};

export const applicationPlanActionSchema = z.enum([
  "prepare",
  "request_review",
  "mark_prepared",
  "approve",
  "confirm_submit",
  "reject",
  "begin_submission",
  "mark_submitted",
  "mark_failed",
]);

export type ApplicationPlanAction = z.infer<typeof applicationPlanActionSchema>;

export const extensionPlanActionSchema = applicationPlanActionSchema.extract([
  "prepare",
  "request_review",
  "mark_prepared",
  "approve",
  "mark_submitted",
]);

export type ExtensionPlanAction = z.infer<typeof extensionPlanActionSchema>;
