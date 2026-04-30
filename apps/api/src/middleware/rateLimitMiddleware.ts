// Rate Limit Middleware - Valkey-backed sliding window counter
// Simplified: bot no longer calls API via HTTP, only dashboard users

import type { Context, Next } from "hono";
import { getValkeyClient } from "../infrastructure/valkey";
import logger from "../utils/logger";

interface RateLimitOptions {
  windowMs: number;       // sliding window duration (default: 60000)
  maxRequests: number;     // max requests per window (default: 100)
  keyPrefix: string;       // Valkey key prefix (default: "rl")
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60000,         // 1 minute
  maxRequests: 100,        // 100 requests per minute
  keyPrefix: "rl",
};

// In-memory fallback when Valkey is down
class InMemoryRateLimiter {
  private counters = new Map<string, { count: number; windowStart: number }>();
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
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
}

const inMemoryLimiter = new InMemoryRateLimiter(DEFAULT_OPTIONS);

// Periodic cleanup every 5 minutes
setInterval(() => {
  inMemoryLimiter.cleanup();
}, 5 * 60 * 1000);

export function createRateLimitMiddleware(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (c: Context, next: Next) => {
    // Parse first IP from x-forwarded-for to avoid spoofing via comma-separated values
    const forwardedFor = c.req.header("x-forwarded-for");
    const rawIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;
    const ip = rawIp || c.req.header("x-real-ip") || "unknown";
    const identifier = `user:${ip}`;

    try {
      const valkey = getValkeyClient();
      const key = `${opts.keyPrefix}:${identifier}`;
      const now = Date.now();

      // Increment-based counter with expiry — O(1) instead of O(n) full scan
      const currentCount = await valkey.increment(key);
      if (currentCount === 1) {
        // First request in this window — set expiry
        await valkey.expire(key, Math.ceil(opts.windowMs / 1000));
      }

      const windowReset = now + opts.windowMs;

      if (currentCount > opts.maxRequests) {
        c.header("Retry-After", Math.ceil(opts.windowMs / 1000).toString());
        c.header("X-RateLimit-Limit", opts.maxRequests.toString());
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", windowReset.toString());

        logger.warn(`Rate limit exceeded for ${identifier}`, {
          currentCount,
          maxRequests: opts.maxRequests,
          identifier,
        });

        return c.json({ error: "Too many requests" }, 429);
      }

      c.header("X-RateLimit-Limit", opts.maxRequests.toString());
      c.header("X-RateLimit-Remaining", Math.max(0, opts.maxRequests - currentCount).toString());
      c.header("X-RateLimit-Reset", windowReset.toString());

      await next();
    } catch (error) {
      logger.warn("Rate limiter falling back to in-memory", {
        error: error instanceof Error ? error.message : String(error),
      });

      const result = await inMemoryLimiter.checkLimit(ip);

      if (!result.allowed) {
        c.header("Retry-After", Math.ceil((result.resetAt - Date.now()) / 1000).toString());
        return c.json({ error: "Too many requests" }, 429);
      }

      await next();
    }
  };
}

// Default rate limit middleware instance
export const rateLimitMiddleware = createRateLimitMiddleware();

export default rateLimitMiddleware;
