/** @format */

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
  raw_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type WorkerConfig = {
  user: User;
  profile: UserProfile | null;
  job_hunting_profile: JobHuntingProfile | null;
  runtime_settings: RuntimeSettings | null;
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

export type DesktopBotPlatform = 'linkedin' | 'seek' | 'third_party';

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
  const value = String(status || '')
    .trim()
    .toLowerCase();
  if (!value) return 'applied';
  if (value === 'submitted') return 'applied';
  return value;
}

function normalizeDisplayStatus(status: string | null | undefined): string {
  const value = String(status || '')
    .trim()
    .toLowerCase();
  if (!value) return 'applied';
  if (value === 'submitted') return 'applied';
  if (value === 'interrupted') return 'needs review';
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
  const entries =
    Array.isArray(rawTimeline) ?
      rawTimeline.filter(
        (entry): entry is ApplicationTimelineEntry =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as ApplicationTimelineEntry).stage === 'string',
      )
    : [];

  const fallback: ApplicationTimelineEntry[] = [];
  const statusValue = String(application.status || '')
    .trim()
    .toLowerCase();
  const currentStageFallback =
    statusValue === 'submitted' ? 'applied'
    : statusValue === 'interrupted' ? 'interrupted'
    : statusValue === 'processing' ? 'processing'
    : statusValue === 'cancelled' ? 'cancelled'
    : statusValue === 'skipped' ? 'skipped'
    : normalizeStatusToStage(application.pipeline_stage || application.status);

  if (
    (currentStageFallback === 'applied' &&
      (application.status_updated_at ||
        application.date_applied ||
        application.created_at)) ||
    (currentStageFallback !== 'applied' &&
      (application.status_updated_at ||
        application.updated_at ||
        application.created_at))
  ) {
    fallback.push({
      stage: currentStageFallback || 'applied',
      timestamp:
        (currentStageFallback === 'applied' ?
          application.status_updated_at || application.date_applied
        : application.status_updated_at || application.updated_at) ||
        application.created_at ||
        new Date().toISOString(),
      notes:
        currentStageFallback === 'applied' ?
          'Initial job application submitted.'
        : `Application status is currently ${currentStageFallback}.`,
    });
  }

  const shouldAppendPipelineFallback =
    currentStageFallback === 'applied' &&
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
  if (!timeline.length) return 'applied';

  const latestEntry = timeline[timeline.length - 1];
  if (latestEntry.stage === 'applied') {
    for (let i = timeline.length - 2; i >= 0; i -= 1) {
      if (timeline[i].stage && timeline[i].stage !== 'applied') {
        return timeline[i].stage;
      }
    }
  }

  return latestEntry.stage || 'applied';
}

export function getCurrentApplicationStage(
  application: JobApplication,
): string {
  if (application.status === 'interrupted') {
    return 'interrupted';
  }
  if (application.status === 'skipped') {
    return 'skipped';
  }
  if (application.status === 'cancelled') {
    return 'cancelled';
  }
  if (application.status === 'processing') {
    return 'processing';
  }
  const timeline = getApplicationTimeline(application);
  if (timeline.length) {
    return getLatestTimelineStage(timeline);
  }

  return normalizeStatusToStage(
    application.pipeline_stage || application.status || 'submitted',
  );
}

export function getCurrentApplicationStageTimestamp(
  application: JobApplication,
): string | null {
  if (application.status === 'interrupted') {
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
  return application.status === 'processing';
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
    return 'needs review';
  }

  if (application.status === 'processing') {
    return 'processing';
  }

  if (application.status === 'interrupted') {
    return 'needs review';
  }

  return normalizeDisplayStatus(getCurrentApplicationStage(application));
}

export function shouldShowApplicationSkipReason(
  application: JobApplication,
): boolean {
  const status = getDisplayApplicationStatus(application).toLowerCase();
  return ['skipped', 'needs review', 'cancelled'].includes(status);
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
    s.includes('submit') ||
    [
      'applied',
      'screening',
      'interviewing',
      'offer',
      'rejected',
      'withdrawn',
    ].includes(s)
  );
}

export function getStatusBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  switch (s) {
    case 'submitted':
    case 'applied':
      return 'bg-green-500/20 text-green-600 border-green-500/20';
    case 'processing':
      return 'bg-sky-500/10 text-sky-600 border-sky-500/20';
    case 'needs review':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'skipped':
      return 'bg-amber-500/5 text-amber-600 border-amber-500/20';
    case 'cancelled':
      return 'bg-rose-500/5 text-rose-600 border-rose-500/20';
    case 'screening':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'interviewing':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'offer':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'rejected':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'withdrawn':
      return 'bg-zinc-500/5 text-zinc-500 border-zinc-500/20';
    default:
      return 'bg-glass text-ink-secondary border-border';
  }
}

export type InterviewCategory = {
  id: string;
  name: string;
  user_id?: string;
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

export type InterviewQuestion = {
  id: string;
  category_id?: string | null;
  title: string;
  frequency?: string | null;
  importance_score?: number | null;
  answer_objective?: string | null;
  answer_framework?: string | null;
  sample_answer?: string | null;
  my_answer?: string | null;
  improvement_notes?: string | null;
  category?: InterviewCategory | null;
  tags?: InterviewTag[];
  created_at?: string;
  updated_at?: string;
};

export type AudioRecord = {
  id: string;
  practice_record_id: string;
  url_path: string;
  duration?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type PracticeRecord = {
  id: string;
  question_id: string;
  user_id?: string;
  date?: string;
  my_answer?: string | null;
  confidence_score?: number | null;
  notes?: string | null;
  audio_records?: AudioRecord[];
  created_at?: string;
  updated_at?: string;
};

export type PracticePlan = {
  id: string;
  name: string;
  target_days: number;
  daily_questions_count: number;
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
