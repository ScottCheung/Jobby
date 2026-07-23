/**
 * Central TanStack Query Hooks & Cache Keys
 *
 * Provides typed, cached query hooks and cache invalidation helpers.
 *
 * @format
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  User,
  UserProfile,
  DailySummary,
  DailyQuest,
  Achievement,
  InterviewQuestion,
  PracticeRecord,
  PracticePlan,
  InterviewCategory,
  InterviewTag,
  InterviewCollection,
} from '@/lib/types';

// Query Key Constants
export const QUERY_KEYS = {
  me: ['user', 'me'] as const,
  profile: ['user', 'profile'] as const,
  gamificationSummary: ['gamification', 'summary'] as const,
  gamificationHeatmap: ['gamification', 'heatmap'] as const,
  dailyQuests: ['gamification', 'quests'] as const,
  achievements: ['gamification', 'achievements'] as const,
  interviewQuestions: (params?: Record<string, unknown>) => ['interview', 'questions', params || {}] as const,
  interviewCategories: ['interview', 'categories'] as const,
  interviewTags: ['interview', 'tags'] as const,
  interviewCollections: ['interview', 'collections'] as const,
  practicePlans: ['interview', 'plans'] as const,
  practiceRecords: ['interview', 'records'] as const,
};

// ── User & Profile Queries ────────────────────────────────────────────────────
export function useUserQuery() {
  return useQuery<User>({
    queryKey: QUERY_KEYS.me,
    queryFn: () => api.me(),
  });
}

export function useProfileQuery() {
  return useQuery<UserProfile>({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => api.profile(),
  });
}

// ── Gamification Queries ──────────────────────────────────────────────────────
export function useGamificationSummaryQuery() {
  return useQuery<DailySummary>({
    queryKey: QUERY_KEYS.gamificationSummary,
    queryFn: () => api.gamificationSummary(),
  });
}

export function useDailyQuestsQuery() {
  return useQuery<DailyQuest[]>({
    queryKey: QUERY_KEYS.dailyQuests,
    queryFn: () => api.dailyQuests(),
  });
}

export function useAchievementsQuery() {
  return useQuery<Achievement[]>({
    queryKey: QUERY_KEYS.achievements,
    queryFn: () => api.achievements(),
  });
}

// ── Interview & Practice Queries ──────────────────────────────────────────────
export function useInterviewQuestionsQuery(options?: { limit?: number; offset?: number; search?: string; category_id?: string }) {
  return useQuery<InterviewQuestion[]>({
    queryKey: QUERY_KEYS.interviewQuestions(options),
    queryFn: () => api.interviewQuestions(options),
  });
}

export function useInterviewCategoriesQuery() {
  return useQuery<InterviewCategory[]>({
    queryKey: QUERY_KEYS.interviewCategories,
    queryFn: () => api.interviewCategories(),
  });
}

export function useInterviewTagsQuery() {
  return useQuery<InterviewTag[]>({
    queryKey: QUERY_KEYS.interviewTags,
    queryFn: () => api.interviewTags(),
  });
}

export function useInterviewCollectionsQuery() {
  return useQuery<InterviewCollection[]>({
    queryKey: QUERY_KEYS.interviewCollections,
    queryFn: () => api.interviewCollections(),
  });
}

export function usePracticePlansQuery() {
  return useQuery<PracticePlan[]>({
    queryKey: QUERY_KEYS.practicePlans,
    queryFn: () => api.practicePlans(),
  });
}

export function usePracticeRecordsQuery() {
  return useQuery<PracticeRecord[]>({
    queryKey: QUERY_KEYS.practiceRecords,
    queryFn: () => api.practiceRecords(),
  });
}

// ── Invalidation Helper Hook ──────────────────────────────────────────────────
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateGamification: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.gamificationSummary });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyQuests });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
    },
    invalidateQuestions: () => {
      void queryClient.invalidateQueries({ queryKey: ['interview', 'questions'] });
    },
    invalidatePlans: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.practicePlans });
    },
    invalidateAll: () => {
      void queryClient.invalidateQueries();
    },
  };
}
