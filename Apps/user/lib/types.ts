/** @format */

export type User = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  community_badge?: "Admin" | "Contributor" | "VIP" | null;
  role: string;
  status: string;
  can_use_auto_apply: boolean;
};
export type UserProfile = {
  id?: string;
  user_id?: string;
  preferred_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email?: string | null;
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

export type ResumeLocation = {
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
};

export type ResumeLink = {
  type: string | null;
  link: string | null;
};

export type ResumeSkillGroup = {
  type: string | null;
  skills: string[];
};

export type ResumeCertification = {
  name: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_url: string | null;
};

export type ResumeCertificationGroup = {
  type: string | null;
  certifications: ResumeCertification[];
};

export type ResumeOtherItem = {
  type?: string | null;
  title?: string | null;
  organization?: string | null;
  location?: string | null;
  date?: string | null;
  description: string[];
};

export type MasterResumeData = {
  basics?: {
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: ResumeLocation;
    linkedin_id?: string | null;
    website?: string | null;
    portfolio_url?: string | null;
    headline?: string | null;
  };
  summary?: string | null;
  links?: ResumeLink[];
  experience: Array<{
    company?: string | null;
    title?: string | null;
    location?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description: string[];
    technologies: string[];
  }>;
  education: Array<{
    institution?: string | null;
    degree?: string | null;
    field_of_study?: string | null;
    location?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    highlights: string[];
  }>;
  projects: Array<{
    name?: string | null;
    url?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description: string[];
    technologies: string[];
  }>;
  skills?: ResumeSkillGroup[];
  certifications?: ResumeCertificationGroup[];
  languages?: Array<{ name?: string | null; proficiency?: string | null }>;
  search_terms?: string[];
  other?: ResumeOtherItem[];
};

export type MasterResumeEvaluationDimension = {
  type:
    | "factual_completeness"
    | "experience_quality"
    | "skill_evidence"
    | "information_density";
  score: number;
  overview: string;
  suggestions: string[];
};

export type MasterResumeEvaluation = {
  rubric_version: string;
  overall_score: number;
  evaluation: MasterResumeEvaluationDimension[];
  source_hash: string;
  coins_spent: number;
  resume_version?: number;
  published_version?: number | null;
  target?: "draft" | "published";
};

export type MasterResumeEvaluationHistoryItem = {
  id: string;
  resume_version: number;
  published_version?: number | null;
  evaluation: MasterResumeEvaluation;
  resume_data?: MasterResumeData | null;
  created_at: string;
};

export type MasterResume = {
  id: string;
  original_filename: string;
  original_url: string;
  resume_data: MasterResumeData;
  content_version: number;
  published_version: number;
  draft_base_version: number;
  has_draft_changes: boolean;
  evaluation_is_current: boolean;
  published_evaluation?: MasterResumeEvaluation | null;
  published_at?: string | null;
  evaluation?: MasterResumeEvaluation | null;
  evaluation_updated_at?: string | null;
  status: "processing" | "review" | "draft" | "confirmed" | "failed";
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MasterResumeVersion = {
  id: string;
  version: number;
  resume_data: MasterResumeData;
  original_filename: string;
  original_url: string;
  evaluation?: MasterResumeEvaluation | null;
  published_at: string;
};

export type ResumeSource = {
  original_filename: string;
  page_count: number;
  character_count: number;
  text: string;
};

export type ResumeAsset = {
  profile_id: string;
  filename: string;
  url: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CareerProfileScoreHistoryItem = {
  id: string;
  evaluation: MasterResumeEvaluation;
  resume_data: MasterResumeData;
  created_at: string;
};

export type CareerProfile = JobHuntingProfile & {
  id: string;
  created_at?: string;
  updated_at?: string;
  original_filename?: string | null;
  original_url?: string | null;
  resume_data: MasterResumeData;
  status: 'processing' | 'ready' | 'failed';
  latest_evaluation: MasterResumeEvaluation | Record<string, never>;
  evaluation_is_current: boolean;
  evaluation_updated_at?: string | null;
};

export type JobHuntingProfile = {
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
  years_of_experience?: string | null;
  require_visa?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  resume_path?: string | null;
  citizenship?: string | null;
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

export type AutomationSettings = {
  execution_mode: 'dry_run' | 'prepare_only' | 'human_confirmed' | 'submit';
  review_channel: 'browser' | 'console';
  max_jobs_per_run: number;
  max_retries: number;
  require_submit_confirmation: boolean;
  stop_on_unknown_question: boolean;
};

export type AISettings = {
  enabled: boolean;
  provider: string;
  model: string;
  min_confidence: number;
  max_calls_per_job: number;
  daily_budget: number;
  allow_tailored_resume: boolean;
};

export type ResumeSettings = {
  master_resume_id?: string | null;
  tailored_match_threshold: number;
  require_tailored_review: boolean;
};

export type PolicySettings = {
  minimum_match_threshold: number;
  only_easy_apply: boolean;
  blacklisted_companies: string[];
  blacklisted_job_terms: string[];
  whitelisted_companies: string[];
};

export type ApplicationSettings = {
  automation: AutomationSettings;
  ai: AISettings;
  resume: ResumeSettings;
  policy: PolicySettings;
};

export type ApplicationCandidateInput = {
  platform?: string;
  external_id: string;
  title: string;
  company: string;
  description?: string | null;
  match_score?: number | null;
  easy_apply?: boolean;
  already_applied?: boolean;
};

export type ApplicationDecisionResponse = {
  candidate: ApplicationCandidateInput & { platform: string; title: string; company: string };
  decision: {
    action: 'skip' | 'review' | 'apply';
    reason_codes: string[];
    explanation: string;
    score?: number | null;
    resume_strategy?: 'master' | 'tailored' | null;
    requires_submit_confirmation: boolean;
  };
  should_generate_tailored_resume: boolean;
  matched_terms?: string[];
};

export type ApplicationPlanResponse = {
  application_id: string;
  plan: {
    candidate: ApplicationCandidateInput & { platform: string; title: string; company: string };
    decision: ApplicationDecisionResponse['decision'];
    idempotency_key: string;
    state: string;
    review_reason?: string | null;
  };
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
  status_updated_at?: string | null;
  questions?: unknown;
  skip_reason?: string | null;
  screenshot_path?: string | null;
  has_tailored_resume?: boolean;
  tailored_resume_id?: string | null;
  raw_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type WorkerConfig = {
  user: User;
  profile: UserProfile | null;
  job_hunting_profile: JobHuntingProfile | null;
  runtime_settings: RuntimeSettings | null;
  application_settings?: ApplicationSettings;
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

export type DesktopBotPlatform = "linkedin" | "seek" | "third_party";

export type DesktopBotState = {
  status: string;
  message: string;
  stats: {
    submitted: number;
    skipped: number;
    failed: number;
  };
  logs: Array<{
    at: string;
    line: string;
  }>;
};

export const PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;

export type ApplicationTimelineEntry = {
  stage: string;
  timestamp: string;
  notes?: string;
};

function normalizeStatusToStage(status: string | null | undefined): string {
  const value = String(status || "")
    .trim()
    .toLowerCase();
  if (!value) return "applied";
  if (value === "submitted") return "applied";
  return value;
}

function normalizeDisplayStatus(status: string | null | undefined): string {
  const value = String(status || "")
    .trim()
    .toLowerCase();
  if (!value) return "applied";
  if (value === "submitted") return "applied";
  if (value === "interrupted") return "needs review";
  return value;
}

function parseTimestampMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? Number.NaN : ms;
}

export function getApplicationTimeline(
  application: JobApplication,
): ApplicationTimelineEntry[] {
  const rawTimeline = application.raw_data?.timeline;
  const entries = Array.isArray(rawTimeline)
    ? rawTimeline.filter(
        (entry): entry is ApplicationTimelineEntry =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as ApplicationTimelineEntry).stage === "string",
      )
    : [];

  const fallback: ApplicationTimelineEntry[] = [];
  const statusValue = String(application.status || "")
    .trim()
    .toLowerCase();
  const currentStageFallback =
    statusValue === "submitted"
      ? "applied"
      : statusValue === "interrupted"
        ? "interrupted"
        : statusValue === "processing"
          ? "processing"
          : statusValue === "cancelled"
            ? "cancelled"
            : statusValue === "skipped"
              ? "skipped"
              : normalizeStatusToStage(
                  application.pipeline_stage || application.status,
                );

  if (
    (currentStageFallback === "applied" &&
      (application.status_updated_at ||
        application.date_applied ||
        application.created_at)) ||
    (currentStageFallback !== "applied" &&
      (application.status_updated_at ||
        application.updated_at ||
        application.created_at))
  ) {
    fallback.push({
      stage: currentStageFallback || "applied",
      timestamp:
        (currentStageFallback === "applied"
          ? application.status_updated_at || application.date_applied
          : application.status_updated_at || application.updated_at) ||
        application.created_at ||
        new Date().toISOString(),
      notes:
        currentStageFallback === "applied"
          ? "Initial job application submitted."
          : `Application status is currently ${currentStageFallback}.`,
    });
  }

  const shouldAppendPipelineFallback =
    currentStageFallback === "applied" &&
    !!application.pipeline_stage &&
    application.pipeline_stage !== fallback[0]?.stage &&
    !entries.some((entry) => entry.stage === application.pipeline_stage);

  if (shouldAppendPipelineFallback) {
    fallback.push({
      stage: application.pipeline_stage,
      timestamp:
        application.status_updated_at ||
        application.updated_at ||
        new Date().toISOString(),
      notes: `Application status transitioned to ${application.pipeline_stage}.`,
    });
  }

  return (entries.length ? entries : fallback).sort((a, b) => {
    const aMs = parseTimestampMs(a.timestamp);
    const bMs = parseTimestampMs(b.timestamp);
    if (Number.isNaN(aMs) && Number.isNaN(bMs)) return 0;
    if (Number.isNaN(aMs)) return 1;
    if (Number.isNaN(bMs)) return -1;
    return aMs - bMs;
  });
}

function getLatestTimelineStage(timeline: ApplicationTimelineEntry[]): string {
  if (!timeline.length) return "applied";

  const latestEntry = timeline[timeline.length - 1];
  if (latestEntry.stage === "applied") {
    for (let i = timeline.length - 2; i >= 0; i -= 1) {
      if (timeline[i].stage && timeline[i].stage !== "applied") {
        return timeline[i].stage;
      }
    }
  }

  return latestEntry.stage || "applied";
}

export function getCurrentApplicationStage(
  application: JobApplication,
): string {
  if (application.status === "interrupted") {
    return "interrupted";
  }
  if (application.status === "skipped") {
    return "skipped";
  }
  if (application.status === "cancelled") {
    return "cancelled";
  }
  if (application.status === "processing") {
    return "processing";
  }
  const timeline = getApplicationTimeline(application);
  if (timeline.length) {
    return getLatestTimelineStage(timeline);
  }

  return normalizeStatusToStage(
    application.pipeline_stage || application.status || "submitted",
  );
}

export function getCurrentApplicationStageTimestamp(
  application: JobApplication,
): string | null {
  if (application.status === "interrupted") {
    return (
      application.status_updated_at ??
      application.updated_at ??
      application.created_at ??
      null
    );
  }
  const currentStage = getCurrentApplicationStage(application);
  const timeline = getApplicationTimeline(application);

  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    if (timeline[i].stage === currentStage) {
      return timeline[i].timestamp || null;
    }
  }

  return (
    application.status_updated_at ??
    application.updated_at ??
    application.date_applied ??
    application.created_at ??
    null
  );
}

export function getApplicationLastActivityTimestamp(
  application: JobApplication,
): string | null {
  return (
    application.updated_at ??
    application.date_applied ??
    application.created_at ??
    null
  );
}

export function isProcessingApplication(application: JobApplication): boolean {
  return application.status === "processing";
}

export function isStaleProcessingApplication(
  application: JobApplication,
): boolean {
  if (!isProcessingApplication(application)) return false;

  const updatedAt = application.updated_at ?? application.created_at;
  if (!updatedAt) return false;

  const updatedAtMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedAtMs)) return false;

  return Date.now() - updatedAtMs > PROCESSING_TIMEOUT_MS;
}

export function getDisplayApplicationStatus(
  application: JobApplication,
): string {
  if (isStaleProcessingApplication(application)) {
    return "needs review";
  }

  if (application.status === "processing") {
    return "processing";
  }

  if (application.status === "interrupted") {
    return "needs review";
  }

  return normalizeDisplayStatus(getCurrentApplicationStage(application));
}

export function shouldShowApplicationSkipReason(
  application: JobApplication,
): boolean {
  const status = getDisplayApplicationStatus(application).toLowerCase();
  return ["skipped", "needs review", "cancelled"].includes(status);
}

export function getApplicationDisplayDate(
  application: JobApplication,
): string | null {
  if (application.date_applied) {
    return application.status_updated_at ?? application.date_applied;
  }

  return (
    application.status_updated_at ??
    application.updated_at ??
    application.created_at ??
    null
  );
}

export function isStatusSubmitted(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s.includes("submit") ||
    [
      "applied",
      "screening",
      "interviewing",
      "offer",
      "rejected",
      "withdrawn",
    ].includes(s)
  );
}

