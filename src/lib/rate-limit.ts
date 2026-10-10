/**
 * Fixed-window rate limiter kept in process memory.
 *
 * Good enough for a single instance and as a first line of defence on
 * serverless (each warm instance limits independently). For strict global
 * limits across instances, swap the Map for a shared store such as Upstash
 * Redis — the `limit()` signature is designed to stay the same.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function limit(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const ok = bucket.count <= max;
  return {
    ok,
    remaining: Math.max(0, max - bucket.count),
    retryAfterSeconds: ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Named policies so limits live in one place. */
export const POLICIES = {
  auth: { max: 10, windowMs: 60_000 },
  answer: { max: 120, windowMs: 60_000 },
  session: { max: 20, windowMs: 60_000 },
  billing: { max: 10, windowMs: 60_000 },
  admin: { max: 60, windowMs: 60_000 },
  webhook: { max: 300, windowMs: 60_000 },
} as const;

export function resetRateLimits() {
  buckets.clear();
}
