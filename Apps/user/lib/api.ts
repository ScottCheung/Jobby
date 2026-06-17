import type {
  JobApplication,
  JobPreferences,
  QuestionCacheEntry,
  RuntimeSettings,
  SearchProfile,
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
  jobPreferences: () => apiRequest<JobPreferences>("/api/job-preferences"),
  updateJobPreferences: (payload: JobPreferences) =>
    apiRequest<JobPreferences>("/api/job-preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  searchProfile: () => apiRequest<SearchProfile>("/api/search-profile"),
  updateSearchProfile: (payload: SearchProfile) =>
    apiRequest<SearchProfile>("/api/search-profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  runtimeSettings: () => apiRequest<RuntimeSettings>("/api/runtime-settings"),
  updateRuntimeSettings: (payload: RuntimeSettings) =>
    apiRequest<RuntimeSettings>("/api/runtime-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  questionCache: () => apiRequest<QuestionCacheEntry[]>("/api/question-cache"),
  updateQuestionCache: (entry: QuestionCacheEntry) =>
    apiRequest<QuestionCacheEntry>(`/api/question-cache/${entry.id}`, {
      method: "PUT",
      body: JSON.stringify(entry),
    }),
  deleteQuestionCache: (entryId: string) =>
    apiRequest<void>(`/api/question-cache/${entryId}`, {
      method: "DELETE",
    }),
  applications: (status?: string) =>
    apiRequest<JobApplication[]>(status ? `/api/applications?status=${encodeURIComponent(status)}` : "/api/applications"),
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
