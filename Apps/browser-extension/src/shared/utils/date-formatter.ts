/** @format */

export interface FormattedJobDate {
  displayText: string;
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
    return { displayText: datePosted || '', isNotFresh: false };
  }

  const trimmed = datePosted.trim();
  const lower = trimmed.toLowerCase();

  let ageInDays: number | null = null;
  let ageInHours: number | null = null;
  let realDateStr: string | undefined = undefined;

  // 1. Try parsing relative hour and minute keywords
  const hourMatch = lower.match(/(\d+)\s*(?:hours?|hrs?|h\b|小时前)/i);
  const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?|分钟前)/i);

  if (hourMatch && hourMatch[1]) {
    ageInHours = parseInt(hourMatch[1], 10);
    ageInDays = 0;
  } else if (minMatch && minMatch[1]) {
    const mins = parseInt(minMatch[1], 10);
    ageInHours = Math.max(0, Math.floor(mins / 60));
    ageInDays = 0;
  } else if (
    /\b(?:today|just\s+(?:posted|now)|secs?\s+ago)\b/i.test(lower) ||
    /(?:刚刚|今天)/.test(lower)
  ) {
    ageInDays = 0;
  } else if (/\b(?:yesterday)\b/i.test(lower) || /昨天/.test(lower)) {
    ageInDays = 1;
  } else {
    // Check day count: e.g. "3 days ago", "6d", "6天前"
    const dayMatch = lower.match(/(\d+)\s*(?:days?|d\b|天前|日前的?)/i);
    if (dayMatch && dayMatch[1]) {
      ageInDays = parseInt(dayMatch[1], 10);
    } else {
      // Check week count: e.g. "1 week ago", "1w", "1周前", "Over 2 weeks"
      const weekMatch = lower.match(/(\d+)\s*(?:weeks?|wks?|w\b|周前|星期前)/i);
      if (weekMatch && weekMatch[1]) {
        ageInDays = parseInt(weekMatch[1], 10) * 7;
      } else {
        // Check month count: e.g. "1 month ago", "1mo", "1个月前"
        const monthMatch = lower.match(/(\d+)\s*(?:months?|mos?|mo\b|m\b|个月前|月前)/i);
        if (monthMatch && monthMatch[1]) {
          ageInDays = parseInt(monthMatch[1], 10) * 30;
        } else if (/30\+\s*(?:days?|d)/i.test(lower)) {
          ageInDays = 30;
        } else {
          const yearMatch = lower.match(/(\d+)\s*(?:years?|yrs?|y\b|年前)/i);
          if (yearMatch && yearMatch[1]) {
            ageInDays = parseInt(yearMatch[1], 10) * 365;
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
    return { displayText: trimmed, isNotFresh: false };
  }

  // Calculate an estimated real date YYYY-MM-DD if not explicitly parsed
  if (!realDateStr) {
    const estimatedDate = new Date(
      referenceDate.getTime() - ageInDays * 24 * 60 * 60 * 1000
    );
    realDateStr = formatDateToYYYYMMDD(estimatedDate);
  }

  // 3. Determine freshness and display format
  if (ageInDays <= 14) {
    let displayText: string;

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
    } else if (ageInDays < 7) {
      displayText = `${ageInDays} day${ageInDays === 1 ? '' : 's'} ago`;
    } else {
      const weeks = Math.floor(ageInDays / 7);
      displayText = `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    }

    return {
      displayText,
      isNotFresh: false,
      realDate: realDateStr,
      ageInDays,
    };
  }

  // Older than 2 weeks (> 14 days) -> Not Fresh
  let displayText: string;
  if (ageInDays >= 365) {
    const years = Math.floor(ageInDays / 365);
    displayText = `${years} year${years === 1 ? '' : 's'} ago`;
  } else if (ageInDays >= 28) {
    const months = Math.max(1, Math.floor(ageInDays / 30));
    displayText = `${months} month${months === 1 ? '' : 's'} ago`;
  } else {
    const weeks = Math.floor(ageInDays / 7);
    displayText = `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  return {
    displayText,
    isNotFresh: true,
    realDate: realDateStr,
    ageInDays,
  };
}
