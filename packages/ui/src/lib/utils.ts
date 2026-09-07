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

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern navigator.clipboard.writeText
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      if (typeof window !== 'undefined' && typeof window.focus === 'function') {
        window.focus();
      }
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback mechanisms
    }
  }

  // 2. Try document.execCommand('copy') via temporary textarea
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText =
        'position: fixed; left: -9999px; top: 0; opacity: 0; pointer-events: none; z-index: -1;';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand('copy');
      textarea.remove();
      if (successful) return true;
    } catch {
      // Fall through to iframe parent delegation
    }
  }

  // 3. In cross-origin iframe context (such as Jobby floating dialog inside a web page),
  // post a message to parent window to perform clipboard write
  if (
    typeof window !== 'undefined' &&
    window.parent &&
    window.parent !== window
  ) {
    try {
      window.parent.postMessage(
        { source: 'jobby-dialog', type: 'jobby.copy-text', text },
        '*',
      );
      return true;
    } catch {
      // Ignore
    }
  }

  return false;
}

