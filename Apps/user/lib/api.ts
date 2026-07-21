import type {
  JobApplication,
  QuestionCacheEntry,
  RuntimeSettings,
  JobHuntingProfile,
  User,
  UserProfile,
  WorkerConfig,
  InterviewCategory,
  InterviewTag,
  InterviewQuestion,
  InterviewCollection,
  InterviewReport,
  QuestionCommunitySummary,
  QuestionComment,
  QuestionCommentPage,
  CommunityInterviewReport,
  UserNotification,
  PracticeRecord,
  PracticePlan,
  PlanTask,
  DailySummary,
  HeatmapData,
  GamificationTransaction,
  DailyQuest,
  Achievement,
  LootBoxResponse,
  WelcomeBonusResponse,
  GamificationAdminConfig,
  QuestionDiscussionMerge,
  QuestionDuplicateGroup,
} from "./types";
import { resolveApiBaseUrl } from "./runtime";
import { createClient } from "./supabase/client";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = await resolveApiBaseUrl();
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  if (session?.user?.email) {
    headers["X-User-Email"] = session.user.email;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const detailText = await response.text();
    try {
      const parsed = JSON.parse(detailText);
      if (typeof parsed?.detail === "string") {
        throw new Error(parsed.detail);
      }
      if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) {
        throw new Error(parsed.detail[0].msg);
      }
    } catch {}
    throw new Error(detailText || `API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => apiRequest<{ status: string }>("/health"),
  me: () => apiRequest<User>("/api/me"),
  workerConfig: () => apiRequest<WorkerConfig>("/api/worker/config"),
  profile: () => apiRequest<UserProfile>("/api/profile"),
  updateProfile: (payload: UserProfile) =>
    apiRequest<UserProfile>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  jobHuntingProfiles: () => apiRequest<JobHuntingProfile[]>("/api/job-hunting-profiles"),
  jobHuntingProfile: () => apiRequest<JobHuntingProfile>("/api/job-hunting-profile"),
  updateJobHuntingProfile: (payload: JobHuntingProfile) =>
    apiRequest<JobHuntingProfile>("/api/job-hunting-profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createJobHuntingProfile: (payload: JobHuntingProfile) =>
    apiRequest<JobHuntingProfile>("/api/job-hunting-profiles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateJobHuntingProfileById: (profileId: string, payload: JobHuntingProfile) =>
    apiRequest<JobHuntingProfile>(`/api/job-hunting-profiles/${profileId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  activateJobHuntingProfile: (profileId: string) =>
    apiRequest<JobHuntingProfile>(`/api/job-hunting-profiles/${profileId}/activate`, {
      method: "POST",
    }),
  deleteJobHuntingProfile: (profileId: string) =>
    apiRequest<void>(`/api/job-hunting-profiles/${profileId}`, {
      method: "DELETE",
    }),
  runtimeSettings: () => apiRequest<RuntimeSettings>("/api/runtime-settings"),
  updateRuntimeSettings: (payload: RuntimeSettings) =>
    apiRequest<RuntimeSettings>("/api/runtime-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  questionCache: (limit?: number, offset?: number, search?: string) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append("limit", String(limit));
    if (offset !== undefined) params.append("offset", String(offset));
    if (search) params.append("search", search);
    const qs = params.toString();
    return apiRequest<QuestionCacheEntry[]>(qs ? `/api/question-cache?${qs}` : "/api/question-cache");
  },
  updateQuestionCache: (entry: QuestionCacheEntry) =>
    apiRequest<QuestionCacheEntry>(`/api/question-cache/${entry.id}`, {
      method: "PUT",
      body: JSON.stringify(entry),
    }),
  deleteQuestionCache: (entryId: string) =>
    apiRequest<void>(`/api/question-cache/${entryId}`, {
      method: "DELETE",
    }),
  applications: (status?: string, limit?: number, offset?: number, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (limit !== undefined) params.append("limit", String(limit));
    if (offset !== undefined) params.append("offset", String(offset));
    if (search) params.append("search", search);
    const qs = params.toString();
    return apiRequest<JobApplication[]>(qs ? `/api/applications?${qs}` : "/api/applications");
  },
  applicationStats: (timezone?: string) => {
    const tz = timezone ? `?timezone=${encodeURIComponent(timezone)}` : "";
    return apiRequest<{
      total_applications: number;
      submitted: number;
      today_submitted: number;
      yesterday_submitted: number;
      today_processed: number;
      yesterday_processed: number;
      interviewing: number;
      skipped: number;
    }>(`/api/applications/stats${tz}`);
  },
  updateApplication: (applicationId: string, payload: Partial<JobApplication>) =>
    apiRequest<JobApplication>(`/api/applications/${applicationId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  asyncApplicationFromLink: (applicationId: string) =>
    apiRequest<JobApplication>(`/api/applications/${applicationId}/async-from-link`, {
      method: "POST",
    }),
  batchAsyncApplicationsFromLink: (limit = 100) =>
    apiRequest<{ processed: number; synced: number; failed: number; results: unknown[] }>(`/api/applications/async-from-link/batch?limit=${limit}`, {
      method: "POST",
    }),
  deleteApplication: (applicationId: string) =>
    apiRequest<void>(`/api/applications/${applicationId}`, {
      method: "DELETE",
    }),
  // Interview Playbook
  interviewCategories: () => apiRequest<InterviewCategory[]>("/api/interview/categories"),
  createInterviewCategory: (payload: { name: string }) =>
    apiRequest<InterviewCategory>("/api/interview/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  interviewTags: () => apiRequest<InterviewTag[]>("/api/interview/tags"),
  createInterviewTag: (payload: { name: string }) =>
    apiRequest<InterviewTag>("/api/interview/tags", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  interviewQuestions: () => apiRequest<InterviewQuestion[]>("/api/interview/questions"),
  searchGlobalQuestions: (q: string) => apiRequest<InterviewQuestion[]>(`/api/interview/questions/search/global?q=${encodeURIComponent(q)}`),
  getInterviewQuestion: (id: string) => apiRequest<InterviewQuestion>(`/api/interview/questions/${id}`),
  createInterviewQuestion: (payload: Partial<InterviewQuestion>) =>
    apiRequest<InterviewQuestion>("/api/interview/questions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  batchCreateInterviewQuestions: (payload: Partial<InterviewQuestion>[]) =>
    apiRequest<InterviewQuestion[]>("/api/interview/questions/batch", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateInterviewQuestion: (id: string, payload: Partial<InterviewQuestion>) =>
    apiRequest<InterviewQuestion>(`/api/interview/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteInterviewQuestion: (id: string) =>
    apiRequest<void>(`/api/interview/questions/${id}`, {
      method: "DELETE",
    }),
    interviewCollections: (kind?: string) => {
    const params = new URLSearchParams();
    if (kind) params.append("kind", kind);
    params.append("_t", String(Date.now()));
    const qs = params.toString();
    return apiRequest<InterviewCollection[]>(`/api/interview/collections?${qs}`);
  },
  myCreatedCollections: () =>
    apiRequest<InterviewCollection[]>(`/api/interview/collections/me/created?_t=${Date.now()}`),
  purchasedInterviewCollections: () =>
    apiRequest<InterviewCollection[]>(`/api/interview/collections?kind=purchased&_t=${Date.now()}`),
  interviewCollection: (id: string) => apiRequest<InterviewCollection>(`/api/interview/collections/${id}?_t=${Date.now()}`),
  addCollectionToLibrary: (id: string) =>
    apiRequest<{ message: string; questions_added: number; purchased: boolean }>(`/api/interview/collections/${id}/add`, {
      method: "POST",
    }),
  removeCollectionFromLibrary: (id: string) =>
    apiRequest<{ message: string }>(`/api/interview/collections/${id}/remove`, {
      method: "DELETE",
    }),
  uploadCollectionCover: async (id: string, file: File) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file, file.name);
    const response = await fetch(`${apiBaseUrl}/api/interview/collections/${id}/cover`, {
      method: 'POST',
      body: formData,
      headers: session?.user?.email ? { 'X-User-Email': session.user.email } : undefined,
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = await response.text();
      try {
        const parsed = JSON.parse(detail);
        throw new Error(parsed?.detail || 'Could not upload cover image.');
      } catch (error) {
        if (error instanceof Error) throw error;
      }
      throw new Error(detail || 'Could not upload cover image.');
    }
    return response.json() as Promise<InterviewCollection>;
  },
  createInterviewCollection: (payload: { title: string; description?: string; price_coins?: number; status?: string; question_ids: string[] }) =>
    apiRequest<InterviewCollection>("/api/interview/collections", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateInterviewCollection: (id: string, payload: { title?: string; description?: string; price_coins?: number; status?: string; question_ids?: string[] }) =>
    apiRequest<InterviewCollection>(`/api/interview/collections/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteInterviewCollection: (id: string) =>
    apiRequest<{ message: string }>(`/api/interview/collections/${id}`, {
      method: "DELETE",
    }),
  interviewReports: () => apiRequest<InterviewReport[]>("/api/interview/reports"),
  createInterviewReport: (payload: Partial<InterviewReport>) =>
    apiRequest<InterviewReport>("/api/interview/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  questionCommunity: (id: string) =>
    apiRequest<QuestionCommunitySummary>(`/api/interview/questions/${id}/community`),
  updateQuestionCommunityRating: (id: string, payload: { importance_rating?: number | null; difficulty_rating?: number | null }) =>
    apiRequest<QuestionCommunitySummary>(`/api/interview/questions/${id}/community/rating`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateQuestionCommunityReaction: (id: string, value: 'up' | 'down' | null) =>
    apiRequest<QuestionCommunitySummary>(`/api/interview/questions/${id}/community/reaction`, { method: 'PUT', body: JSON.stringify({ value }) }),
  questionComments: (id: string, options?: { kind?: string; before?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.kind) params.set('kind', options.kind);
    if (options?.before) params.set('before', options.before);
    params.set('limit', String(options?.limit ?? 10));
    return apiRequest<QuestionCommentPage>(`/api/interview/questions/${id}/comments?${params}`);
  },
  questionCommentReplies: (questionId: string, commentId: string, before?: string) =>
    apiRequest<QuestionCommentPage>(`/api/interview/questions/${questionId}/comments/${commentId}/replies?limit=10${before ? `&before=${encodeURIComponent(before)}` : ''}`),
  createQuestionComment: (id: string, payload: { kind: 'discussion' | 'feedback' | 'example'; body: string; parent_id?: string }) =>
    apiRequest<QuestionComment>(`/api/interview/questions/${id}/comments`, { method: 'POST', body: JSON.stringify(payload) }),
  updateQuestionComment: (questionId: string, commentId: string, payload: { body: string }) =>
    apiRequest<QuestionComment>(`/api/interview/questions/${questionId}/comments/${commentId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteQuestionComment: (questionId: string, commentId: string) =>
    apiRequest<void>(`/api/interview/questions/${questionId}/comments/${commentId}`, { method: 'DELETE' }),
  toggleQuestionCommentLike: (questionId: string, commentId: string) =>
    apiRequest<{ liked: boolean; like_count: number }>(`/api/interview/questions/${questionId}/comments/${commentId}/like`, { method: 'PUT' }),
  reportQuestionComment: (questionId: string, commentId: string, reason: 'spam' | 'off_topic' | 'unsafe') =>
    apiRequest<void>(`/api/interview/questions/${questionId}/comments/${commentId}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),
  communityInterviewReports: (id: string) => apiRequest<CommunityInterviewReport[]>(`/api/interview/questions/${id}/community/reports`),
  communityNotifications: () => apiRequest<UserNotification[]>('/api/interview/community/notifications'),
  markCommunityNotificationsRead: () => apiRequest<{ message: string }>('/api/interview/community/notifications/read', { method: 'POST' }),
  notifications: () => apiRequest<UserNotification[]>('/api/interview/notifications'),
  markNotificationRead: (id: string) => apiRequest<{ message: string }>(`/api/interview/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => apiRequest<{ message: string }>('/api/interview/notifications/read', { method: 'POST' }),
  practiceRecords: () => apiRequest<PracticeRecord[]>("/api/interview/practice-records"),
  createPracticeRecord: (payload: Partial<PracticeRecord>) =>
    apiRequest<PracticeRecord>("/api/interview/practice-records", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePracticeRecord: (id: string, payload: Partial<PracticeRecord>) =>
    apiRequest<PracticeRecord>(`/api/interview/practice-records/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  practicePlans: () => apiRequest<PracticePlan[]>("/api/interview/plans"),
  createPracticePlan: (payload: Partial<PracticePlan>) =>
    apiRequest<PracticePlan>("/api/interview/plans", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  planTasks: (planId: string) => apiRequest<PlanTask[]>(`/api/interview/plans/${planId}/tasks`),
  createPlanTask: (planId: string, payload: Partial<PlanTask>) =>
    apiRequest<PlanTask>(`/api/interview/plans/${planId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deletePracticePlan: (planId: string) =>
    apiRequest<void>(`/api/interview/plans/${planId}`, {
      method: "DELETE",
    }),
  updatePlanTask: (planId: string, taskId: string, payload: Partial<PlanTask>) =>
    apiRequest<PlanTask>(`/api/interview/plans/${planId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  gamificationSummary: () => apiRequest<DailySummary>("/api/interview/gamification/summary"),
  gamificationHeatmap: () => apiRequest<HeatmapData>("/api/interview/gamification/heatmap"),
  gamificationTransactions: () =>
    apiRequest<GamificationTransaction[]>('/api/interview/gamification/transactions'),
  gamificationCheckin: () =>
    apiRequest<{ message: string; xp_earned: number; coins_earned: number; loot_boxes_earned: number }>('/api/interview/gamification/checkin', {
      method: 'POST',
    }),
  welcomeBonus: () =>
    apiRequest<WelcomeBonusResponse>('/api/interview/gamification/welcome', {
      method: 'POST',
    }),
  openLootBox: () =>
    apiRequest<LootBoxResponse>('/api/interview/gamification/lootbox/open', {
      method: 'POST',
    }),
  dailyQuests: () =>
    apiRequest<DailyQuest[]>('/api/interview/gamification/quests'),
  claimQuest: (questId: string) =>
    apiRequest<{ message: string; xp_earned: number; coins_earned: number; loot_boxes_earned: number }>(`/api/interview/gamification/quests/${questId}/claim`, {
      method: 'POST',
    }),
  achievements: () =>
    apiRequest<Achievement[]>('/api/interview/gamification/achievements'),
  gamificationAdminConfig: () =>
    apiRequest<{ scope: string; config: GamificationAdminConfig; updated_at?: string | null; updated_by_user_id?: string | null }>('/api/interview/gamification/admin-config'),
  updateGamificationAdminConfig: (config: GamificationAdminConfig) =>
    apiRequest<{ scope: string; config: GamificationAdminConfig; updated_at?: string | null; updated_by_user_id?: string | null }>('/api/interview/gamification/admin-config', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    }),
  resetGamification: () =>
    apiRequest<{ message: string }>('/api/interview/gamification/reset', {
      method: 'POST',
    }),
  uploadPracticeAudio: async (recordId: string, blob: Blob) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    const response = await fetch(`${apiBaseUrl}/api/interview/practice-records/${recordId}/audio`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `API request failed: ${response.status}`);
    }
    return response.json() as Promise<{ id: string; url_path: string }>;
  },
  deletePracticeRecord: (id: string) =>
    apiRequest<void>(`/api/interview/practice-records/${id}`, {
      method: "DELETE",
    }),
};
