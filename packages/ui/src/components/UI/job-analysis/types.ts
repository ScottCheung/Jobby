/** @format */

import type { MasterResumeData } from '../Resume/types';

export type JobAnalysisDocType = 'resume' | 'cover_letter' | 'both';

export interface JobAnalysisSnapshot {
  platform: string;
  externalId: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  firstPostedAt?: string;
  lastPostedAt?: string;
  isReposted?: boolean;
  description?: string;
  technologies: string[];
  easyApply?: boolean;
}

export type JobAnalysisInspection =
  | {
      kind: 'job';
      snapshot: JobAnalysisSnapshot;
      originalSnapshot?: JobAnalysisSnapshot;
    }
  | {
      kind: 'not_job_page' | 'unsupported_page';
      reason: string;
      url: string;
      platform?: string;
    };

export interface JobAnalysisEvaluation {
  candidate: {
    platform: string;
    external_id: string;
    title: string;
    company: string;
    match_score: number | null;
    priority_score: number | null;
    recency_factor: number | null;
    skill_score: number | null;
    title_score: number | null;
    exp_score: number | null;
    easy_apply: boolean;
    already_applied: boolean;
    description: string;
  };
  decision: {
    action: 'skip' | 'review' | 'apply';
    reason_codes: string[];
    explanation: string;
    score: number | null;
    resume_strategy: 'master' | 'tailored' | null;
    requires_submit_confirmation: boolean;
  };
  should_generate_tailored_resume: boolean;
  matched_terms: string[];
}

export interface JobAnalysisCareerProfile {
  id: string;
  name: string;
  is_default: boolean;
  resume_data?: MasterResumeData;
}

export interface JobAnalysisUserSkill {
  id: string;
  skill_name: string;
  canonical_name: string;
  category?: string | null;
  source?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobAnalysisGeneration {
  docType: JobAnalysisDocType;
  jobTitle: string;
  company: string;
}

export interface JobDescriptionOpenPayload {
  title: string;
  company?: string;
  location?: string;
  datePosted?: string;
  description: string;
  platform?: string;
}

export type JobRequirementHighlightResult =
  | { highlighted: boolean; matchCount: number; currentIndex: number }
  | boolean;
