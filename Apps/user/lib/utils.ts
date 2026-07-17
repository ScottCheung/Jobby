import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanName(name: string): string {
  if (!name) return '';
  return name.replace(/^\d+[\.\-\s]*\s+/, '');
}

