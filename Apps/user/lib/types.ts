export type User = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  can_use_auto_apply: boolean;
};

export type UserProfile = {
  id?: string;
  user_id?: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  current_city?: string | null;
  street?: string | null;
  state?: string | null;
  zipcode?: string | null;
  country?: string | null;
  ethnicity?: string | null;
  gender?: string | null;
  gender_identity?: string | null;
  disability_status?: string | null;
  veteran_status?: string | null;
  extra_data?: Record<string, unknown>;
};

export type JobPreferences = {
  id?: string;
  user_id?: string;
  years_of_experience?: string | null;
  require_visa?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  resume_path?: string | null;
  us_citizenship?: string | null;
  desired_salary?: string | number | null;
  current_ctc?: string | number | null;
  notice_period?: number | null;
  linkedin_headline?: string | null;
  linkedin_summary?: string | null;
  cover_letter?: string | null;
  user_information_all?: string | null;
  recent_employer?: string | null;
  confidence_level?: string | null;
  extra_data?: Record<string, unknown>;
};

export type SearchProfile = {
  id?: string;
  user_id?: string;
  platform_account_id?: string | null;
  name: string;
  platform: string;
  search_terms: string[];
  search_location?: string | null;
  filters: Record<string, unknown>;
  blacklist_rules: Record<string, unknown>;
  whitelist_rules: Record<string, unknown>;
  is_default: boolean;
};

export type RuntimeSettings = {
  id?: string;
  user_id?: string;
  platform_account_id?: string | null;
  run_in_background: boolean;
  safe_mode: boolean;
  stealth_mode: boolean;
  click_gap: number;
  pause_before_submit: boolean;
  pause_at_failed_question: boolean;
  overwrite_previous_answers: boolean;
  learn_from_manual_answers: boolean;
  question_similarity_threshold: string | number;
  settings: Record<string, unknown>;
};

export type QuestionCacheEntry = {
  id: string;
  platform_account_id?: string | null;
  platform: string;
  original_label: string;
  normalized_label: string;
  field_type: string;
  options?: string[] | null;
  answer?: string | null;
  source?: string | null;
  times_used: number;
  last_used_at?: string | null;
  companies: string[];
};

export type JobApplication = {
  id: string;
  platform: string;
  job_id?: string | null;
  title?: string | null;
  company?: string | null;
  work_location?: string | null;
  work_style?: string | null;
  job_description?: string | null;
  job_link?: string | null;
  external_job_link?: string | null;
  status: string;
  pipeline_stage: string;
  interview_stage?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  notes?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  last_contacted_at?: string | null;
  deleted_at?: string | null;
  application_type?: string | null;
  resume_path?: string | null;
  date_posted?: string | null;
  date_applied?: string | null;
  questions?: unknown;
  skip_reason?: string | null;
  screenshot_path?: string | null;
  raw_data?: Record<string, unknown>;
};

export type WorkerConfig = {
  user: User;
  profile: UserProfile | null;
  job_preferences: JobPreferences | null;
  search_profile: SearchProfile | null;
  runtime_settings: RuntimeSettings | null;
};

export type AutomationRun = {
  id: string;
  user_id: string;
  platform_account_id?: string | null;
  search_profile_id?: string | null;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  current_message?: string | null;
  summary: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

export type DesktopRuntimeInfo = {
  environmentName?: string;
  deploymentTarget?: string;
  api?: {
    url?: string;
    mode?: string;
  };
  dashboard?: {
    url?: string;
    mode?: string;
  };
  worker?: {
    mode?: string;
  };
};

export type DesktopServiceStatusEntry = {
  mode: string;
  url?: string | null;
  running: boolean;
  startedAt?: string | null;
  healthy?: boolean | null;
  checkedAt?: string | null;
  detail?: string | null;
  recentLogs: Array<{
    at: string;
    line: string;
  }>;
};

export type DesktopServiceStatus = {
  api: DesktopServiceStatusEntry;
  dashboard: DesktopServiceStatusEntry;
  worker: DesktopServiceStatusEntry;
};

export type DesktopConnectionConfig = {
  environmentName: string;
  deploymentTarget: string;
  apiUrl: string;
  dashboardUrl: string;
  apiMode: string;
  dashboardMode: string;
  workerMode: string;
};

export type DesktopConnectionConfigResult = {
  ok: boolean;
  config: DesktopConnectionConfig;
  error?: string;
};
