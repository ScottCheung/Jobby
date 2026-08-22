/** @format */

export type JobFreshnessTier = 'new' | 'aging' | 'stale';

export interface FormattedJobDate {
  displayText: string;
  freshnessTier?: JobFreshnessTier;
  isTooOld: boolean;
  isNotFresh: boolean;
  realDate?: string;
  ageInDays?: number;
}

function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses raw datePosted string (e.g. "2026-08-01", "3 hours ago", "3 days ago", "Posted 2 weeks ago")
 * and returns formatted display text and a flag indicating if the post is over 2 weeks old.
 */
export function parseAndFormatJobDate(
  datePosted: string,
  referenceDate: Date = new Date()
): FormattedJobDate {
  if (!datePosted || typeof datePosted !== 'string') {
    return { displayText: datePosted || '', isTooOld: false, isNotFresh: false };
  }

  const trimmed = datePosted.trim();
  const lower = trimmed.toLowerCase();

  let ageInDays: number | null = null;
  let ageInHours: number | null = null;
  let realDateStr: string | undefined = undefined;

  let inputUnit: 'hour' | 'minute' | 'day' | 'week' | 'month' | 'year' | null = null;

  // 1. Try parsing relative hour and minute keywords
  const hourMatch = lower.match(/(\d+)\s*(?:hours?|hrs?|h\b|小时前)/i);
  const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?|分钟前)/i);

  if (hourMatch && hourMatch[1]) {
    ageInHours = parseInt(hourMatch[1], 10);
    ageInDays = 0;
    inputUnit = 'hour';
  } else if (minMatch && minMatch[1]) {
    const mins = parseInt(minMatch[1], 10);
    ageInHours = Math.max(0, Math.floor(mins / 60));
    ageInDays = 0;
    inputUnit = 'minute';
  } else if (
    /\b(?:today|just\s+(?:posted|now)|secs?\s+ago)\b/i.test(lower) ||
    /(?:刚刚|今天)/.test(lower)
  ) {
    ageInDays = 0;
  } else if (/\b(?:yesterday)\b/i.test(lower) || /昨天/.test(lower)) {
    ageInDays = 1;
    inputUnit = 'day';
  } else {
    // Check day count: e.g. "3 days ago", "6d", "19d", "26d", "6天前"
    const dayMatch = lower.match(/(\d+)\s*(?:days?|d\b|天前|日前的?)/i);
    if (dayMatch && dayMatch[1]) {
      ageInDays = parseInt(dayMatch[1], 10);
      inputUnit = 'day';
    } else {
      // Check week count: e.g. "1 week ago", "1w", "1周前", "Over 2 weeks"
      const weekMatch = lower.match(/(\d+)\s*(?:weeks?|wks?|w\b|周前|星期前)/i);
      if (weekMatch && weekMatch[1]) {
        ageInDays = parseInt(weekMatch[1], 10) * 7;
        inputUnit = 'week';
      } else {
        // Check month count: e.g. "1 month ago", "1mo", "1个月前"
        const monthMatch = lower.match(/(\d+)\s*(?:months?|mos?|mo\b|m\b|个月前|月前)/i);
        if (monthMatch && monthMatch[1]) {
          ageInDays = parseInt(monthMatch[1], 10) * 30;
          inputUnit = 'month';
        } else if (/30\+\s*(?:days?|d)/i.test(lower)) {
          ageInDays = 30;
          inputUnit = 'month';
        } else {
          const yearMatch = lower.match(/(\d+)\s*(?:years?|yrs?|y\b|年前)/i);
          if (yearMatch && yearMatch[1]) {
            ageInDays = parseInt(yearMatch[1], 10) * 365;
            inputUnit = 'year';
          }
        }
      }
    }
  }

  // 2. Try parsing as an explicit date or timestamp (strip prefix words first)
  const cleanDateStr = trimmed.replace(/^(?:posted\s+(?:on\s+)?|reposted\s+(?:on\s+)?|date\s*:\s*|发布于\s*|重新发布于\s*|over\s+|more\s+than\s+)/i, '').trim();
  const timestamp = Date.parse(cleanDateStr) || Date.parse(trimmed);
  if (!isNaN(timestamp)) {
    const parsedDate = new Date(timestamp);
    const year = parsedDate.getFullYear();
    // Validate reasonable year range
    if (year >= 2000 && year <= 2100) {
      realDateStr = formatDateToYYYYMMDD(parsedDate);
      const diffMs = referenceDate.getTime() - parsedDate.getTime();
      if (diffMs >= 0) {
        const computedHours = Math.floor(diffMs / (1000 * 60 * 60));
        const computedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (ageInDays === null) {
          ageInDays = computedDays;
        }
        if (ageInHours === null && computedHours < 24) {
          ageInHours = computedHours;
        }
      }
    }
  }

  // If ageInDays could not be calculated, return original text as fallback
  if (ageInDays === null) {
    return { displayText: trimmed, isTooOld: false, isNotFresh: false };
  }

  // Calculate an estimated real date YYYY-MM-DD if not explicitly parsed
  if (!realDateStr) {
    const estimatedDate = new Date(
      referenceDate.getTime() - ageInDays * 24 * 60 * 60 * 1000
    );
    realDateStr = formatDateToYYYYMMDD(estimatedDate);
  }

  // 3. Determine freshness and display format
  let displayText = '';
  if (ageInDays === 0) {
    if (ageInHours !== null && ageInHours > 0) {
      displayText = `${ageInHours} hour${ageInHours === 1 ? '' : 's'} ago`;
    } else if (minMatch && minMatch[1]) {
      const mins = parseInt(minMatch[1], 10);
      displayText = `${mins} minute${mins === 1 ? '' : 's'} ago`;
    } else if (/\bjust\s+(?:posted|now)\b/i.test(lower) || /刚刚/.test(lower)) {
      displayText = 'Just posted';
    } else {
      displayText = 'Today';
    }
  } else if (inputUnit === 'day' || (inputUnit === null && ageInDays < 7)) {
    displayText = `${ageInDays} day${ageInDays === 1 ? '' : 's'} ago`;
  } else if (inputUnit === 'week' || (inputUnit === null && ageInDays < 30)) {
    const weeks = Math.max(1, Math.round(ageInDays / 7));
    displayText = `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  } else if (inputUnit === 'month' || (inputUnit === null && ageInDays < 365)) {
    const months = Math.max(1, Math.round(ageInDays / 30));
    displayText = `${months} month${months === 1 ? '' : 's'} ago`;
  } else {
    const years = Math.max(1, Math.floor(ageInDays / 365));
    displayText = `${years} year${years === 1 ? '' : 's'} ago`;
  }

  const isTooOld = ageInDays > 7;
  const isNotFresh = ageInDays > 4 && ageInDays <= 7;
  const freshnessTier: JobFreshnessTier =
    ageInDays <= 4 ? 'new' : ageInDays <= 7 ? 'aging' : 'stale';

  return {
    displayText,
    freshnessTier,
    isTooOld,
    isNotFresh,
    realDate: realDateStr,
    ageInDays,
  };
}

/**
 * Formats a date or ISO string into a concise relative time (e.g. "just now", "10m ago", "2h ago", "19d ago", "26d ago").
 */
export function formatRelativeTime(
  dateInput: string | Date | number | undefined | null
): string {
  if (!dateInput) return '';
  const date =
    typeof dateInput === 'object' && dateInput instanceof Date
      ? dateInput
      : new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSec < 45) return 'just now';
  if (diffSec < 90) return '1m ago';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}
