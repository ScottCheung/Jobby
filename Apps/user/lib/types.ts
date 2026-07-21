/** @format */

export type User = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
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

export type Company = {
  id: string;
  name: string;
  logo_url?: string | null;
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
  source_collection_id?: string | null;
  source_question_id?: string | null;
  archived_at?: string | null;
  is_library_copy?: boolean;
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
  price_coins: number;
  status: string;
  last_updated_at?: string | null;
  library_adds: number;
  question_count: number;
  user_active_question_count: number;
  missing_question_count: number;
  library_status: 'not_added' | 'partial' | 'complete' | 'empty';
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
  importance_average?: number | null;
  difficulty_average?: number | null;
  rating_count: number;
  upvote_count: number;
  downvote_count: number;
  seen_in_interview_count: number;
  company_count: number;
  top_companies: { name: string; count: number }[];
  user_importance_rating?: number | null;
  user_difficulty_rating?: number | null;
  user_reaction?: 'up' | 'down' | null;
  survey_bonus_xp?: number;
  survey_bonus_coins?: number;
};

export type QuestionComment = {
  id: string;
  question_id: string;
  parent_id?: string | null;
  kind: 'discussion' | 'feedback' | 'example';
  body: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_badge?: 'Admin' | 'Author' | 'VIP' | null;
  is_author: boolean;
  like_count: number;
  is_liked: boolean;
  is_reported: boolean;
  reply_count: number;
  created_at: string;
  updated_at: string;
  replies: QuestionComment[];
};
export type QuestionCommentPage = { items: QuestionComment[]; next_cursor?: string | null; question_id: string; };
export type CommunityInterviewReport = { id: string; company?: string | null; role?: string | null; happened_at: string; };
export type UserNotification = { id: string; kind: string; title?: string | null; message: string; action_url?: string | null; actor_user_id?: string | null; metadata?: Record<string, unknown>; question_id?: string | null; read_at?: string | null; created_at: string; };
export type QuestionDuplicateCandidate = { id: string; title: string; owner_name: string; created_at: string; };
export type QuestionDuplicateGroup = { normalized_title: string; questions: QuestionDuplicateCandidate[]; };
export type QuestionDiscussionMerge = { target_question_id: string; merged_question_ids: string[]; comments_moved: number; };

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
  application_origin: 'any' | 'manual' | 'auto';
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
