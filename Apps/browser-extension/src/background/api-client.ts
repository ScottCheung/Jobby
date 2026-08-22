/** @format */

import {
  getValidAuthSession,
  refreshAuthSession,
  restoreWebSession,
} from './auth-service';
import {
  applicationPlanResponseSchema,
  type ApplicationPlanAction,
  type ApplicationPlanCreatePayload,
  type ValidatedApplicationPlanResponse,
} from '../shared/contracts/backend';
import {
  formFillInstructionsResponseSchema,
  formAutofillInstructionsResponseSchema,
  type FormAutofillInstructionsResponse,
  type FormFillInstructionsResponse,
} from '../shared/contracts/form-actions';
import type { FormFieldObservation } from '../shared/contracts/form-inspection';
import type {
  CareerProfile,
  JobReviewPayload,
  JobReviewPreview,
  JobReviewResult,
  TailoredResume,
} from '../shared/contracts/tailored-resume';

export interface ResumeAsset {
  profile_id: string;
  filename: string;
  url: string;
  is_default: boolean;
}

export interface DownloadedResume {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(
    /\/$/,
    '',
  );
}

function responseMessage(body: string, fallback: string): string {
  if (!body.trim()) return fallback;
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
      const detail = (parsed as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
    }
  } catch {
    // Preserve a useful server message when the response is not JSON.
  }
  return body.trim().slice(0, 300) || fallback;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    );
  }
  return btoa(chunks.join(''));
}

