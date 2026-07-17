/** @format */

import type {
  InterviewQuestion,
  PracticeRecord,
  InterviewCategory,
  PracticePlan,
  PlanTask,
} from '@/lib/types';

export const practiceCache = {
  questions: null as InterviewQuestion[] | null,
  records: null as PracticeRecord[] | null,
  categories: null as InterviewCategory[] | null,
  activePlan: null as PracticePlan | null,
  planTasks: null as PlanTask[] | null,
  apiBaseUrl: '',
};
