/** @format */

import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Gem,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import type React from 'react';
import type { InterviewCollection, InterviewQuestion } from '@/lib/types';
import {
  getInterviewCategoryIcon,
  getInterviewCategoryLabel,
} from '@/lib/interview-categories';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ContentActivityBadge = 'New' | 'New this week' | 'Updated';

const THEME_ICONS = {
  Behaviour: MessageCircle,
  'About You': UserRound,
  Project: BriefcaseBusiness,
  'Role-specific': Gem,
  Company: Building2,
} satisfies Record<string, React.ElementType>;

export function timestamp(value?: string | null) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function isWithinLastSevenDays(value?: string | null) {
  const valueMs = timestamp(value);
  return (
    !Number.isNaN(valueMs) &&
    valueMs >= Date.now() - SEVEN_DAYS_MS &&
    valueMs <= Date.now()
  );
}

function isAfterLogin(
  value: string | null | undefined,
  lastLoginAt: string | null,
) {
  const valueMs = timestamp(value);
  const loginMs = timestamp(lastLoginAt);
  return !Number.isNaN(valueMs) && !Number.isNaN(loginMs) && valueMs > loginMs;
}

export function getQuestionActivityBadge(
  question: InterviewQuestion,
  lastLoginAt: string | null,
): ContentActivityBadge | undefined {
  if (isAfterLogin(question.created_at, lastLoginAt)) return 'New';
  if (isWithinLastSevenDays(question.created_at)) return 'New this week';
  return undefined;
}

export function getCollectionActivityBadge(
  collection: InterviewCollection,
  lastLoginAt: string | null,
): ContentActivityBadge | undefined {
  const publishedAt = collection.created_at;
  const updatedAt = collection.last_updated_at || collection.updated_at;
  const isUpdated = Boolean(
    updatedAt && publishedAt && timestamp(updatedAt) > timestamp(publishedAt),
  );

  if (isAfterLogin(publishedAt, lastLoginAt)) return 'New';
  if (isUpdated && isAfterLogin(updatedAt, lastLoginAt)) return 'Updated';
  if (isWithinLastSevenDays(publishedAt)) return 'New this week';
  if (isUpdated && isWithinLastSevenDays(updatedAt)) return 'Updated';
  return undefined;
}

export function dedupeQuestions(questions: InterviewQuestion[]) {
  const normalizeTitle = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const byTitle = new Map<string, InterviewQuestion>();

  questions.forEach((question) => {
    const key =
      question.normalized_title || normalizeTitle(question.title) || question.id;
    const existing = byTitle.get(key);
    if (!existing || (question.is_saved && !existing.is_saved)) {
      byTitle.set(key, question);
    }
  });

  return Array.from(byTitle.values());
}

export function rankedWindow<T>(items: T[], offset: number, count: number) {
  if (items.length <= count) return items;
  return Array.from(
    { length: count },
    (_, index) => items[(offset + index) % items.length],
  );
}

export function getCategoryPresentation(question: InterviewQuestion) {
  const category = question.category;
  const label = getInterviewCategoryLabel(category);
  const Icon = getInterviewCategoryIcon(category, BookOpen);
  if (category?.icon_key || category?.slug) return { label, Icon };

  const normalized = label.toLowerCase();
  if (normalized.includes('behav'))
    return { label: 'Behaviour', Icon: THEME_ICONS.Behaviour };
  if (normalized.includes('about'))
    return { label: 'About You', Icon: THEME_ICONS['About You'] };
  if (normalized.includes('experience') || normalized.includes('project'))
    return { label: 'Project', Icon: THEME_ICONS.Project };
  if (normalized.includes('role'))
    return { label: 'Role-specific', Icon: THEME_ICONS['Role-specific'] };
  if (normalized.includes('company'))
    return { label: 'Company', Icon: THEME_ICONS.Company };
  return { label, Icon: BookOpen };
}

export function isToday(value?: string | null) {
  return Boolean(value && new Date(value).toDateString() === new Date().toDateString());
}
