import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanName(name: string): string {
  if (!name) return '';
  return name.replace(/^\s*\d+\s*[\.)_:-]?\s*/, '').trim();
}

export function formatInterviewDuration(seconds?: number | null): string {
  const value = Math.max(1, Math.round(seconds || 120));
  if (value < 60) return `${value}s`;
  if (value % 60 === 0) return `${value / 60} min`;
  return `${Number((value / 60).toFixed(1))} min`;
}