function semanticFeatures(field: FormFieldObservation): string[] {
  if (field.semanticFeatures?.length) return field.semanticFeatures;
  const stopWords = new Set([
    'a',
    'an',
    'and',
    'are',
    'do',
    'enter',
    'for',
    'is',
    'of',
    'please',
    'the',
    'to',
    'what',
    'your',
  ]);
  return [
    ...new Set(
      `${field.label} ${field.name || ''} ${field.id || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 1 && !stopWords.has(word)),
    ),
  ].slice(0, 50);
}

function semanticFeaturesForPayload(
  label: string,
  name?: string,
  id?: string,
): string[] {
  return semanticFeatures({
    label,
    name,
    id,
    key: label,
    type: 'text',
    required: false,
    filled: false,
    sensitive: false,
    options: [],
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromCaller = () => controller.abort();
  if (externalSignal?.aborted) abortFromCaller();
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw new ApiClientError('Request cancelled.', 499);
      }
      const seconds = Math.round(timeoutMs / 1000);
      throw new ApiClientError(
        `Backend request timed out after ${seconds} seconds.`,
        504,
      );
    }
    throw new ApiClientError('Could not connect to Jobby backend server.', 503);
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export class ApiClient {
  async request<T>(
    path: string,
    init: RequestInit = {},
    authenticated = true,
    timeoutMs = 15000,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');

    if (authenticated) {
      let session = null;
      try {
        session = await getValidAuthSession();
        if (!session) {
          await restoreWebSession();
          session = await getValidAuthSession();
        }
      } catch (error) {
        throw new ApiClientError(
          error instanceof Error ?
            error.message
          : 'Your Jobby session expired. Please sign in again.',
          401,
        );
      }
      if (!session)
        throw new ApiClientError(
          'Please sign in to Jobby before using autofill.',
          401,
        );
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${apiBaseUrl()}${path}`,
        { ...init, headers },
        timeoutMs,
      );
      if (authenticated && response.status === 401) {
        // The access token can be revoked before its local expiry. Recover the
        // latest Supabase session and retry once before surfacing a login error.
        let recovered = await refreshAuthSession().catch(() => null);
        if (!recovered) {
          await restoreWebSession().catch(() => null);
          recovered = await getValidAuthSession().catch(() => null);
        }
        if (recovered) {
          headers.set('Authorization', `Bearer ${recovered.accessToken}`);
          response = await fetchWithTimeout(
            `${apiBaseUrl()}${path}`,
            { ...init, headers },
            timeoutMs,
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError(
        'Could not connect to Jobby backend server.',
        503,
      );
    }

    const body = await response.text();
    if (!response.ok) {
      throw new ApiClientError(
        responseMessage(body, `API request failed with ${response.status}.`),
        response.status,
      );
    }
    if (!body.trim()) return undefined as T;

    try {
      return JSON.parse(body) as T;
    } catch {
      throw new ApiClientError(
        'The API returned an invalid JSON response.',
        response.status,
      );
    }
  }

  async createApplicationPlan(
    payload: ApplicationPlanCreatePayload,
  ): Promise<ValidatedApplicationPlanResponse> {
    const response = await this.request<unknown>('/api/application-plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return applicationPlanResponseSchema.parse(response);
  }

  async getApplicationPlan(
    applicationId: string,
  ): Promise<ValidatedApplicationPlanResponse> {
    const response = await this.request<unknown>(
      `/api/application-plans/${encodeURIComponent(applicationId)}`,
    );
    return applicationPlanResponseSchema.parse(response);
  }

  async applyApplicationPlanAction(
    applicationId: string,
    action: ApplicationPlanAction,
    reason?: string,
  ): Promise<ValidatedApplicationPlanResponse> {
    const response = await this.request<unknown>(
      `/api/application-plans/${encodeURIComponent(applicationId)}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      },
    );
    return applicationPlanResponseSchema.parse(response);
  }

  async getFormFillInstructions(
    applicationId: string,
    fields: FormFieldObservation[],
  ): Promise<FormFillInstructionsResponse> {
    const response = await this.request<unknown>(
      `/api/application-plans/${encodeURIComponent(applicationId)}/form-instructions`,
      {
        method: 'POST',
        body: JSON.stringify({
          fields: fields.map(
            ({ key, id, name, type, label, required, options }) => ({
              key,
              id,
              name,
              type,
              label,
              required,
              options,
            }),
          ),
        }),
      },
    );
    return formFillInstructionsResponseSchema.parse(response);
  }

  async getFormAutofillInstructions(
    platform: string,
    fields: FormFieldObservation[],
    company?: string,
    scene = 'generic',
    sessionId?: string,
  ): Promise<FormAutofillInstructionsResponse> {
    const response = await this.request<unknown>(
      '/api/form-autofill-instructions',
      {
        method: 'POST',
        body: JSON.stringify({
          platform,
          ...(company ? { company } : {}),
          scene,
          ...(sessionId ? { session_id: sessionId } : {}),
          fields: fields.map(
            ({
              key,
              id,
              name,
              type,
              label,
              required,
              options,
              semanticFeatures,
            }) => ({
              key,
              id,
              name,
              type,
              label,
              required,
              options,
              semantic_features:
                semanticFeatures?.length ? semanticFeatures : (
                  semanticFeaturesForPayload(label, name, id)
                ),
            }),
          ),
        }),
      },
    );
    return formAutofillInstructionsResponseSchema.parse(response);
  }

  async recordFormTempChange(
    platform: string,
    company: string | undefined,
    scene: string,
    sessionId: string,
    field: FormFieldObservation,
  ): Promise<void> {
    await this.request('/api/form-temp-changes', {
      method: 'POST',
      body: JSON.stringify({
        platform,
        ...(company ? { company } : {}),
        scene,
        session_id: sessionId,
        field: {
          key: field.key,
          id: field.id,
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required,
          options: field.options,
          semantic_features: semanticFeatures(field),
        },
        temp_value: field.currentValue || '',
      }),
    });
  }

  async finalizeFormTempChanges(
    sessionId: string,
    save: boolean,
    changes: Array<{
      platform: string;
      company?: string;
      scene: string;
      field: FormFieldObservation;
    }>,
  ): Promise<{
    status: 'saved' | 'discarded' | 'empty';
    saved_count: number;
    discarded_count: number;
  }> {
    const response = await this.request<unknown>(
      '/api/form-temp-changes/finalize',
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          save,
          changes: changes.map(({ platform, company, scene, field }) => ({
            platform,
            ...(company ? { company } : {}),
            scene,
            session_id: sessionId,
            field: {
              key: field.key,
              id: field.id,
              name: field.name,
              type: field.type,
              label: field.label,
              required: field.required,
              options: field.options,
              semantic_features: semanticFeatures(field),
            },
            temp_value: field.currentValue || '',
          })),
        }),
      },
    );
    return response as {
      status: 'saved' | 'discarded' | 'empty';
      saved_count: number;
      discarded_count: number;
    };
  }

  async downloadDefaultResume(): Promise<DownloadedResume> {
    const assets = await this.request<ResumeAsset[]>('/api/resume-assets');
    const asset = assets.find((candidate) => candidate.is_default) || assets[0];
    if (!asset?.url)
      throw new ApiClientError(
        'No resume is available in your Jobby resume library.',
        404,
      );

    const response = await fetch(asset.url);
    if (!response.ok)
      throw new ApiClientError(
        'Could not download the selected Jobby resume.',
        response.status,
      );
    const content = await response.arrayBuffer();
    if (content.byteLength === 0)
      throw new ApiClientError('The selected Jobby resume is empty.', 422);
    if (content.byteLength > 10 * 1024 * 1024) {
      throw new ApiClientError(
        'The selected Jobby resume is larger than the 10 MB upload limit.',
        413,
      );
    }
    const headerType = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim();
    return {
      filename: asset.filename || 'Resume.pdf',
      mimeType: headerType || 'application/pdf',
      contentBase64: arrayBufferToBase64(content),
    };
  }

  async previewJobReview(payload: JobReviewPayload): Promise<JobReviewPreview> {
    return this.request<JobReviewPreview>(
      '/api/job-review/preview',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true,
      60000,
    );
  }

  async reviewJob(
    payload: JobReviewPayload,
    signal?: AbortSignal,
  ): Promise<JobReviewResult> {
    return this.request<JobReviewResult>(
      '/api/job-review',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      },
      true,
      180000,
    );
  }

  async cancelJobReview(generationId: string): Promise<void> {
    await this.request(
      `/api/job-review/${encodeURIComponent(generationId)}/cancel`,
      { method: 'POST' },
    );
  }

  async getCareerProfiles(): Promise<CareerProfile[]> {
    return this.request<CareerProfile[]>('/api/career-profiles');
  }

  async updateCareerProfile(
    id: string,
    payload: Partial<CareerProfile> | Record<string, unknown>,
  ): Promise<CareerProfile> {
    return this.request<CareerProfile>(
      `/api/career-profiles/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
  }

  async setPrimaryCareerProfile(id: string): Promise<CareerProfile> {
    return this.request<CareerProfile>(
      `/api/career-profiles/${encodeURIComponent(id)}/primary`,
      {
        method: 'POST',
      },
    );
  }

  async getTailoredResumes(limit = 20): Promise<TailoredResume[]> {
    return this.request<TailoredResume[]>(
      `/api/tailored-resumes?limit=${limit}`,
    );
  }

  async getTailoredResume(id: string): Promise<TailoredResume> {
    return this.request<TailoredResume>(
      `/api/tailored-resumes/${encodeURIComponent(id)}`,
    );
  }

  async updateTailoredResume(
    id: string,
    payload: Partial<TailoredResume> | Record<string, unknown>,
  ): Promise<TailoredResume> {
    return this.request<TailoredResume>(
      `/api/tailored-resumes/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
  }

  async deleteTailoredResume(
    id: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(
      `/api/tailored-resumes/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
  }
}

export const apiClient = new ApiClient();