export function getStatusBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  switch (s) {
    case "submitted":
    case "applied":
      return "bg-green-500/20 text-green-600 border-green-500/20";
    case "processing":
      return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    case "needs review":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    case "skipped":
      return "bg-amber-500/5 text-amber-600 border-amber-500/20";
    case "cancelled":
      return "bg-rose-500/5 text-rose-600 border-rose-500/20";
    case "screening":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "interviewing":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    case "offer":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "withdrawn":
      return "bg-zinc-500/5 text-zinc-500 border-zinc-500/20";
    default:
      return "bg-glass text-ink-secondary border-border";
  }
}

export type InterviewCategory = {
  id: string;
  name: string;
  slug?: string | null;
  display_name?: string | null;
  icon_key?: string | null;
  sort_order?: number | null;
  is_system?: boolean;
  user_id?: string;
  question_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type InterviewTag = {
  id: string;
  name: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type Company = {
  id: string;
  name: string;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InterviewQuestion = {
  id: string;
  display_number?: number | null;
  submitted_by_user_id?: string | null;
  category_id?: string | null;
  title: string;
  normalized_title?: string | null;
  is_favorited?: boolean;
  user_reaction?: "up" | "down" | null;
  can_edit?: boolean;
  difficulty?: "Easy" | "Medium" | "Hard" | string | null;
  estimated_duration_seconds?: number | null;
  metrics?: {
    view_count?: number;
    favorite_count?: number;
    upvote_count?: number;
    downvote_count?: number;
    seen_in_interview_count?: number;
    comment_count?: number;
    practice_count?: number;
    hot_score?: number;
    top_companies?: { name: string; count: number }[];
  };
  frequency?: string | null;
  importance_score?: number | null;
  contributor_name?: string | null;
  recommendation_score?: number | null;
  recommendation_reason?: string | null;
  author_frequency?: string | null;
  author_importance_score?: number | null;
  ai_metadata?: {
    tags?: string[];
    importance_score?: number;
    difficulty?: "easy" | "medium" | "hard";
    estimated_duration?: number;
    generated_at?: string;
  } | null;
  answer_objective?: string | null;
  sample_answer?: string | null;
  my_answer?: string | null;
  improvement_notes?: string | null;
  collection_ids?: string[];
  is_saved?: boolean;
  category?: InterviewCategory | null;
  tags?: InterviewTag[];
  companies?: Company[];
  created_at?: string;
  updated_at?: string;
};

export type InterviewCollection = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_url?: string | null;
  cover_storage_key?: string | null;
  creator_user_id?: string | null;
  collection_type: string;
  theme?: string | null;
  price_coins: number;
  status: string;
  last_updated_at?: string | null;
  created_at?: string;
  updated_at?: string;
  library_adds: number;
  question_count: number;
  user_active_question_count: number;
  missing_question_count: number;
  library_status: "not_added" | "partial" | "complete" | "empty";
  sample_questions?: string[];
  question_ids?: string[];
  creator_name?: string | null;
  contributor_count: number;
  is_owned: boolean;
  is_in_library: boolean;
  is_purchased: boolean;
  can_purchase: boolean;
  free_label?: string | null;
};

export type InterviewReport = {
  id: string;
  user_id: string;
  question_id: string;
  company?: string | null;
  role?: string | null;
  seen_in_interview: boolean;
  happened_at: string;
  notes?: string | null;
  raw_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type QuestionCommunitySummary = {
  frequency_average?: number | null;
  importance_average?: number | null;
  difficulty_average?: number | null;
  rating_count: number;
  view_count: number;
  unique_viewer_count: number;
  practice_count: number;
  unique_practicer_count: number;
  total_practice_seconds: number;
  average_practice_seconds?: number | null;
  favorite_count: number;
  is_favorited: boolean;
  upvote_count: number;
  downvote_count: number;
  seen_in_interview_count: number;
  company_count: number;
  comment_count?: number;
  blended_importance_score?: number | null;
  blended_frequency_score?: number | null;
  top_companies: { name: string; count: number }[];
  user_frequency_rating?: number | null;
  user_importance_rating?: number | null;
  user_difficulty_rating?: number | null;
  user_reaction?: "up" | "down" | null;
  survey_bonus_xp?: number;
  survey_bonus_coins?: number;
};

export type QuestionAnswer = {
  id: string;
  question_id: string;
  author_user_id?: string | null;
  source: string;
  answer_type: string;
  status: string;
  title?: string | null;
  body?: string | null;
  structured_content?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  is_recommended: boolean;
  recommended_by_user_id?: string | null;
  recommended_at?: string | null;
  reaction_count: number;
  upvote_count: number;
  downvote_count: number;
  user_reaction?: "up" | "down" | null;
  comment_count: number;
  is_saved: boolean;
  is_reported: boolean;
  is_author: boolean;
  can_manage: boolean;
  author_name?: string | null;
  author_avatar_url?: string | null;
  author_badge?: "Admin" | "Contributor" | "VIP" | null;
  is_locked: boolean;
  unlock_cost: number;
  question_unlock_remaining_cost: number;
  created_at: string;
  updated_at: string;
};

export type PracticeEvaluation = {
  id: string;
  practice_record_id: string;
  status: string;
  provider: string;
  model: string;
  prompt_version: string;
  overall_score?: number | null;
  result: {
    priority_issue?: string;
    priority_fix?: string;
    answer_plan?: string[];
    dimensions?: {
      name: string;
      score: number;
      feedback: string;
      evidence?: string;
      fix?: string;
    }[];
    score_basis?: string[];
    strengths?: string[];
    gaps?: string[];
    next_steps?: string[];
    polished_answer?: string;
    gold_rewrite?: string;
  };
  coins_spent: number;
  created_at: string;
};

export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};

export type TranscriptSegment = {
  text: string;
  start: number;
  end: number;
  words?: TranscriptWord[];
};

export type PracticeTranscription = {
  provider: string;
  model: string;
  language?: string | null;
  duration_seconds?: number | null;
  text: string;
  segments: TranscriptSegment[];
};

export type QuestionAnswerComment = {
  id: string;
  answer_id: string;
  parent_id?: string | null;
  body: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_badge?: "Admin" | "Contributor" | "VIP" | null;
  is_author: boolean;
  like_count: number;
  is_liked: boolean;
  is_reported: boolean;
  reply_count: number;
  created_at: string;
  updated_at: string;
  replies: QuestionAnswerComment[];
};

export type QuestionAnswerCommentPage = {
  items: QuestionAnswerComment[];
  next_cursor?: string | null;
  answer_id: string;
};

export type QuestionComment = {
  id: string;
  question_id: string;
  parent_id?: string | null;
  kind: "discussion" | "feedback" | "example";
  body: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_badge?: "Admin" | "Contributor" | "VIP" | null;
  is_author: boolean;
  like_count: number;
  is_liked: boolean;
  is_reported: boolean;
  reply_count: number;
  created_at: string;
  updated_at: string;
  replies: QuestionComment[];
};
export type QuestionCommentPage = {
  items: QuestionComment[];
  next_cursor?: string | null;
  question_id: string;
};
export type CommunityInterviewReport = {
  id: string;
  company?: string | null;
  role?: string | null;
  location?: string | null;
  happened_at: string;
};
export type UserNotification = {
  id: string;
  kind: string;
  title?: string | null;
  message: string;
  action_url?: string | null;
  actor_user_id?: string | null;
  metadata?: Record<string, unknown>;
  question_id?: string | null;
  read_at?: string | null;
  created_at: string;
};
export type QuestionDuplicateCandidate = {
  id: string;
  title: string;
  owner_name: string;
  created_at: string;
  match_type: "exact" | "similar";
};
export type QuestionDuplicateGroup = {
  normalized_title: string;
  questions: QuestionDuplicateCandidate[];
};
export type QuestionDiscussionMerge = {
  target_question_id: string;
  merged_question_ids: string[];
  comments_moved: number;
};

export type AudioRecord = {
  id: string;
  practice_record_id: string;
  url_path: string;
  duration?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type GamificationUpdate = {
  xp_gained: number;
  coins_gained: number;
  new_streak: number;
  new_level: number;
  is_streak_extended: boolean;
};

export type PracticeRecord = {
  id: string;
  question_id: string;
  user_id?: string;
  started_at?: string | null;
  submitted_at?: string | null;
  duration_seconds?: number | null;
  date?: string;
  my_answer?: string | null;
  confidence_score?: number | null;
  notes?: string | null;
  audio_records?: AudioRecord[];
  gamification_update?: GamificationUpdate | null;
  created_at?: string;
  updated_at?: string;
};

export type PracticePlan = {
  id: string;
  name: string;
  target_days: number;
  daily_questions_count: number;
  claimed_stage_days?: number[];
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PlanTask = {
  id: string;
  plan_id: string;
  question_id: string;
  scheduled_date: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type DailySummary = {
  completed_questions: number;
  new_questions: number;
  review_questions: number;
  total_speaking_time_seconds: number;
  best_answer_title: string | null;
  current_streak: number;
  xp_gained_today: number;
  coins_gained_today: number;
  level: number;
  total_xp: number;
  next_level_xp: number;
  loot_boxes: number;
  has_checked_in_today: boolean;
  total_coins: number;
  max_daily_xp_gain?: number;
  max_daily_coin_gain?: number;
  inventory?: Record<string, number>;
  active_boosters?: Record<string, string>;
};

export type UserInventoryResponse = {
  coins: number;
  xp: number;
  level: number;
  loot_boxes: number;
  inventory: Record<string, number>;
  active_boosters: Record<string, string>;
};

export type DailyQuest = {
  id: string;
  quest_date: string;
  quest_type: string;
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  is_claimed: boolean;
};

export type Achievement = {
  id: string;
  badge_id: string;
  badge_name: string;
  description: string;
  unlocked_at?: string | null;
  unlocked: boolean;
  unlock_reason?: string | null;
};

export type LootBoxResponse = {
  coins_won: number;
  new_balance: number;
};

export type WelcomeBonusResponse = {
  awarded: boolean;
  coins_earned: number;
  xp_earned?: number;
  loot_boxes_earned?: number;
};

export type GamificationQuestConfig = {
  id: string;
  title: string;
  description: string;
  metric_key: string;
  target_value: number;
  category: string;
  enabled: boolean;
  visible: boolean;
  reward_xp: number;
  reward_coins: number;
  reward_loot_boxes: number;
};

export type GamificationBadgeConfig = {
  badge_id: string;
  badge_name: string;
  description: string;
  metric_key: string;
  target_value: number;
  enabled: boolean;
  visible: boolean;
};

export type GamificationEventConfig = {
  event_key: string;
  label: string;
  xp: number;
  coins: number;
  loot_boxes: number;
  enabled: boolean;
  application_origin: "any" | "manual" | "auto";
};

export type GamificationAdminConfig = {
  daily_selection_count: number;
  weekly_selection_count: number;
  daily_quest_pool: GamificationQuestConfig[];
  weekly_quest_pool: GamificationQuestConfig[];
  badges: GamificationBadgeConfig[];
  reward_events: GamificationEventConfig[];
  spend_events: GamificationEventConfig[];
  max_daily_xp_gain?: number;
  max_daily_coin_gain?: number;
  welcome_bonus_coins?: number;
  welcome_bonus_xp?: number;
  welcome_bonus_loot_boxes?: number;
  celebration_config?: unknown;
};

export type HeatmapDataEntry = {
  date: string;
  count: number;
};

export type HeatmapData = {
  entries: HeatmapDataEntry[];
};

export type GamificationTransaction = {
  id: string;
  user_id?: string;
  amount: number;
  currency: string;
  reason: string;
  reference_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FavoritedCommentSummary = {
  id: string;
  question_id: string;
  question_title: string;
  body: string;
  kind?: string;
  author_name?: string;
  created_at?: string | null;
  is_author?: boolean;
};

export type SavedAnswerSummary = {
  id: string;
  question_id: string;
  question_title: string;
  title?: string | null;
  body: string;
  answer_type: string;
  author_name: string;
  created_at?: string | null;
};

export type SavedCollectionSummary = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  price_coins: number;
  is_purchased: boolean;
  added_at?: string | null;
};

export type UserFavoritesCounts = {
  favorited_questions: number;
  my_comments: number;
  liked_comments: number;
  saved_answers: number;
  saved_collections: number;
  total: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total?: number;
  has_more: boolean;
  next_offset?: number | null;
  next_cursor?: string | null;
};

export type UserFavoritesAll = {
  favorited_questions: InterviewQuestion[];
  my_comments: FavoritedCommentSummary[];
  liked_comments: FavoritedCommentSummary[];
  saved_answers: SavedAnswerSummary[];
  saved_collections: SavedCollectionSummary[];
};

export type ProspectRoleType = "recruiter" | "hiring_manager" | "engineering_manager";
export type ProspectStatus = "recommended" | "contacted" | "replied" | "interviewing" | "archived";
export type ProspectMatchLevel = "high" | "medium" | "low";

export interface ProspectScoreBreakdown {
  hiring_power: number;       // 1-100
  reply_probability: number;  // 1-100
  company_match: number;      // 1-100
  experience_match: number;   // 1-100
  overall: number;            // 1-100
}

export type Prospect = {
  id: string;
  user_id: string;
  name: string;
  title: string;
  company: string;
  linkedin_url?: string | null;
  role_type: ProspectRoleType;
  location?: string | null;
  has_active_job: boolean;
  active_job_title?: string | null;
  active_job_url?: string | null;
  priority_score: number;
  score_breakdown?: ProspectScoreBreakdown | null;
  match_level: ProspectMatchLevel;
  recommendation_reason: string;
  status: ProspectStatus;
  notes?: string | null;
  last_interacted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectAgentLogEntry = {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
};

export type ProspectAgentLog = {
  id: string;
  user_id: string;
  status: "running" | "completed" | "failed";
  prospects_found: number;
  prospects_added: number;
  summary: string;
  logs: ProspectAgentLogEntry[];
  created_at: string;
  updated_at: string;
};

export type ProspectDiscoveryRequest = {
  target_roles?: string[];
  preferred_locations?: string[];
  role_types?: ProspectRoleType[];
  limit?: number;
};

export type ProspectDiscoveryResponse = {
  status: string;
  prospects_found: number;
  prospects_added: number;
  summary: string;
  logs: ProspectAgentLogEntry[];
  new_prospects: Prospect[];
};
