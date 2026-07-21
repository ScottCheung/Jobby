const QUICK_RATING_LOCK_KEY = 'practiceQuickRatingLocked';

type LockedMap = Record<string, true>;

function readLockedMap(): LockedMap {
  try {
    const raw = window.localStorage.getItem(QUICK_RATING_LOCK_KEY);
    return raw ? (JSON.parse(raw) as LockedMap) : {};
  } catch {
    return {};
  }
}

function writeLockedMap(map: LockedMap) {
  try {
    window.localStorage.setItem(QUICK_RATING_LOCK_KEY, JSON.stringify(map));
  } catch {}
}

export function isQuickRatingLocked(questionId: string): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(readLockedMap()[questionId]);
}

export function lockQuickRating(questionId: string) {
  if (typeof window === 'undefined') return;
  writeLockedMap({ ...readLockedMap(), [questionId]: true });
}
