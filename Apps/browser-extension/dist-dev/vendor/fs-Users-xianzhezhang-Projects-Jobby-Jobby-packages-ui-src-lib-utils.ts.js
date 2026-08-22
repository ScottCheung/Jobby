import { clsx } from "/vendor/.vite-deps-clsx.js__v--a59ebdb8.js";
import { twMerge } from "/vendor/.vite-deps-tailwind-merge.js__v--6d9b534e.js";
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
export function cleanName(name) {
  if (!name) return "";
  return name.replace(/^\s*\d+\s*[\.)_:-]?\s*/, "").trim();
}
export function formatInterviewDuration(seconds) {
  const value = Math.max(1, Math.round(seconds || 120));
  if (value < 60) return `${value}s`;
  if (value % 60 === 0) return `${value / 60} min`;
  return `${Number((value / 60).toFixed(1))} min`;
}
