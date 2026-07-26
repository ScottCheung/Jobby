import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Folder,
  Gem,
  MessageCircle,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { InterviewCategory } from './types';
import { cleanName } from './utils';

const CATEGORY_ICON_COMPONENTS = {
  'message-circle': MessageCircle,
  'user-round': UserRound,
  'briefcase-business': BriefcaseBusiness,
  gem: Gem,
  'building-2': Building2,
  folder: Folder,
} satisfies Record<string, LucideIcon>;

const CATEGORY_ICON_BY_SLUG = {
  behaviour: MessageCircle,
  about_you: UserRound,
  project: BriefcaseBusiness,
  role_specific: Gem,
  company: Building2,
} satisfies Record<string, LucideIcon>;

export function getInterviewCategoryIcon(
  category?:
    | Partial<Pick<InterviewCategory, 'icon_key' | 'slug' | 'name'>>
    | null,
  fallback: LucideIcon = BookOpen,
) {
  if (!category) return fallback;
  const iconByKey =
    CATEGORY_ICON_COMPONENTS[
      (category.icon_key || '') as keyof typeof CATEGORY_ICON_COMPONENTS
    ];
  if (iconByKey) return iconByKey;
  const iconBySlug =
    CATEGORY_ICON_BY_SLUG[
      (category.slug || '') as keyof typeof CATEGORY_ICON_BY_SLUG
    ];
  if (iconBySlug) return iconBySlug;
  return fallback;
}

export function getInterviewCategoryLabel(
  category?:
    | Partial<Pick<InterviewCategory, 'display_name' | 'name'>>
    | null,
) {
  return cleanName(category?.display_name || category?.name || '') || 'General';
}
