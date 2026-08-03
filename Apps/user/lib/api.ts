import type {
  JobApplication,
  QuestionCacheEntry,
  RuntimeSettings,
  ApplicationSettings,
  ApplicationCandidateInput,
  ApplicationDecisionResponse,
  ApplicationPlanResponse,
  JobHuntingProfile,
  CareerProfile,
  CareerProfileScoreHistoryItem,
  MasterResume,
  MasterResumeVersion,
  ResumeAsset,
  ResumeSource,
  User,
  UserProfile,
  WorkerConfig,
  InterviewCategory,
  InterviewTag,
  InterviewQuestion,
  InterviewCollection,
  InterviewReport,
  QuestionCommunitySummary,
  QuestionAnswer,
  QuestionAnswerComment,
  QuestionAnswerCommentPage,
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
  QuestionDuplicateCandidate,
  UserFavoritesAll,
  UserFavoritesCounts,
  PaginatedResult,
  FavoritedCommentSummary,
  SavedAnswerSummary,
  SavedCollectionSummary,
  Prospect,
  ProspectAgentLog,
  ProspectDiscoveryRequest,
  ProspectDiscoveryResponse,
} from "./types";
import {
  getLocalProspects,
  saveLocalProspects,
  runLocalDiscoveryAgent,
} from "./prospects-fallback";
import { resolveApiBaseUrl } from "./runtime";
import { createClient } from "./supabase/client";
import { dedup } from "./request-dedup";

export type JobReviewResult = {
  resume_data?: {
    summary?: string;
    core_competencies?: string[];
    key_qualifications?: string[];
    skills?: Array<{ type?: string; skills?: string[] }>;
    experience?: Array<Record<string, unknown>>;
    projects?: Array<Record<string, unknown>>;
  } | null;
  key_qualifications?: string[];
  core_competencies?: string[];
  targeted_projects?: Array<Record<string, unknown>>;
  raw_ai_response?: Record<string, unknown>;
  tailored_resume?: TailoredResume;
};

export type JobReviewPreview = { messages: Array<{ role: string; content: string }> };

export type TailoredResume = {
  id: string;
  job_application_id: string;
  career_profile_id?: string | null;
  job_title?: string | null;
  company?: string | null;
  job_description: string;
  source_resume_data: Record<string, unknown>;
  resume_data: NonNullable<JobReviewResult['resume_data']>;
  raw_ai_response: Record<string, unknown>;
  key_qualifications: string[];
  core_competencies: string[];
  targeted_projects: Array<Record<string, unknown>>;
  prompt_version: string;
  created_at: string;
  updated_at: string;
};

function responseErrorMessage(body: string, fallback: string): string {
  const trimmedBody = body.trim();
  if (!trimmedBody) return fallback;

  try {
    const parsed = JSON.parse(trimmedBody) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (
      Array.isArray(parsed.detail) &&
      typeof parsed.detail[0]?.msg === "string"
    ) {
      return parsed.detail[0].msg;
    }
  } catch {
    // Some proxies return a plain-text error body instead of JSON.
  }

  return trimmedBody;
}

async function readJsonResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const body = await response.text();

  if (!response.ok) {
    throw new Error(responseErrorMessage(body, fallback));
  }

  const trimmed = body ? body.trim() : "";
  if (!trimmed) {
    return {} as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const detail = trimmed.replace(/\s+/g, " ").slice(0, 200);
    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
    throw new Error(
      detail
        ? `${fallback} The server returned a non-JSON response (${status}): ${detail}`
        : `${fallback} The server returned an empty response (${status}).`,
    );
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = await resolveApiBaseUrl();
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  if (session?.user?.email) {
    headers["X-User-Email"] = session.user.email;
  }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  return readJsonResponse<T>(
    response,
    `API request failed: ${response.status}`,
  );
}

