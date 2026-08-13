/** @format */

/**
 * Core time-quantity pattern (no prefix). Captures expressions like
 * "3 days ago", "2 weeks ago", "today", "just now", etc.
 */
const CORE_TIME_PATTERN =
  /\b(\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|[dhwmy]|mo)\s*ago|today|yesterday|just\s+(?:now|posted))\b/i;

/** Optional prefixes LinkedIn prepends: "Posted", "Reposted", "Over", "More than". */
const PREFIX_PATTERN = /^(?:(?:re)?posted|over|more\s+than)\s+/i;

/** Chinese relative-time pattern (strips 发布于/重新发布于 prefix). */
const ZH_CORE_PATTERN =
  /(\d+\s*\+?\s*(?:个?月|周|天|小时|分钟)前|刚刚|今天|昨天)/;

/**
 * Strip a "Posted" / "Reposted" / "Over" / "More than" prefix and return
 * the clean core time expression, e.g. "Reposted 3 days ago" → "3 days ago".
 */
function stripPrefix(raw: string): string {
  return raw.replace(PREFIX_PATTERN, '').replace(/\s+/g, ' ').trim();
}

/** Extract the relative posting-date phrase from LinkedIn metadata text. */
export function extractLinkedInPostedDate(
  value: string | null | undefined,
): string | undefined {
  const rawText = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!rawText) return undefined;

  // 1. Prefer ISO date (e.g. "2026-08-10", "2026-08-10T12:00:00Z")
  const isoMatch = rawText.match(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?\b/);
  if (isoMatch?.[0]) return isoMatch[0];

  // Split by bullet / pipe / newline to work on isolated segments first
  const segments = rawText.split(/\s*[·•|\n]\s*/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const coreMatch = seg.match(CORE_TIME_PATTERN);
    if (coreMatch?.[1]) return coreMatch[1].replace(/\s+/g, ' ').trim();

    const zhMatch = seg.match(ZH_CORE_PATTERN);
    if (zhMatch?.[1]) return zhMatch[1].replace(/\s+/g, ' ').trim();
  }

  // Fallback: match on the full string
  const coreFallback = rawText.match(CORE_TIME_PATTERN);
  if (coreFallback?.[1]) return coreFallback[1].replace(/\s+/g, ' ').trim();

  const zhFallback = rawText.match(ZH_CORE_PATTERN);
  if (zhFallback?.[1]) return zhFallback[1].replace(/\s+/g, ' ').trim();

  return undefined;
}

/**
 * Normalise a raw `datePosted` value from any source.
 *
 * - If it already looks like a clean relative expression or ISO date, return as-is.
 * - If it contains a "Posted / Reposted / Over" prefix, strip it.
 * - Otherwise attempt a full extraction.
 */
export function cleanPostedAt(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;

  // Already clean ISO date
  if (/^\d{4}-\d{2}-\d{2}(?:T[\d:.Z]+)?$/.test(trimmed)) return trimmed;

  // Strip known prefix and re-validate
  const stripped = stripPrefix(trimmed);
  if (CORE_TIME_PATTERN.test(stripped) || ZH_CORE_PATTERN.test(stripped)) {
    return stripped;
  }

  return extractLinkedInPostedDate(trimmed);
}
