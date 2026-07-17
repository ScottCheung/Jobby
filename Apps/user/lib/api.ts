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
  PracticeRecord,
  PracticePlan,
  PlanTask,
  DailySummary,
  HeatmapData,
  GamificationTransaction,
  DailyQuest,
  Achievement,
  LootBoxResponse,
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
    const detail = await response.text();
    throw new Error(detail || `API request failed: ${response.status}`);
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
  practiceRecords: () => apiRequest<PracticeRecord[]>("/api/interview/practice-records"),
  createPracticeRecord: (payload: Partial<PracticeRecord>) =>
    apiRequest<PracticeRecord>("/api/interview/practice-records", {
      method: "POST",
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
    apiRequest<{ message: string; xp_earned: number; loot_boxes_earned: number }>('/api/interview/gamification/checkin', {
      method: 'POST',
    }),
  openLootBox: () =>
    apiRequest<LootBoxResponse>('/api/interview/gamification/lootbox/open', {
      method: 'POST',
    }),
  dailyQuests: () =>
    apiRequest<DailyQuest[]>('/api/interview/gamification/quests'),
  claimQuest: (questId: string) =>
    apiRequest<{ message: string; loot_boxes_earned: number }>(`/api/interview/gamification/quests/${questId}/claim`, {
      method: 'POST',
    }),
  achievements: () =>
    apiRequest<Achievement[]>('/api/interview/gamification/achievements'),
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
