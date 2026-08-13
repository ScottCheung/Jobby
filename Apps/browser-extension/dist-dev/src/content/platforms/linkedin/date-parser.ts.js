const CORE_TIME_PATTERN = /\b(\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|[dhwmy]|mo)\s*ago|today|yesterday|just\s+(?:now|posted))\b/i;
const PREFIX_PATTERN = /^(?:(?:re)?posted|over|more\s+than)\s+/i;
const ZH_CORE_PATTERN = /(\d+\s*\+?\s*(?:个?月|周|天|小时|分钟)前|刚刚|今天|昨天)/;
function stripPrefix(raw) {
  return raw.replace(PREFIX_PATTERN, "").replace(/\s+/g, " ").trim();
}
export function extractLinkedInPostedDate(value) {
  const rawText = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!rawText) return void 0;
  const isoMatch = rawText.match(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?\b/);
  if (isoMatch?.[0]) return isoMatch[0];
  const segments = rawText.split(/\s*[·•|\n]\s*/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const coreMatch = seg.match(CORE_TIME_PATTERN);
    if (coreMatch?.[1]) return coreMatch[1].replace(/\s+/g, " ").trim();
    const zhMatch = seg.match(ZH_CORE_PATTERN);
    if (zhMatch?.[1]) return zhMatch[1].replace(/\s+/g, " ").trim();
  }
  const coreFallback = rawText.match(CORE_TIME_PATTERN);
  if (coreFallback?.[1]) return coreFallback[1].replace(/\s+/g, " ").trim();
  const zhFallback = rawText.match(ZH_CORE_PATTERN);
  if (zhFallback?.[1]) return zhFallback[1].replace(/\s+/g, " ").trim();
  return void 0;
}
export function cleanPostedAt(value) {
  if (!value) return void 0;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return void 0;
  if (/^\d{4}-\d{2}-\d{2}(?:T[\d:.Z]+)?$/.test(trimmed)) return trimmed;
  const stripped = stripPrefix(trimmed);
  if (CORE_TIME_PATTERN.test(stripped) || ZH_CORE_PATTERN.test(stripped)) {
    return stripped;
  }
  return extractLinkedInPostedDate(trimmed);
}
