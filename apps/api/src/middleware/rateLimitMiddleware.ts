// Rate Limit Middleware - Valkey-backed sliding window counter
// Follows SDD design: Wave 2

import type { Context, Next } from "hono";
import { getValkeyClient } from "../infrastructure/valkey";
import { safeStringify } from "../utils/logger";
import logger from "../utils/logger";

interface RateLimitOptions {
  windowMs: number;       // sliding window duration (default: 60000)
  maxRequests: number;     // max requests per window (default: 100)
  botMaxRequests: number;  // limit for bot requests (default: 300)
  keyPrefix: string;       // Valkey key prefix (default: "rl")
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60000,         // 1 minute
  maxRequests: 100,        // 100 requests per minute for regular clients
  botMaxRequests: 300,     // 300 requests per minute for bot clients
  keyPrefix: "rl",
};

// In-memory fallback when Valkey is down
class InMemoryRateLimiter {
  private counters = new Map<string, { count: number; windowStart: number }>();
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = options;
  }

  isBotRequest(c: Context): boolean {
    // Bot requests identified by X-Bot-Key header
    const botKey = c.req.header("X-Bot-Key");
    return botKey === process.env.API_KEY;
  }

  async checkLimit(c: Context): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const { windowMs, maxRequests, botMaxRequests } = this.options;
    
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const apiKey = c.req.header("X-API-Key");
    const isBot = apiKey === process.env.API_KEY;
    const identifier = isBot ? `bot:${ip}` : `user:${ip}`;
    const effectiveMax = isBot ? botMaxRequests : maxRequests;
    
    const entry = this.counters.get(identifier);
    
    if (!entry || now - entry.windowStart >= windowMs) {
      // New window
      this.counters.set(identifier, { count: 1, windowStart: now });
      return { allowed: true, remaining: effectiveMax - 1, resetAt: now + windowMs };
    }

    entry.count++;
    const remaining = Math.max(0, effectiveMax - entry.count);
    const allowed = entry.count <= effectiveMax;
    
    return { allowed, remaining, resetAt: entry.windowStart + windowMs };
  }

  // Periodic cleanup of old entries
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
    // Get client identifier (IP + optional API key for bot)
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const apiKey = c.req.header("X-API-Key");
    const isBot = apiKey === process.env.API_KEY;
    const identifier = isBot ? `bot:${ip}` : `user:${ip}`;
    const maxRequests = isBot ? opts.botMaxRequests : opts.maxRequests;

    try {
      const valkey = getValkeyClient();
      const key = `${opts.keyPrefix}:${identifier}`;
      const now = Date.now();
      const windowStart = now - opts.windowMs;

      // Use sliding window counter with Valkey
      // 1. Remove old entries outside the window
      await valkey.sortedSetRemoveByScore(key, windowStart);
      
      // 2. Count current requests in window
      const entries = await valkey.sortedSetRangeByScore(key, windowStart, now);
      const currentCount = entries.length;
      
      // 3. Check limit
      if (currentCount >= maxRequests) {
        // Oldest entry is the first since entries are sorted by score (timestamp)
        const oldestEntry = entries.length > 0 ? parseInt(entries[0]) : now;
        const resetAt = oldestEntry + opts.windowMs;
        
        c.header("Retry-After", Math.ceil((resetAt - now) / 1000).toString());
        c.header("X-RateLimit-Limit", maxRequests.toString());
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", resetAt.toString());
        
        logger.warn(`Rate limit exceeded for ${identifier}`, {
          currentCount,
          maxRequests,
          identifier,
        });
        
        return c.json({ error: "Too many requests" }, 429);
      }

      // 4. Add current request to window (score = timestamp, member = timestamp)
      await valkey.sortedSetAdd(key, now, `${now}`);

      // 5. Set headers
      c.header("X-RateLimit-Limit", maxRequests.toString());
      c.header("X-RateLimit-Remaining", Math.max(0, maxRequests - currentCount - 1).toString());
      c.header("X-RateLimit-Reset", (now + opts.windowMs).toString());

      await next();
    } catch (error) {
      // Valkey unavailable - fall back to in-memory
      logger.warn("Rate limiter falling back to in-memory", {
        error: error instanceof Error ? error.message : String(error),
      });

      const result = await inMemoryLimiter.checkLimit(c);
      
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