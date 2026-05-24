// Rate Limit Middleware - Valkey-backed fixed window counter
// Simplified: bot no longer calls API via HTTP, only dashboard users

import type { Context, Next } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { getValkeyClient } from "../infrastructure/valkey";
import logger from "../utils/logger";

interface RateLimitOptions {
  windowMs: number;       // fixed window duration (default: 60000)
  maxRequests: number;     // max requests per window (default: 100)
  keyPrefix: string;       // Valkey key prefix (default: "rl")
  maxSize?: number;        // in-memory fallback max entries (default: 10000)
}

const DEFAULT_OPTIONS: Required<RateLimitOptions> = {
  windowMs: 60000,         // 1 minute
  maxRequests: 100,        // 100 requests per minute
  keyPrefix: "rl",
  maxSize: 10000,
};

/**
 * Sanitize and normalize an IP string for use in rate-limit keys.
 * Strips port, limits length, and removes unsafe characters.
 */
function sanitizeIp(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  // Strip surrounding brackets (IPv6) and port
  let ip = raw.trim();
  if (ip.startsWith("[")) {
    const bracketEnd = ip.indexOf("]");
    if (bracketEnd !== -1) {
      ip = ip.slice(1, bracketEnd);
    }
  } else {
    const portIdx = ip.lastIndexOf(":");
    if (portIdx !== -1 && ip.indexOf(":") === portIdx) {
      // IPv4 with port — strip it
      ip = ip.slice(0, portIdx);
    }
  }
  // Reject anything that isn't a reasonable IP or contains unsafe chars
  if (ip.length > 45 || /[^a-fA-F0-9.:]/.test(ip)) {
    return "unknown";
  }
  return ip || "unknown";
}

// In-memory fallback when Valkey is down
class InMemoryRateLimiter {
  private counters = new Map<string, { count: number; windowStart: number }>();
  private options: Required<RateLimitOptions>;

  constructor(options: Required<RateLimitOptions>) {
    this.options = options;
  }

  async checkLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const { windowMs, maxRequests } = this.options;
    const identifier = `user:${ip}`;

    const entry = this.counters.get(identifier);
    if (!entry || now - entry.windowStart >= windowMs) {
      this.counters.set(identifier, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }

    entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);
    const allowed = entry.count <= maxRequests;
    return { allowed, remaining, resetAt: entry.windowStart + windowMs };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.counters) {
      if (now - entry.windowStart >= this.options.windowMs * 2) {
        this.counters.delete(key);
      }
    }
  }

  evictIfNeeded(): void {
    const excess = this.counters.size - (this.options.maxSize ?? 10000);
    if (excess <= 0) return;
    // Evict oldest entries by windowStart
    const sorted = Array.from(this.counters.entries()).sort(
      (a, b) => a[1].windowStart - b[1].windowStart,
    );
    for (let i = 0; i < excess; i++) {
      const entry = sorted[i];
      if (entry) {
        this.counters.delete(entry[0]);
      }
    }
  }
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Derive a stable client identifier for rate limiting.
 * Prefers the actual connection remote address. Only trusts forwarded
 * headers when TRUST_PROXY is explicitly configured.
 */
function deriveIdentifier(c: Context): string {
  // Prefer actual connection info when available
  try {
    const connInfo = getConnInfo(c);
    const remoteAddress = connInfo.remote.address;
    if (remoteAddress) {
      return `user:${sanitizeIp(remoteAddress)}`;
    }
  } catch {
    // getConnInfo may fail if not running under @hono/node-server
  }

  // Only trust forwarded headers when behind a known proxy
  if (process.env.TRUST_PROXY === "1") {
    const forwardedFor = c.req.header("x-forwarded-for");
    const rawIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;
    const ip = rawIp || c.req.header("x-real-ip");
    if (ip) {
      return `user:${sanitizeIp(ip)}`;
    }
  }

  return "user:unknown";
}

export function createRateLimitMiddleware(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const inMemoryLimiter = new InMemoryRateLimiter(opts);

  // Periodic cleanup every 5 minutes — unref'd so it won't keep process alive
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      inMemoryLimiter.cleanup();
    }, 5 * 60 * 1000);
    cleanupTimer.unref();
  }

  return async (c: Context, next: Next) => {
    const identifier = deriveIdentifier(c);
    // Extract raw IP for logging (after sanitization)
    const logIp = identifier.replace("user:", "");

    try {
      const valkey = getValkeyClient();
      const key = `${opts.keyPrefix}:${identifier}`;
      const now = Date.now();

      // Fixed-window counter: INCR then always ensure expiry is set.
      // Calling expire on every request is defensive: if the first request's
      // expire failed (network blip), subsequent requests repair the TTL.
      const currentCount = await valkey.increment(key);
      await valkey.expire(key, Math.ceil(opts.windowMs / 1000));

      // windowStart approximates when this fixed window began.
      // For the first request (count === 1) it's exactly now.
      const windowStart = currentCount === 1 ? now : now; // best-effort; true start is key creation time
      const windowReset = windowStart + opts.windowMs;

      if (currentCount > opts.maxRequests) {
        c.header("Retry-After", Math.ceil(opts.windowMs / 1000).toString());
        c.header("X-RateLimit-Limit", opts.maxRequests.toString());
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", Math.ceil(windowReset / 1000).toString());

        logger.warn(`Rate limit exceeded for ${identifier}`, {
          currentCount,
          maxRequests: opts.maxRequests,
          identifier,
          ip: logIp,
        });

        return c.json({ error: "Too many requests" }, 429);
      }

      c.header("X-RateLimit-Limit", opts.maxRequests.toString());
      c.header("X-RateLimit-Remaining", Math.max(0, opts.maxRequests - currentCount).toString());
      c.header("X-RateLimit-Reset", Math.ceil(windowReset / 1000).toString());

      await next();
    } catch (error) {
      // Log fallback once to avoid log flood during outages
      logger.warn("Rate limiter falling back to in-memory", {
        error: error instanceof Error ? error.message : String(error),
        identifier,
        ip: logIp,
      });

      const result = await inMemoryLimiter.checkLimit(logIp);
      inMemoryLimiter.evictIfNeeded();

      if (!result.allowed) {
        const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
        c.header("Retry-After", retryAfterSec.toString());
        c.header("X-RateLimit-Limit", opts.maxRequests.toString());
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());
        return c.json({ error: "Too many requests" }, 429);
      }

      c.header("X-RateLimit-Limit", opts.maxRequests.toString());
      c.header("X-RateLimit-Remaining", result.remaining.toString());
      c.header("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());

      await next();
    }
  };
}

/**
 * Stop the periodic in-memory cleanup timer.
 * Call during graceful shutdown or tests.
 */
export function stopRateLimitCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// Default rate limit middleware instance
export const rateLimitMiddleware = createRateLimitMiddleware();

export default rateLimitMiddleware;
