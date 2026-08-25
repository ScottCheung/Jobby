import { z } from 'zod';

const nullableScore = z.number().min(0).max(1).nullable();

export const jobMatchEvaluationSchema = z.object({
  candidate: z.object({
    platform: z.string(),
    external_id: z.string(),
    title: z.string(),
    company: z.string(),
    match_score: nullableScore,
    priority_score: nullableScore,
    recency_factor: nullableScore,
    skill_score: nullableScore,
    title_score: nullableScore,
    exp_score: nullableScore,
    easy_apply: z.boolean(),
    already_applied: z.boolean(),
    description: z.string(),
  }),
  decision: z.object({
    action: z.enum(['skip', 'review', 'apply']),
    reason_codes: z.array(z.string()),
    explanation: z.string(),
    score: nullableScore,
    resume_strategy: z.enum(['master', 'tailored']).nullable(),
    requires_submit_confirmation: z.boolean(),
  }),
  should_generate_tailored_resume: z.boolean(),
  matched_terms: z.array(z.string()),
});

export type JobMatchEvaluation = z.infer<typeof jobMatchEvaluationSchema>;