export const api = {
  health: () => apiRequest<{ status: string }>("/health"),
  reviewJob: (payload: { job_description: string; title?: string; company?: string; date_posted?: string }) =>
    apiRequest<JobReviewResult>("/api/job-review", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  previewJobReview: (payload: { job_description: string; title?: string; company?: string; date_posted?: string }) =>
    apiRequest<JobReviewPreview>("/api/job-review/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  tailoredResumes: (limit = 20) =>
    apiRequest<TailoredResume[]>(`/api/tailored-resumes?limit=${limit}`),
  tailoredResume: (id: string) =>
    apiRequest<TailoredResume>(`/api/tailored-resumes/${id}`),
  me: () => dedup("me", () => apiRequest<User>("/api/me")),
  uploadAvatar: async (file: File) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch(`${apiBaseUrl}/api/me/avatar`, {
      method: "POST",
      body: formData,
      headers: session?.user?.email
        ? { "X-User-Email": session.user.email }
        : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      try {
        const parsed = JSON.parse(detail);
        throw new Error(parsed?.detail || "Could not upload avatar.");
      } catch (error) {
        if (error instanceof Error) throw error;
      }
      throw new Error(detail || "Could not upload avatar.");
    }
    return response.json() as Promise<User>;
  },
  removeAvatar: () => apiRequest<User>("/api/me/avatar", { method: "DELETE" }),
  careerProfiles: () => apiRequest<CareerProfile[]>("/api/career-profiles"),
  careerProfile: (profileId: string) =>
    apiRequest<CareerProfile>(`/api/career-profiles/${profileId}`),
  uploadCareerProfile: async (file: File) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file, file.name);
    const response = await fetch(`${apiBaseUrl}/api/career-profiles/upload`, {
      method: 'POST', body: formData,
      headers: session?.user?.email ? { 'X-User-Email': session.user.email } : undefined,
      cache: 'no-store',
    });
    return readJsonResponse<CareerProfile>(response, 'Could not upload the resume.');
  },
  updateCareerProfile: (profileId: string, payload: Partial<CareerProfile>) =>
    apiRequest<CareerProfile>(`/api/career-profiles/${profileId}`, {
      method: 'PUT', body: JSON.stringify(payload),
    }),
  setPrimaryCareerProfile: (profileId: string) =>
    apiRequest<CareerProfile>(`/api/career-profiles/${profileId}/primary`, { method: 'POST' }),
  deleteCareerProfile: (profileId: string) =>
    apiRequest<void>(`/api/career-profiles/${profileId}`, { method: 'DELETE' }),
  evaluateCareerProfile: (profileId: string) =>
    apiRequest<CareerProfile>(`/api/career-profiles/${profileId}/evaluate`, { method: 'POST' }),
  careerProfileScoreHistory: (profileId: string) =>
    apiRequest<CareerProfileScoreHistoryItem[]>(`/api/career-profiles/${profileId}/score-history`),
  masterResume: (signal?: AbortSignal) =>
    apiRequest<MasterResume>("/api/master-resume", { signal }),
  deleteMasterResume: () =>
    apiRequest<void>("/api/master-resume", { method: "DELETE" }),
  resumeAssets: () => apiRequest<ResumeAsset[]>("/api/resume-assets"),
  selectResumeAsset: (profileId: string) =>
    apiRequest<MasterResume>(`/api/resume-assets/${profileId}/select`, {
      method: "POST",
    }),
  deleteResumeAsset: (profileId: string) =>
    apiRequest<void>(`/api/resume-assets/${profileId}`, {
      method: "DELETE",
    }),
  extractResumeSource: async (file: File) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch(
      `${apiBaseUrl}/api/master-resume/debug/source`,
      {
        method: "POST",
        body: formData,
        headers: session?.user?.email
          ? { "X-User-Email": session.user.email }
          : undefined,
        cache: "no-store",
      },
    );
    return readJsonResponse<ResumeSource>(
      response,
      "Could not extract PDF text.",
    );
  },
  debugResumeAi: async (file: File) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch(`${apiBaseUrl}/api/master-resume/debug/ai`, {
      method: "POST",
      body: formData,
      headers: session?.user?.email
        ? { "X-User-Email": session.user.email }
        : undefined,
      cache: "no-store",
    });
    return readJsonResponse<Record<string, unknown>>(
      response,
      "Could not parse the resume.",
    );
  },
  uploadMasterResume: async (file: File) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch(`${apiBaseUrl}/api/master-resume/upload`, {
      method: "POST",
      body: formData,
      headers: session?.user?.email
        ? { "X-User-Email": session.user.email }
        : undefined,
      cache: "no-store",
    });
    return readJsonResponse<MasterResume>(
      response,
      "Could not parse the resume.",
    );
  },
  retryMasterResumeParsing: () =>
    apiRequest<MasterResume>("/api/master-resume/retry", {
      method: "POST",
    }),
  cancelMasterResumeParsing: () =>
    apiRequest<MasterResume>("/api/master-resume/cancel", {
      method: "POST",
    }),
  updateMasterResume: (resume_data: MasterResume["resume_data"]) =>
    apiRequest<MasterResume>("/api/master-resume", {
      method: "PUT",
      body: JSON.stringify({ resume_data }),
    }),
  evaluateMasterResume: () =>
    apiRequest<MasterResume>("/api/master-resume/evaluate", {
      method: "POST",
    }),
  masterResumeEvaluationHistory: () =>
    apiRequest<import("./types").MasterResumeEvaluationHistoryItem[]>(
      "/api/master-resume/evaluation-history",
    ),
  masterResumeVersions: () =>
    apiRequest<MasterResumeVersion[]>("/api/master-resume/versions"),
  deleteMasterResumeVersion: (version: number) =>
    apiRequest<void>(`/api/master-resume/versions/${version}`, {
      method: "DELETE",
    }),
  startDraftFromMasterResumeVersion: (version: number) =>
    apiRequest<MasterResume>(`/api/master-resume/versions/${version}/draft`, {
      method: "POST",
    }),
  confirmMasterResume: (resume_data: MasterResume["resume_data"]) =>
    apiRequest<MasterResume>("/api/master-resume/confirm", {
      method: "POST",
      body: JSON.stringify({ resume_data }),
    }),
  workerConfig: () => apiRequest<WorkerConfig>("/api/worker/config"),
  profile: () =>
    dedup("profile", () => apiRequest<UserProfile>("/api/profile")),
  updateProfile: (payload: UserProfile) =>
    apiRequest<UserProfile>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  jobHuntingProfiles: () =>
    dedup("jobHuntingProfiles", () =>
      apiRequest<JobHuntingProfile[]>("/api/job-hunting-profiles"),
    ),
  jobHuntingProfile: () =>
    dedup("jobHuntingProfile", () =>
      apiRequest<JobHuntingProfile>("/api/job-hunting-profile"),
    ),
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
  updateJobHuntingProfileById: (
    profileId: string,
    payload: JobHuntingProfile,
  ) =>
    apiRequest<JobHuntingProfile>(`/api/job-hunting-profiles/${profileId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  activateJobHuntingProfile: (profileId: string) =>
    apiRequest<JobHuntingProfile>(
      `/api/job-hunting-profiles/${profileId}/activate`,
      {
        method: "POST",
      },
    ),
  deleteJobHuntingProfile: (profileId: string) =>
    apiRequest<void>(`/api/job-hunting-profiles/${profileId}`, {
      method: "DELETE",
    }),
  runtimeSettings: () =>
    dedup("runtimeSettings", () =>
      apiRequest<RuntimeSettings>("/api/runtime-settings"),
    ),
  updateRuntimeSettings: (payload: RuntimeSettings) =>
    apiRequest<RuntimeSettings>("/api/runtime-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  applicationSettings: () =>
    dedup("applicationSettings", () =>
      apiRequest<ApplicationSettings>("/api/application-settings"),
    ),
  updateApplicationSettings: (payload: ApplicationSettings) =>
    apiRequest<ApplicationSettings>("/api/application-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  evaluateApplicationDecision: (candidate: ApplicationCandidateInput) =>
    apiRequest<ApplicationDecisionResponse>("/api/application-decisions", {
      method: "POST",
      body: JSON.stringify({ candidate }),
    }),
  createApplicationPlan: (payload: { candidate: ApplicationCandidateInput; job_description?: string | null; job_link?: string | null }) =>
    apiRequest<ApplicationPlanResponse>("/api/application-plans", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  applicationPlan: (applicationId: string) =>
    apiRequest<ApplicationPlanResponse>(`/api/application-plans/${applicationId}`),
  applicationPlanAction: (applicationId: string, action: string, reason?: string) =>
    apiRequest<ApplicationPlanResponse>(`/api/application-plans/${applicationId}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    }),
  questionCache: (limit?: number, offset?: number, search?: string) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append("limit", String(limit));
    if (offset !== undefined) params.append("offset", String(offset));
    if (search) params.append("search", search);
    const qs = params.toString();
    return apiRequest<QuestionCacheEntry[]>(
      qs ? `/api/question-cache?${qs}` : "/api/question-cache",
    );
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
  applications: (
    status?: string,
    limit?: number,
    offset?: number,
    search?: string,
  ) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (limit !== undefined) params.append("limit", String(limit));
    if (offset !== undefined) params.append("offset", String(offset));
    if (search) params.append("search", search);
    const qs = params.toString();
    return apiRequest<JobApplication[]>(
      qs ? `/api/applications?${qs}` : "/api/applications",
    );
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
  updateApplication: (
    applicationId: string,
    payload: Partial<JobApplication>,
  ) =>
    apiRequest<JobApplication>(`/api/applications/${applicationId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  asyncApplicationFromLink: (applicationId: string) =>
    apiRequest<JobApplication>(
      `/api/applications/${applicationId}/async-from-link`,
      {
        method: "POST",
      },
    ),
  batchAsyncApplicationsFromLink: (limit = 100) =>
    apiRequest<{
      processed: number;
      synced: number;
      failed: number;
      results: unknown[];
    }>(`/api/applications/async-from-link/batch?limit=${limit}`, {
      method: "POST",
    }),
  deleteApplication: (applicationId: string) =>
    apiRequest<void>(`/api/applications/${applicationId}`, {
      method: "DELETE",
    }),
  getTailoredResumeForApplication: (applicationId: string) =>
    apiRequest<TailoredResume>(`/api/applications/${applicationId}/tailored-resume`),
  generateTailoredResumeForApplication: (applicationId: string) =>
    apiRequest<TailoredResume>(`/api/applications/${applicationId}/generate-resume`, {
      method: "POST",
    }),
  updateTailoredResumeForApplication: (
    applicationId: string,
    payload: Partial<TailoredResume>,
  ) =>
    apiRequest<TailoredResume>(`/api/applications/${applicationId}/tailored-resume`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  // Interview Playbook
  interviewCategories: () =>
    dedup("interviewCategories", () =>
      apiRequest<InterviewCategory[]>("/api/interview/categories"),
    ),
  createInterviewCategory: (payload: { name: string }) =>
    apiRequest<InterviewCategory>("/api/interview/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  interviewTags: () =>
    dedup("interviewTags", () =>
      apiRequest<InterviewTag[]>("/api/interview/tags"),
    ),
  createInterviewTag: (payload: { name: string }) =>
    apiRequest<InterviewTag>("/api/interview/tags", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  interviewQuestions: (options?: {
    limit?: number;
    offset?: number;
    search?: string;
    category_id?: string;
    category_ids?: string[];
    collection_ids?: string[];
    tag_ids?: string[];
    importance_scores?: number[];
    frequencies?: string[];
    question_ids?: string[];
  }) => {
    const params = new URLSearchParams();
    if (options?.limit !== undefined)
      params.append("limit", String(options.limit));
    if (options?.offset !== undefined)
      params.append("offset", String(options.offset));
    if (options?.search) params.append("search", options.search);
    if (options?.category_id) params.append("category_id", options.category_id);
    options?.category_ids?.forEach((id) => params.append("category_ids", id));
    options?.collection_ids?.forEach((id) =>
      params.append("collection_ids", id),
    );
    options?.tag_ids?.forEach((id) => params.append("tag_ids", id));
    options?.importance_scores?.forEach((score) =>
      params.append("importance_scores", String(score)),
    );
    options?.frequencies?.forEach((frequency) =>
      params.append("frequencies", frequency),
    );
    options?.question_ids?.forEach((id) => params.append("question_ids", id));
    const qs = params.toString();
    const url = qs
      ? `/api/interview/questions?${qs}`
      : "/api/interview/questions";
    return dedup(`interviewQuestions:${qs}`, () =>
      apiRequest<PaginatedResult<InterviewQuestion>>(url),
    );
  },
  findQuestionDuplicates: (title: string) =>
    apiRequest<QuestionDuplicateCandidate[]>(
      `/api/interview/questions/duplicates?q=${encodeURIComponent(title)}`,
    ),
  searchGlobalQuestions: (
    q: string,
    sort?: "hot" | "week" | "month" | "season" | "newest",
  ) => {
    const params = new URLSearchParams({ q });
    if (sort) params.set("sort", sort);
    return apiRequest<InterviewQuestion[]>(
      `/api/interview/questions/search/global?${params.toString()}`,
    );
  },
  forYouQuestions: () =>
    apiRequest<InterviewQuestion[]>("/api/interview/recommendations/for-you"),
  recordExploreVisit: () =>
    apiRequest<{ last_login_at: string | null }>(
      "/api/interview/explore/visit",
      {
        method: "POST",
      },
    ),
  saveInterviewQuestion: (id: string) =>
    apiRequest<InterviewQuestion>(`/api/interview/questions/${id}/save`, {
      method: "POST",
    }),
  getInterviewQuestion: (id: string) =>
    apiRequest<InterviewQuestion>(`/api/interview/questions/${id}`),
  toggleQuestionFavorite: (id: string) =>
    apiRequest<QuestionCommunitySummary>(
      `/api/interview/questions/${id}/favorite`,
      {
        method: "PUT",
      },
    ),
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
  archiveInterviewQuestion: (id: string) =>
    apiRequest<void>(`/api/interview/questions/${id}/archive`, {
      method: "POST",
    }),
  interviewCollections: (kind?: string) => {
    const params = new URLSearchParams();
    if (kind) params.append("kind", kind);
    params.append("_t", String(Date.now()));
    const qs = params.toString();
    return apiRequest<InterviewCollection[]>(
      `/api/interview/collections?${qs}`,
    );
  },
  myCreatedCollections: () =>
    apiRequest<InterviewCollection[]>(
      `/api/interview/collections/me/created?_t=${Date.now()}`,
    ),
  purchasedInterviewCollections: () =>
    apiRequest<InterviewCollection[]>(
      `/api/interview/collections?kind=purchased&_t=${Date.now()}`,
    ),
  interviewCollection: (id: string) =>
    apiRequest<InterviewCollection>(
      `/api/interview/collections/${id}?_t=${Date.now()}`,
    ),
  addCollectionToLibrary: (id: string) =>
    apiRequest<{
      message: string;
      questions_added: number;
      purchased: boolean;
    }>(`/api/interview/collections/${id}/add`, {
      method: "POST",
    }),
  removeCollectionFromLibrary: (id: string) =>
    apiRequest<{ message: string }>(`/api/interview/collections/${id}/remove`, {
      method: "DELETE",
    }),
  uploadCollectionCover: async (id: string, file: File) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch(
      `${apiBaseUrl}/api/interview/collections/${id}/cover`,
      {
        method: "POST",
        body: formData,
        headers: session?.user?.email
          ? { "X-User-Email": session.user.email }
          : undefined,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      try {
        const parsed = JSON.parse(detail);
        throw new Error(parsed?.detail || "Could not upload cover image.");
      } catch (error) {
        if (error instanceof Error) throw error;
      }
      throw new Error(detail || "Could not upload cover image.");
    }
    return response.json() as Promise<InterviewCollection>;
  },
  createInterviewCollection: (payload: {
    title: string;
    description?: string;
    theme?: string;
    price_coins?: number;
    status?: string;
    question_ids: string[];
  }) =>
    apiRequest<InterviewCollection>("/api/interview/collections", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateInterviewCollection: (
    id: string,
    payload: {
      title?: string;
      description?: string;
      theme?: string;
      price_coins?: number;
      status?: string;
      question_ids?: string[];
    },
  ) =>
    apiRequest<InterviewCollection>(`/api/interview/collections/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteInterviewCollection: (id: string) =>
    apiRequest<{ message: string }>(`/api/interview/collections/${id}`, {
      method: "DELETE",
    }),
  interviewReports: () =>
    dedup("interviewReports", () =>
      apiRequest<InterviewReport[]>("/api/interview/reports"),
    ),
  createInterviewReport: (payload: Partial<InterviewReport>) =>
    apiRequest<InterviewReport>("/api/interview/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  questionCommunity: (id: string) =>
    apiRequest<QuestionCommunitySummary>(
      `/api/interview/questions/${id}/community`,
    ),
  updateQuestionCommunityRating: (
    id: string,
    payload: {
      frequency_rating?: number | null;
      importance_rating?: number | null;
      difficulty_rating?: number | null;
    },
  ) =>
    apiRequest<QuestionCommunitySummary>(
      `/api/interview/questions/${id}/community/rating`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  updateQuestionCommunityReaction: (id: string, value: "up" | "down" | null) =>
    apiRequest<QuestionCommunitySummary>(
      `/api/interview/questions/${id}/community/reaction`,
      { method: "PUT", body: JSON.stringify({ value }) },
    ),
  questionAnswers: (
    id: string,
    options?: { answer_type?: string; include_archived?: boolean },
  ) => {
    const params = new URLSearchParams();
    if (options?.answer_type) params.set("answer_type", options.answer_type);
    if (options?.include_archived) params.set("include_archived", "true");
    const qs = params.toString();
    return apiRequest<QuestionAnswer[]>(
      qs
        ? `/api/interview/questions/${id}/answers?${qs}`
        : `/api/interview/questions/${id}/answers`,
    );
  },
  createQuestionAnswer: (
    id: string,
    payload: {
      source?: string;
      answer_type?: string;
      status?: string;
      title?: string | null;
      body: string;
      metadata?: Record<string, unknown>;
      is_recommended?: boolean;
    },
  ) =>
    apiRequest<QuestionAnswer>(`/api/interview/questions/${id}/answers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateQuestionAnswer: (
    id: string,
    payload: {
      status?: string;
      title?: string | null;
      body?: string;
      metadata?: Record<string, unknown>;
      is_recommended?: boolean;
    },
  ) =>
    apiRequest<QuestionAnswer>(`/api/interview/answers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createAiReferenceAnswer: (
    questionId: string,
    options?: { regenerate?: boolean },
  ) =>
    apiRequest<QuestionAnswer>(
      `/api/interview/questions/${questionId}/ai-answers${options?.regenerate ? "?regenerate=true" : ""}`,
      { method: "POST" },
    ),
  generateQuestionAiMetadata: (questionId: string) =>
    apiRequest<InterviewQuestion>(
      `/api/interview/questions/${questionId}/ai-metadata`,
      { method: "POST" },
    ),
  unlockAiAnswer: (answerId: string) =>
    apiRequest<{
      answer: QuestionAnswer;
      coins_spent: number;
      remaining_coins: number;
    }>(`/api/interview/answers/${answerId}/unlock`, { method: "PUT" }),
  updateQuestionAnswerReaction: (id: string, value: "up" | "down" | null) =>
    apiRequest<QuestionAnswer>(`/api/interview/answers/${id}/reaction`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  toggleQuestionAnswerSave: (id: string) =>
    apiRequest<{ saved: boolean }>(`/api/interview/answers/${id}/save`, {
      method: "PUT",
    }),
  reportQuestionAnswer: (id: string, reason: "spam" | "off_topic" | "unsafe") =>
    apiRequest<void>(`/api/interview/answers/${id}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  questionAnswerComments: (id: string, before?: string) =>
    apiRequest<QuestionAnswerCommentPage>(
      `/api/interview/answers/${id}/comments?limit=10${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    ),
  createQuestionAnswerComment: (
    id: string,
    payload: { body: string; parent_id?: string },
  ) =>
    apiRequest<QuestionAnswerComment>(`/api/interview/answers/${id}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateQuestionAnswerComment: (
    answerId: string,
    commentId: string,
    payload: { body: string },
  ) =>
    apiRequest<QuestionAnswerComment>(
      `/api/interview/answers/${answerId}/comments/${commentId}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  deleteQuestionAnswerComment: (answerId: string, commentId: string) =>
    apiRequest<void>(
      `/api/interview/answers/${answerId}/comments/${commentId}`,
      { method: "DELETE" },
    ),
  toggleQuestionAnswerCommentLike: (answerId: string, commentId: string) =>
    apiRequest<{ liked: boolean; like_count: number }>(
      `/api/interview/answers/${answerId}/comments/${commentId}/like`,
      { method: "PUT" },
    ),
  reportQuestionAnswerComment: (
    answerId: string,
    commentId: string,
    reason: "spam" | "off_topic" | "unsafe",
  ) =>
    apiRequest<void>(
      `/api/interview/answers/${answerId}/comments/${commentId}/report`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  practiceEvaluations: (recordId: string) =>
    apiRequest<import("./types").PracticeEvaluation[]>(
      `/api/interview/practice-records/${recordId}/evaluations`,
    ),
  createPracticeEvaluation: (recordId: string) =>
    apiRequest<import("./types").PracticeEvaluation>(
      `/api/interview/practice-records/${recordId}/evaluations`,
      { method: "POST" },
    ),
  questionComments: (
    id: string,
    options?: { kind?: string; before?: string; limit?: number },
  ) => {
    const params = new URLSearchParams();
    if (options?.kind) params.set("kind", options.kind);
    if (options?.before) params.set("before", options.before);
    params.set("limit", String(options?.limit ?? 10));
    return apiRequest<QuestionCommentPage>(
      `/api/interview/questions/${id}/comments?${params}`,
    );
  },
  questionCommentReplies: (
    questionId: string,
    commentId: string,
    before?: string,
  ) =>
    apiRequest<QuestionCommentPage>(
      `/api/interview/questions/${questionId}/comments/${commentId}/replies?limit=10${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    ),
  createQuestionComment: (
    id: string,
    payload: {
      kind: "discussion" | "feedback" | "example";
      body: string;
      parent_id?: string;
    },
  ) =>
    apiRequest<QuestionComment>(`/api/interview/questions/${id}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateQuestionComment: (
    questionId: string,
    commentId: string,
    payload: { body: string },
  ) =>
    apiRequest<QuestionComment>(
      `/api/interview/questions/${questionId}/comments/${commentId}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  deleteQuestionComment: (questionId: string, commentId: string) =>
    apiRequest<void>(
      `/api/interview/questions/${questionId}/comments/${commentId}`,
      { method: "DELETE" },
    ),
  toggleQuestionCommentLike: (questionId: string, commentId: string) =>
    apiRequest<{ liked: boolean; like_count: number }>(
      `/api/interview/questions/${questionId}/comments/${commentId}/like`,
      { method: "PUT" },
    ),
  reportQuestionComment: (
    questionId: string,
    commentId: string,
    reason: "spam" | "off_topic" | "unsafe",
  ) =>
    apiRequest<void>(
      `/api/interview/questions/${questionId}/comments/${commentId}/report`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  communityInterviewReports: (id: string) =>
    apiRequest<CommunityInterviewReport[]>(
      `/api/interview/questions/${id}/community/reports`,
    ),
  communityNotifications: () =>
    apiRequest<UserNotification[]>("/api/interview/community/notifications"),
  markCommunityNotificationsRead: () =>
    apiRequest<{ message: string }>(
      "/api/interview/community/notifications/read",
      { method: "POST" },
    ),
  notifications: (options?: {
    unreadOnly?: boolean;
    limit?: number;
    before?: string;
  }) => {
    const params = new URLSearchParams();
    params.set("unread_only", String(options?.unreadOnly ?? true));
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.before) params.set("before", options.before);
    return apiRequest<UserNotification[]>(
      `/api/interview/notifications?${params}`,
    );
  },
  markNotificationRead: (id: string) =>
    apiRequest<{ message: string }>(`/api/interview/notifications/${id}/read`, {
      method: "POST",
    }),
  markAllNotificationsRead: () =>
    apiRequest<{ message: string }>("/api/interview/notifications/read", {
      method: "POST",
    }),
  practiceRecords: () =>
    dedup("practiceRecords", () =>
      apiRequest<PracticeRecord[]>("/api/interview/practice-records"),
    ),
  createPracticeRecord: (payload: Partial<PracticeRecord>) =>
    apiRequest<PracticeRecord>("/api/interview/practice-records", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  transcribePracticeAudio: async (blob: Blob, filename = "audio.webm") => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", blob, filename);
    const response = await fetch(
      `${apiBaseUrl}/api/interview/practice-transcriptions`,
      {
        method: "POST",
        body: formData,
        headers: session?.user?.email
          ? { "X-User-Email": session.user.email }
          : undefined,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `API request failed: ${response.status}`);
    }
    return response.json() as Promise<import("./types").PracticeTranscription>;
  },
  updatePracticeRecord: (id: string, payload: Partial<PracticeRecord>) =>
    apiRequest<PracticeRecord>(`/api/interview/practice-records/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  practicePlans: () =>
    dedup("practicePlans", () =>
      apiRequest<PracticePlan[]>("/api/interview/plans"),
    ),
  createPracticePlan: (payload: Partial<PracticePlan>) =>
    apiRequest<PracticePlan>("/api/interview/plans", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  planTasks: (planId: string) =>
    apiRequest<PlanTask[]>(`/api/interview/plans/${planId}/tasks`),
  createPlanTask: (planId: string, payload: Partial<PlanTask>) =>
    apiRequest<PlanTask>(`/api/interview/plans/${planId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deletePracticePlan: (planId: string) =>
    apiRequest<void>(`/api/interview/plans/${planId}`, {
      method: "DELETE",
    }),
  updatePlanTask: (
    planId: string,
    taskId: string,
    payload: Partial<PlanTask>,
  ) =>
    apiRequest<PlanTask>(`/api/interview/plans/${planId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  claimStageReward: (planId: string, dayNum: number) =>
    apiRequest<{
      message: string;
      reward: { type: string; name: string; badge: string; icon: string };
      claimed_stage_days: number[];
      gamification: {
        coins: number;
        xp: number;
        level: number;
        loot_boxes: number;
        inventory: Record<string, number>;
        active_boosters: Record<string, string>;
      };
    }>(`/api/interview/plans/${planId}/stages/${dayNum}/claim-reward`, {
      method: "POST",
    }),
  getInventory: () =>
    apiRequest<import("./types").UserInventoryResponse>(
      "/api/interview/gamification/inventory",
    ),
  useInventoryItem: (itemType: string) =>
    apiRequest<{
      message: string;
      inventory: Record<string, number>;
      active_boosters: Record<string, string>;
      coins_won?: number;
      new_balance?: number;
    }>("/api/interview/gamification/inventory/use", {
      method: "POST",
      body: JSON.stringify({ item_type: itemType }),
    }),
  gamificationSummary: () =>
    dedup("gamificationSummary", () =>
      apiRequest<DailySummary>("/api/interview/gamification/summary"),
    ),
  gamificationHeatmap: () =>
    dedup("gamificationHeatmap", () =>
      apiRequest<HeatmapData>("/api/interview/gamification/heatmap"),
    ),
  gamificationTransactions: () =>
    apiRequest<GamificationTransaction[]>(
      "/api/interview/gamification/transactions",
    ),
  gamificationCheckin: () =>
    apiRequest<{
      message: string;
      xp_earned: number;
      coins_earned: number;
      loot_boxes_earned: number;
    }>("/api/interview/gamification/checkin", {
      method: "POST",
    }),
  welcomeBonus: () =>
    apiRequest<WelcomeBonusResponse>("/api/interview/gamification/welcome", {
      method: "POST",
    }),
  openLootBox: () =>
    apiRequest<LootBoxResponse>("/api/interview/gamification/lootbox/open", {
      method: "POST",
    }),
  dailyQuests: () =>
    dedup("dailyQuests", () =>
      apiRequest<DailyQuest[]>("/api/interview/gamification/quests"),
    ),
  claimQuest: (questId: string) =>
    apiRequest<{
      message: string;
      xp_earned: number;
      coins_earned: number;
      loot_boxes_earned: number;
    }>(`/api/interview/gamification/quests/${questId}/claim`, {
      method: "POST",
    }),
  achievements: () =>
    dedup("achievements", () =>
      apiRequest<Achievement[]>("/api/interview/gamification/achievements"),
    ),
  gamificationAdminConfig: () =>
    apiRequest<{
      scope: string;
      config: GamificationAdminConfig;
      updated_at?: string | null;
      updated_by_user_id?: string | null;
    }>("/api/interview/gamification/admin-config"),
  updateGamificationAdminConfig: (config: GamificationAdminConfig) =>
    apiRequest<{
      scope: string;
      config: GamificationAdminConfig;
      updated_at?: string | null;
      updated_by_user_id?: string | null;
    }>("/api/interview/gamification/admin-config", {
      method: "PUT",
      body: JSON.stringify({ config }),
    }),
  resetGamification: () =>
    apiRequest<{ message: string }>("/api/interview/gamification/reset", {
      method: "POST",
    }),
  uploadPracticeAudio: async (
    recordId: string,
    blob: Blob,
    filename = "audio.webm",
  ) => {
    const apiBaseUrl = await resolveApiBaseUrl();
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append("file", blob, filename);
    const response = await fetch(
      `${apiBaseUrl}/api/interview/practice-records/${recordId}/audio`,
      {
        method: "POST",
        body: formData,
        headers: session?.user?.email
          ? { "X-User-Email": session.user.email }
          : undefined,
        cache: "no-store",
      },
    );
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
  userFavoritesAll: () =>
    apiRequest<UserFavoritesAll>("/api/interview/user/favorites/all"),
  userFavoritesCounts: () =>
    apiRequest<UserFavoritesCounts>("/api/interview/user/favorites/counts"),
  userFavoritesQuestions: (limit = 15, offset = 0) =>
    apiRequest<PaginatedResult<InterviewQuestion>>(
      `/api/interview/user/favorites/questions?limit=${limit}&offset=${offset}`,
    ),
  userFavoritesComments: (
    kind: "all" | "mine" | "liked" = "all",
    limit = 15,
    offset = 0,
    before?: string,
  ) => {
    const params = new URLSearchParams({
      kind,
      limit: String(limit),
      offset: String(offset),
    });
    if (before) params.set("before", before);
    return apiRequest<PaginatedResult<FavoritedCommentSummary>>(
      `/api/interview/user/favorites/comments?${params.toString()}`,
    );
  },
  userFavoritesAnswers: (limit = 15, offset = 0) =>
    apiRequest<PaginatedResult<SavedAnswerSummary>>(
      `/api/interview/user/favorites/answers?limit=${limit}&offset=${offset}`,
    ),
  userFavoritesCollections: (limit = 15, offset = 0) =>
    apiRequest<PaginatedResult<SavedCollectionSummary>>(
      `/api/interview/user/favorites/collections?limit=${limit}&offset=${offset}`,
    ),
  // Prospects & Outreach
  prospects: async (
    status?: string,
    role_type?: string,
    search?: string,
    limit = 50,
    offset = 0,
  ) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (role_type) params.append("role_type", role_type);
      if (search) params.append("search", search);
      params.append("limit", String(limit));
      params.append("offset", String(offset));
      return await apiRequest<Prospect[]>(`/api/prospects?${params.toString()}`);
    } catch {
      let list = getLocalProspects();
      if (status) list = list.filter((p) => p.status === status);
      if (role_type) list = list.filter((p) => p.role_type === role_type);
      if (search) {
        const s = search.toLowerCase().trim();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(s) ||
            p.company.toLowerCase().includes(s) ||
            p.title.toLowerCase().includes(s),
        );
      }
      return list.slice(offset, offset + limit);
    }
  },
  prospect: async (id: string) => {
    try {
      return await apiRequest<Prospect>(`/api/prospects/${id}`);
    } catch {
      const p = getLocalProspects().find((item) => item.id === id);
      if (!p) throw new Error("Prospect not found");
      return p;
    }
  },
  createProspect: async (payload: Partial<Prospect>) => {
    try {
      return await apiRequest<Prospect>("/api/prospects", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      const current = getLocalProspects();
      const newP: Prospect = {
        id: `p-${Date.now()}`,
        user_id: "local-user",
        name: payload.name || "New Prospect",
        title: payload.title || "Target Role",
        company: payload.company || "Target Company",
        linkedin_url: payload.linkedin_url,
        role_type: payload.role_type || "hiring_manager",
        location: payload.location,
        has_active_job: Boolean(payload.has_active_job),
        active_job_title: payload.active_job_title,
        active_job_url: payload.active_job_url,
        priority_score: payload.priority_score || 85,
        match_level: payload.match_level || "high",
        recommendation_reason: payload.recommendation_reason || "Direct match",
        status: payload.status || "recommended",
        notes: payload.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      current.unshift(newP);
      saveLocalProspects(current);
      return newP;
    }
  },
  createProspectsBatch: async (payload: Partial<Prospect>[]) => {
    try {
      return await apiRequest<Prospect[]>("/api/prospects/batch", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      const created: Prospect[] = [];
      const current = getLocalProspects();
      for (const item of payload) {
        const newP: Prospect = {
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          user_id: "local-user",
          name: item.name || "New Prospect",
          title: item.title || "Target Role",
          company: item.company || "Target Company",
          linkedin_url: item.linkedin_url,
          role_type: item.role_type || "hiring_manager",
          location: item.location,
          has_active_job: Boolean(item.has_active_job),
          active_job_title: item.active_job_title,
          active_job_url: item.active_job_url,
          priority_score: item.priority_score || 85,
          match_level: item.match_level || "high",
          recommendation_reason: item.recommendation_reason || "Direct match",
          status: item.status || "recommended",
          notes: item.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        created.push(newP);
        current.unshift(newP);
      }
      saveLocalProspects(current);
      return created;
    }
  },
  updateProspect: async (id: string, payload: Partial<Prospect>) => {
    try {
      return await apiRequest<Prospect>(`/api/prospects/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } catch {
      const current = getLocalProspects();
      const idx = current.findIndex((p) => p.id === id);
      if (idx !== -1) {
        current[idx] = {
          ...current[idx],
          ...payload,
          updated_at: new Date().toISOString(),
        };
        saveLocalProspects(current);
        return current[idx];
      }
      throw new Error("Prospect not found");
    }
  },
  deleteProspect: async (id: string) => {
    try {
      await apiRequest<void>(`/api/prospects/${id}`, { method: "DELETE" });
    } catch (err) {
      console.warn("Delete API failed, falling back to local storage removal:", err);
    } finally {
      const current = getLocalProspects().filter((p) => p.id !== id);
      saveLocalProspects(current);
    }
  },
  discoverProspects: async (payload: ProspectDiscoveryRequest = {}) => {
    try {
      return await apiRequest<ProspectDiscoveryResponse>(
        "/api/prospects/discover",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
    } catch {
      return runLocalDiscoveryAgent(payload);
    }
  },
  prospectAgentLogs: async (limit = 10) => {
    try {
      return await apiRequest<ProspectAgentLog[]>(
        `/api/prospects/agent-logs?limit=${limit}`,
      );
    } catch {
      return [];
    }
  },
};
