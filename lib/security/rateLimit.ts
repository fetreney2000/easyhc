/**
 * Minimal fixed-window rate limiter (no dependencies, no external store).
 *
 * Scope: it is per Node.js process. On Vercel that means per warm lambda
 * instance, so this is best-effort throttling — enough to slow down a single
 * source hammering login / password-guess / public check-in endpoints, not a
 * substitute for an edge/WAF rule against a distributed attack.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 60 * 1000;

function pruneExpired(now: number): void {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry (0 when ok). */
  retryAfterSeconds: number;
}

/**
 * Count one attempt against `key`. Returns ok:false once `limit` attempts
 * have been made inside `windowMs`.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Clear a key (e.g. after a successful authentication). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Best-effort client IP behind Vercel/nginx. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
