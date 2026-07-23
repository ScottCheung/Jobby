/**
 * Lightweight request deduplication layer.
 *
 * When multiple React components (or hooks) mount simultaneously and call the
 * same API endpoint, this utility ensures that only **one** actual HTTP request
 * is made.  All callers share the same in-flight Promise and receive the same
 * result.
 *
 * A configurable TTL (default 2 000 ms) prevents the same endpoint from being
 * re-fetched within a short window — useful during rapid component mount/unmount
 * cycles and route transitions.
 *
 * Usage:
 *   dedup('interviewQuestions', () => apiRequest('/api/interview/questions'))
 *
 * @format
 */

interface InflightEntry<T = unknown> {
  promise: Promise<T>;
  timestamp: number;
}

const inflight = new Map<string, InflightEntry>();

/**
 * Deduplicate concurrent calls to the same fetcher within a time window.
 *
 * @param key     A stable, unique key that identifies the request (e.g. the API
 *                method name or the URL path).
 * @param fetcher A function that performs the actual request and returns a
 *                Promise.  It is only called if no unexpired entry exists for
 *                the given key.
 * @param ttlMs   How long (in milliseconds) a resolved result may be reused
 *                before a fresh request is allowed.  Defaults to 2 000 ms.
 *                Set to 0 to only deduplicate truly concurrent (in-flight)
 *                requests without any caching.
 */
export function dedup<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 2_000,
): Promise<T> {
  const existing = inflight.get(key) as InflightEntry<T> | undefined;

  if (existing && Date.now() - existing.timestamp < ttlMs) {
    return existing.promise;
  }

  const promise = fetcher().finally(() => {
    // After the TTL elapses, remove the entry so the next call triggers a
    // fresh request.  If `ttlMs` is 0, we clean up on the next microtick.
    const delay = Math.max(0, ttlMs);
    setTimeout(() => {
      const current = inflight.get(key);
      if (current?.promise === promise) {
        inflight.delete(key);
      }
    }, delay);
  });

  inflight.set(key, { promise, timestamp: Date.now() });
  return promise;
}

/**
 * Invalidate a cached/in-flight entry so the next call to `dedup` with the same
 * key will trigger a fresh request.  Useful after mutations (POST/PUT/DELETE)
 * that affect the data a cached GET would return.
 */
export function invalidateDedup(key: string): void {
  inflight.delete(key);
}

/**
 * Invalidate all cached entries.  Useful on logout or full-page refresh
 * scenarios.
 */
export function invalidateAllDedup(): void {
  inflight.clear();
}
