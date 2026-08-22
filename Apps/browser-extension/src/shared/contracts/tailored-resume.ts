/** @format */

export type ResumeLocation = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  address?: string | null;
};

export type ResumeLink = {
  name?: string | null;
  url?: string | null;
};

export type ResumeSkillGroup = {
  type?: string | null;
  skills?: string[];
};

export type ResumeCertification = {
  name?: string | null;
  issuer?: string | null;
  date?: string | null;
  url?: string | null;
};

export type ResumeCertificationGroup = {
  type?: string | null;
  certifications?: ResumeCertification[];
};

export type ResumeOtherItem = {
  type?: string | null;
  description?: string[];
};

import type { MasterResumeData as UiMasterResumeData } from '@jobby/ui/components/UI/Resume';

export type MasterResumeData = UiMasterResumeData;

export type DocType = 'resume' | 'cover_letter' | 'both';

export type TailoredResume = {
  id: string;
  job_application_id: string;
  career_profile_id?: string | null;
  job_title?: string | null;
  company?: string | null;
  job_description: string;
  source_resume_data?: Record<string, unknown>;
  resume_data: MasterResumeData;
  raw_ai_response?: Record<string, unknown> | null;
  key_qualifications?: string[];
  core_competencies?: string[];
  targeted_projects?: Array<Record<string, unknown>>;
  cover_letter?: string | null;
  prompt_version?: string;
  created_at: string;
  updated_at: string;
  isGenerating?: boolean;
  generatingDocType?: DocType;
  errorMessage?: string;
};

export type JobReviewResult = {
  resume_data: MasterResumeData | null;
  core_competencies: string[];
  key_qualifications?: string[];
  targeted_projects?: Array<Record<string, unknown>>;
  raw_ai_response?: Record<string, unknown> | null;
  cover_letter?: string | null;
  tailored_resume?: TailoredResume;
};

export type JobReviewPreview = {
  messages: Array<{ role: string; content: string }>;
};

export type JobReviewPayload = {
  job_description: string;
  title?: string;
  company?: string;
  date_posted?: string;
  doc_type?: DocType;
  mock?: boolean;
  generation_id?: string;
};

export type CareerProfile = {
  id: string;
  name: string;
  is_default: boolean;
  resume_data?: MasterResumeData;
  cover_letter?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type UserSkill = {
  id: string;
  skill_name: string;
  canonical_name: string;
  category?: string | null;
  source?: string | null;
  created_at: string;
  updated_at: string;
};
