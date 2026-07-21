import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanName(name: string): string {
  if (!name) return '';
  return name.replace(/^\d+[\.\-\s]*\s+/, '');
}

export function matchesCollection(
  q: { source_collection_id?: string | null; id: string; source_question_id?: string | null },
  collection: { id: string; question_ids?: string[] }
): boolean {
  return (
    q.source_collection_id === collection.id ||
    (collection.question_ids && collection.question_ids.includes(q.id)) ||
    !!(q.source_question_id && collection.question_ids && collection.question_ids.includes(q.source_question_id))
  );
}


