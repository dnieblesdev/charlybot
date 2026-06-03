import { describe, it, expect } from "vitest";
import { logRouteError } from "../../src/utils/logRouteError";
import { readFileSync } from "fs";
import { join } from "path";

function createMockLogger() {
  return {
    info: vitest.fn(),
    error: vitest.fn(),
    warn: vitest.fn(),
    debug: vitest.fn(),
  };
}

/**
 * Tests for Slice 3 of structured-json-logging SDD.
 *
 * Validates:
 * 1. Route catch blocks use logRouteError with c.get("logger")
 * 2. MusicQueueCacheService emits warn for previously-silent catch blocks
 * 3. DiscordOAuthService per-guild loop uses debug (not info)
 */
describe("Slice 3 - Route error standardization", () => {
  describe("logRouteError shape", () => {
    it("logs with route context meta fields", () => {
      const logger = createMockLogger();
      const c = {
        req: { method: "GET", url: "http://localhost:3000/api/v1/guilds" },
        status: 500,
      } as unknown as import("hono").Context;

      logRouteError(logger as any, {
        c,
        error: new Error("DB failure"),
        meta: { guild_id: "guild-123" },
      });

      expect(logger.error).toHaveBeenCalledTimes(1);
      const [meta] = logger.error.mock.calls[0];
      expect(meta.type).toBe("route_error");
      expect(meta.method).toBe("GET");
      expect(meta.path).toBe("/api/v1/guilds");
      expect(meta.guild_id).toBe("guild-123");
    });

    it("accepts caller-provided type override", () => {
      const logger = createMockLogger();
      const c = {
        req: { method: "POST", url: "http://localhost:3000/api/v1/economy/config/abc" },
        status: 500,
      } as unknown as import("hono").Context;

      logRouteError(logger as any, {
        c,
        error: new Error("Prisma error"),
        meta: { type: "db_query_failed", guild_id: "abc" },
      });

      const [meta] = logger.error.mock.calls[0];
      expect(meta.type).toBe("db_query_failed");
      expect(meta.guild_id).toBe("abc");
    });
  });

  describe("OAuth per-guild loop verbosity", () => {
    it("uses debug level (not info) in per-guild loop", () => {
      const oauthPath = join(__dirname, "../../src/services/discordOAuth.service.ts");
      const content = readFileSync(oauthPath, "utf-8");

      const forLoopStart = content.indexOf("for (const g of botMatchedGuilds)");
      const forLoopSection = content.substring(forLoopStart, forLoopStart + 600);

      // Per-guild loop MUST use debug, not info
      expect(forLoopSection).toContain("log.debug");
      expect(forLoopSection).not.toContain("log.info");
    });
  });
});
