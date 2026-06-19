import type {
  JobApplication,
  QuestionCacheEntry,
  RuntimeSettings,
  JobHuntingProfile,
  User,
  UserProfile,
  WorkerConfig,
} from "./types";
import { resolveApiBaseUrl } from "./runtime";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = await resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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
};
