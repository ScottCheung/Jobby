/** @format */

/**
 * LinkedIn Voyager API client.
 *
 * LinkedIn's internal `/voyager/api/jobs/jobPostings/{jobId}` endpoint returns
 * rich, structured metadata for any job the currently-authenticated user can
 * view.  Because the content script runs on `linkedin.com`, the browser
 * automatically attaches the user's session cookies, so no additional
 * authentication is required.
 *
 * Key fields extracted:
 *  - `listedAt`              — exact Unix ms timestamp of the posting date
 *  - `originalListedAt`      — original posting date (before any reposts)
 *  - `workRemoteAllowed`     — whether remote work is allowed
 *  - `workplaceTypes`        — URNs encoding on-site / remote / hybrid
 *  - `formattedExperienceLevel` — e.g. "Mid-Senior level"
 *  - `formattedLocation`     — canonical location string from LinkedIn
 *  - `formattedIndustries`   — e.g. ["Software Development"]
 *  - `companyDescription`    — company blurb included in some postings
 */

/** Workplace type URN → human-readable label. */
const WORKPLACE_TYPE_MAP: Record<string, 'onsite' | 'remote' | 'hybrid'> = {
  'urn:li:fs_workplaceType:1': 'onsite',
  'urn:li:fs_workplaceType:2': 'remote',
  'urn:li:fs_workplaceType:3': 'hybrid',
};

export type WorkType = 'onsite' | 'remote' | 'hybrid';

export interface LinkedInJobApiData {
  /** Exact posting date as an ISO-8601 date string, e.g. "2026-04-24". */
  listedAt?: string;
  workType?: WorkType;
  experienceLevel?: string;
  /** Canonical location text from the API (more authoritative than DOM). */
  location?: string;
  industries?: string[];
  companyDescription?: string;
  /** Whether LinkedIn Easy Apply is available (derived from applyMethod.$type). */
  easyApply?: boolean;
}

/**
 * Extract the CSRF token required by LinkedIn's Voyager API.
 *
 * LinkedIn uses the `JSESSIONID` cookie value as the CSRF token.
 * The cookie may be quoted (e.g. `JSESSIONID="ajax:123"`) so we strip quotes.
 */
function getCsrfToken(): string {
  const match = document.cookie.match(/JSESSIONID="?([^";]+)"?/);
  return match?.[1] ?? '';
}

/**
 * Convert a Unix millisecond timestamp to an ISO-8601 date string.
 * Returns undefined for invalid / missing values.
 */
function msToIsoDate(ms: number | null | undefined): string | undefined {
  if (!ms || typeof ms !== 'number' || ms <= 0) return undefined;
  try {
    return new Date(ms).toISOString().split('T')[0]; // "YYYY-MM-DD"
  } catch {
    return undefined;
  }
}

/**
 * Resolve workplace type URNs to a single WorkType label.
 * When multiple types are listed we prefer the most specific one.
 */
function resolveWorkType(urns: string[] | null | undefined): WorkType | undefined {
  if (!Array.isArray(urns) || urns.length === 0) return undefined;
  for (const urn of urns) {
    const mapped = WORKPLACE_TYPE_MAP[urn];
    if (mapped) return mapped;
  }
  return undefined;
}

/**
 * Fetch rich job metadata from LinkedIn's internal Voyager API.
 *
 * @param jobId  The numeric LinkedIn job ID (e.g. "4433016215").
 * @returns      Parsed data on success, `null` on network/auth failure.
 *
 * This call will silently fail (return null) when:
 *  - The user is not logged in (401)
 *  - The job has been removed (404)
 *  - LinkedIn changes the API shape
 *  - Network is unavailable
 *
 * Callers should always fall back to DOM-based extraction when null is returned.
 */
export async function fetchLinkedInJobPosting(jobId: string): Promise<LinkedInJobApiData | null> {
  if (!jobId || !/^\d+$/.test(jobId)) return null;

  const csrfToken = getCsrfToken();
  if (!csrfToken) return null; // Not logged in — no point calling the API

  try {
    const response = await fetch(`/voyager/api/jobs/jobPostings/${jobId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0',
        accept: 'application/vnd.linkedin.normalized+json+2.1',
        'x-li-lang': document.documentElement.lang || 'en_US',
      },
    });

    if (!response.ok) return null;

    const json = await response.json() as Record<string, unknown>;
    // The Voyager normalised response wraps data under a `data` key.
    const data = (json.data ?? json) as Record<string, unknown>;

    // ── listedAt ──────────────────────────────────────────────────────────────
    // `listedAt` is the canonical posting date; `originalListedAt` is used when
    // the job was reposted.  Prefer `originalListedAt` when it differs and is
    // earlier (i.e. the job existed before the repost).
    const listedAtMs = data.listedAt as number | undefined;
    const originalListedAtMs = data.originalListedAt as number | undefined;
    const bestMs =
      originalListedAtMs && originalListedAtMs < (listedAtMs ?? Infinity)
        ? originalListedAtMs
        : listedAtMs;
    const listedAt = msToIsoDate(bestMs);

    // ── workType ──────────────────────────────────────────────────────────────
    const workplaceTypes = data.workplaceTypes as string[] | undefined;
    const workRemoteAllowed = data.workRemoteAllowed as boolean | undefined;
    let workType = resolveWorkType(workplaceTypes);
    // Fallback: if the URN list is missing but workRemoteAllowed is set, infer remote.
    if (!workType && workRemoteAllowed === true) workType = 'remote';
    if (!workType && workRemoteAllowed === false) workType = 'onsite';

    // ── experienceLevel ───────────────────────────────────────────────────────
    const rawLevel = data.formattedExperienceLevel as string | undefined;
    const experienceLevel = rawLevel && rawLevel.trim() ? rawLevel.trim() : undefined;

    // ── location ──────────────────────────────────────────────────────────────
    const location = (data.formattedLocation as string | undefined)?.trim() || undefined;

    // ── industries ────────────────────────────────────────────────────────────
    const formattedIndustries = data.formattedIndustries as string[] | undefined;
    const industries =
      Array.isArray(formattedIndustries) && formattedIndustries.length > 0
        ? formattedIndustries
        : undefined;

    // ── companyDescription ────────────────────────────────────────────────────
    const companyDescObj = data.companyDescription as { text?: string } | undefined;
    const companyDescription = companyDescObj?.text?.trim() || undefined;

    // ── easyApply ─────────────────────────────────────────────────────────────
    const applyMethod = data.applyMethod as { $type?: string } | undefined;
    const easyApply = applyMethod?.$type === 'com.linkedin.voyager.jobs.ComplexOnsiteApply';

    return {
      listedAt,
      workType,
      experienceLevel,
      location,
      industries,
      companyDescription,
      easyApply,
    };
  } catch {
    // Network error, JSON parse failure, etc. — silently fall back to DOM.
    return null;
  }
}
