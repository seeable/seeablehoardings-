/**
 * Rate-limit SCAFFOLD — api-specification.md §33.7, IMPLEMENTATION-PLAN.md §Phase 3.
 *
 * In-memory token bucket keyed by user id (or client IP for anonymous calls).
 * This is deliberately minimal:
 *   - it works for local dev and a single Worker isolate;
 *   - it is NOT a durable limiter — Cloudflare runs many ephemeral isolates, so
 *     a determined caller can exceed the limit N-fold.
 * Phase 11 replaces the store with Cloudflare KV / a Durable Object (or
 * Cloudflare's built-in rate-limiting rules) and sets the real per-endpoint
 * numbers. The call site and the `RATE_LIMITED` + `Retry-After` contract do not
 * change when that happens.
 */
import { ApiError } from "@/lib/api/errors";

interface Bucket {
  tokens: number;
  updated: number; // ms epoch
}

const buckets = new Map<string, Bucket>();

export interface RateLimit {
  /** Sustained requests per minute. */
  perMinute: number;
  /** Burst allowance (max tokens). Defaults to `perMinute`. */
  burst?: number;
}

/**
 * Consume one token for `key` under `limit`. Throws `429 RATE_LIMITED` with a
 * `Retry-After` (seconds) in `details` when the bucket is empty.
 */
export function consume(key: string, limit: RateLimit): void {
  const now = Date.now();
  const capacity = limit.burst ?? limit.perMinute;
  const refillPerMs = limit.perMinute / 60_000;

  const b = buckets.get(key) ?? { tokens: capacity, updated: now };
  b.tokens = Math.min(capacity, b.tokens + (now - b.updated) * refillPerMs);
  b.updated = now;

  if (b.tokens < 1) {
    const retryAfter = Math.ceil((1 - b.tokens) / refillPerMs / 1000);
    buckets.set(key, b);
    throw new ApiError(
      "RATE_LIMITED",
      "Too many requests. Please slow down.",
      429,
      { retry_after_seconds: Math.max(1, retryAfter) },
    );
  }

  b.tokens -= 1;
  buckets.set(key, b);
}

/** Test/ops helper — wipe all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
