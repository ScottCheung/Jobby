/** @format */

import type { InterviewQuestion, PlanTask } from '@/lib/types';

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed & 0xffffffff;
  for (let i = a.length - 1; i > 0; i--) {
    s = ((s * 1664525 + 1013904223) & 0xffffffff) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getPlanQueue(
  planTasks: PlanTask[],
  questions: InterviewQuestion[],
): InterviewQuestion[] {
  if (planTasks.length === 0) return [];
  const sorted = [...planTasks].sort(
    (a, b) =>
      new Date(a.scheduled_date).getTime() -
      new Date(b.scheduled_date).getTime(),
  );
  const todayStr = new Date().toDateString();
  let dayTasks = sorted.filter(
    (t) => new Date(t.scheduled_date).toDateString() === todayStr,
  );
  if (dayTasks.length === 0) {
    const pending = sorted.filter((t) => t.status === 'pending');
    if (pending.length > 0) {
      const earliest = new Date(
        Math.min(...pending.map((t) => new Date(t.scheduled_date).getTime())),
      ).toDateString();
      dayTasks = sorted.filter(
        (t) => new Date(t.scheduled_date).toDateString() === earliest,
      );
    }
  }
  const seen = new Set<string>();
  const result: InterviewQuestion[] = [];
  for (const task of dayTasks) {
    if (!seen.has(task.question_id)) {
      const q = questions.find((q) => q.id === task.question_id);
      if (q) {
        result.push(q);
        seen.add(task.question_id);
      }
    }
  }
  return result;
}
